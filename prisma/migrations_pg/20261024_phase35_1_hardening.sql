-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_phase35_1_hardening.sql
-- Rakshak v3.0 — Phase 35.1 History & Audit Immutability Hardening
-- Enforces:
-- 1. Explicit revocation of UPDATE and DELETE on AuditLog from rakshak_app_user
-- 2. Explicit revocation of UPDATE and DELETE on CaseStatusHistory from rakshak_app_user
-- 3. Explicit revocation of DELETE on CaseAssignmentHistory from rakshak_app_user
-- 4. Kernel-enforced RLS & FORCE RLS on CaseAssignmentHistory, CaseStatusHistory, Case, AccessGrant
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Ensure RLS and FORCE RLS on history and audit tables
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CaseStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseStatusHistory" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CaseAssignmentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseAssignmentHistory" FORCE ROW LEVEL SECURITY;

ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Case" FORCE ROW LEVEL SECURITY;

-- 2. Revoke destructive privileges on AuditLog from runtime app user
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM rakshak_app_user;
GRANT SELECT, INSERT ON TABLE "AuditLog" TO rakshak_app_user;

-- 3. Revoke destructive privileges on CaseStatusHistory from runtime app user (Append-only)
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "CaseStatusHistory" FROM rakshak_app_user;
GRANT SELECT, INSERT ON TABLE "CaseStatusHistory" TO rakshak_app_user;

-- 4. Revoke DELETE on CaseAssignmentHistory from runtime app user (Lifecycle via status/endedAt only)
REVOKE DELETE, TRUNCATE ON TABLE "CaseAssignmentHistory" FROM rakshak_app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "CaseAssignmentHistory" TO rakshak_app_user;

-- 5. Admin role retains administrative maintenance permissions
GRANT ALL ON TABLE "AuditLog" TO rakshak_admin_user;
GRANT ALL ON TABLE "CaseStatusHistory" TO rakshak_admin_user;
GRANT ALL ON TABLE "CaseAssignmentHistory" TO rakshak_admin_user;

COMMIT;
