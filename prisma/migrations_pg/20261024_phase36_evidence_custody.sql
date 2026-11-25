-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_phase36_evidence_custody.sql
-- Rakshak v3.0 — Phase 36 Evidence Lifecycle, Chain of Custody & Immutability Hardening
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Non-destructively add lifecycle columns to Evidence
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "status" VARCHAR(64) NOT NULL DEFAULT 'ACCEPTED';
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "currentCustodianId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "examinerId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "quarantineReason" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "sealedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- 2. Non-destructively add cryptographic chaining columns to CustodyEvent
ALTER TABLE "CustodyEvent" ADD COLUMN IF NOT EXISTS "prevEventHash" TEXT;
ALTER TABLE "CustodyEvent" ADD COLUMN IF NOT EXISTS "eventHash" TEXT;
ALTER TABLE "CustodyEvent" ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER DEFAULT 1;

-- 3. Create indices for performance and integrity verification
CREATE INDEX IF NOT EXISTS "Evidence_status_idx" ON "Evidence"("status");
CREATE INDEX IF NOT EXISTS "Evidence_currentCustodianId_idx" ON "Evidence"("currentCustodianId");
CREATE INDEX IF NOT EXISTS "CustodyEvent_sequenceNumber_idx" ON "CustodyEvent"("evidenceId", "sequenceNumber");

-- 4. Database-level immutability for CustodyEvent:
-- rakshak_app_user can SELECT and INSERT (append-only), but NEVER UPDATE or DELETE
GRANT SELECT, INSERT ON "CustodyEvent" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;

-- Also protect Evidence from truncation
REVOKE TRUNCATE ON "Evidence" FROM rakshak_app_user;

-- 5. Row-Level Security: Ensure RLS is enabled and forced
ALTER TABLE "Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidence" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CustodyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustodyEvent" FORCE ROW LEVEL SECURITY;

-- 5B. Helper function to retrieve verified officer ID from verified session context
CREATE OR REPLACE FUNCTION public.get_verified_officer_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'private_auth', 'pg_temp'
AS $$
DECLARE
    v_officer TEXT;
BEGIN
    SELECT officer_id INTO v_officer
    FROM private_auth.session_context
    WHERE backend_pid = pg_backend_pid()
      AND expires_at > NOW();

    RETURN v_officer;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_verified_officer_id() TO rakshak_app_user, rakshak_admin_user;

-- 5C. Refine Case RLS Policy to support active AccessGrants
DROP POLICY IF EXISTS "p_case_tenant_isolation" ON "Case";
CREATE POLICY "p_case_tenant_isolation" ON "Case"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
    OR
    EXISTS (
      SELECT 1 FROM "AccessGrant" ag
      WHERE (ag."targetCaseId" = "Case".id OR ag."targetDepartmentId" = "Case"."departmentId")
        AND ag."granteeOfficerId" = get_verified_officer_id()
        AND ag."status" = 'ACTIVE'
        AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
    )
  )
  WITH CHECK (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  );

-- 6. Refine Evidence RLS Policy to support active AccessGrants
DROP POLICY IF EXISTS "p_evidence_tenant_isolation" ON "Evidence";
CREATE POLICY "p_evidence_tenant_isolation" ON "Evidence"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  )
  WITH CHECK (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  );

-- 7. Refine CustodyEvent RLS Policy with active AccessGrant support
DROP POLICY IF EXISTS "p_custody_tenant_isolation" ON "CustodyEvent";
CREATE POLICY "p_custody_tenant_isolation" ON "CustodyEvent"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Evidence" e
      JOIN "Case" c ON c.id = e."caseId"
      WHERE e.id = "CustodyEvent"."evidenceId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  )
  WITH CHECK (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Evidence" e
      JOIN "Case" c ON c.id = e."caseId"
      WHERE e.id = "CustodyEvent"."evidenceId"
        AND (
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
          OR
          EXISTS (
            SELECT 1 FROM "AccessGrant" ag
            WHERE (ag."targetCaseId" = c.id OR ag."targetDepartmentId" = c."departmentId")
              AND ag."granteeOfficerId" = get_verified_officer_id()
              AND ag."status" = 'ACTIVE'
              AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          )
        )
    )
  );

COMMIT;
