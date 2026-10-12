-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261011_rls_tenant_isolation.sql
-- Rakshak v3.0 — Phase 24 Hardened PostgreSQL Row-Level Security (RLS) Architecture
--
-- Defense-in-depth database-level tenant isolation and privilege escalation prevention.
-- Mitigates self-asserted platform admin escalation, arbitrary department switching,
-- search-path injection, and connection pool tenant leakage.
--
-- STATUS: HARDENED PRODUCTION SPECIFICATION & REVERSIBLE DDL MIGRATION
-- RUNTIME EXECUTION ON LOCAL DEV HOST: UNVERIFIED / BLOCKED (Port 5432 Offline)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Database Role Architecture ────────────────────────────────────────────

-- 1A. Platform Admin Role Group
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_admin_role') THEN
    CREATE ROLE rakshak_admin_role NOLOGIN;
  END IF;
END
$$;

-- 1B. Schema Migrator / Table Owner Role (Inherits Admin Role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_migrator') THEN
    CREATE ROLE rakshak_migrator WITH LOGIN PASSWORD 'change_me_in_vault' IN ROLE rakshak_admin_role;
  END IF;
END
$$;

-- 1C. Platform Administrative Connection Pool Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_admin_user') THEN
    CREATE ROLE rakshak_admin_user WITH LOGIN PASSWORD 'change_me_in_vault' IN ROLE rakshak_admin_role;
  END IF;
END
$$;

-- 1D. Least-Privilege Departmental Application Runtime Role (NOBYPASSRLS, NOT IN ADMIN ROLE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_app_user') THEN
    CREATE ROLE rakshak_app_user WITH LOGIN PASSWORD 'change_me_in_vault';
  END IF;
END
$$;

-- 1E. Isolated Test Administration Role (NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_test_admin') THEN
    CREATE ROLE rakshak_test_admin WITH LOGIN PASSWORD 'change_me_in_vault';
  END IF;
END
$$;

-- Ensure application and test roles CANNOT bypass RLS under any circumstances
ALTER ROLE rakshak_app_user NOBYPASSRLS;
ALTER ROLE rakshak_test_admin NOBYPASSRLS;
ALTER ROLE rakshak_admin_user NOBYPASSRLS;

-- Grant schema usage and standard DML privileges to application roles
GRANT USAGE ON SCHEMA public TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin;

-- ── 2. Hardened Tenant-Context Management Functions ──────────────────────────

-- 2A. Departmental Context Setter (Callable by rakshak_app_user)
-- Explicitly forces app.is_platform_admin = 'false' to prevent self-elevation.
CREATE OR REPLACE FUNCTION set_department_context(
  p_department_id TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_department_id IS NOT NULL AND length(trim(p_department_id)) > 0 THEN
    PERFORM set_config('app.current_department_id', trim(p_department_id), true); -- true = is_local to transaction
  ELSE
    PERFORM set_config('app.current_department_id', '', true);
  END IF;

  -- Guarantee that ordinary departmental callers can NEVER self-elevate to admin
  PERFORM set_config('app.is_platform_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2B. Authenticated Officer Context Setter with Department Membership Validation
CREATE OR REPLACE FUNCTION set_authenticated_tenant_context(
  p_officer_id TEXT,
  p_department_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_assigned_dept TEXT;
  v_status TEXT;
BEGIN
  IF p_officer_id IS NULL OR length(trim(p_officer_id)) = 0 THEN
    RAISE EXCEPTION 'Access Denied: Officer identity required for tenant context initialization';
  END IF;

  -- Query assigned department directly from Officer table
  SELECT "departmentId", "status" INTO v_assigned_dept, v_status
  FROM "Officer"
  WHERE "id" = trim(p_officer_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: Officer record not found (%)', p_officer_id;
  END IF;

  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Access Denied: Officer account is inactive or suspended (%)', p_officer_id;
  END IF;

  -- Verify officer belongs to requested department
  IF p_department_id IS NOT NULL AND length(trim(p_department_id)) > 0 THEN
    IF v_assigned_dept IS NULL OR v_assigned_dept <> trim(p_department_id) THEN
      RAISE EXCEPTION 'Access Denied: Officer is not assigned to target department (%)', p_department_id;
    END IF;
    PERFORM set_config('app.current_department_id', trim(p_department_id), true);
  ELSE
    PERFORM set_config('app.current_department_id', '', true);
  END IF;

  PERFORM set_config('app.is_platform_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2C. Dedicated Platform Admin Context Setter (RESTRICTED TO ADMIN ROLES ONLY)
CREATE OR REPLACE FUNCTION set_platform_admin_context() RETURNS VOID AS $$
BEGIN
  -- Strict role verification: caller must belong to rakshak_admin_role
  IF NOT (
    pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
    OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
  ) THEN
    RAISE EXCEPTION 'Access Denied: Role % is not authorized to assert platform administrator context', CURRENT_USER;
  END IF;

  PERFORM set_config('app.is_platform_admin', 'true', true);
  PERFORM set_config('app.current_department_id', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2D. Clear Tenant Context (For connection pooling reset)
CREATE OR REPLACE FUNCTION clear_tenant_context() RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_department_id', '', true);
  PERFORM set_config('app.is_platform_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execution from PUBLIC to prevent unauthorized invocation
REVOKE EXECUTE ON FUNCTION set_department_context(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_authenticated_tenant_context(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_platform_admin_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clear_tenant_context() FROM PUBLIC;

-- Grant departmental context setters to application roles
GRANT EXECUTE ON FUNCTION set_department_context(TEXT) TO rakshak_app_user, rakshak_test_admin;
GRANT EXECUTE ON FUNCTION set_authenticated_tenant_context(TEXT, TEXT) TO rakshak_app_user, rakshak_test_admin;
GRANT EXECUTE ON FUNCTION clear_tenant_context() TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin;

-- Grant admin context setter STRICTLY to administrative roles
GRANT EXECUTE ON FUNCTION set_platform_admin_context() TO rakshak_admin_user, rakshak_migrator;

-- ── 3. Table-by-Table Row-Level Security Policies (Hardened) ─────────────────

-- Helper predicate: Platform Admin requires BOTH setting='true' AND authenticated admin database role
-- (CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator') OR pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER'))

-- 3A. Case Table RLS
ALTER TABLE "Case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Case" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_case_tenant_isolation ON "Case";
CREATE POLICY p_case_tenant_isolation ON "Case"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    (
      "departmentId" IS NOT NULL
      AND NULLIF(current_setting('app.current_department_id', true), '') IS NOT NULL
      AND "departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    (
      "departmentId" IS NOT NULL
      AND "departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3B. Evidence Table RLS
ALTER TABLE "Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidence" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_evidence_tenant_isolation ON "Evidence";
CREATE POLICY p_evidence_tenant_isolation ON "Evidence"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3C. ExtractedFact Table RLS
ALTER TABLE "ExtractedFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedFact" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_fact_tenant_isolation ON "ExtractedFact";
CREATE POLICY p_fact_tenant_isolation ON "ExtractedFact"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "ExtractedFact"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "ExtractedFact"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3D. CaseEntity Table RLS (Extracted suspect identifiers)
ALTER TABLE "CaseEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseEntity" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_caseentity_tenant_isolation ON "CaseEntity";
CREATE POLICY p_caseentity_tenant_isolation ON "CaseEntity"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "CaseEntity"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "CaseEntity"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3E. CustodyEvent Table RLS
ALTER TABLE "CustodyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustodyEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_custody_tenant_isolation ON "CustodyEvent";
CREATE POLICY p_custody_tenant_isolation ON "CustodyEvent"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Evidence" e
      JOIN "Case" c ON c.id = e."caseId"
      WHERE e.id = "CustodyEvent"."evidenceId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Evidence" e
      JOIN "Case" c ON c.id = e."caseId"
      WHERE e.id = "CustodyEvent"."evidenceId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3F. TimelineEvent Table RLS
ALTER TABLE "TimelineEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimelineEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_timeline_tenant_isolation ON "TimelineEvent";
CREATE POLICY p_timeline_tenant_isolation ON "TimelineEvent"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "TimelineEvent"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "TimelineEvent"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3G. GeneratedReport Table RLS
ALTER TABLE "GeneratedReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedReport" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_report_tenant_isolation ON "GeneratedReport";
CREATE POLICY p_report_tenant_isolation ON "GeneratedReport"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    (
      "caseId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "Case" c
        WHERE c.id = "GeneratedReport"."caseId"
          AND c."departmentId" IS NOT NULL
          AND c."departmentId" = current_setting('app.current_department_id', true)
      )
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    (
      "caseId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "Case" c
        WHERE c.id = "GeneratedReport"."caseId"
          AND c."departmentId" IS NOT NULL
          AND c."departmentId" = current_setting('app.current_department_id', true)
      )
    )
  );

-- 3H. Legal Mappings & Dossier Audit Tables RLS
ALTER TABLE "CaseLegalMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseLegalMapping" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_legal_tenant_isolation ON "CaseLegalMapping";
CREATE POLICY p_legal_tenant_isolation ON "CaseLegalMapping"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "CaseLegalMapping"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "CaseLegalMapping"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

ALTER TABLE "DossierExportAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DossierExportAudit" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_dossier_tenant_isolation ON "DossierExportAudit";
CREATE POLICY p_dossier_tenant_isolation ON "DossierExportAudit"
  AS PERMISSIVE
  FOR ALL
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "DossierExportAudit"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
      AND (
        pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
        OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "DossierExportAudit"."caseId"
        AND c."departmentId" IS NOT NULL
        AND c."departmentId" = current_setting('app.current_department_id', true)
    )
  );

-- 3I. AuditLog Table Protection
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_auditlog_insert ON "AuditLog";
CREATE POLICY p_auditlog_insert ON "AuditLog"
  FOR INSERT
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  WITH CHECK (true); -- Append-only logging is always permitted

DROP POLICY IF EXISTS p_auditlog_select ON "AuditLog";
CREATE POLICY p_auditlog_select ON "AuditLog"
  FOR SELECT
  TO rakshak_app_user, rakshak_admin_user, rakshak_test_admin
  USING (
    -- Only platform administrators with active admin role may read raw cross-tenant audit traces
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    AND (
      pg_has_role(CURRENT_USER, 'rakshak_admin_role', 'MEMBER')
      OR CURRENT_USER IN ('rakshak_admin_user', 'rakshak_migrator')
    )
  );

COMMIT;
