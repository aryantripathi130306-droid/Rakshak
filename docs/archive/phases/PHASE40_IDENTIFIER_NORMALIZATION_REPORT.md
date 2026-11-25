# RAKSHAK v3.0 — PHASE 40 IDENTIFIER NORMALIZATION REPORT
## Comprehensive Audit, Formal Normalization Specifications & False-Match Prevention

**Date:** 2026-10-25  
**Version:** 3.0.0-phase40  
**Status:** COMPLETE  
**Target Environment:** Isolated Synthetic Test Environment (`rakshak_phase40_test`)  
**Security Invariant:** Active Development Database (`prisma/dev.db`) & Evidence Cold Storage (`uploads/raw/`) 100% Preserved & Untouched.

---

## 1. Executive Summary & Problem Diagnosis

During previous iterations (V1 normalization), phone number normalization across the system relied on an ad-hoc sanitization rule that removed non-digit characters, extracted the final ten digits, and blindly prepended `+91`:
```typescript
// Legacy V1 Anti-pattern (DEPRECATED):
const digits = raw.replace(/\D/g, "");
return digits.length >= 10 ? `+91${digits.slice(-10)}` : raw;
```

### Critical Flaws and Collision Risks in Legacy V1:
1. **International Country Code Erasure & False Collisions:**
   - Any international phone number (e.g., US `+1 9876543210`, UK `+44 9876543210`, UAE `+971 9876543210`) sharing the same final 10 digits as an Indian domestic subscriber was forcefully truncated and rewritten as `+919876543210`. This manufactured catastrophic false cross-border entity collisions across unrelated investigative cases.
2. **Type Conflation & Identifier Masking:**
   - Bank account numbers, 12-digit transaction UTRs, Unix epoch timestamps, or device serials containing 10 or more digits were inadvertently converted into `+91` Indian mobile numbers if passed through phone normalization routines.
3. **Invalid Indian Domestic Number Admission:**
   - In India, TRAI (Telecom Regulatory Authority of India) strictly restricts national mobile allocations to leading digits `6`, `7`, `8`, and `9`. V1 admitted numbers such as `0000000000`, `1111111111`, and `1234567890`, turning arbitrary noise or dummy records into verified matches.
4. **Extension Blurring:**
   - Domestic and corporate PBX extensions (e.g., `+91 98201 23456 ext 402`) were either stripped or mixed into digits, corrupting the canonical E.164 representation.
5. **Lack of Provenance and Versioning:**
   - Normalization occurred in place without recording the underlying normalization algorithm version, raw source value, or whether the identifier was ambiguous, generic, or public infrastructure.

---

## 2. Workstream A — Canonical Phone Normalization Policy (V2)

