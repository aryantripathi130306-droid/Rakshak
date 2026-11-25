# RAKSHAK v3.0 — PHASE 37 ENTITY RESOLUTION & PROVENANCE REPORT
## Deterministic Normalization, Candidate Matching, Provenance Tracing & Human-in-the-Loop Review

### 1. Executive Summary

Phase 37 establishes a deterministic, explainable entity resolution and link provenance engine for Rakshak v3.0. Automated systems generate candidate associations based on verifiable, type-specific matching rules. Under no circumstances are automated leads treated as confirmed relationships, proof of identity, or evidence of guilt.

All candidate relationships maintain full backward traceability to originating cases, evidence records, and extracted facts. Final conclusions, status transitions, and analytical confirmations remain under strict, attributable human investigator control.

---

### 2. Supported Entity Types & Normalization Rules (Version `v1`)

Identifiers are normalized deterministically according to their semantic type prior to candidate matching. General string truncation or uniform casing is rejected in favor of type-specific canonicalization rules.

| Entity Type | Normalization Rule | Example Input | Normalized Canonical Value (`v1`) | Masked Display Value |
| :--- | :--- | :--- | :--- | :--- |
| **`EMAIL`** | Lowercase trim, eliminate duplicate dots in Gmail local parts, strip trailing dot. | `Suspect.One+spam@Gmail.com` | `suspectone+spam@gmail.com` | `s***e@gmail.com` |
| **`PHONE`** | Strip all non-digit chars, canonicalize Indian 10-digit / leading zero into E.164 standard `+91`. | `098765-43210` / `9876543210` | `+919876543210` | `+91 98*** **210` |
| **`UPI`** | Lowercase trim, validate handle format (`user@bank`). | `Merchant.Pay@OKHDFC` | `merchant.pay@okhdfc` | `m***y@okhdfc` |
| **`ACCOUNT`** | Strip spaces and hyphens, uppercase. | `1234 - 5678 - 9012` | `123456789012` | `**** **** 9012` |
| **`IFSC`** | Uppercase alphanumeric, trim whitespace. | `hdfc 0001234` | `HDFC0001234` | `HDFC0001234` |
| **`DOMAIN`** | Lowercase trim, strip leading `www.`, remove protocol if present. | `Https://WWW.Phish-Portal.Org/` | `phish-portal.org` | `phish-portal.org` |
| **`URL`** | Canonicalize protocol & hostname to lowercase, remove trailing slash. | `HTTP://Target.Com/login/?ref=1` | `http://target.com/login/?ref=1` | `http://target.com/login/?ref=1` |
| **`IP`** | Trim, strip port, validate IPv4 octet bounds (0-255). | `192.168.1.1:8080` | `192.168.1.1` | `192.168.1.1` |
| **`DEVICE_HASH`** | Hexadecimal lowercasing, length validation (MD5=32, SHA-256=64). | `A1B2C3D4...E5F6` | `a1b2c3d4...e5f6` | `a1b2...e5f6` |
| **`TELEGRAM`** | Strip leading `@` or URL prefix, lowercase. | `@cyber_group_bot` | `cyber_group_bot` | `@c***t` |
| **`UTR`** | Uppercase alphanumeric transaction reference. | `utr-2026-998811` | `UTR2026998811` | `UTR***98811` |

---

### 3. Generic & High-Volume Shared Identifier Detection

A critical security and investigative constraint is that common, generic, or potentially shared infrastructure must never be treated as conclusive linking evidence.

The engine actively flags identifiers matching known generic profiles:
1. **Generic Email Accounts:** High-volume shared addresses (e.g. `info@gmail.com`, `admin@yahoo.com`, `support@outlook.com`, `contact@...`).
2. **Generic Phone Numbers:** Emergency helplines (1930, 100, 112, 1091), telecom automated centers (198, 121), and dummy numbers.
3. **Private & Non-Routable IP Addresses:** Loopback (`127.0.0.1`), RFC-1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and carrier-grade NAT.
4. **Shared Generic Gateways:** Universal payment gateways and dummy testing handles.

