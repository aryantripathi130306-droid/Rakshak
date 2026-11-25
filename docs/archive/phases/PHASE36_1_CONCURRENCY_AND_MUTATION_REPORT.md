# RAKSHAK v3.0 — PHASE 36.1 REPORT
## Workstreams C & E: Concurrency Control, Sequence Safety & Database Immutability Verification

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Target PostgreSQL Database:** `rakshak_phase36_1_test` (Dedicated synthetic database)  
**Database Runtime Role:** `rakshak_app_user` (`rolsuper = false`, `rolbypassrls = false`)  
**Cold Binary Vault Status:** 560 exhibits preserved (SHA-256 Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  

---

### 1. Executive Summary

Phase 36.1 resolves concurrency risks associated with appending events to the same custody chain and independently verifies database-level immutability in the PostgreSQL kernel.

Key technical protections verified:
1. **Per-Evidence Serialization & Mutex Queue:** Concurrent appends to the same exhibit are serialized in a FIFO queue before database persistence, while appends to distinct exhibits execute in parallel without cross-blocking.
2. **Database-Level Partial Unique Constraint:** A partial unique index (`CustodyEvent_evidence_seq_unique_idx`) prevents duplicate sequence numbers on chained events at the database kernel layer, regardless of client or application bugs.
3. **Optimistic Locking Conflict Trapping:** Prisma `P2025` errors during concurrent evidence state transitions are trapped and returned as clean `409 Conflict` responses rather than unhandled server crashes.
4. **Direct PostgreSQL Role Restrictions:** Kernel-level `REVOKE UPDATE, DELETE, TRUNCATE` guarantees that runtime application users cannot alter historical custody events.

---

### 2. Workstream C: Concurrency Architecture & Sequence Safety

#### 2.1 Locking Strategy & Queue Architecture
When appending events to a chain, two race conditions must be avoided:
- **Sequence Collision:** Two concurrent requests reading the same prior event, computing the same `sequenceNumber`, and attempting to insert competing records.
- **Chain Forking:** Concurrent appends creating branching chains with differing event hashes.

To address this, `appendCustodyEventAsync` in [lib/custodyChain.ts](file:///E:/Rakshak/lib/custodyChain.ts) implements a multi-tier concurrency model:
1. **In-Process Promise Queue (`evidenceLockQueues`):** Appends for the same `evidenceId` are serialized in a FIFO chain (`withEvidenceLock`), preventing in-process race conditions.
2. **Transaction Retry with Exponential Backoff:** If database-level contention or serializability conflicts occur, the append operation automatically re-fetches the latest event and retries up to 3 times before failing cleanly.
3. **Database Unique Index:** In PostgreSQL, a partial unique index enforces uniqueness:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS "CustodyEvent_evidence_seq_unique_idx"
     ON "CustodyEvent"("evidenceId", "sequenceNumber")
     WHERE "eventHash" IS NOT NULL;
   ```
   Any attempt to insert a duplicate sequence number aborts with `ERROR: duplicate key value violates unique constraint`.

#### 2.2 Concurrency Test Results

| Test ID | Concurrency Scenario | Test Mechanism | Outcome | Empirical Diagnostic |
|---|---|---|---|---|
| **TC-23** | 10 concurrent appends to SAME exhibit | `Promise.all` with 10 parallel calls | **PASSED** | Monotonically sequenced $1 \dots 10$ with 0 collisions |
| **TC-24** | Concurrent appends to DIFFERENT exhibits | Parallel calls to Exhibit A & B | **PASSED** | Parallel execution completed in 16ms |
| **TC-25** | Intentional duplicate sequence insert | Direct insert attempt with duplicate seq | **PASSED** | Trapped by sequencing gate / unique constraint |
| **TC-26** | Concurrent custody transfer race | Parallel transfers from same custodian | **PASSED** | Exactly 1 request won; other returned 409 Conflict |
| **TC-27** | Transaction failure rollback atomicity | Simulated DB failure in transaction | **PASSED** | Status remained `TRANSFERRED`; 0 corrupt events |

---

### 3. Workstream E: Direct PostgreSQL Security & Database Immutability

#### 3.1 Kernel Privilege Audit on `rakshak_phase36_1_test`
Direct SQL commands were executed using `psql` under the runtime role `rakshak_app_user`:
- Non-superuser: `rolsuper = false`.
- No RLS bypass: `rolbypassrls = false`.
- RLS enabled and forced on `CustodyEvent`, `Evidence`, `Case`, and `AccessGrant`.

#### 3.2 SQL Mutation Rejection Test Results

| Test ID | Direct SQL Attack Scenario | SQL Command Executed | Database Error Returned | Result |
|---|---|---|---|---|
| **TC-33** | Direct SQL `UPDATE` on CustodyEvent | `UPDATE "CustodyEvent" SET action = '...'` | `ERROR: permission denied for table CustodyEvent` | **PASSED** |
| **TC-34** | Direct SQL `DELETE` on CustodyEvent | `DELETE FROM "CustodyEvent" WHERE id = '...'` | `ERROR: permission denied for table CustodyEvent` | **PASSED** |
| **TC-35** | Direct SQL `TRUNCATE` on CustodyEvent | `TRUNCATE TABLE "CustodyEvent";` | `ERROR: permission denied for table CustodyEvent` | **PASSED** |
| **TC-36** | Cross-department fabricated event insert | `INSERT INTO "CustodyEvent" ... foreign exhibit` | `ERROR: new row violates row-level security policy` | **PASSED** |
| **TC-37** | Forged client context query | `SET app.current_department_id = '...'; SELECT` | Returned `0` rows (unverified context fails closed) | **PASSED** |
| **TC-38** | Pooled connection context leak | `clear_tenant_context(); DISCARD ALL; SELECT` | Pre: `1`, Post: `0` (Zero context leakage across pool) | **PASSED** |
| **TC-39** | Partial unique index duplicate sequence test | Direct duplicate insert as admin | `ERROR: duplicate key value violates unique constraint` | **PASSED** |

---

### 4. Cold Storage Invariant Check

- **TC-40:** Directory [uploads/raw/](file:///E:/Rakshak/uploads/raw/) containing 560 evidence binaries was verified via SHA-256 manifest before and after suite execution:
  $$\text{Count} = 560, \quad \text{Manifest Hash} = \texttt{bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8}$$
  Zero files were opened, modified, renamed, or deleted.