Phase 40 introduces a formal, documented phone normalization specification implemented in [lib/validators.ts](file:///E:/Rakshak/lib/validators.ts) via `PHONE_NORMALIZATION_VERSION = "PHONE_NORM_V2"`.

### Policy Directives

| Criterion | Implementation Specification |
|---|---|
| **International Numbers** | Must preserve the authentic ITU-T E.164 country calling code (e.g., `+1`, `+44`, `+971`, `+91`). Never strip or discard the country code. |
| **Leading Dialing Prefixes** | International direct dialing prefix `00` is standardized to `+` (e.g., `0014155552671` -> `+14155552671`), with guardrails preventing zero-strings from being misidentified. |
| **Indian Domestic Numbers** | Admitted only when matching TRAI mobile allocation (`^[6-9]\d{9}$`) or valid STD landline format (`^[2-5]\d{9}$`). Prepends `+91` only when input satisfies domestic criteria. |
| **PBX / Office Extensions** | Extensions (e.g., `ext 402`, `x101`, `#12`) are extracted, isolated, and stored in separate metadata (`details.extension`). They are never merged into canonical E.164. |
| **Dummy / Sequential Digits** | Repeated digits (`9999999999`), all zeros (`0000000000`), or sequential runs are flagged with `isGeneric: true`, preventing unique entity resolution. |
| **Emergency / Helplines** | Public infrastructure numbers (`100`, `112`, `1930`, `1090`, `1800...`, `1860...`) are tagged as `isGeneric: true`, preventing false suspect linkage. |
| **Provenance Isolation** | Raw input string is strictly preserved alongside normalized value, rule version (`PHONE_NORM_V2`), and diagnostic warnings. |
| **Historical Preservation** | Existing confirmed historical entity links and fact reviews are immutable; changed normalization versions flag candidates for human re-review without rewriting history. |

### Architectural Call-Site Audit and Refactoring

Every call-site of phone normalization was audited and reconciled:
- [lib/validators.ts](file:///E:/Rakshak/lib/validators.ts): Added `normalisePhoneDetailed(raw)` and updated `normalisePhone(raw)`.
- [lib/factExtraction.ts](file:///E:/Rakshak/lib/factExtraction.ts): Refactored `normalisePhoneNumber(raw)` to delegate to `normalisePhone(raw)`.
- [lib/entityResolution.ts](file:///E:/Rakshak/lib/entityResolution.ts): Refactored `normalizePhone(raw)` to return `PhoneNormalizationDetails` with version `PHONE_NORM_V2`.
- [lib/factReview.ts](file:///E:/Rakshak/lib/factReview.ts): Enforced human-reviewed acceptance before feeding downstream graph resolution.
- [lib/graphIntelligence.ts](file:///E:/Rakshak/lib/graphIntelligence.ts): Filtered out unreviewed or generic entity links from candidate matching.

---

## 3. Workstream B — Versioned Normalization Matrix Across Identifier Types

Phase 40 establishes explicit, versioned normalization across all 11 identifier types supported in the Rakshak investigative ecosystem.

| Identifier Type | Version | Accepted Input Format | Normalization Algorithm | Validation Requirements | Collision Vectors & Mitigation | Exact Match Eligibility | Generic / Non-Unique Handling |
|---|---|---|---|---|---|---|---|
| **PHONE** | `PHONE_NORM_V2` | Domestic 10-digit, 11-digit (0-lead), 12-digit (91-lead), or international with `+`/`00` | ITU-T E.164 parsing, TRAI mobile/STD verification, PBX extension isolation | Length 8–15 digits; Indian mobile must begin with 6–9 | **Vector:** Truncation collision. **Mitigation:** Retain country code; reject arbitrary digit slices. | **Yes** (if valid & non-generic) | Helplines (`1930`, `112`) & `1800` toll-free flagged `isGeneric: true`; downgraded to `POTENTIAL_MATCH`. |
| **EMAIL** | `v2` | RFC 5322 format `user@domain.tld` | Lowercase conversion, trim whitespace, normalize Gmail plus-addressing | Regex email structure, valid TLD | **Vector:** Disposable & support desks. **Mitigation:** Known helpdesk domain/user dictionary (`support@`, `info@`, `admin@`). | **Yes** (personal emails) | Helpdesks and generic addresses tagged `isGeneric: true`; cannot produce confirmed identity match. |
| **UPI** | `v2` | Virtual Payment Address `username@bankhandle` | Lowercase conversion, trim whitespace | Exactly one `@`, valid PSP suffix (`okhdfcbank`, `apl`, `paytm`, etc.) | **Vector:** Conflating with email. **Mitigation:** Explicit PSP handle validation and separate `UPI` entity type. | **Yes** (unique VPA) | Merchant aggregators (`paytmqr@...`) tagged `isGeneric: true`. |
| **ACCOUNT** | `v2` | Core Banking Account Number (9–18 alphanumeric/digits) | Uppercase, trim whitespace, strip hyphens/spaces | Length 9–18 chars, alphanumeric check | **Vector:** Substring matching. **Mitigation:** Exact match only; distinct from phone numbers. | **Yes** (when bank/IFSC bound) | Shared pooling accounts tagged as non-unique. |
| **IFSC** | `v2` | 11-character Indian Financial System Code | Uppercase, trim whitespace | `^[A-Z]{4}0[A-Z0-9]{6}$` | **Vector:** Treating branch as individual. **Mitigation:** Marked facility identifier (`isGeneric: true`). | **No** (facility level) | Never matches persons; matches bank branch facility only. |
| **UTR** | `v2` | Unique Transaction Reference (12 digits or 12–22 alphanumeric) | Uppercase, strip whitespace | 12-digit numeric (NEFT/RTGS/IMPS) or alphanumeric ref | **Vector:** Conflating 12-digit UTR with 12-digit phone (`91...`). **Mitigation:** Dedicated `normalizeUtr` validator. | **Yes** (transaction level) | Unique per transaction; distinct from party identities. |
| **DOMAIN** | `v2` | FQDN (e.g. `sub.domain.com`) | Lowercase, trim whitespace, remove trailing dot, strip `www.` | Valid hostname regex, recognized TLD | **Vector:** Cloud hosters (AWS S3, Firebase). **Mitigation:** Shared SaaS domains flagged generic. | **Yes** (specific domain) | Shared hosters flagged generic. |
| **URL** | `v2` | HTTP/HTTPS URI | Parse via URL standard, lowercase scheme/host, preserve path & query, remove trailing slash | Valid URL syntax, HTTP/HTTPS scheme | **Vector:** Stripping critical query parameters. **Mitigation:** Normalize paths while preserving unique resource query keys. | **Yes** (exact endpoint) | Root search engines flagged non-unique. |
| **IP** | `v2` | IPv4 or IPv6 dotted/colon notation | RFC 791/4291 parsing, expand/trim | Valid octets (0–255), valid IPv6 groups | **Vector:** Private RFC 1918 & CGNAT ranges. **Mitigation:** Strict subnet evaluation (`10/8`, `172.16/12`, `192.168/16`, `100.64/10`). | **Conditional** (Public static IP only) | RFC 1918 & CGNAT flagged `isGeneric: true`, preventing suspect identity claims. |
| **DEVICE_HASH** | `v2` | SHA-256 (64 hex), MD5 (32 hex), or MAC (12/17 hex) | Lowercase, strip colons/hyphens | Strict hex-length check | **Vector:** Truncated hashes or invalid strings. **Mitigation:** Hex regex validation. | **Yes** (hardware bound) | Generic mock digests (`0000...`) flagged generic. |
| **DATE** | `v2` | ISO-8601 `YYYY-MM-DD` | Parse ISO string, normalize to `YYYY-MM-DD` UTC | Valid calendar date | **Vector:** Ambiguous local dates (`MM/DD` vs `DD/MM`). **Mitigation:** Require ISO format. | **No** (temporal metadata) | Temporal clustering only; never unique identity proof. |

---

## 4. Workstream C — Candidate Link Re-Evaluation Engine

To safeguard historical data integrity, Phase 40 implements `reevaluateCandidateLinks(prisma, options)` in [lib/entityResolution.ts](file:///E:/Rakshak/lib/entityResolution.ts).

### Core Re-Evaluation Invariants:
1. **Analyst-Confirmed Links Are Immutable:**
   - Any link with `status: "CONFIRMED"` or `confidenceCategory: "ANALYST_CONFIRMED"` is strictly preserved without modification. The system increments `confirmedPreservedCount` and does not mutate the record.
2. **Safe Identification of Affected Candidates:**
   - Unreviewed candidate links (`status: "CANDIDATE"`) whose normalized value diverges under V2, or whose value is recognized as generic/shared infrastructure, are tagged with `[FLAGGED_FOR_REEVALUATION_V2]` in their `limitations` field.
3. **No Automatic Promotion or Confirmation:**
   - Re-evaluation never automatically confirms relationships. All updates require human review and audit provenance.
4. **Tenant and Case Scoping:**
   - Re-evaluation operates within authorized case boundaries (`caseId` option) or across candidate links without exposing cross-department data across RLS boundaries.

---

## 5. Verification Summary

The complete adversarial normalization suite was executed in `scripts/test_phase40_identifier_normalization.mjs`:
- **Scenarios Executed:** 30
- **Passed:** 30 / 30 (100.0%)
- **Failed:** 0
- **dev.db Hash:** `dd24614b14f1b4cf8413b674e27bba8459eec6c182536537ab085dbd647af3a9` (Preserved)
- **uploads/raw/ Exhibits:** 560 files (Preserved)

All objectives of Workstreams A and B are fully satisfied.
