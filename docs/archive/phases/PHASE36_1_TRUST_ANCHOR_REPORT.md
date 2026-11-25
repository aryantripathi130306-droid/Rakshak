# RAKSHAK v3.0 — PHASE 36.1 REPORT
## Workstream D: Trust Anchors, Digital Checkpoints & Honest Security Boundaries

**Phase Status:** COMPLETE  
**Execution Date:** 2026-10-24  
**Trust Anchor Design:** Zero-Genesis Anchoring + External Cryptographic Checkpoints (HMAC-SHA256 / Ed25519)  
**Production Key Status:** STRICTLY BLOCKED (Synthetic test keys only; production HSM/KMS pending)  
**Cold Binary Vault Status:** 560 exhibits preserved (SHA-256 Manifest: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`)  

---

### 1. Executive Summary & Honest Trust Boundaries

A critical requirement of Phase 36.1 is to be honest about trust boundaries and avoid creating false cryptographic guarantees:
1. **Zero-Genesis Hash (`GENESIS_HASH` = 64 Hex Zeros):**
   - **What It Can Detect:** Traps any single-field or multi-field modification, intermediate row deletion, sequence skips, reordered records, and appends with forged previous hashes.
   - **What It Cannot Detect:** If a privileged database superuser (`postgres`) with direct write access alters historical rows and recomputes every event hash from genesis to the head of the chain, an internal verifier inspecting only the database table will see a mathematically valid chain.
2. **External Trust Anchors (Digital Checkpoints):**
   - To defeat full-chain rewrite attacks, Phase 36.1 introduces external cryptographic checkpoints (`CustodyCheckpoint`).
   - A checkpoint cryptographically binds the `evidenceId`, `latestSequenceNumber`, and `latestEventHash` outside the database using a cryptographic key held independently of database credentials.
   - Even if an adversary recalculates every hash in the database, the recalculated head hash will not match the certified checkpoint digest, immediately exposing the forgery.

---

### 2. Independent Checkpoint & Signature Architecture

#### 2.1 Checkpoint Data Structure
```typescript
export interface CustodyCheckpoint {
  checkpointId: string;          // Unique UUID for checkpoint audit record
  evidenceId: string;            // Bound evidence exhibit UUID
  latestSequenceNumber: number;  // Latest verified event sequence number
  latestEventHash: string;       // Authoritative SHA-256 digest at that sequence
  timestamp: string;             // UTC ISO-8601 creation timestamp
  keyId: string;                 // Identifier of the signing key (HSM/KMS key alias)
  algorithm: string;             // "HMAC-SHA256" (or "Ed25519" for asymmetric PKI)
  signature: string;             // Hex cryptographic signature
}
```

#### 2.2 Signing & Verification Workflow
1. **Checkpoint Issuance (`createCustodyCheckpoint`):**
   - Constructed over the canonical stringification of the checkpoint payload:
     $$\text{Payload} = \texttt{\{"checkpointId":"...","evidenceId":"...","keyId":"...","latestEventHash":"...","latestSequenceNumber":N,"timestamp":"..."\}}$$
   - Digitally signed using `secretOrKey`.
2. **Checkpoint Verification (`verifyCustodyCheckpoint`):**
   - Re-canonicalizes the payload and validates that the signature matches.
   - Tampered signatures fail closed immediately.
3. **Chain Trust-Anchor Verification (`verifyChainWithCheckpoint`):**
   - Validates checkpoint signature authenticity.
   - Evaluates internal chain validity.
   - Confirms that the event at `checkpoint.latestSequenceNumber` has an `eventHash` identical to `checkpoint.latestEventHash`.

```
┌──────────────────────────────────────────────┐
│ Database Hash Chain                          │
│ Event #1 ──► Event #2 ──► Event #3 (Hash: H) │
└───────────────────────────────┬──────────────┘
                                │ Matches?
                                ▼
┌──────────────────────────────────────────────┐
│ External Certified Checkpoint                │
│ Sequence: 3, Digest: H, Signature: Valid     │
└──────────────────────────────────────────────┘
```

---

### 3. Adversarial Test Results (Workstream D)

| Test ID | Trust Anchor Scenario | Tested Behavior | Outcome | Diagnostic |
|---|---|---|---|---|
| **TC-28** | Genesis anchor verification | Event #1 with non-zero prev hash | **PASSED** | Rejected as `prevEventHash mismatch` |
| **TC-29** | Checkpoint creation | Signs latest sequence & event hash | **PASSED** | Generated HMAC-SHA256 signature |
| **TC-30** | Untampered chain verification | Valid chain + valid checkpoint | **PASSED** | Verified 3 events against checkpoint |
| **TC-31** | **Full-chain rewrite attack** | Adversary rewrote action and recomputed all hashes from genesis | **PASSED** | **Internal check passed, but checkpoint trust anchor caught rewrite: digest mismatch at event #3** |
| **TC-32** | Forged checkpoint signature | Checkpoint with forged signature | **PASSED** | Rejected immediately (`signature invalid`) |

---

### 4. Key Management & Production Boundaries

- **Test Keys Only:** All Phase 36.1 verification tests utilized synthetic test keys (`synthetic_phase36_1_secret_test_key_not_for_production`). No production keys or secrets exist in the repository.
- **Production Key Provisioning Blocked:** Real production signing-key provisioning remains **STRICTLY BLOCKED** until:
  1. Departmental Key Management Policies are established.
  2. A dedicated Hardware Security Module (HSM) or cloud KMS (e.g. AWS KMS / HashiCorp Vault) is provisioned.
  3. Key rotation and multi-party quorum signing ceremonies are approved.
- **Administrative Superuser Boundary Disclosure:** The system explicitly does not claim protection against an adversary with concurrent superuser access to both the PostgreSQL database and the external HSM signing service. Protection against such an adversary requires write-once-read-many (WORM) hardware storage or independent public transparency ledgers.
