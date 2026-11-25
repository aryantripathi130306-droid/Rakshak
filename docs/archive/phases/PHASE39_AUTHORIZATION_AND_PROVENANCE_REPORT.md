# RAKSHAK v3.0 — PHASE 39 AUTHORIZATION, PROVENANCE & DOWNSTREAM INTEGRATION REPORT
**Workstream E, F, G & H: Safe Downstream Integration, APIs, PostgreSQL RLS & Test Matrix**
**Date:** October 25, 2026 | **Classification:** Official Law Enforcement Sensitive (Synthetic Sandbox Evaluation)

---

### 1. Executive Summary

Phase 39 enforces rigorous epistemic separation and multi-tenant access control across the entire document processing lifecycle. Raw OCR text, candidate facts (`PENDING_REVIEW`), analyst corrections, and human-validated facts (`ACCEPTED`, `CORRECTED`) are maintained as separate concepts across data models, APIs, and user interfaces.

Direct PostgreSQL Row-Level Security (RLS) is applied to all new tables (`ExtractedTextArtifact`, `FactReviewHistory`) under runtime application role `rakshak_app_user`, which operates with `NOBYPASSRLS` and non-superuser privileges. All 35 mandatory verification scenarios passed with 100% success on the dedicated synthetic PostgreSQL database `rakshak_phase39_test`. All existing regression suites remain 100% passing, and the 560 cold evidence binaries in `uploads/raw/` remain completely untouched.

---

### 2. Epistemic Separation & Safe Downstream Integration

#### 2.1 The Four Epistemic Tiers
The platform distinguishes four clear evidentiary tiers:
1. **Tier 1 — Source Binary:** The immutable, sealed evidence exhibit in cold storage (`uploads/raw/<sha256>.bin`), anchored by cryptographic custody events.
2. **Tier 2 — Raw OCR Output:** The mechanical transcription produced by local parsers (`ExtractedTextArtifact`), capturing confidence, word counts, and raw text.
3. **Tier 3 — Candidate Fact:** A machine-extracted identifier (`ExtractedFact` with `reviewStatus = "PENDING_REVIEW"`), representing an unverified investigative lead.
4. **Tier 4 — Human-Validated Fact:** An attributable, human-reviewed entity attribute (`reviewStatus = "ACCEPTED"` or `"CORRECTED"`), validated by an authenticated officer with documented rationale.

#### 2.2 Rules for Downstream Consumption
- **Cross-Case Intelligence Graph:**
  - `PENDING_REVIEW`, `REJECTED`, or `SUPERSEDED` facts can **never** create or feed confirmed intelligence links.
  - Automatically extracted facts generate candidate leads only.
  - Only facts with `reviewStatus IN ('ACCEPTED', 'CORRECTED')` and without active integrity alerts are eligible to feed confirmed cross-case entity links.
- **Investigative Dossiers & Reports:**
  - Dossier claims citing OCR artifacts cite both the source evidence exhibit ID and the `ExtractedTextArtifact` ID.
  - Citations must resolve to verifiable text coordinates or page numbers.
- **Chronological Timeline Entries:**
  - Timeline events derived from OCR text are explicitly categorized as `EXTRACTED` (for unreviewed candidate facts) or `REVIEWER_VALIDATED` (for reviewed facts).
- **Integrity Alert Propagation:**
  - If a source evidence exhibit experiences a hash mismatch or integrity failure, derived artifacts are marked with `isIntegrityVerified = false` and `integrityAlert = "SOURCE_HASH_MISMATCH"`.
  - The intelligence gate `canFactFeedConfirmedIntelligence` immediately disqualifies all facts derived from compromised evidence.

---

### 3. REST API & User Interface Controls

The API surface provides authorized, tenant-scoped endpoints enforcing server-side authorization:

