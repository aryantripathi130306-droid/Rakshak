# RAKSHAK v3.0 — PHASE 39.1 OCR RELEASE VERIFICATION REPORT
**Audit of OCR Architecture, Fact Extraction Boundaries, Measured Telemetry & Release Readiness**
**Date:** October 25, 2026 | **Classification:** Official Law Enforcement Sensitive (Post-Phase 39 Safety Audit)

---

### 1. Executive Summary

This report establishes the forensic boundaries, architectural constraints, and measured quality baseline of the Phase 39 Optical Character Recognition (OCR) and candidate fact extraction subsystem.

The platform processes raster images, digital PDFs, and raw text logs using strictly local in-process libraries (Tesseract.js v5.1.1, pdf-parse v2.4.5, and UTF-8 stream parsers). External network OCR transmissions are strictly disabled by default. All candidate facts are maintained as unverified investigative leads until validated by an authenticated officer, and all corrections preserve prior values and attributable audit history.

---

### 2. Architecture & Engine Verification

#### 2.1 Genuine Engine Execution vs Simulated Fixtures
- **Genuine OCR Engine (`TESSERACT_OCR_V5`):** Utilizes `tesseract.js` version 5.1.1 compiled to WebAssembly with local `eng` traineddata. Invoked by `processImageOcr` in [`lib/ocrPipeline.ts`](file:///e:/Rakshak/lib/ocrPipeline.ts).
- **Genuine PDF Stream Parser (`PDF_PARSE_V1`):** Utilizes `pdf-parse` version 2.4.5 to decode binary streams, extract text objects, and attribute page numbers.
- **Genuine Forensic Text Parser (`TEXT_PARSE_V1`):** Ingests raw UTF-8 text, CSV transaction logs, JSON exhibits, and communication dumps, mapping line breaks and character offsets.
- **Distinction from Mocks:** In [`scripts/test_phase39_ocr_fact_extraction.mjs`](file:///e:/Rakshak/scripts/test_phase39_ocr_fact_extraction.mjs), tests TC-01, TC-09, TC-11, etc. execute genuine parsers against synthetic document buffers. No parser output is mocked or hardcoded in `executeSecureOcrJob`.

#### 2.2 OCR Engine Quality Baseline & Limitations
The following technical limitations and calibration realities are documented for operational investigators:

| Characteristic | Architectural Guarantee | Calibration Reality & Limitation |
| :--- | :--- | :--- |
| **Confidence Scoring** | Tesseract engine emits confidence scores (`0.0 - 100.0%`) based on glyph match distance against trained character models. | **Not a Truth Metric:** Engine confidence indicates character recognition clarity, **not** the factual truth or legal veracity of the text statement. |
| **Scan Resolution Sensitivity** | Highest accuracy achieved on scans between 300 and 600 DPI. | Scans below 150 DPI, skewed images, or handwriting exhibit elevated character ambiguity (e.g. `0` vs `O`, `1` vs `I` vs `l`). |
| **PDF Stream Extraction** | Digital text streams in PDFs are extracted with 100% character fidelity. | Scanned image-only PDFs require rasterization before OCR. |
| **Bounding Coordinates** | Word-level bounding boxes (`{"x":N,"y":N,"width":N,"height":N}`) are extracted when provided by Tesseract. | Bounding boxes are unavailable in plain text logs or digital PDF streams without glyph coordinate metadata. The platform never fabricates bounding box coordinates when unavailable. |

---

### 3. Epistemic Separation & Human-in-the-Loop Validation

#### 3.1 The Principle of Candidate Isolation
Under platform design principles, machine-extracted text is classified as **untrusted data**.
- Extraction generates candidate facts with `reviewStatus = "PENDING_REVIEW"` and `verificationStatus = "UNVERIFIED"`.
- Under [`canFactFeedConfirmedIntelligence`](file:///e:/Rakshak/lib/factReview.ts#L225-L255), unreviewed facts are strictly barred from:
  - Establishing confirmed cross-case entity links.
  - Generating syndicate clusters.
  - Establishing assertions of identity, guilt, or criminal roles in investigative dossiers.

#### 3.2 Human Correction & Attribution
- **Reviewer Authorization:** Only authenticated officers with roles `INVESTIGATOR`, `SUPERVISOR`, or `ADMIN` and valid department scope may submit reviews.
- **Attributable Server-Side Identity:** Reviewer credentials are extracted from validated JWT/session tokens. Client-submitted reviewer badges are ignored.
- **Mandatory Rationale:** Submitting a review requires a rationale of $\ge 5$ characters.
- **Value Preservation:** Correcting a fact (e.g. from `6101599887` to `+919876543299`) updates `normalizedValue` and `acceptedValue` while immutably preserving the verbatim OCR text in `originalValue` and logging the transition in [`FactReviewHistory`](file:///e:/Rakshak/prisma/schema.prisma#L719-L737).

---

### 4. Security & Safety Boundary Audit

The pipeline enforces defensive hardening against malicious or oversized uploads:

| Safety Boundary | Implementation | Verification Result |
| :--- | :--- | :--- |
| **Pre-Processing Hash Verification** | Buffer SHA-256 is checked against `evidence.sha256Hash` before parsing. | TC-06: Hash mismatch prevents processing and records `isIntegrityVerified = false`. |
| **Restricted Workspace Isolation** | Files processed in `scratch/ocr_temp/` with UUID names. | TC-10: Path traversal attempts throwing `Path traversal security violation`. |
| **Denial-of-Service Size Cap** | Maximum input size capped at **25 MB**. | TC-08: 26MB buffer safely rejected before parsing. |
| **Strict Whitelist Policy** | Rejects unapproved formats (`.zip`, `.exe`, `.sh`). | TC-07: Rejected with `Unsupported MIME type`. |
| **Passive Data Treatment** | Embedded PDF macros and HTML/SQL injection strings treated as data. | TC-29 & TC-30: Script tags stored purely as passive UTF-8 text without evaluation. |
| **PostgreSQL RLS Enforcement** | Direct RLS applied to `ExtractedTextArtifact` and `FactReviewHistory`. | TC-31 & TC-32: Unauthenticated queries return 0 rows; forged tenant contexts blocked. |
| **Audit Ledger Immutability** | Database permissions `UPDATE, DELETE, TRUNCATE` revoked from runtime role. | TC-33: Direct SQL delete rejected with `permission denied`. |
| **Cold Evidence Preservation** | Storage directory `uploads/raw/` untouched. | TC-35: 560 files verified byte-identical (manifest: `bdc91bb7...`). |

---

### 5. Downstream Integration Protocol

#### 5.1 Timeline Events
Timeline entries created from OCR artifacts are explicitly labeled:
- Unreviewed: `EXTRACTED`
- Human-reviewed: `REVIEWER_VALIDATED`

#### 5.2 Dossier Citations
Dossier generation ([`lib/dossierGeneration.ts`](file:///e:/Rakshak/lib/dossierGeneration.ts)) resolves citations directly to:
- Source evidence exhibit ID (`Evidence.id`)
- Source exhibit hash (`Evidence.sha256Hash`)
- Derived artifact ID (`ExtractedTextArtifact.id`)
- Exact character offset (`ExtractedFact.charOffset`) and page number (`ExtractedFact.pageNumber`)

#### 5.3 Evidence Integrity Invalidation
If an evidence exhibit's hash fails verification during custody audits, all dependent candidate and reviewed facts are flagged with:
`limitations = "INTEGRITY ALERT: Associated source evidence hash mismatch"`.
Any fact with an integrity alert is immediately disqualified from cross-case intelligence matching.

---

### 6. Release Recommendation & Project Boundaries

The Phase 39 OCR and fact extraction subsystem is fully verified, robust, and safe for synthetic evaluation:
- All 35 Phase 39 scenarios passed.
- All 13 Phase 39.1 audit scenarios passed.
- All earlier regression suites (Phases 17–38) remain 100% passing.
- Turbopack production build (`npm run build`) compiles cleanly with zero errors across all 73 routes.

**Enforced Stop Condition:** In accordance with project instructions, work stops at Phase 39.1. Phase 40 has not been started. Real investigative data ingestion, external intelligence feeds, production signing keys, and production deployment remain strictly disabled.
