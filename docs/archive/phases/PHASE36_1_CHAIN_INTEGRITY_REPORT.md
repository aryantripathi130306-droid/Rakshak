# RAKSHAK v3.0 — PHASE 36.1 REPORT
## Workstreams A & B: Complete Event-Hash Coverage, Deterministic Canonicalization & Adversarial Tampering Verification

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Target Environment:** Isolated Synthetic Sandbox (`rakshak_phase36_1_test` / `prisma/dev.db` non-destructive)  
**Cold Binary Vault Status:** 560 exhibits preserved (SHA-256 Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  
**Production Ingestion Status:** STRICTLY DISABLED  

---

### 1. Executive Summary

Phase 36.1 hardens the cryptographic chain-of-custody implementation across all integrity-relevant fields. In Phase 36, the digest covered top-level event fields and serialized details, but did not bind `eventId` directly or define explicit canonicalization versioning.

Phase 36.1 introduces:
1. **Full-Field Inventory Coverage (V2 Canonicalization):** Cryptographically binds `eventId`, `evidenceId`, `sequenceNumber`, `prevEventHash`, `eventType`, `actor`, `action`, `result`, `timestamp`, and the complete key-sorted metadata envelope (`actorId`, `departmentId`, `caseId`, `caseNumber`, `reason`, `previousStatus`, `resultingStatus`, `previousCustodianId`, `newCustodianId`, `evidenceHash`, `derivedArtifactId`, `sourceHash`, `approvalRef`).
2. **Deterministic Canonical Serialization:** Normalized, key-sorted, whitespace-trimmed, versioned JSON serialization (`canonicalStringify`) ensuring consistent digests across platforms.
3. **Adversarial Tampering Test Suite:** 20 adversarial tests proving that modifying any single hashed field, altering metadata, injecting unhashed keys, deleting intermediate records, reordering events, or appending invalid hashes fails verification immediately.
4. **Backward Compatibility:** Legacy Phase 36 V1 events remain 100% verifiable without re-hashing or rewriting historical records.

---

### 2. Workstream A: Event-Field Inventory & Canonicalization Architecture

#### 2.1 Complete Field Inventory Matrix

| Field | Source | Canonical Location | Covered in Digest | Security / Integrity Purpose |
|---|---|---|---|---|
| `eventId` (`id`) | Database UUID | V2 Envelope Root | **YES** | Cryptographically commits to unique record ID |
| `evidenceId` | Parent Exhibit UUID | V2 Envelope Root | **YES** | Binds event strictly to target evidence exhibit |
| `sequenceNumber` | Monotonic Integer ($1, 2, \dots$) | V2 Envelope Root | **YES** | Prevents insertion, deletion, and reordering |
| `prevEventHash` | Hex SHA-256 Digest | V2 Envelope Root | **YES** | Cryptographically chains each event to predecessor |
| `eventType` | Lifecycle Event Code | V2 Envelope Root | **YES** | Binds operational event category |
| `actor` | Formatted Identity String | V2 Envelope Root | **YES** | Human-readable audit display |
| `action` | Action Description Text | V2 Envelope Root | **YES** | Attributable description of performed action |
| `result` | Status (`SUCCESS`, `VERIFIED`, etc.) | V2 Envelope Root | **YES** | Result status of the evidentiary operation |
| `timestamp` | UTC ISO-8601 String | V2 Envelope Root | **YES** | Tamper-evident temporal anchoring |
| `canonicalVersion` | Schema Tag (`"v2"`) | V2 Envelope Root & Details | **YES** | Version safety against ambiguous parsing |
| `actorId` | Verified Server Session | `details.actorId` | **YES** | Stable verified officer UUID (immune to display name spoofing) |
| `departmentId` | Verified Server Session | `details.departmentId` | **YES** | Stable verified department UUID (enforces tenant scope) |
| `caseId` | Case UUID | `details.caseId` | **YES** | Relational link to parent case |
| `caseNumber` | Case String | `details.caseNumber` | **YES** | Official FIR/incident number |
| `reason` | Justification Text | `details.reason` | **YES** | Required justification for transition/transfer/quarantine |
| `previousStatus` | Lifecycle Status | `details.previousStatus` | **YES** | State machine prior status |
| `resultingStatus` | Lifecycle Status | `details.resultingStatus` | **YES** | State machine resulting status |
| `previousCustodianId` | Officer UUID | `details.previousCustodianId` | **YES** | Prior custodian identity |
| `newCustodianId` | Officer UUID | `details.newCustodianId` | **YES** | New custodian identity |
| `evidenceHash` | SHA-256 Digest | `details.evidenceHash` | **YES** | Evidence binary digest at time of event |
| `derivedArtifactId` | Fact/OCR UUID | `details.derivedArtifactId` | **YES** | Provenance link to derived extraction |
| `sourceHash` | SHA-256 Digest | `details.sourceHash` | **YES** | Provenance link to raw source binary |
| `approvalRef` | Reference String | `details.approvalRef` | **YES** | Supervisor or court authorization reference |

#### 2.2 Deterministic Canonical Serialization (`canonicalStringify`)
Ambiguous key ordering in JSON objects can cause identical data to produce different hashes. The `canonicalStringify` function implements strict canonicalization:
1. Primitives: Numbers and booleans formatted per JSON standard; strings trimmed.
2. Null values: Formatted as literal `"null"`.
3. Dates: Converted to canonical UTC ISO-8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
4. Arrays: Elements recursively canonicalized in preservation order.
5. Objects: Keys sorted lexicographically; undefined/function properties excluded; whitespace stripped.

$$\text{Canonical JSON} = \texttt{\{"action":"...","actor":"...","canonicalVersion":"v2",...\}}$$
$$\text{Event Hash} = \text{SHA-256}(\text{Canonical JSON})$$

---

### 3. Workstream B: Adversarial Tampering Verification Results

The independent verifier `verifyCustodyChainEvents` was subjected to 22 direct adversarial scenarios in [scripts/test_phase36_1_custody_adversarial.mjs](file:///E:/Rakshak/scripts/test_phase36_1_custody_adversarial.mjs):

| Test ID | Adversarial Test Scenario | Expected Behavior | Actual Diagnostic | Result |
|---|---|---|---|---|
| **TC-01** | Valid untouched V2 custody chain | Pass verification | Verified 3 events with 100% integrity | **PASSED** |
| **TC-02** | Backward compatibility: Untouched V1 chain | Pass verification | Verified legacy V1 event | **PASSED** |
| **TC-03** | Altering `actor` display name string | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-04** | Altering `action` description text | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-05** | Altering `result` outcome (`SUCCESS` $\to$ `FAILED`) | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-06** | Altering `timestamp` | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-07** | Altering `sequenceNumber` ($2 \to 99$) | Detect discontinuity | `Sequence discontinuity: expected #2, got #99` | **PASSED** |
| **TC-08** | Replacing `prevEventHash` | Detect broken linkage | `prevEventHash mismatch` at event #2 | **PASSED** |
| **TC-09** | Altering structured `reason` in metadata | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-10** | Altering verified `actorId` in metadata | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-11** | Altering verified `departmentId` in metadata | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-12** | Altering `evidenceHash` in metadata | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-13** | Altering derived-artifact `sourceHash` | Detect tampering | `digest recalculation failed (V2)` at event #4 | **PASSED** |
| **TC-14** | Altering custody transfer `newCustodianId` | Detect tampering | `digest recalculation failed (V2)` at event #3 | **PASSED** |
| **TC-15** | Altering lifecycle status values (`toStatus`) | Detect tampering | `digest recalculation failed (V2)` at event #3 | **PASSED** |
| **TC-16** | Injecting unhashed keys into structured metadata | Detect tampering | `digest recalculation failed (V2)` at event #2 | **PASSED** |
| **TC-17** | Deleting middle event (#2 deleted) | Detect discontinuity | `Sequence discontinuity: expected #2, got #3` | **PASSED** |
| **TC-18** | Reordering events (#2 before #1) | Detect reordering | `Sequence discontinuity: expected #1, got #2` | **PASSED** |
| **TC-19** | Skipping sequence numbers ($1 \to 3$) | Detect discontinuity | `Sequence discontinuity: expected #2, got #3` | **PASSED** |
| **TC-20** | Appending event with invalid previous hash | Detect broken link | `prevEventHash mismatch` at event #4 | **PASSED** |
| **TC-21** | Unsupported canonical version (`v99`) | Fail closed safely | `Unsupported or malformed canonicalization version: v99` | **PASSED** |
| **TC-22** | Diagnostic hygiene check | Safe reporting | Disclosed event sequence & category without secrets | **PASSED** |

---

### 4. Non-Destructive Reconciliation

Existing custody events created under Phase 36 remain fully verifiable through dual-mode verification:
- Events containing `canonicalVersion: "v2"` verify strictly against the V2 canonical envelope.
- Events lacking `canonicalVersion` or tagged `v1` verify against the Phase 36 pipe-delimited format.
- Neither database tables nor historical records were destructively rewritten or altered.
