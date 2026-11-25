-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_phase36_2_custody_integrity.sql
-- Rakshak v3.0 — Phase 36.2 Custody Chain Sequence & Integrity Hardening
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Ensure any partial index is upgraded to a total unique constraint on (evidenceId, sequenceNumber)
DROP INDEX IF EXISTS "CustodyEvent_evidence_seq_unique_idx";

CREATE UNIQUE INDEX "CustodyEvent_evidence_seq_unique_idx"
  ON "CustodyEvent"("evidenceId", "sequenceNumber");

-- 2. Database-level CHECK constraints to prevent missing, empty, or malformed hashes
ALTER TABLE "CustodyEvent"
  DROP CONSTRAINT IF EXISTS "CustodyEvent_eventHash_check",
  ADD CONSTRAINT "CustodyEvent_eventHash_check"
    CHECK ("eventHash" IS NOT NULL AND length("eventHash") = 64 AND "eventHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "CustodyEvent"
  DROP CONSTRAINT IF EXISTS "CustodyEvent_prevEventHash_check",
  ADD CONSTRAINT "CustodyEvent_prevEventHash_check"
    CHECK ("prevEventHash" IS NOT NULL AND length("prevEventHash") = 64 AND "prevEventHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "CustodyEvent"
  DROP CONSTRAINT IF EXISTS "CustodyEvent_sequenceNumber_check",
  ADD CONSTRAINT "CustodyEvent_sequenceNumber_check"
    CHECK ("sequenceNumber" IS NOT NULL AND "sequenceNumber" >= 1);

-- 3. Verify and maintain strict append-only permissions for runtime application role
GRANT SELECT, INSERT ON "CustodyEvent" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;

-- 4. Re-affirm RLS enforcement
ALTER TABLE "CustodyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustodyEvent" FORCE ROW LEVEL SECURITY;

COMMIT;