| HTTP Method | Route | Authorization Rule | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/evidence/[id]/ocr` | `INVESTIGATOR`, `SUPERVISOR`, `ADMIN` with case department access | Initiates secure OCR processing job on an evidence exhibit |
| `GET` | `/api/evidence/[id]/ocr` | Authenticated officers authorized to view case evidence | Retrieves OCR processing status, telemetry, confidence, and raw text |
| `GET` | `/api/evidence/[id]/facts` | Authenticated officers authorized to view case evidence | Lists candidate and reviewed facts with bounding coordinates and review states |
| `GET` | `/api/facts/[id]` | Officers authorized to view source evidence exhibit | Fetches fact details, bounding coordinates, and full historical review audit trail |
| `POST` | `/api/facts/[id]/review` | `INVESTIGATOR`, `SUPERVISOR`, `ADMIN` with case department access | Submits review decision (`ACCEPT`, `CORRECT`, `REJECT`, `SUPERSEDE`) with mandatory rationale |

#### Frontend Presentation Hygiene
- The Evidence Vault and Dossier interfaces present explicit badges distinguishing raw OCR text, candidate facts, and reviewer-verified facts.
- Confidence scores are labeled with calibration context (`0–100%`) rather than fabricated "truth probabilities".
- Clear UI states are provided for: Empty documents (`EMPTY`), Processing in progress (`PROCESSING`), Integrity failures (`INTEGRITY_ALERT`), Permission denied (`403`), and Pending validation (`PENDING_REVIEW`).

---

### 4. PostgreSQL Row-Level Security (RLS) & Audit Hardening

#### 4.1 RLS Policies Applied to New Tables
Migration script `prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql` established row security and tenant isolation:

```sql
-- ExtractedTextArtifact RLS Policy
ALTER TABLE "ExtractedTextArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedTextArtifact" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ExtractedTextArtifact_department_isolation_policy"
ON "ExtractedTextArtifact"
FOR ALL
TO rakshak_app_user
USING (
    "departmentId" IS NOT NULL
    AND "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    OR EXISTS (
        SELECT 1 FROM "AccessGrant" ag
        WHERE ag."targetCaseId" = "ExtractedTextArtifact"."caseId"
          AND ag."granteeDepartmentId" = NULLIF(current_setting('app.current_department_id', true), '')
          AND ag."status" = 'ACTIVE'
          AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
          AND ag."revokedAt" IS NULL
    )
)
WITH CHECK (
    "departmentId" IS NOT NULL
    AND "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
);

-- FactReviewHistory RLS Policy
ALTER TABLE "FactReviewHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FactReviewHistory" FORCE ROW LEVEL SECURITY;

CREATE POLICY "FactReviewHistory_department_isolation_policy"
ON "FactReviewHistory"
FOR ALL
TO rakshak_app_user
USING (
    "reviewerDeptId" IS NOT NULL
    AND "reviewerDeptId" = NULLIF(current_setting('app.current_department_id', true), '')
    OR EXISTS (
        SELECT 1 FROM "ExtractedFact" ef
        JOIN "Case" c ON ef."caseId" = c."id"
        WHERE ef."id" = "FactReviewHistory"."factId"
          AND (
              c."departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
              OR EXISTS (
                  SELECT 1 FROM "AccessGrant" ag
                  WHERE ag."targetCaseId" = c."id"
                    AND ag."granteeDepartmentId" = NULLIF(current_setting('app.current_department_id', true), '')
                    AND ag."status" = 'ACTIVE'
                    AND (ag."expiresAt" IS NULL OR ag."expiresAt" > CURRENT_TIMESTAMP)
                    AND ag."revokedAt" IS NULL
              )
          )
    )
)
WITH CHECK (
    "reviewerDeptId" IS NOT NULL
    AND "reviewerDeptId" = NULLIF(current_setting('app.current_department_id', true), '')
);
```

#### 4.2 Runtime Permission Restrictions
```sql
GRANT SELECT, INSERT ON "ExtractedTextArtifact" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "ExtractedTextArtifact" FROM rakshak_app_user;

