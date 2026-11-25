# RAKSHAK v3.0 — PHASE 36.2 TRUST ANCHOR READINESS REPORT
## External Checkpoint Architecture, Adversarial Rewrite Defenses & Honest Security Boundaries

**Document Version:** 1.0  
**Phase Target:** Phase 36.2 — Trust-Anchor Architecture & Verification Hardening  
**Target Ledger:** Cryptographic Custody Chain (`lib/custodyChain.ts`)  
**Readiness Status:** ARCHITECTURALLY VERIFIED | PRODUCTION DEPLOYMENT BLOCKED  

---

### 1. Executive Summary

A fundamental tenet of cryptographic engineering is to be honest about trust boundaries. A database-resident hash chain starting from a zero-filled genesis hash (`0000000000000000000000000000000000000000000000000000000000000000`) provides internal tamper-evidence: any modification to an event's text, actor, timestamp, or sequence breaks the chain for all subsequent events.

However, **a genesis hash of zeros alone does NOT prevent an adversary with full database privileges from rewriting the entire history**. An attacker with raw PostgreSQL administrator access could modify a row, recalculate all SHA-256 digests from that row up to the chain head, and commit the modified database. To an internal verifier inspecting only the database rows, the forged chain would evaluate as mathematically valid.

Phase 36.2 hardens the external trust-anchor and digital checkpoint facility (`createCustodyCheckpoint`, `verifyCustodyCheckpoint`, `verifyChainWithCheckpoint`, `createCustodyCheckpointFromDbAsync`) to anchor custody chains to independent cryptographic witnesses outside the database.

---

### 2. Checkpoint Architecture & Payload Specification

A custody checkpoint is a signed cryptographic attestation issued by an authorized custody authority that seals the state of an evidence chain at a specific sequence number.

#### 2.1 Canonical Checkpoint Structure

```typescript
export interface CustodyCheckpoint {
  checkpointId: string;         // Unique UUID identifying this checkpoint
  evidenceId: string;           // Target evidence exhibit UUID
  latestSequenceNumber: number; // Highest committed sequence number certified
  latestEventHash: string;      // 64-character hex SHA-256 digest of latest event
  timestamp: string;            // Standard UTC ISO-8601 generation timestamp
  keyId: string;                // Identifier of signing key in key catalog
  algorithm: string;            // Cryptographic algorithm ("HMAC-SHA256" | "Ed25519")
  signature: string;            // Hex-encoded cryptographic signature
}
```

#### 2.2 Canonical Serialization & Signature Generation

The signature is computed over the deterministic canonical stringification of the payload:
```typescript
const payload = canonicalStringify({
  checkpointId,
  evidenceId: params.evidenceId.trim(),
  keyId: params.keyId.trim(),
  latestEventHash: params.latestEventHash.trim(),
  latestSequenceNumber: Number(params.latestSequenceNumber),
  timestamp: now,
});

// Test key implementation (HMAC-SHA256)
const signature = crypto
  .createHmac("sha256", secretOrKey)
  .update(payload, "utf8")
  .digest("hex");
```

---

### 3. Concurrency Protection During Checkpoint Generation

To prevent race conditions where a checkpoint is generated while concurrent appends are executing:
- `createCustodyCheckpointFromDbAsync` acquires the exhibit's exclusive serialization lock (`withEvidenceLock`) before reading the chain.
- The entire chain is verified from sequence #1 to head before the checkpoint is signed.
- If any event in the chain is broken, missing, or malformed, checkpoint generation fails closed with `Cannot checkpoint invalid or tampered chain`.

---

### 4. Adversarial Attack Mitigation & Verification Matrix

The test suite in `scripts/test_phase36_2_distributed_custody.mjs` validated all six trust-anchor adversarial vectors:

