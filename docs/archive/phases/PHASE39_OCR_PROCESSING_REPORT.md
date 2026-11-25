# RAKSHAK v3.0 — PHASE 39 OCR PROCESSING PIPELINE REPORT
**Workstream A & B: Secure OCR Processing Pipeline & Source-Linked Text Extraction**
**Date:** October 25, 2026 | **Classification:** Official Law Enforcement Sensitive (Synthetic Sandbox Evaluation)

---

### 1. Executive Summary

Phase 39 establishes a secure, bounded, and attributable optical character recognition (OCR) and document text extraction pipeline for the RAKSHAK investigative platform. The pipeline ingests authorized case evidence, verifies cryptographic integrity prior to processing, rejects malformed and adversarial payloads, and persists extracted text as immutable, source-linked derived artifacts distinct from the original evidence binaries.

All development and empirical testing were conducted against isolated synthetic databases (`rakshak_phase39_test`) and synthetic exhibits. Zero changes were made to cold storage binaries in `uploads/raw/` (560 `.bin` files verified byte-identical) or the active SQLite baseline (`prisma/dev.db`).

---

### 2. Architecture & Engine Specifications

The extraction engine architecture is modular and deterministic, utilizing local in-process libraries without sending evidence to external network services or third-party APIs:

| Engine Name | Engine Identifier | Library Version | Target MIME Types & Extensions | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Tesseract OCR Engine** | `TESSERACT_OCR_V5` | 5.1.1 (WASM/Node) | `image/png`, `image/jpeg`, `image/webp`, `image/tiff` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.tiff`, `.tif`) | Full-page OCR, confidence scoring, word-level tokenization, bounding box estimation |
| **PDF Extraction Engine** | `PDF_PARSE_V1` | 2.4.5 | `application/pdf` (`.pdf`) | Multi-page text stream extraction, page coordinate attribution, stream parsing |
| **Forensic Text Parser** | `TEXT_PARSE_V1` | 1.0.0 | `text/plain`, `text/csv`, `application/json`, `.log` | Structured text parsing, line-based offset tracking, sanitization |

#### Zero External Dependencies & Privacy Compliance
External OCR network requests are strictly prohibited and disabled by default. All image recognition, PDF stream decoding, and text parsing occur exclusively within the Node.js runtime process using sandboxed local libraries.

---

### 3. Security Controls & Defensive Hardening

#### 3.1 Restricted Temporary Workspace & Path Traversal Prevention
- **Workspace Location:** Temporary scratch directory located at `E:\Rakshak\scratch\ocr_temp\`, strictly outside web-accessible roots (`public/`, `app/`).
- **Safe Path Generation (`generateSafeTempFilePath`):**
  - Generates safe UUID-based filenames (`rakshak_ocr_<uuid>.<ext>`).
  - Strips non-alphanumeric characters from file extensions.
  - Resolves absolute paths and asserts `resolvedPath.startsWith(restrictedWorkspaceBase)`. Path traversal attempts such as `/../../etc/passwd` throw an immediate fatal security exception.
- **Guaranteed Cleanup:** Temporary files are placed in structured `try...finally` lifecycle blocks, guaranteeing automatic unlinking even upon processing exceptions or parser crashes.

#### 3.2 File Size & Resource Exhaustion Protection (DoS Defense)
- **Hard Size Boundary:** Maximum file size is strictly capped at **25 MB** (`MAX_OCR_FILE_SIZE = 25 * 1024 * 1024`).
- **Early Rejection:** File size is validated *prior* to parsing or hashing large buffers, protecting worker threads from memory exhaustion. Files exceeding 25 MB immediately record a `FAILED` artifact and throw a clear `400 Bad Request` diagnostic.

#### 3.3 Strict Whitelist & MIME Validation
- The pipeline permits only recognized investigative formats: images (`PNG`, `JPEG`, `WEBP`, `TIFF`), documents (`PDF`), and text logs (`TXT`, `CSV`, `JSON`, `LOG`).
- Unsupported file types (e.g. `.zip`, `.exe`, `.tar`, `.sh`) are safely rejected with descriptive diagnostics without corrupting database state.

#### 3.4 Cryptographic Pre-Processing Integrity Verification
- Before submitting binary buffers to OCR or document parsers, the engine calculates the SHA-256 digest of the raw buffer and compares it against `evidence.sha256Hash`.
- If a hash mismatch is detected (indicating bit rot, disk corruption, or unauthorized tampering):
  - Normal processing is aborted immediately.
  - A permanent `ExtractedTextArtifact` record is inserted with `status = "FAILED"`, `isIntegrityVerified = false`, and `integrityAlert = "SOURCE_HASH_MISMATCH"`.
  - A fatal error is thrown, preventing downstream intelligence from ingesting corrupted evidence.

#### 3.5 Malicious Content & Injection Immunity
- Active content in PDFs (JavaScript streams, embedded macros, launch actions) is ignored; only passive text data streams are extracted.
- OCR text output is treated strictly as passive, untrusted string data.
- Text strings containing HTML, scripts (`<script>alert('xss')</script>`), or SQL injection sequences (`DROP TABLE "Case"; --`) are safely persisted as literal strings via parameterized SQL / Prisma ORM bindings without triggering SQL execution or DOM mutation.

---

### 4. Lifecycle State Machine & Idempotency

#### 4.1 State Machine
The OCR processing job traverses a strictly controlled lifecycle:
```
[QUEUED] ──> [PROCESSING] ──┬──> [COMPLETED] (Text extracted, confidence scored)
                            │
                            ├──> [EMPTY] (Valid document containing 0 extractable text)
                            │
                            ├──> [FAILED] (Integrity failure, parser error, oversized, unsupported)
                            │
                            └──> [REVIEW_REQUIRED] (Low confidence < 60% or integrity alert)
