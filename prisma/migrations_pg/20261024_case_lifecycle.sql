-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_case_lifecycle.sql
-- Rakshak v3.0 — Phase 35 Case Lifecycle, Officer Assignment & RLS Isolation
-- Compatible with PostgreSQL 16
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS "CaseAssignmentHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "caseId" TEXT NOT NULL,
  "officerId" TEXT,
  "officerName" TEXT NOT NULL,
  "officerBadge" TEXT NOT NULL,
  "departmentId" TEXT,
  "assignedById" TEXT NOT NULL,
  "assignedByName" TEXT NOT NULL,
  "assignedByBadge" TEXT,
  "assignmentType" TEXT NOT NULL DEFAULT 'PRIMARY',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "CaseAssignmentHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_caseId_idx" ON "CaseAssignmentHistory"("caseId");
CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_officerId_idx" ON "CaseAssignmentHistory"("officerId");
CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_departmentId_idx" ON "CaseAssignmentHistory"("departmentId");
CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_assignedAt_idx" ON "CaseAssignmentHistory"("assignedAt");

CREATE TABLE IF NOT EXISTS "CaseStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "caseId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "changedByName" TEXT NOT NULL,
  "changedByBadge" TEXT,
  "departmentId" TEXT,
  "reason" TEXT,
  "approvedBy" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CaseStatusHistory_caseId_idx" ON "CaseStatusHistory"("caseId");
CREATE INDEX IF NOT EXISTS "CaseStatusHistory_departmentId_idx" ON "CaseStatusHistory"("departmentId");
CREATE INDEX IF NOT EXISTS "CaseStatusHistory_changedAt_idx" ON "CaseStatusHistory"("changedAt");

-- Enable & force Row Level Security
ALTER TABLE "CaseAssignmentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseAssignmentHistory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CaseStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseStatusHistory" FORCE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON TABLE "CaseAssignmentHistory" TO rakshak_app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "CaseStatusHistory" TO rakshak_app_user;
GRANT ALL ON TABLE "CaseAssignmentHistory" TO rakshak_admin_user;
GRANT ALL ON TABLE "CaseStatusHistory" TO rakshak_admin_user;

-- Hardened RLS policies matching verified tenant context
DROP POLICY IF EXISTS "case_assignment_history_tenant_isolation" ON "CaseAssignmentHistory";
CREATE POLICY "case_assignment_history_tenant_isolation" ON "CaseAssignmentHistory"
  FOR ALL
  TO PUBLIC
  USING (
    is_verified_platform_admin()
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  )
  WITH CHECK (
    is_verified_platform_admin()
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  );

DROP POLICY IF EXISTS "case_status_history_tenant_isolation" ON "CaseStatusHistory";
CREATE POLICY "case_status_history_tenant_isolation" ON "CaseStatusHistory"
  FOR ALL
  TO PUBLIC
  USING (
    is_verified_platform_admin()
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  )
  WITH CHECK (
    is_verified_platform_admin()
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  );

COMMIT;
