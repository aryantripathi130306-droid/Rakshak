# RAKSHAK v3.0 — PHASE 36.2 HASH AND SEQUENCE INTEGRITY REPORT
## Mandatory Event Digest Coverage, PostgreSQL Constraints & Historical Record Parity

**Document Version:** 1.0  
**Phase Target:** Phase 36.2 — Cryptographic Sequence & Digest Hardening  
**Target Database:** `rakshak_phase36_2_test` on PostgreSQL 16.4  
**Audit Status:** COMPLETE — All Constraints Enforced & Adversarial Invariants Verified  

---

### 1. Executive Summary

Phase 36.2 hardens the database kernel against invalid, empty, or un-hashed custody event rows. In Phase 36.1, a partial unique index was created (`WHERE "eventHash" IS NOT NULL`) to accommodate legacy un-hashed test fixtures in SQLite development environments. Phase 36.2 evaluates this boundary, proves that the database cannot accept newly appended custody events with missing, empty, or malformed hashes, upgrades the sequence constraint to a total unique index in PostgreSQL, and establishes a safe, non-destructive reconciliation strategy for historical development records.

---

### 2. Complete Event-Field Inventory & Canonicalization Format

Every custody event persisted in the relational ledger is hashed using deterministic canonicalization.

#### 2.1 Supported Canonicalization Formats

| Version Tag | Architecture | Canonical Payload Structure | Fields Covered |
| :--- | :--- | :--- | :--- |
| **`v1`** | Phase 36 Baseline | Pipe-delimited string: `evidenceId\|sequenceNumber\|eventType\|actor\|action\|result\|timestamp\|prevEventHash\|canonicalDetails` | 9 primary fields |
| **`v2`** | Phase 36.1+ Hardened | Lexicographically sorted canonical JSON envelope (whitespace-normalized, UTC ISO-8601 timestamps, sorted keys, null-safe) | **11 core fields + 10 structured metadata fields** |

#### 2.2 Complete V2 Event Envelope Inventory

The canonical SHA-256 digest protects all security-relevant fields:
```json
{
  "action": "Human-readable action description",
  "actor": "Server-verified actor name and badge string",
  "canonicalVersion": "v2",
  "details": {
    "actorDepartmentId": "Authoritative server-side department ID",
    "actorId": "Authoritative server-side officer ID",
    "actorRole": "INVESTIGATING_OFFICER | SUPERVISOR | FORENSIC_EXAMINER | ADMIN",
    "approvalRef": "Supervisory approval ID (if applicable)",
    "caseId": "Parent case identifier",
    "caseNumber": "Official FIR or preliminary inquiry reference",
    "derivedArtifactId": "Forensic derived artifact identifier (if applicable)",
    "evidenceHash": "Source evidence binary SHA-256 at intake",
    "fromStatus": "Lifecycle status prior to transition",
    "newCustodianId": "Designated transferee officer ID",
    "previousCustodianId": "Transferor officer ID",
    "reason": "Mandatory justification or operational note",
    "sourceHash": "Source evidence SHA-256 linked for forensic derivations",
    "toStatus": "Lifecycle status resulting from transition"
  },
  "eventId": "Unique UUID primary key",
  "evidenceId": "Target evidence exhibit UUID",
  "eventType": "Canonical enum (INTAKE_UPLOAD, HASH_VERIFIED, CUSTODY_TRANSFER, etc.)",
  "prevEventHash": "64-character lowercase hex digest of preceding event",
  "result": "SUCCESS | VERIFIED | FAILED | WARNING",
  "sequenceNumber": 1,
  "timestamp": "2026-10-24T12:00:00.000Z"
}
```

---

### 3. Database-Level Schema Constraints (`CustodyEvent`)

The migration `prisma/migrations_pg/20261024_phase36_2_custody_integrity.sql` was authored and applied to `rakshak_phase36_2_test`:

```sql
BEGIN;

-- 1. Upgrade sequence index to total unique constraint
DROP INDEX IF EXISTS "CustodyEvent_evidence_seq_unique_idx";
CREATE UNIQUE INDEX "CustodyEvent_evidence_seq_unique_idx"
  ON "CustodyEvent"("evidenceId", "sequenceNumber");

-- 2. Check constraints enforcing non-null 64-hex SHA-256 hashes
ALTER TABLE "CustodyEvent"
  ADD CONSTRAINT "CustodyEvent_eventHash_check"
    CHECK ("eventHash" IS NOT NULL AND length("eventHash") = 64 AND "eventHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "CustodyEvent"
  ADD CONSTRAINT "CustodyEvent_prevEventHash_check"
    CHECK ("prevEventHash" IS NOT NULL AND length("prevEventHash") = 64 AND "prevEventHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "CustodyEvent"
  ADD CONSTRAINT "CustodyEvent_sequenceNumber_check"
    CHECK ("sequenceNumber" IS NOT NULL AND "sequenceNumber" >= 1);

-- 3. Strict runtime role privileges
GRANT SELECT, INSERT ON "CustodyEvent" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;

-- 4. Row-Level Security
ALTER TABLE "CustodyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustodyEvent" FORCE ROW LEVEL SECURITY;

COMMIT;
```

