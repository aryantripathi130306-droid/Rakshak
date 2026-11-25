# RAKSHAK v3.0 — PHASE 36.2 DISTRIBUTED CONCURRENCY REPORT
## Cross-Process Custody-Chain Serialization, Concurrency Architecture & Contention Verification

**Document Version:** 1.0  
**Phase Target:** Phase 36.2 — Cross-Process Custody-Chain Concurrency, Sequence Integrity & Trust-Anchor Readiness  
**Target Environment:** Isolated PostgreSQL Database (`rakshak_phase36_2_test`) on PostgreSQL 16  
**Evaluation Status:** COMPLETE — All 27 Verification Scenarios Passed (100.0%)  
**Production Readiness:** BLOCKED (Production signing keys, HSM/KMS integration, and live deployment remain strictly disabled)  

---

### 1. Executive Summary

In Phase 36.1, custody event appends were protected against in-memory thread races using a Node.js process-local FIFO mutex (`withEvidenceLock`). While effective within a single process, this design leaves multi-process architectures (such as horizontally scaled API containers, Next.js serverless workers, or background forensic workers) vulnerable to race conditions if two independent processes append to the same evidence chain simultaneously.

Phase 36.2 eliminates this limitation by implementing **database-coordinated transaction serialization** directly in the PostgreSQL engine. Using transaction-level advisory locks scoped uniquely to each evidence exhibit (`pg_advisory_xact_lock`), combined with interactive database transactions and transactional retry loops, custody events appended from independent operating system processes are serialized with zero chain forks, zero sequence collisions, and zero cross-exhibit lock contention.

---

### 2. Concurrency Architecture & Locking Model

#### 2.1 The Two-Tiered Serialization Architecture

To ensure safety across all runtime topologies (single-process Node.js, multi-worker clustering, and multi-node container clusters):

1. **Tier 1 (In-Process FIFO Queue):**  
   The application maintains an in-memory queue (`withEvidenceLock`) per `evidenceId` to minimize database lock contention and connection churn within the same Node.js runtime.
2. **Tier 2 (PostgreSQL Transaction Advisory Lock):**  
   Within an interactive transaction (`tx`), the application acquires a transaction-level advisory lock uniquely hashed from the target evidence exhibit:
   ```sql
   SELECT pg_advisory_xact_lock(('x' || substr(md5('custody_chain_' || $1), 1, 16))::bit(64)::bigint);
   ```
   - **Scope:** The lock is held strictly for the duration of the interactive transaction (`xact_lock`).
   - **Automatic Release:** PostgreSQL automatically releases the advisory lock upon transaction `COMMIT` or `ROLLBACK`. No dangling locks can persist even if the application process crashes or loses network connectivity mid-transaction.
   - **Granularity:** The 64-bit integer hash generated from `md5('custody_chain_' || evidenceId)` provides a collision space of $2^{64} \approx 1.84 \times 10^{19}$, ensuring that appends to distinct evidence exhibits proceed in parallel without false lock contention.

#### 2.2 Sequence and Digest Calculation Under Exclusive Lock

While holding the advisory lock inside the transaction, the engine executes:
```typescript
// 1. Authoritative chain head read
const lastEvent = await tx.custodyEvent.findFirst({
  where: { evidenceId: input.evidenceId },
  orderBy: [{ sequenceNumber: "desc" }, { timestamp: "desc" }],
  select: { id: true, sequenceNumber: true, eventHash: true },
});

// 2. Next sequence and prior digest resolution
const nextSeq = (lastEvent?.sequenceNumber || 0) + 1;
const prevHash = lastEvent?.eventHash || GENESIS_HASH;

// 3. Fail-closed validation of prior digest
if (!prevHash || !/^[0-9a-f]{64}$/.test(prevHash)) {
  throw new Error(`Previous event hash is invalid or malformed: '${prevHash}'`);
}

// 4. Deterministic canonical V2 hash computation
const eventHash = computeEventHash({
  canonicalVersion,
  eventId,
  evidenceId: input.evidenceId,
  sequenceNumber: nextSeq,
  eventType: input.eventType,
  actor: input.actor,
  action: input.action,
  result: resultStatus,
  timestamp: now,
  prevEventHash: prevHash,
  details: structuredDetails,
});

// 5. Atomic persistence
return await tx.custodyEvent.create({
  data: {
    id: eventId,
    evidenceId: input.evidenceId,
    eventType: input.eventType,
    actor: input.actor,
    action: input.action,
    result: resultStatus,
    details: detailsString,
    timestamp: now,
    prevEventHash: prevHash,
    eventHash,
    sequenceNumber: nextSeq,
  },
});
```