| Test ID | Adversarial Vector | Attack Mechanism | Detection / Defense Mechanism | Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-19** | Checkpoint Structure & Binding | Validate binding of `evidenceId`, `latestSequenceNumber`, `latestEventHash` | `verifyCustodyCheckpoint` verifies complete canonical payload | **PASSED** |
| **TC-20** | Signature Forgery | Attacker fabricates random 64-hex signature | `verifyCustodyCheckpoint` recomputes signature and rejects with `signature mismatch` | **PASSED** |
| **TC-21** | Checkpoint Payload Tampering | Attacker edits sequence number from 2 to 99 | Canonical payload changes -> signature validation fails | **PASSED** |
| **TC-22** | Cross-Exhibit Substitution | Attacker applies valid checkpoint from Exhibit A to Exhibit B | `verifyChainWithCheckpoint` checks `checkpoint.evidenceId === events[0].evidenceId` -> rejects with `evidenceId mismatch` | **PASSED** |
| **TC-23** | Stale Intermediate Checkpoint | Attacker presents valid checkpoint for seq #2 to certify an altered chain at seq #3 | `options: { requireHead: true }` verifies `checkpoint.latestSequenceNumber === chainHead.sequenceNumber` -> rejects with `sequence mismatch` | **PASSED** |
| **TC-24** | Authoritative Database Generation | Full database read, verification, and checkpoint issuance | `createCustodyCheckpointFromDbAsync` validates chain integrity and issues signed checkpoint | **PASSED** |

---

### 5. Honest Security Boundaries

| Threat Scenario | Protected by Zero-Genesis Chain Alone? | Protected by External Checkpoint Anchor? | Residual Risk / Limitation |
| :--- | :---: | :---: | :--- |
| **Unauthorized application user alters an action, actor, or detail** | **YES** | **YES** | Detected immediately by digest recomputation. |
| **Intermediate event deleted by rogue application query** | **YES** | **YES** | Sequence discontinuity detected immediately. |
| **Events reordered or skipped** | **YES** | **YES** | Sequence continuity check fails closed. |
| **Adversary with raw SQL access alters middle event without recalculating hashes** | **YES** | **YES** | `eventHash` mismatch on modified row; `prevEventHash` mismatch on subsequent row. |
| **Adversary with raw SQL access alters event AND recalculates entire chain from genesis** | **NO** | **YES** | Database chain alone cannot detect recalculation. External checkpoint detects digest divergence: `database chain digest does not match certified checkpoint digest`. |
| **Adversary compromises both database AND external signing key / checkpoint store** | **NO** | **NO** | **Total compromise boundary:** If an adversary controls the database, the external signing key, and the external storage, no software-only system can detect forgery. Hardware Security Modules (HSMs) and immutable write-once transparency logs are required to mitigate this boundary. |

---

### 6. Production Key Management & Readiness Status

#### 6.1 Cryptographic Algorithms for Production Readiness

1. **HMAC-SHA256 (Used for Synthetic Tests):**  
   Employed for Phase 36.1 and 36.2 automated tests using synthetic test keys (`synthetic_phase36_2_test_key_not_for_production`).  
   - *Limitation:* Symmetric cryptography requires the verifier to possess the shared secret, creating key exposure risk if verifiers are widely distributed.
2. **Ed25519 (Target Production Standard):**  
   Production checkpoints must transition to asymmetric Ed25519 digital signatures:
   - **Private Signing Key:** Stored exclusively inside an external Hardware Security Module (HSM) or dedicated Key Management Service (AWS KMS, Azure Key Vault, or Government PKI HSM). Ordinary database administrators have zero read access to the private key.
   - **Public Verification Key:** Widely published and embedded in court verification tools, allowing public verification without exposing signing authority.

#### 6.2 Key Rotation Protocol

- Every checkpoint incorporates a `keyId` attribute (e.g., `rakshak-custody-2026-v1`).
- Key rotation is non-destructive: historical checkpoints remain verifiable using the corresponding public key registered under that `keyId`.
- An audited key registry binds each `keyId` to its statutory validity period.

#### 6.3 Formal Production Blocker Statement

> [!CAUTION]
> **Production Signing-Key Provisioning is Strictly BLOCKED.**  
> Real production signing keys must NEVER be generated, committed to source control, or stored in application configuration files.  
> Deployment to production remains blocked until:
> 1. An external HSM or approved government cloud KMS is provisioned.
> 2. An out-of-band checkpoint publishing mechanism (e.g., append-only transparency log or court evidence repository) is established.
> 3. Formal cryptographic key custody policies and disaster-recovery procedures are signed off by accredited security authorities.