```

#### 4.2 Idempotency & Concurrency Guards
- The pipeline queries existing extraction jobs for `(evidenceId, sourceHash)` before executing new parser runs.
- Duplicate requests for completed or in-progress jobs return the existing `ExtractedTextArtifact` rather than duplicating worker load.
- Re-processing can only be initiated via explicit `forceReprocess: true` by authorized officers (`INVESTIGATOR`, `SUPERVISOR`, `ADMIN`).
- Concurrent processing requests resolve consistently without race conditions or orphan records.

---

### 5. Derived Artifact Data Model Parity

The derived artifact model is defined with 100% parity across SQLite (`prisma/schema.prisma`) and PostgreSQL (`prisma/schema.postgresql.prisma`):

```prisma
model ExtractedTextArtifact {
  id                  String   @id @default(uuid())
  evidenceId          String
  evidence            Evidence @relation(fields: [evidenceId], references: [id], onDelete: Cascade)
  caseId              String
  sourceHash          String   // SHA-256 of source evidence at extraction time
  mimeType            String
  fileName            String?
  engine              String   // "TESSERACT_OCR_V5" | "PDF_PARSE_V1" | "TEXT_PARSE_V1" | "NONE"
  engineVersion       String   // e.g. "5.1.1", "2.4.5"
  status              String   // "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EMPTY" | "REVIEW_REQUIRED"
  confidence          Float    // 0.0 - 100.0% calibration
  charCount           Int
  lineCount           Int
  pageCount           Int      @default(1)
  rawText             String   // Full raw text extracted
  boundingBoxes       String?  // JSON serialized bounding coordinates where supported
  processingTimeMs    Int      @default(0)
  errorMessage        String?
  isIntegrityVerified Boolean  @default(true)
  integrityAlert      String?  // e.g. "SOURCE_HASH_MISMATCH"
  departmentId        String?
  extractedAt         DateTime @default(now())

  facts               ExtractedFact[]

  @@index([evidenceId])
  @@index([caseId])
  @@index([sourceHash])
  @@index([status])
  @@index([departmentId])
}
```

---

### 6. Chain of Custody Integration

Every OCR processing execution logs an attributable, cryptographically hashed event to `CustodyEvent`:
- **Event Type:** `OCR_EXTRACTION`
- **Actor:** Derived securely from authenticated server session (`engine + callerBadge / role`).
- **Action:** Full audit string documenting character count, engine version, confidence percentage, or failure diagnostics.
- **Details JSON:** Structured payload containing `artifactId`, `durationMs`, `pageCount`, and `engineVersion`.
- **Cryptographic Hash:** SHA-256 chained to preceding custody event digest (`prevEventHash`).

---

### 7. Empirical Test Verification

The OCR processing pipeline was verified in `scripts/test_phase39_ocr_fact_extraction.mjs` against synthetic test scenarios:

| Test ID | Scenario | Result | Measured Evidence / Diagnostic |
| :--- | :--- | :--- | :--- |
| **TC-01** | Authorized processing request succeeds | **PASSED** | Extracted 621 characters, status `COMPLETED`, engine `TEXT_PARSE_V1` |
| **TC-02** | Unauthenticated request is denied | **PASSED** | Trapped: `Authentication required: Missing officer identity` |
| **TC-03** | Suspended officer is denied | **PASSED** | Trapped: `Access denied: Officer account is SUSPENDED` |
| **TC-04** | Unauthorized department cannot retrieve results | **PASSED** | Trapped: `Access denied: Case FIR-MUM-2026-391 belongs to dept_p39_mumbai` |
| **TC-05** | Revoked grant blocks processing or review | **PASSED** | Trapped: `Access denied without active access grant` |
| **TC-06** | Source hash mismatch prevents normal processing | **PASSED** | Trapped: `Source binary hash mismatch ... Evidence may be tampered` |
| **TC-07** | Unsupported file types are rejected | **PASSED** | Trapped: `Unsupported MIME type 'application/zip'` |
| **TC-08** | Oversized documents are rejected safely | **PASSED** | Trapped: `File exceeds maximum OCR size limit of 25MB (26.00MB)` |
| **TC-09** | Malformed documents fail without corrupting records | **PASSED** | Persisted artifact status `FAILED`, table constraints intact |
| **TC-10** | Temporary filenames cannot escape restricted workspace | **PASSED** | Resolved strictly to `scratch/ocr_temp/`, traversal rejected |
| **TC-11** | Extracted text retains its evidence reference | **PASSED** | Artifact bound to `evi_p39_txt_doc` and source hash `b09a718e...` |
| **TC-12** | Page references are preserved when supported | **PASSED** | Page count: 1 |
| **TC-13** | OCR service failure produces a real failure state | **PASSED** | Status `FAILED`, confidence `0.0`, error message populated |
| **TC-14** | Duplicate processing handled idempotently | **PASSED** | Reused existing artifact ID without duplicate processing |
| **TC-15** | Concurrent jobs do not produce inconsistent state | **PASSED** | Both parallel jobs resolved consistently to identical artifact |