#### 2.3 Contention Handling and Jittered Exponential Backoff

If transient serialization errors or lock acquisition timeouts occur (e.g., under extreme multi-client write spikes), `appendCustodyEventAsync` executes a retry loop:
- **Maximum Retries:** 5 attempts.
- **Backoff Formula:** `delay = (25 * attempt) + Math.floor(Math.random() * 25) ms`.
- **Fail-Closed Gate:** Validation errors (such as unsupported canonicalization versions, empty actors, or malformed hashes) fail immediately without consuming retry attempts.

---

### 3. Lifecycle Transitions & Concurrency Conflict Trapping

In `lib/evidenceLifecycle.ts`, evidence state transitions (e.g., custody transfers, sealing, quarantine) and their corresponding custody event creation are unified inside a single coordinated database transaction:
- **Optimistic Locking:** `tx.evidence.update` includes `where: { id: evidenceId, version: currentVersion }`.
- **Conflict Trapping:** If another process has updated the exhibit concurrently, Prisma throws error code `P2025` ("Record to update not found").
- **Clean Conflict Response:** The error is trapped, the transaction rolls back cleanly, and the function returns:
  ```json
  {
    "success": false,
    "error": "Optimistic concurrency conflict: Evidence exhibit was updated concurrently by another operation.",
    "statusCode": 409
  }
  ```
- **Atomicity:** Zero orphan custody events are created when an evidence update fails, and no evidence lifecycle state is modified if custody event persistence fails.

---

### 4. Empirical Multi-Process Adversarial Test Results

The suite in `scripts/test_phase36_2_distributed_custody.mjs` executed 27 automated scenarios against `rakshak_phase36_2_test`:

| Test ID | Scenario Description | Tested Mechanism | Result | Evidence / Details |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Two independent Node.js processes append 5 events simultaneously to same evidence | Multi-process advisory locking (`child_process.spawn`) | **PASSED** | 10 events committed in sequence 1..10, valid chain, 0 forks |
| **TC-02** | Ten concurrent appends across independent clients complete without duplicate sequences | Parallel client connections (`PrismaClientPg`) | **PASSED** | Sequences 1..10 monotonic, 0 collisions, 100% valid digests |
| **TC-03** | Every committed event strictly references authoritative predecessor digest | Monotonic hash linkage | **PASSED** | All 10 events verified against predecessor `eventHash` |
| **TC-04** | Two independent processes attempting concurrent custody transfers | Optimistic concurrency + atomic lifecycle transaction | **PASSED** | Exactly 1 process committed (exit 0), 1 received 409 conflict (exit 2), 0 chain forks |
| **TC-05** | Concurrent writes to different evidence items proceed independently | Exhibit-level advisory lock hashing | **PASSED** | Parallel appends completed in 94ms with zero cross-blocking |
| **TC-11** | Sequential and contended appends handle transaction lifecycle safely | Exponential backoff retry loop | **PASSED** | Contended events sequenced cleanly into seq 1 and seq 2 |
| **TC-12** | Database error mid-lifecycle transition completely rolls back evidence and custody state | Interactive transaction atomicity | **PASSED** | Status remained `IN_CUSTODY`, version=1, 0 orphan custody events |
| **TC-13** | Aborted transaction / connection loss leaves zero phantom sequences or chain corruption | PostgreSQL transaction abort | **PASSED** | Subsequent legitimate event received seq #1 with `GENESIS_HASH` |

---

### 5. Architectural Findings & Operational Guarantees

1. **Independent Appends to Distinct Exhibits Do Not Block:**  
   Because the advisory lock key is derived from the SHA-256 / MD5 digest of the `evidenceId`, operations on Exhibit A and Exhibit B run in complete parallelism without thread or database lock serialization.
2. **Crash Consistency:**  
   If an application node terminates unexpectedly or loses network connectivity mid-append, PostgreSQL immediately aborts the active transaction, drops the advisory lock, and rolls back all uncommitted writes. No corrupt intermediate state is persisted.
3. **Database Constraints as Ultimate Safety Rail:**  
   Even if an unauthorized query bypasses application mutexes, the database unique index `("evidenceId", "sequenceNumber")` prevents duplicate sequences at the storage engine level.
