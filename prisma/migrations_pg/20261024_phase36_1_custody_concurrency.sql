-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_phase36_1_custody_concurrency.sql
-- Rakshak v3.0 — Phase 36.1 Custody Chain Concurrency & Uniqueness Hardening
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Database-level partial unique index to strictly forbid duplicate sequence numbers
-- on any chained custody event per evidence exhibit.
CREATE UNIQUE INDEX IF NOT EXISTS "CustodyEvent_evidence_seq_unique_idx"
  ON "CustodyEvent"("evidenceId", "sequenceNumber")
  WHERE "eventHash" IS NOT NULL;

-- 2. Verify and enforce immutability privileges for application runtime role
GRANT SELECT, INSERT ON "CustodyEvent" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;

-- 3. Ensure Row-Level Security remains strictly enabled and forced
ALTER TABLE "CustodyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustodyEvent" FORCE ROW LEVEL SECURITY;

COMMIT;