When a generic identifier is evaluated:
- The `isGeneric` property is set to `true`.
- The `confidenceCategory` is clamped to `POTENTIAL_MATCH` (never `EXACT_IDENTIFIER_MATCH`).
- A mandatory `limitations` warning is attached (e.g. *"Shared or generic identifier. High probability of coincidence; cannot establish common actor identity without secondary corroboration."*).

---

### 4. Privacy & Masked Representations

To safeguard privacy in visual intelligence graphs:
- Visual graph nodes and summary tables display masked representations (`maskedValue`) by default via `maskIdentifier()`.
- Sensitive identifiers can also be evaluated using keyed cryptographic HMAC-SHA256 digests (`computeKeyedDigest()`).
- In accordance with constraints, the keyed digest secret is kept strictly outside the database and source control, provided via process environment variables (`ENTITY_DIGEST_SECRET`), preventing low-entropy dictionary reversal while ensuring cross-case join parity.

---

### 5. Provenance Model & Source-of-Truth Separation

The `EntityLink` model enforces rigorous provenance tracing without duplicating or corrupting original authoritative source records:

```
┌────────────────────────────┐         ┌────────────────────────────┐
│      Case (Delhi Unit)     │         │     Case (Mumbai Unit)     │
│   Auth: Case Management    │         │   Auth: Case Management    │
└──────────────┬─────────────┘         └──────────────┬─────────────┘
               │                                      │
       sourceCaseId                           targetCaseId
               │                                      │
               ▼                                      ▼
    ┌────────────────────────────────────────────────────────────┐
    │                        EntityLink                          │
    │  - entityType: PHONE                                       │
    │  - normalizedValue: +919876543210                          │
    │  - linkType: EXACT_IDENTIFIER_MATCH                        │
    │  - status: CANDIDATE / UNDER_REVIEW / CONFIRMED            │
    │  - matchRule: RULE_EXACT_NORM_PHONE_V1                     │
    │  - sourceEvidenceId ──► Authoritative Evidence Exhibit     │
    │  - targetEvidenceId ──► Authoritative Evidence Exhibit     │
    │  - sourceEntityId   ──► Authoritative CaseEntity / Fact    │
    │  - version: Concurrency Sequence Number                    │
    └────────────────────────────────────────────────────────────┘
                                   │
                               1-to-Many
                                   ▼
    ┌────────────────────────────────────────────────────────────┐
    │                      EntityLinkReview                      │
    │  - fromStatus / toStatus                                   │
    │  - reviewerId / reviewerBadge / reviewerRole (Server-Side) │
    │  - rationale: Mandatory rationale >= 5 chars               │
    │  - reviewedAt: Immutable UTC timestamp                     │
    └────────────────────────────────────────────────────────────┘
```

If an `EntityLink` is created without verifiable source provenance (`sourceCaseId` or `sourceEvidenceId`), system validation blocks it from ever transitioning to a verified status.

---

### 6. Controlled Human Review Workflow

Candidate links are never automatically promoted to confirmed findings. All consequential status updates require human intervention governed by a formal finite-state machine.

#### 6.1 State Machine Transition Rules
```
               ┌─────────────┐
               │  CANDIDATE  │ (Initial automated state)
               └──────┬──────┘
                      │
                      ▼
             ┌─────────────────┐
             │  UNDER_REVIEW   │ ◄──────────────────────┐
             └────────┬────────┘                        │
                      │                                 │
         ┌────────────┴────────────┐                    │
         ▼                         ▼                    │ (Fact Invalidation)
   ┌───────────┐             ┌───────────┐              │
   │ CONFIRMED │             │ REJECTED  │              │
   └─────┬─────┘             └───────────┘              │
         │                                              │
         ▼                                              │
    ┌─────────┐                                         │
    │ REVOKED │ ────────────────────────────────────────┘
    └─────────┘
```

1. **`CANDIDATE` -> `UNDER_REVIEW`**: Initiated when an investigator commences formal examination.
2. **`UNDER_REVIEW` -> `CONFIRMED`**: Analyst confirms link validity with mandatory investigative rationale (>= 5 chars).
3. **`UNDER_REVIEW` -> `REJECTED`**: Analyst rejects candidate association with mandatory rationale.
4. **`CONFIRMED` -> `REVOKED`**: Analyst revokes earlier confirmation due to emerging contrary evidence.
5. **Direct Jumps Prohibited:** Direct transition from `CANDIDATE` to `CONFIRMED` without an `UNDER_REVIEW` state or required rationale is rejected server-side.

