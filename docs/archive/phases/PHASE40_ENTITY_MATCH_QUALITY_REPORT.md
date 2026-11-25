# RAKSHAK v3.0 — PHASE 40 ENTITY MATCH QUALITY REPORT
## Collision-Resistant Matching, False-Positive Prevention & Adversarial Scenario Verification

**Date:** 2026-10-25  
**Version:** 3.0.0-phase40  
**Status:** COMPLETE  
**Target Environment:** Isolated Synthetic Test Environment (`rakshak_phase40_test`)  
**Security Invariant:** Active Development Database (`prisma/dev.db`) & Evidence Cold Storage (`uploads/raw/`) 100% Preserved & Untouched.

---

## 1. Objective & Epistemic Match Philosophy

In criminal intelligence and cyber forensics, false-positive entity matching carries severe investigative consequences. Erroneously linking two distinct cases due to an uncurated phone number, shared bank branch code, or customer-care helpline can mislead law enforcement, violate privacy, and taint chain of custody.

Phase 40 establishes strict collision-resistant entity matching guidelines:
1. **No Opaque Confidence Scoring:** Matches are not assigned arbitrary floating-point probabilistic scores. Every candidate link is backed by deterministic, explainable rule sets (`matchRule`) and versioned normalization provenance (`normalizationVersion: "v2"`).
2. **Never Treat Shared Attributes as Proof of Identity:** A shared identifier (e.g. phone, IP, email) constitutes an investigative lead, never conclusive proof of wrongdoing, identity, or guilt.
3. **Strict Separation of Candidate vs Confirmed:** Normalization produces `CANDIDATE` links with `POTENTIAL_MATCH` or `EXACT_IDENTIFIER_MATCH` confidence categories. Only authorized human investigators with documented rationale can elevate links to `CONFIRMED`.
4. **Epistemic Invalidation on Evidence Failure:** If source evidence binary integrity check fails, dependent facts and candidate links are flagged with integrity alerts (`INTEGRITY_ALERT`).

---

## 2. Match Classification Rules & Rule Engine V2

