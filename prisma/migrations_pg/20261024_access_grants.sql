-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_access_grants.sql
-- Rakshak v3.0 — Phase 33 PostgreSQL DDL & RLS Policy for Access Grants
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS "AccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "granteeOfficerId" TEXT,
    "granteeDepartmentId" TEXT NOT NULL,
    "targetDepartmentId" TEXT NOT NULL,
    "targetCaseId" TEXT,
    "scope" TEXT NOT NULL,
    "grantedByOfficerId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByOfficerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessGrant_granteeOfficerId_fkey" FOREIGN KEY ("granteeOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_granteeDepartmentId_fkey" FOREIGN KEY ("granteeDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetCaseId_fkey" FOREIGN KEY ("targetCaseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_grantedByOfficerId_fkey" FOREIGN KEY ("grantedByOfficerId") REFERENCES "Officer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_revokedByOfficerId_fkey" FOREIGN KEY ("revokedByOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AccessGrant_granteeOfficerId_idx" ON "AccessGrant"("granteeOfficerId");
CREATE INDEX IF NOT EXISTS "AccessGrant_granteeDepartmentId_idx" ON "AccessGrant"("granteeDepartmentId");
CREATE INDEX IF NOT EXISTS "AccessGrant_targetDepartmentId_idx" ON "AccessGrant"("targetDepartmentId");
CREATE INDEX IF NOT EXISTS "AccessGrant_targetCaseId_idx" ON "AccessGrant"("targetCaseId");
CREATE INDEX IF NOT EXISTS "AccessGrant_status_idx" ON "AccessGrant"("status");
CREATE INDEX IF NOT EXISTS "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");

-- Grant permissions to application roles
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON "AccessGrant" TO rakshak_app_user;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'rakshak_admin_user') THEN
    GRANT ALL PRIVILEGES ON "AccessGrant" TO rakshak_admin_user;
  END IF;
END
$$;

-- Enable Row-Level Security
ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" FORCE ROW LEVEL SECURITY;

-- Department tenant isolation policy:
-- App users can view grants where their department is the source (grantee) or the target department.
DROP POLICY IF EXISTS "access_grant_department_isolation" ON "AccessGrant";
CREATE POLICY "access_grant_department_isolation" ON "AccessGrant"
  FOR ALL
  TO PUBLIC
  USING (
    (pg_has_role(SESSION_USER, 'rakshak_admin_role', 'MEMBER') AND current_setting('app.is_platform_admin', true) = 'true')
    OR
    ("granteeDepartmentId" = current_setting('app.current_department_id', true))
    OR
    ("targetDepartmentId" = current_setting('app.current_department_id', true))
  )
  WITH CHECK (
    (pg_has_role(SESSION_USER, 'rakshak_admin_role', 'MEMBER') AND current_setting('app.is_platform_admin', true) = 'true')
    OR
    ("targetDepartmentId" = current_setting('app.current_department_id', true))
  );

COMMIT;
