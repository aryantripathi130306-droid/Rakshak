-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations/20261024180000_phase35_case_lifecycle/migration.sql
-- Rakshak v3.0 — Phase 35 Case Lifecycle & Officer Assignment Schema Migration
-- Compatible with SQLite
-- ─────────────────────────────────────────────────────────────────────────────

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
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
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
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CaseStatusHistory_caseId_idx" ON "CaseStatusHistory"("caseId");
CREATE INDEX IF NOT EXISTS "CaseStatusHistory_departmentId_idx" ON "CaseStatusHistory"("departmentId");
CREATE INDEX IF NOT EXISTS "CaseStatusHistory_changedAt_idx" ON "CaseStatusHistory"("changedAt");
