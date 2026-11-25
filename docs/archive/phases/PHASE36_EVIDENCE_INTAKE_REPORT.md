# RAKSHAK v3.0 — PHASE 36 REPORT
## Workstreams A, B & C: Evidence Lifecycle, Secure Intake & Integrity-Protected Storage

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Target Environment:** Isolated Synthetic Sandbox (`rakshak_phase36_test` / `prisma/dev.db` non-destructive)  
**Cold Binary Vault Status:** 560 exhibits preserved (SHA-256 Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  
**Production Ingestion Status:** STRICTLY DISABLED  

---

### 1. Executive Summary

Phase 36 establishes an end-to-end, controlled evidence lifecycle and intake architecture integrated into the Rakshak v3.0 investigative platform. The design addresses the vulnerability of client-asserted digests and path traversal risks by introducing:
1. **Server-Side Evidence State Machine:** Strict transitions enforced through explicit permitted state graphs with optimistic concurrency control (`version`).
2. **Secure Synthetic Intake Pipeline:** Multi-barrier validation enforcing non-zero content, whitelisted MIME/file-types, strict path sanitizer (rejecting path traversal escapes like `../` and control characters), server-side SHA-256 digest computation, and transit mismatch detection.
3. **Fail-Closed Storage Interface & Quarantine Protocols:** Read-time digest verification preventing silent bit rot, unauthorized binary substitution, or execution of unverified binaries. Quarantined exhibits strictly fail closed against normal retrieval or download.

---

### 2. Workstream A: Evidence Lifecycle State Machine

#### 2.1 State Graph & Permitted Transitions
The lifecycle defines 11 explicit evidence states:
- `INTAKE_INITIATED`: Intake record created; binary awaiting staging receipt.
- `RECEIVED_STAGING`: Binary received in isolated staging area; awaiting hash calculation.
- `ACCEPTED`: Binary integrity verified; canonical SHA-256 recorded; ready for custody assignment.
- `QUARANTINED`: Integrity mismatch, transit corruption, or security incident detected; normal access blocked.
- `REJECTED`: File failed intake policy (prohibited type, empty file, malicious path); permanently ineligible.
- `IN_CUSTODY`: Assigned to an active, authorized officer custodian.
- `EXAMINATION_IN_PROGRESS`: Transferred to an authorized `FORENSIC_EXAMINER` for forensic extraction.
- `EXAMINATION_COMPLETED`: Forensic examination completed; derived artifacts linked with provenance.
- `SEALED`: Evidentiary seal applied; gated strictly to authorized supervisors.
- `TRANSFERRED`: Two-step custody transfer initiated; awaiting recipient acknowledgement.
- `RELEASED`: Court- or supervisor-authorized release; lifecycle finalized.

```
       [INTAKE_INITIATED]
               │
       [RECEIVED_STAGING]
         ┌─────┴───────────────┐
         ▼                     ▼
     [ACCEPTED]           [REJECTED]
         │ (Assign)
         ▼
    [IN_CUSTODY] ◄──────────────┐
     │   │   ▲                  │
     │   │   └─ [TRANSFERRED] ──┘ (Acknowledge)
     │   ▼
     │ [EXAMINATION_IN_PROGRESS]
     │   │
     │   ▼
     │ [EXAMINATION_COMPLETED]
     │   │
     ├───┼──────────────────────┐
     ▼   ▼                      ▼
  [SEALED]                 [RELEASED]
     ▲
     │ (Any state on mismatch)
 [QUARANTINED]
```

#### 2.2 Transition Authorization & Concurrency Model
Every transition enforces:
- **Active Authenticated Identity:** Suspended or inactive accounts are rejected (`403 Forbidden`).
- **Department & Grant Scope:** Officer must belong to the case's department or hold an unexpired `AccessGrant` (`CASE_READ` or `CASE_WRITE`).
- **Role Permissions:** Sealed status release requires `SUPERVISOR` or `ADMIN`; forensic examination requires `FORENSIC_EXAMINER` or `ADMIN`.
- **Reason Mandate:** Quarantining, rejection, and release require a documented justification (`reason >= 5 chars`).
- **Optimistic Concurrency Control:** Transitions evaluate `WHERE id = ? AND version = ?`, atomically incrementing `version = version + 1`. Stale requests fail closed with `409 Conflict`.

---

### 3. Workstream B: Secure Synthetic Evidence Intake

#### 3.1 Security Controls at Ingestion Boundary
- **Path Sanitization:** Filenames containing `../`, `..\`, control characters (`\x00-\x1f`), or leading path separators are rejected immediately with `400 Bad Request`.
- **Safe Internal Storage Keying:** Physical files are stored using generated UUIDs and content digests (`{uuid}_{sha256}.bin`), eliminating attacker-controlled file paths.
- **Strict File-Type Whitelist:** Allowed types: `PDF`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `ARCHIVE`, `BIN`. Prohibited extensions (`.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.py`, `.dll`) and disguised MIME types are rejected.
- **Empty File Protection:** Uploads with `size === 0` fail closed immediately.
- **Dual SHA-256 Digest Verification:** Client-supplied hashes are treated as untrusted claims. The server computes the canonical SHA-256 directly from received bytes. If a client claim is provided and differs from the server digest, the exhibit is flagged and transitioned to `QUARANTINED`.

---

### 4. Workstream C: Protected Storage & Read-Time Integrity

#### 4.1 Content-Addressed Storage Adapter
Evidence binaries are maintained outside the web root (`uploads/raw/` in live cold storage, dedicated fixture sandboxes in testing). Binaries are never served as static assets.

#### 4.2 Read-Time Integrity Verification
Prior to authorized download or forensic examination, `verifyEvidenceIntegrityAsync`:
1. Reads raw bytes from the registered `storagePath`.
2. Computes the real-time SHA-256 hash.
3. Compares against `Evidence.sha256Hash`.
4. **On Match:** Appends a signed, chained `HASH_VERIFIED` custody event.
5. **On Mismatch:** Appends an `INTEGRITY_MISMATCH` custody event, immediately transitions exhibit status to `QUARANTINED`, records `quarantineReason`, and denies binary retrieval.

---

### 5. Test Suite Verification (Workstreams A, B, C)

| Test ID | Scenario | Result | Details |
|---|---|---|---|
| **TC-01** | Valid synthetic evidence intake sets ACCEPTED status and records SHA-256 | **PASSED** | Status `ACCEPTED`, hash computed server-side |
| **TC-02** | Intake detects dual SHA-256 mismatch between server digest and client claim | **PASSED** | Correctly identified transit discrepancy |
| **TC-03** | Intake rejects path traversal and control character filename patterns | **PASSED** | Blocked directory escape attempts |
| **TC-04** | Intake rejects unapproved executable and script file types | **PASSED** | Enforced file type whitelist |
| **TC-05** | Intake rejects empty 0-byte upload attempts | **PASSED** | Fails closed on 0-byte input |
| **TC-06** | Intake rejects unauthorized cross-department officer without active grant | **PASSED** | Cross-department access denied |
| **TC-07** | Valid lifecycle transition from ACCEPTED to IN_CUSTODY succeeds | **PASSED** | Assigned to primary custodian |
| **TC-08** | Arbitrary non-permitted state transition is rejected by state machine | **PASSED** | Blocked ACCEPTED -> RELEASED jump |
| **TC-09** | Quarantine and rejection transitions require mandatory justification reason | **PASSED** | Enforced min 5 char reason |
| **TC-10** | Optimistic concurrency locking rejects conflicting stale updates | **PASSED** | Version mismatch caught atomically |
| **TC-30** | Quarantined evidence exhibit strictly denies ordinary binary download | **PASSED** | Blocked download of quarantined exhibit |
| **TC-31** | Sealed evidence denies ordinary investigator and allows supervisor authorization | **PASSED** | Supervisor gating enforced |

---

### 6. Production Prerequisites
- **WORM/Object Lock Certification:** Local filesystem storage must be backed by an S3-compatible Object Lock or certified immutable WORM storage appliance before production intake.
- **ClamAV/Malware Scanning Pipeline:** Asynchronous scanning integration before transitioning from `RECEIVED_STAGING` to `ACCEPTED`.
- **Live Evidence Ingestion Notice:** Real evidence ingestion remains DISABLED until formal departmental and statutory sign-offs are obtained.
