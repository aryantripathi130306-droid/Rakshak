# RAKSHAK v3.0 — PHASE 36 REPORT
## Workstream D: Append-Only Chain-of-Custody Ledger & Cryptographic Event Chaining

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Ledger Architecture:** Append-Only Relational Ledger with SHA-256 Hash Chaining  
**Database Guard:** `REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;`  
**Cold Storage Preservation:** 560 exhibits unaltered (Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  

---

### 1. Executive Summary

Workstream D establishes an immutable, cryptographically verifiable chain-of-custody ledger for all evidence exhibits in Rakshak v3.0. Every interaction with an exhibit—including intake ingestion, hash verification, acceptance, custody transfer initiation and acknowledgement, forensic examination commencement and completion, and seal/release operations—is recorded as an append-only event cryptographically anchored to its predecessor.

An independent verifier algorithm detects any post-facto modification, row deletion, or sequence tampering. Database-level privilege revocations prevent application-tier roles from modifying or deleting existing custody records.

---

### 2. Cryptographic Hash Chaining Protocol

#### 2.1 Canonical Serialization Format
To ensure deterministic digests across heterogeneous environments, event hashes are calculated over an unspaced, sorted JSON stringification of canonical fields:

```typescript
const canonicalPayload = JSON.stringify({
  action: event.action.trim(),
  actor: event.actor.trim(),
  evidenceId: event.evidenceId.trim(),
  eventType: event.eventType.trim(),
  prevEventHash: event.prevEventHash,
  result: (event.result || "SUCCESS").trim(),
  sequenceNumber: Number(event.sequenceNumber),
  timestamp: new Date(event.timestamp).toISOString(),
});
```

The event digest is computed as:
$$\text{eventHash} = \text{SHA-256}(\text{canonicalPayload})$$

#### 2.2 Genesis Anchor & Sequential Linking
- **Genesis Event (Sequence #1):** Anchored with a fixed 64-character hexadecimal zero string:
  $$\text{prevEventHash} = \texttt{0000000000000000000000000000000000000000000000000000000000000000}$$
- **Subsequent Events (Sequence $N > 1$):**
  $$\text{prevEventHash}_N = \text{eventHash}_{N-1}$$
  $$\text{sequenceNumber}_N = \text{sequenceNumber}_{N-1} + 1$$

```
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│ Event #1: INTAKE_UPLOAD │       │ Event #2: HASH_VERIFIED │       │ Event #3: IN_CUSTODY    │
├─────────────────────────┤       ├─────────────────────────┤       ├─────────────────────────┤
│ seq: 1                  │       │ seq: 2                  │       │ seq: 3                  │
│ prev: 00000000000000... │       │ prev: HASH_EVENT_1      │       │ prev: HASH_EVENT_2      │
│ digest: HASH_EVENT_1    ├──────►│ digest: HASH_EVENT_2    ├──────►│ digest: HASH_EVENT_3    │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

#### 2.3 Independent Verification Engine
The independent verification function `verifyCustodyChainEvents`:
1. Validates that the event array is non-empty and in strictly monotonic sequence order ($1, 2, \dots, N$).
2. Confirms Event #1 has `prevEventHash === GENESIS_HASH`.
3. For each event $i > 0$, checks that `prevEventHash === events[i-1].eventHash`.
4. Recalculates the SHA-256 digest over the canonical payload and verifies equality with `event.eventHash`.
5. **On Any Discrepancy:** Fails closed, identifying the exact sequence index and nature of failure (`TAMPERING_DETECTED`, `DISCONTINUITY_OR_REORDERING`, or `CORRUPTED_EVENT_HASH`).

---

### 3. Database-Level Immutability Enforcement

Beyond application-level validations, immutability is strictly enforced in the PostgreSQL database kernel:
```sql
GRANT SELECT, INSERT ON "CustodyEvent" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "CustodyEvent" FROM rakshak_app_user;
```

Any attempt by runtime application connections to modify or delete custody records is aborted with `42501 permission denied for table CustodyEvent`.

HTTP endpoints (`/api/evidence/[id]/custody`) reject mutation methods (`PUT`, `PATCH`, `DELETE`) with `405 Method Not Allowed`.

---

### 4. Authoritative Actor Attribution

Custody records never accept client-asserted officer badges, names, or timestamps. The backend derives the actor identity authoritatively from the verified session context:
$$\text{Actor} = \text{Officer.name} + \text{" ("} + \text{Officer.badgeNumber} + \text{")"}$$
Timestamps are generated server-side in UTC (`new Date().toISOString()`).

---

### 5. Test Suite Verification (Workstream D)

| Test ID | Scenario | Result | Verification Details |
|---|---|---|---|
| **TC-11** | Initial genesis custody event anchored with 64 hex zeros | **PASSED** | `prevEventHash: 0000...0000`, digest computed |
| **TC-12** | Sequential custody events cryptographically commit to previous digest | **PASSED** | Monotonic chaining sequence $1 \to 2 \to 3$ |
| **TC-13** | Independent verifier validates untampered cryptographic custody chain | **PASSED** | Verified all events cleanly |
| **TC-14** | Verifier detects tampered event action/details and reports failure | **PASSED** | Caught payload modification at event #2 |
| **TC-15** | Verifier detects deleted intermediate event and sequence discontinuity | **PASSED** | Trapped missing event #2 between #1 and #3 |
| **TC-16** | Verifier detects reordered events in chain and fails closed | **PASSED** | Trapped out-of-order sequence index |
| **TC-17** | Custody logging derives authoritative actor identity from session | **PASSED** | Derived: `Inspector Ravi Shankar (CY-INV-001)` |
| **TC-18** | Custody route rejects unsupported mutation methods with HTTP 405 | **PASSED** | PUT, PATCH, DELETE rejected |
| **TC-19** | Direct SQL UPDATE on CustodyEvent denied for runtime role | **PASSED** | PostgreSQL error `permission denied for table CustodyEvent` |
| **TC-20** | Direct SQL DELETE on CustodyEvent denied for runtime role | **PASSED** | PostgreSQL error `permission denied for table CustodyEvent` |

---

### 6. Architectural Disclosures & Limitations
1. **Privileged Database Administrator Boundary:** Cryptographic chaining and SQL permission revokes prevent application users and compromised runtime roles from altering history. However, a superuser (`postgres`) with direct database write access could theoretically rewrite historical rows and recompute hashes. Immutable off-site ledger replication (or external timestamp anchoring) remains a future production hardening requirement.
2. **Key Management:** Events currently utilize deterministic SHA-256 hash chaining. Asymmetric officer digital signatures (PKI / Ed25519) will be incorporated once hardware security modules (HSM) or departmental smart-card infrastructure is approved.