#### 6.2 Reviewer Authorization Gating
Only authorized roles may review entity links:
- `ADMIN`
- `SUPERVISOR`
- `INVESTIGATOR`
- `ANALYST`

Submissions from unauthenticated callers or unauthorized roles (e.g. `EXTERNAL_AUDITOR`, `READONLY_OFFICER`) are rejected with `403 Forbidden`. The reviewer identity is resolved strictly from trusted server-side session credentials, ignoring client-supplied headers.

#### 6.3 Optimistic Concurrency Control
Each `EntityLink` maintains an integer `version` field. When a review submission occurs:
```sql
UPDATE "EntityLink" 
SET "status" = $toStatus, "version" = "version" + 1, "updatedAt" = NOW()
WHERE "id" = $linkId AND "version" = $expectedVersion;
```
If two analysts submit conflicting reviews concurrently, the second transaction detects a version mismatch and fails safely with `409 Conflict`, preventing silent overwrites.

---

### 7. Fact Correction & Evidence Incident Invalidation Hooks

The integrity of intelligence relationships is dynamically linked to underlying case evidence:

1. **Source Record Invalidation (`invalidateEntityLinksForFact`):**
   - When an underlying `ExtractedFact` or `CaseEntity` is corrected, superseded, or retracted, the platform executes `invalidateEntityLinksForFact()`.
   - Dependent links with status `CONFIRMED` or `CANDIDATE` are immediately transitioned to `UNDER_REVIEW`.
   - An explanatory note (*"Underlying source fact was modified/retracted. Review required."*) is attached to `limitations`.
   - An immutable audit trail entry is logged.

2. **Evidence Integrity Incidents (`flagEntityLinksForEvidenceIncident`):**
   - If an evidence exhibit fails cryptographic hash verification, suffers a custody anomaly, or is marked compromised, `flagEntityLinksForEvidenceIncident()` is invoked.
   - Any dependent `EntityLink` has its `limitations` field immediately updated (*"[EVIDENCE INTEGRITY INCIDENT] Supporting evidence was flagged for integrity check failure."*).
   - This ensures intelligence visualizations immediately reflect evidence unreliability without silently masking the underlying chain of custody.

---

### 8. Verification & Empirical Results

The entity resolution engine was verified under 35 rigorous scenarios in `scripts/test_phase37_cross_case_intelligence.mjs` against synthetic database `rakshak_phase37_test`:
- **Scenario TC-01:** Normalized exact phone/email matching creates valid `CANDIDATE` links.
- **Scenario TC-02:** Formatting variations (E.164, local dot variants) normalize consistently.
- **Scenario TC-03:** Unsupported entity types (e.g. biometric traits) are safely rejected.
- **Scenario TC-04:** Generic identifiers (`info@gmail.com`, `192.168.1.1`) correctly flagged as `isGeneric = true` and `POTENTIAL_MATCH`.
- **Scenario TC-05 & 06:** Provenance integrity enforced; missing provenance blocks confirmation.
- **Scenario TC-07, 08 & 09:** Reviewer authentication, mandatory rationale, and role gating verified.
- **Scenario TC-10 & 11:** Rejection and revocation preserve immutable review ledger in `EntityLinkReview`.
- **Scenario TC-24, 25 & 26:** Invalid transitions, concurrent review races (version conflict), and duplicate candidate insertions handled safely.
- **Scenario TC-27:** Historical normalization versions (`v1`) remain immutable upon engine evolution.
- **Scenario TC-28 & 29:** Fact corrections trigger automatic review invalidation, and evidence integrity incidents propagate warnings to dependent links.

---

### 9. Limitations & Ethical Safeguards

1. **Investigative Lead Only:** No entity resolution link constitutes legal proof of identity or culpability.
2. **No Predictive Scoring:** The platform strictly prohibits crime prediction algorithms, automated arrest recommendations, or automated adverse decisions.
3. **No Biometric Identification:** Facial recognition, voice biometrics, and sensitive trait inferences are completely excluded from the entity resolution architecture.
4. **Human Accountability:** Consequential analytical findings require recorded, attributable human oversight.