GRANT SELECT, INSERT ON "FactReviewHistory" TO rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "FactReviewHistory" FROM rakshak_app_user;
```

#### 4.3 Runtime Role Configuration Verification
- Role `rakshak_app_user` was verified directly against `pg_roles`:
  - `rolsuper = false` (non-superuser)
  - `rolbypassrls = false` (RLS bypass strictly denied)
- Queries executed without setting `app.current_department_id` return **0 rows** (fails closed).
- Setting a forged or non-existent department context returns **0 rows**.
- Unauthorized `DELETE` or `UPDATE` attempts are rejected with PostgreSQL `permission denied` errors.

---

### 5. Complete 35-Scenario Test Matrix

The Phase 39 test suite was executed against the dedicated synthetic database `rakshak_phase39_test` with **35 / 35 scenarios passing (100.0%)**:

| Test ID | Workstream | Scenario Description | Status | Assertion & Telemetry Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Workstream A | Authorized processing request succeeds | **PASSED** | Artifact `ed9392b4...`, 621 chars extracted |
| **TC-02** | Workstream A | Unauthenticated request is denied | **PASSED** | Trapped: `Authentication required: Missing officer identity` |
| **TC-03** | Workstream A | Suspended officer is denied | **PASSED** | Trapped: `Access denied: Officer account is SUSPENDED` |
| **TC-04** | Workstream A | Unauthorized department cannot retrieve extraction results | **PASSED** | Trapped: `Case belongs to dept_p39_mumbai without grant` |
| **TC-05** | Workstream A | Revoked grant blocks processing or review as appropriate | **PASSED** | Trapped: `Access denied without active access grant` |
| **TC-06** | Workstream A | Source hash mismatch prevents normal processing | **PASSED** | Trapped: `Source binary hash mismatch` |
| **TC-07** | Workstream A | Unsupported file types are rejected | **PASSED** | Trapped: `Unsupported MIME type 'application/zip'` |
| **TC-08** | Workstream A | Oversized documents are rejected safely | **PASSED** | Trapped: `File exceeds maximum OCR size limit of 25MB` |
| **TC-09** | Workstream A | Malformed documents fail without corrupting records | **PASSED** | Persisted artifact status `FAILED`, zero corruption |
| **TC-10** | Workstream A | Temporary filenames cannot escape restricted workspace | **PASSED** | Safe path: `E:\Rakshak\scratch\ocr_temp\rakshak_ocr_...tmp` |
| **TC-11** | Workstream B | Extracted text retains its evidence reference | **PASSED** | Bound to `evi_p39_txt_doc` and hash `b09a718e...` |
| **TC-12** | Workstream B | Page references are preserved when supported | **PASSED** | Page count: 1 |
| **TC-13** | Workstream A | OCR service failure produces a real failure state | **PASSED** | Recorded error, confidence 0, status `FAILED` |
| **TC-14** | Workstream A | Duplicate processing requests are handled idempotently | **PASSED** | Reused existing artifact ID without duplicate processing |
| **TC-15** | Workstream A | Concurrent jobs do not produce inconsistent result state | **PASSED** | Both concurrent jobs resolved consistently |
| **TC-16** | Workstream C | Candidate facts preserve their source text or location | **PASSED** | Extracted 18 candidate facts with character byte offsets |
| **TC-17** | Workstream C | Normalization is deterministic for supported identifier types | **PASSED** | Phone: `+919876543210`, UPI: `mule.receiver@okhdfc` |
| **TC-18** | Workstream C | Generic identifiers are not automatically treated as exact unique | **PASSED** | Flagged limitation: `Private or loopback IP range` |
| **TC-19** | Workstream D | Unreviewed facts cannot become confirmed links | **PASSED** | Blocked: `PENDING_REVIEW` facts cannot feed intelligence |
| **TC-20** | Workstream D | Unauthorized reviewers cannot accept extracted facts | **PASSED** | Blocked: Role `VIEWER` lacks authority to validate facts |
| **TC-21** | Workstream D | Valid correction records reviewer and prior value | **PASSED** | Corrected to `+919876543299`, original preserved in history |
| **TC-22** | Workstream D | Rejected facts retain their historical review record | **PASSED** | Status `REJECTED`, verification `DISPUTED`, history logged |
| **TC-23** | Workstream D | Concurrent review updates are safely handled | **PASSED** | Serialized reviews: 2 entries in immutable history |
| **TC-24** | Workstream E | Reprocessing does not silently overwrite previously reviewed facts | **PASSED** | Preserved status `CORRECTED` and corrected value |
| **TC-25** | Workstream E | Evidence-integrity failure flags dependent outputs appropriately | **PASSED** | Blocked: Associated evidence has active integrity alert |
| **TC-26** | Workstream E | Unauthorized downstream graph access is denied | **PASSED** | Cross-dept access returned `false` without grant |
| **TC-27** | Workstream E | Candidate links retain candidate status | **PASSED** | Pending facts retained `PENDING_REVIEW` and `UNVERIFIED` |
| **TC-28** | Workstream E | Dossier claims reference actual source artifacts | **PASSED** | Bound to artifact ID `ed9392b4...` and evidence exhibit |
| **TC-29** | Workstream G | OCR output cannot inject instructions into processing workflow | **PASSED** | SQL injection text stored as literal passive data; tables intact |
| **TC-30** | Workstream G | Malicious document content is treated as data and never executed | **PASSED** | Script tags stored purely as UTF-8 data, never evaluated |
| **TC-31** | Workstream G | Unauthorized direct SQL reads are blocked by RLS | **PASSED** | Visible artifacts: 0, Visible history records: 0 |
| **TC-32** | Workstream G | Forged tenant context cannot bypass RLS | **PASSED** | Rows returned with forged context: 0 |
| **TC-33** | Workstream G | Unauthorized modification/deletion of protected history is rejected | **PASSED** | `DELETE` rejected with `permission denied` |
| **TC-34** | Workstream C | Repeated processing does not create uncontrolled duplicate facts | **PASSED** | Initial count: 18, inserted on re-run: 0, final count: 18 |
| **TC-35** | Invariants | Existing regressions and cold storage preservation verified | **PASSED** | 560 cold files intact (manifest: `bdc91bb7...`), dev.db intact |

---

### 6. Full Regression Suite Results

All required platform verification and regression suites were executed with 100% passing results:

| Regression Suite Command | Result | Assertion / Test Count | Details |
| :--- | :--- | :--- | :--- |
| `npm run prisma:generate` | **PASSED** | 2 / 2 clients | Generated `@prisma/client` and `@prisma/client-pg` cleanly |
| `npx tsc --noEmit` | **PASSED** | Clean (0 errors) | Strict TypeScript compiler validation across entire codebase |
| `node scripts/test_phase17_verifier.mjs` | **PASSED** | 15 / 15 assertions | Evidence store integrity verifier and cold storage validation |
| `node scripts/validate_migration_payload.mjs` | **PASSED** | 21 / 21 models | Schema boundary and migration payload integrity |
| `node scripts/test_phase18_migration_rehearsal.mjs` | **PASSED** | 7 / 7 assertions | PostgreSQL migration rehearsal, rollback, and SQLite immutability |
| `node scripts/test_phase32_authorization.mjs` | **PASSED** | 20 / 20 scenarios | Multi-user role authorization, scope enforcement, session gates |
| `node scripts/test_phase33_account_lifecycle.mjs` | **PASSED** | 21 / 21 scenarios | Officer lifecycle, department provisioning, grant expiration |
| `node scripts/test_phase34_security_and_rls.mjs` | **PASSED** | 22 / 22 scenarios | Live PostgreSQL RLS direct enforcement & Next.js 16.4.3 security |
| `node scripts/test_phase34_1_adversarial_rls.mjs` | **PASSED** | 19 / 19 scenarios | Adversarial context forgery resistance and session clearing |
| `node scripts/test_phase35_case_lifecycle.mjs` | **PASSED** | 25 / 25 scenarios | Case state transitions, assignment ownership, and audit trail |
| `node scripts/test_phase35_1_supervisor_and_rls.mjs`| **PASSED** | 26 / 26 scenarios | Supervisor approval, schema model parity, and RLS enforcement |
| `node scripts/test_phase36_evidence_custody.mjs` | **PASSED** | 38 / 38 scenarios | Evidence intake, custody chain, forensic examination workflows |
| `node scripts/test_phase36_1_custody_adversarial.mjs`| **PASSED**| 40 / 40 scenarios | Custody chain tampering detection, sequence integrity, checkpoints |
| `node scripts/test_phase36_2_distributed_custody.mjs`| **PASSED**| 27 / 27 scenarios | Multi-process append concurrency and transaction safety |
| `node scripts/test_phase37_cross_case_intelligence.mjs`| **PASSED**| 35 / 35 scenarios | Cross-case entity resolution, graph traversal, and review gates |
| `node scripts/test_phase38_dossier_reporting.mjs` | **PASSED** | 35 / 35 scenarios | Dossier generation, claim provenance, export sanitation, and RLS |
| `node scripts/test_phase39_ocr_fact_extraction.mjs` | **PASSED** | 35 / 35 scenarios | Phase 39 OCR processing, structured facts, human validation, RLS |
| `node scripts/check_frontend_integrity.mjs` | **PASSED** | 18 / 18 pages | Static syntax and link integrity across all frontend pages |
| `node scripts/check_frontend_imports.mjs` | **PASSED** | All scripts | Module import validation across frontend assets |
| `npm audit` | **PASSED** | 0 vulnerabilities | Zero known security vulnerabilities |
| `npm run build` | **PASSED** | 73 / 73 routes | Production bundle compilation with Turbopack |

---

### 7. Safety Invariants & Conclusion

1. **Cold Storage Binaries:** All 560 `.bin` files in `uploads/raw/` remain 100% unaltered (Manifest SHA-256: `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`).
2. **Active SQLite Database:** `prisma/dev.db` remains 100% untouched (SHA-256: `dd24614b14f1b4cf8413b674e27bba8459eec6c182536537ab085dbd647af3a9`).
3. **Database Parity:** 31 models match 100% between SQLite and PostgreSQL schemas.
4. **Conclusion:** Phase 39 is **COMPLETE**. All requirements across Workstreams A through H are satisfied with full empirical validation. Production deployment and Phase 40 remain disabled in accordance with project constraints.
