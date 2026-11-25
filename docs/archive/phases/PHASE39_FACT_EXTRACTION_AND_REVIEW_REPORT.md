# RAKSHAK v3.0 — PHASE 39 FACT EXTRACTION & HUMAN REVIEW REPORT
**Workstream C & D: Structured Fact Extraction, Deterministic Normalization & Human Validation**
**Date:** October 25, 2026 | **Classification:** Official Law Enforcement Sensitive (Synthetic Sandbox Evaluation)

---

### 1. Executive Summary

Phase 39 introduces a deterministic candidate-fact extraction layer coupled with an attributable, immutable human-in-the-loop review workflow. Structured investigative identifiers (UPI VPAs, Indian mobile numbers, emails, IFSC bank codes, UTR transaction references, IP addresses, domains, dates, and cryptographic hashes) are extracted from source text with precise character offsets and bounding references.

Candidate facts are initially tagged with review status `PENDING_REVIEW` and epistemic classification `UNVERIFIED`. Under strict platform rules, candidate facts **never** automatically become confirmed entity links, cross-case intelligence, or definitive claims of guilt. Validation and correction require authenticated human review by authorized officers (`INVESTIGATOR`, `SUPERVISOR`, `ADMIN`), with mandatory justification rationale and immutable review logs.

---

### 2. Supported Fact Types, Extraction Rules & Normalization

#### 2.1 Extraction Rule Engine (`REGEX_V1`, Version `1.0.0`)
All extraction rules are deterministic, versioned, and executed strictly in-process without probabilistic or generative hallucinations:

| Fact Type | Token Regex Pattern | Extraction Rule ID | Normalization Rule | Limitations / Warning Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **UPI** | `[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}` | `REGEX_UPI_V1` | Lowercase string, whitespace trimmed | VPA format validation |
| **PHONE** | `(?:\+91\|0)?[6-9]\d{9}` | `REGEX_PHONE_V1` | Strips all non-digits, extracts last 10 digits, formats to E.164 (`+91XXXXXXXXXX`) | Non-unique if shared family device |
| **EMAIL** | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | `REGEX_EMAIL_V1` | Lowercase string, whitespace trimmed | Generic email provider warning (`gmail.com`, `yahoo.com`, `outlook.com`) |
| **IFSC** | `[A-Z]{4}0[A-Z0-9]{6}` | `REGEX_IFSC_V1` | Uppercase string, whitespace trimmed | Validates 5th character is '0' |
| **UTR** | `\b(?:\d{12}\|[A-Z0-9]{12,22})\b` | `REGEX_UTR_V1` | Uppercase string, whitespace trimmed | Bank transaction reference |
| **IP** | `\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b` | `REGEX_IP_V1` | IPv4 quad-octet string | Flags RFC 1918 private IPs (`10.x`, `192.168.x`, `172.16-31.x`) and loopback (`127.0.0.1`) as non-unique |
| **DOMAIN** | `(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/[^\s]*)?` | `REGEX_DOMAIN_V1` | Hostname extracted, protocol and path stripped, lowercase | Flags shared CDN/public domains |
| **DATE** | `\b(?:\d{4}-\d{2}-\d{2}\|\d{2}[\/\-]\d{2}[\/\-]\d{4})\b` | `REGEX_DATE_V1` | Standard ISO 8601 (`YYYY-MM-DD`) | Context-dependent timestamp |
| **HASH** | `\b[a-fA-F0-9]{64}\b` | `REGEX_HASH_V1` | 64-char lowercase hexadecimal | Cryptographic evidence digest |

#### 2.2 Preservation of Raw vs Normalized Values
Each candidate fact record stores both the verbatim extracted string (`rawValue`) and the versioned canonical representation (`normalizedValue`). Reviewers and auditors can always inspect the original passage as it appeared in the evidence exhibit.

#### 2.3 Epistemic Caution on Generic & Non-Unique Identifiers
The extraction layer explicitly evaluates candidate identifiers for ambiguity:
- **Private / Loopback IP Addresses:** IP addresses within `192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, or `127.0.0.0/8` are automatically annotated with:
  `"Private or loopback IP range: non-unique identifier; cannot establish external host identity"`.
- **Generic Email Services:** Public webmail addresses (`gmail.com`, `yahoo.com`, `hotmail.com`) receive warnings noting that email handles do not conclusively establish physical user identity without telecom/ISP logs.
- These limitation flags are persisted in `ExtractedFact.limitations` and actively displayed to reviewers in the user interface.

---

### 3. Human Validation & Review State Machine

#### 3.1 Review Lifecycle States
```
                      ┌───────────────┐
                      │ PENDING_REVIEW│
                      └───────┬───────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │ ACCEPTED  │       │ CORRECTED │       │ REJECTED  │
    └─────┬─────┘       └─────┬─────┘       └───────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
              ┌───────────┐
              │SUPERSEDED │
              └───────────┘