---

### 4. Inspection of Existing Records & Safe Reconciliation Strategy

#### 4.1 Development Record Inspection (`prisma/dev.db`)

An audit of the active SQLite development database revealed 7 pre-Phase 36 test records for exhibit `c02dbba6-ba05-4819-a7db-3743e4fa7d54`:
- All 7 records have `sequenceNumber: 1` and `eventHash: null`.
- These records represent legacy un-chained test fixtures created before cryptographic chain-of-custody was introduced in Phase 36.

#### 4.2 Mandatory Safety Invariant Compliance

In accordance with safety constraints:
- **No deletion or destructive rewrite:** The 7 historical rows in `prisma/dev.db` were NOT deleted, modified, or re-hashed.
- **SHA-256 Immutability:** `prisma/dev.db` maintains exact hash `dd24614b14f1b4cf8413b674e27bba8459eec6c182536537ab085dbd647af3a9` across all test executions.

#### 4.3 Safe Reconciliation Plan for Production Deployment

For deploying the Phase 36.2 migration into environments containing legacy records:
1. **Isolated New Chains:** All exhibits created in Phase 36 and Phase 36.2 enforce sequence monotonicity starting at `#1` with `GENESIS_HASH`.
2. **PostgreSQL Validation:** In PostgreSQL, the constraints apply directly to all active chains. For existing production databases with un-hashed legacy rows, PostgreSQL allows `ADD CONSTRAINT ... NOT VALID;` followed by asynchronous background validation, preventing table locking or migration crashes.
3. **Never Silently Re-Hash:** Historical events must never be silently rewritten or re-hashed. If legacy exhibits require chaining, a formal `CHAIN_INITIALIZATION` reconciliation event signed by an authorized supervisor must be appended at the head of the chain.

---

### 5. Adversarial Testing & Verification Matrix

The test suite executed direct kernel-level and application-level attacks:

| Test ID | Adversarial Test Scenario | Protection Mechanism | Exit Code / Error | Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-06** | Direct SQL duplicate sequence insert | `CustodyEvent_evidence_seq_unique_idx` | `duplicate key value violates unique constraint "CustodyEvent_evidence_seq_unique_idx"` | **PASSED** |
| **TC-07** | Insert event with `eventHash = NULL` | `CustodyEvent_eventHash_check` | `violates check constraint "CustodyEvent_eventHash_check"` | **PASSED** |
| **TC-08** | Insert event with malformed hash (non-64 hex) | `CustodyEvent_eventHash_check` | `violates check constraint "CustodyEvent_eventHash_check"` | **PASSED** |
| **TC-09** | Application append with unsupported version (`v99`) | Application fail-closed validation | Throws `Unsupported canonicalization version: 'v99'` | **PASSED** |
| **TC-10** | Insert event with malformed `prevEventHash` | `CustodyEvent_prevEventHash_check` | `violates check constraint "CustodyEvent_prevEventHash_check"` | **PASSED** |
| **TC-14** | Backward verification of composite V1 + V2 chain | Multi-mode verifier | Returns `valid: true, eventCount: 2` | **PASSED** |
| **TC-15** | Direct SQL `UPDATE`, `DELETE`, `TRUNCATE` as `rakshak_app_user` | PostgreSQL table privileges | `permission denied for table CustodyEvent` | **PASSED** |
| **TC-16** | Forged tenant context via client-settable setting | PostgreSQL Row-Level Security (`p_custody_tenant_isolation`) | Reads return 0 rows; Inserts throw `violates row-level security policy` | **PASSED** |
| **TC-17** | Session context leakage across pooled connection reuse | `DISCARD ALL` + `clear_tenant_context()` | Session variables return `CLEARED` | **PASSED** |
| **TC-18** | Independent verifier detects synthetic duplicate sequence | `verifyCustodyChainEvents` | Returns `Sequence discontinuity or reordering detected at index 1: expected #2, got #1` | **PASSED** |
| **TC-25** | Unprivileged application role audit | PostgreSQL `pg_roles` catalog check | `rolsuper=f, rolcreaterole=f, rolcreatedb=f, rolbypassrls=f` | **PASSED** |

---

### 6. Architectural Conclusion

With the Phase 36.2 migration and application hardening in place:
1. No custody event can be created or committed without a valid 64-hex SHA-256 event digest and valid predecessor digest.
2. Sequence numbers are strictly unique per exhibit across all committed rows.
3. Ordinary runtime application accounts cannot mutate, overwrite, or delete historical records.
4. Tenant isolation is enforced at the database kernel level independently of frontend or API claims.