In [lib/entityResolution.ts](file:///E:/Rakshak/lib/entityResolution.ts), match evaluation is governed by versioned match rules:

| Rule Identifier | Trigger Condition | Classification Outcome | Link Type |
|---|---|---|---|
| `RULE_EXACT_NORM_PHONE_V2` | Both phone inputs are valid E.164, non-generic, identical country code and national number | Candidate Exact Match | `EXACT_IDENTIFIER_MATCH` |
| `RULE_GENERIC_SHARED_PHONE_V2` | Numbers match, but value is flagged as helpline (`1930`, `112`), toll-free (`1800`), or sequential dummy | Candidate Potential Match | `POTENTIAL_MATCH` |
| `RULE_EXACT_NORM_EMAIL_V2` | Both emails valid RFC 5322, normalized, non-generic mailbox | Candidate Exact Match | `EXACT_IDENTIFIER_MATCH` |
| `RULE_GENERIC_SHARED_EMAIL_V2` | Matching emails, but domain/user is helpdesk (`support@`, `info@`, etc.) | Candidate Potential Match | `POTENTIAL_MATCH` |
| `RULE_EXACT_NORM_UPI_V2` | Valid matching Virtual Payment Address on supported PSP handle | Candidate Exact Match | `EXACT_IDENTIFIER_MATCH` |
| `RULE_SHARED_ACCOUNT_V2` | Core banking account numbers match exactly | Shared Account Match | `SHARED_ACCOUNT` |
| `RULE_SHARED_DEVICE_HASH_V2` | Exact cryptographic hardware hash match (MAC / IMEI / SHA-256) | Shared Hardware Match | `SHARED_HASH` |
| `RULE_GENERIC_SHARED_IP_V2` | Matching IP in RFC 1918 private range or CGNAT (`100.64.0.0/10`) | Candidate Potential Match | `POTENTIAL_MATCH` |
| `RULE_EXACT_NORM_UTR_V2` | Exact 12-digit or alphanumeric financial transaction reference match | Transaction Match | `TRANSACTION_REFERENCE` |

### Prevention of Cross-Border Phone Collisions
Under V2, international phone numbers retain their E.164 calling code:
- US number: `+1 (987) 654-3210` normalizes to `+19876543210`.
- Indian number: `9876543210` normalizes to `+919876543210`.
- **Outcome:** `evaluateCandidateLink` returns `isMatch: false` with explanation:
  `"Normalized values do not match: '+19876543210' != '+919876543210'"`.
  Cross-border collisions are completely eliminated.

---

## 3. Workstream D — Adversarial Normalization Scenarios (30/30 Passed)

The adversarial test suite in [scripts/test_phase40_identifier_normalization.mjs](file:///E:/Rakshak/scripts/test_phase40_identifier_normalization.mjs) verified 30 distinct scenarios against `rakshak_phase40_test`:

| Scenario ID | Test Scenario Description | Execution Result | Observed Diagnostic Output |
|---|---|---|---|
| **TC-01** | Valid Indian domestic phone normalizes to +91 E.164 | **PASSED** | `+919876543210` (TRAI mobile valid) |
| **TC-02** | Correctly formatted Indian international forms normalize consistently | **PASSED** | All 4 variations (`+91...`, `0091...`, `91...`, domestic) resolve to `+919876543210` |
| **TC-03** | Invalid domestic number rejected or flagged with ambiguity | **PASSED** | `1234567890` `isValid=false`, `0000000000` `isGeneric=true` |
| **TC-04** | International number preserves authentic country calling code | **PASSED** | US: `+14155552671`, UK: `+447911123456`, UAE: `+971501234567` |
| **TC-05** | Differently prefixed international numbers sharing last 10 digits do not collide | **PASSED** | `isMatch=false` (`+19876543210` != `+919876543210`) |
| **TC-06** | Arbitrary digit sequence not mistakenly converted to +91 phone | **PASSED** | Bank account: `1234567890`, UTR: `123456789012` distinct |
| **TC-07** | PBX extensions isolated from canonical E.164 number into metadata | **PASSED** | Canonical: `+919820123456`, Ext: `402` |
| **TC-08** | Leading international dialing prefix (`00`) converted consistently to `+` | **PASSED** | `001...` -> `+14155552671`, `0091...` -> `+919876543210` |
| **TC-09** | Empty, null, and non-numeric malformed inputs fail safely | **PASSED** | All malformed inputs fail closed with `isValid=false` |
| **TC-10** | Original input preserved alongside normalized value | **PASSED** | Raw value preserved in full for review provenance |
| **TC-11** | Deterministic normalization across 50 repeated executions | **PASSED** | Identical SHA-256 digest across 50 repeated cycles |
| **TC-12** | Active and historical normalization versions explicitly versioned | **PASSED** | Active: `v2`, Legacy: `v1`, Phone: `PHONE_NORM_V2` |
| **TC-13** | Normalization version change strictly preserves confirmed historical links | **PASSED** | Confirmed link status `CONFIRMED` preserved; 0 mutated |
| **TC-14** | Generic email addresses marked non-unique with limitation tags | **PASSED** | `support@` flagged `isGeneric: true`, personal `isGeneric: false` |
| **TC-15** | Emergency and cyber helplines prevented from becoming unique matches | **PASSED** | `1930` classified as `POTENTIAL_MATCH`, `isGeneric: true` |
| **TC-16** | Private and Carrier-Grade NAT (CGNAT) IPs flagged as non-attributable | **PASSED** | `192.168.1.1` & `100.64.0.1` generic; Public static specific |
| **TC-17** | URL path canonicalization preserves distinct endpoint identities | **PASSED** | Distinct endpoints do not match (`isMatch=false`) |
| **TC-18** | UPI VPA handles normalized distinctly from email addresses | **PASSED** | UPI `merchant@okhdfcbank` distinct from email `merchant@gmail.com` |
| **TC-19** | 12-digit financial UTR reference never prefixed as +91 phone | **PASSED** | UTR `919876543210` retains UTR typing without `+` |
| **TC-20** | Cryptographic digests and MAC addresses strictly validated for hex format | **PASSED** | Valid 64-hex SHA-256 and MAC accepted; malformed non-hex rejected |
| **TC-21** | Candidate evaluation preserves complete multi-case provenance anchors | **PASSED** | `sourceCaseId`, `targetCaseId`, `evidenceId` intact |
| **TC-22** | Ambiguous or generic values gated from exact confirmed matching | **PASSED** | Toll-free `1800...` gated to `POTENTIAL_MATCH` |
| **TC-23** | Reviewed relationship preserved when normalized value is unchanged under V2 | **PASSED** | Unaffected count = 1, `limitations` unaltered |
| **TC-24** | Affected candidate link flagged for re-evaluation upon normalization divergence | **PASSED** | Flagged with `[FLAGGED_FOR_REEVALUATION_V2]` |
| **TC-25** | Phase 37 cross-case entity resolution compatibility maintained | **PASSED** | Evaluated cleanly under `RULE_EXACT_NORM_EMAIL_V2` |
| **TC-26** | Distinct financial bank accounts do not produce false collisions | **PASSED** | `isMatch=false` between different accounts |
| **TC-27** | IFSC code normalized as facility identifier | **PASSED** | Normalized as branch facility code; `isGeneric: true` |
| **TC-28** | Keyed HMAC digest calculation is one-way and deterministic | **PASSED** | Deterministic 64-character hex digest |
| **TC-29** | Active development database (`prisma/dev.db`) remains 100% untouched | **PASSED** | Initial and final hash: `dd24614b14f1b4cf...` |
| **TC-30** | Cold storage evidence exhibits (`uploads/raw/`) remain 100% unaltered | **PASSED** | 560 files preserved; manifest hash `bdc91bb78c603d21...` |

---

## 4. Graph Privacy & Zero Cross-Case Metadata Leakage

In [lib/graphIntelligence.ts](file:///E:/Rakshak/lib/graphIntelligence.ts), graph queries across cross-case entity networks strictly enforce multi-tenant authorization:
- Cross-case candidate links referencing foreign cases for which the investigator lacks an approved `AccessGrant` are excluded from graph responses.
- The existence, counts, or case numbers of unauthorized foreign cases are not leaked in graph summaries.
- Traversal depth is strictly capped at `maxDepth = 3`, and max nodes are capped at `maxNodes = 100` to prevent denial-of-service traversal across cyclic entity clusters.

---

## 5. Conclusion & Operational Impact

The implementation of Phase 40 eliminates the false-match vectors introduced by naive 10-digit phone normalization. By combining ITU-T E.164 country code retention, TRAI domestic rules, dedicated UTR/Account validators, generic infrastructure classification, and human-in-the-loop candidate re-evaluation, the Rakshak entity resolution engine achieves high forensic precision while preserving historical case integrity.