```

#### 3.2 State Definitions
1. **`PENDING_REVIEW` (Default):** Candidate fact generated deterministically by OCR parser. Verification status is `UNVERIFIED`. Prohibited from feeding confirmed cross-case intelligence.
2. **`ACCEPTED`:** Human reviewer verifies that the extracted fact accurately reflects the source evidence without modification. Verification status transitions to `VERIFIED`. Eligible to feed confirmed cross-case leads.
3. **`CORRECTED`:** Human reviewer corrects OCR typos, transcription ambiguity, or formatting errors (e.g., misread digits `0` vs `O`, `1` vs `l`).
   - The corrected value becomes `normalizedValue` and `acceptedValue`.
   - The original OCR text is preserved in `originalValue`.
   - Verification status transitions to `VERIFIED`.
4. **`REJECTED`:** Human reviewer marks the candidate fact as a false positive, irrelevant noise, or an uncorroborated artifact. Verification status transitions to `DISPUTED`. The fact is blocked from all downstream intelligence.
5. **`SUPERSEDED`:** An earlier reviewed fact is superseded by new certified evidence (e.g. nodal bank response or certified CDR report). The prior fact remains historically preserved for evidentiary traceability.

#### 3.3 Authorization & Role Guardrails
- **Authorized Reviewer Roles:** Strictly restricted to active accounts with roles `INVESTIGATOR`, `SUPERVISOR`, or `ADMIN`.
- **Denied Roles:** Roles `VIEWER`, `AUDITOR`, and `DEPT_ADMIN` (without investigator assignments) are strictly prohibited from submitting reviews.
- **Trusted Server-Side Identity:** The reviewer's identity (`reviewerId`, `reviewerName`, `reviewerRole`, `reviewerDeptId`) is resolved from authenticated server session tokens, never from client-supplied form fields.
- **Mandatory Justification Rationale:** Every review decision requires an explanatory rationale of at least **5 characters**. Blank, trivial, or missing rationales are rejected at validation time.

---

### 4. Immutable Audit Ledger: `FactReviewHistory`

Every review decision, correction, rejection, or supersession is recorded in the append-only `FactReviewHistory` table:

```prisma
model FactReviewHistory {
  id              String        @id @default(uuid())
  factId          String
  fact            ExtractedFact @relation(fields: [factId], references: [id], onDelete: Cascade)
  fromStatus      String
  toStatus        String
  reviewerId      String
  reviewerName    String
  reviewerBadge   String?
  reviewerRole    String
  reviewerDeptId  String?
  rationale       String
  previousValue   String?
  correctedValue  String?
  timestamp       DateTime      @default(now())

  @@index([factId])
  @@index([reviewerId])
  @@index([timestamp])
}
```

#### Database-Enforced Immutability
Under PostgreSQL Row-Level Security and permission grants for role `rakshak_app_user`:
- `SELECT` and `INSERT` are permitted.
- `UPDATE`, `DELETE`, and `TRUNCATE` are explicitly revoked.
- Attempting to delete or alter historical review records raises a database-level fatal exception: `permission denied for table FactReviewHistory`.

---

### 5. Empirical Test Verification

The candidate fact extraction and human review workflows were tested in `scripts/test_phase39_ocr_fact_extraction.mjs`:

| Test ID | Scenario | Result | Measured Evidence / Diagnostic |
| :--- | :--- | :--- | :--- |
| **TC-16** | Candidate facts preserve source text or location | **PASSED** | Extracted 18 candidate facts with character byte offsets |
| **TC-17** | Normalization is deterministic for supported identifier types | **PASSED** | Phone: `+919876543210`, UPI: `mule.receiver@okhdfc`, Date: `2026-10-15` |
| **TC-18** | Generic identifiers flagged with limitations | **PASSED** | Private IP `192.168.1.105` annotated with non-unique range warning |
| **TC-19** | Unreviewed facts cannot become confirmed links | **PASSED** | Gating check blocked `PENDING_REVIEW` fact from intelligence graph |
| **TC-20** | Unauthorized reviewers cannot accept extracted facts | **PASSED** | Trapped: `Role 'VIEWER' lacks authority to validate or correct extracted facts` |
| **TC-21** | Valid correction records reviewer and prior value | **PASSED** | Corrected to `+919876543299`, original `6101599887` preserved in history |
| **TC-22** | Rejected facts retain historical review record | **PASSED** | Status `REJECTED`, verification `DISPUTED`, history entry count: 1 |
| **TC-23** | Concurrent review updates safely handled | **PASSED** | Serialized reviews: Investigator `ACCEPTED` -> Supervisor `SUPERSEDED` |
| **TC-24** | Reprocessing does not silently overwrite reviewed facts | **PASSED** | Corrected fact retained reviewStatus `CORRECTED` and corrected value |
| **TC-34** | Repeated processing does not create duplicate facts | **PASSED** | Initial count: 18, newly inserted on re-run: 0, final count: 18 |
