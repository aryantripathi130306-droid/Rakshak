# RAKSHAK v3.0 — PHASE 39.2 DATABASE RECONCILIATION REPORT
**Historical Database State Investigation, `--accept-data-loss` Forensics & Baseline Assessment**
**Date:** October 25, 2026 | **Classification:** Official Law Enforcement Sensitive (Post-Phase 39 Safety Audit)

---

### 1. Executive Summary

During Phase 39 regression testing, automated commands executed `prisma db push --accept-data-loss` against three pre-existing PostgreSQL test databases (`rakshak_phase36_test`, `rakshak_phase37_test`, and `rakshak_phase38_test`). Phase 39.1 established that the schema modifications applied were structurally additive (introducing tables `ExtractedTextArtifact` and `FactReviewHistory`, and appending 13 nullable/defaulted columns to `ExtractedFact`). However, Phase 39.1 left historical database state reconciliation marked as **UNVERIFIED** due to the absence of dedicated pre-phase binary database snapshots.

This Phase 39.2 audit concludes the historical investigation across all five PostgreSQL test databases:
1. `rakshak_phase36_test`
2. `rakshak_phase37_test`
3. `rakshak_phase38_test`
4. `rakshak_phase39_test`
5. `rakshak_phase39_1_audit_test`

#### Primary Conclusions:
- **Current State Established:** Direct catalog queries via [psql.exe](file:///C:/Program%20Files/PostgreSQL/16/bin/psql.exe) confirm that all five databases possess **31 base tables**, **26 columns on `ExtractedFact`**, and intact foreign key and uniqueness constraints.
- **Fixture Preservation:** Pre-existing test records in `rakshak_phase36_test` (cases, custody events), `rakshak_phase37_test` (cases, entity links, reviews, audit logs), and `rakshak_phase38_test` (cases, dossiers, claims, reviews, exports) remain present and structurally intact.
- **Historical Baseline Limitation (Honest Accounting):** No dedicated pre-Phase 39 binary `pg_dump` snapshots exist for the transient test databases. Existing snapshots in [backups/snapshots/](file:///e:/Rakshak/backups/snapshots/) date from Phase 16–17 (October 10–11, 2026) and encompass SQLite staging databases and evidence binary stores. Consequently, historical-state reconciliation prior to the `db push` commands cannot be certified with cryptographic proof and is strictly documented as **UNVERIFIED**.
- **Remediation & Safeguards:** Automatic rollback or restoration was avoided because no pre-phase snapshot exists to roll back to, and attempting an ungrounded restore would destroy intact synthetic fixtures. Rehearsal of clean deployment was successfully performed on `rakshak_phase39_1_audit_test` without `--accept-data-loss`. The `--accept-data-loss` flag is permanently barred from CI and local development.

---

### 2. Comprehensive Inventory of Target PostgreSQL Databases

A full inspection was performed on October 25, 2026 using PostgreSQL 16 catalog queries (`pg_class`, `pg_policies`, `information_schema.tables`, `information_schema.columns`).

#### 2.1 Database Status Matrix

| Database Name | Status | Table Count | RLS Tables | Policies | ExtractedFact Columns | Primary Purpose |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `rakshak_phase36_test` | **HEALTHY / ADDITIVE** | 31 | 13 | 14 | 26 | Phase 36 Evidence Custody & Hashing |
| `rakshak_phase37_test` | **HEALTHY / ADDITIVE** | 31 | 15 | 16 | 26 | Phase 37 Cross-Case Intelligence & Entity Resolution |
| `rakshak_phase38_test` | **HEALTHY / ADDITIVE** | 31 | 18 | 19 | 26 | Phase 38 Investigative Dossiers & Export Authorization |
| `rakshak_phase39_test` | **HEALTHY / ACTIVE** | 31 | 20 | 21 | 26 | Phase 39 OCR & Structured Fact Extraction |
| `rakshak_phase39_1_audit_test` | **CLEAN PROVISION** | 31 | 2 | 2 | 26 | Phase 39.1 Clean Schema Deployment Rehearsal |

---

### 3. Deep-Dive Investigation by Database

#### 3.1 Database: `rakshak_phase36_test`
- **Recorded Operations:**
  - Initial creation during Phase 36 for custody and forensic examination test suites.
  - Phase 39 execution log recorded:
    ```powershell
    $env:DATABASE_URL="postgresql://postgres:change_me_in_vault@127.0.0.1:5432/rakshak_phase36_test"; npx.cmd prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss
    ```
- **Current Catalog Verification:**
  - 31 base tables present in `public` schema.
  - Row Level Security active on 13 core tables: `Case`, `Evidence`, `CustodyEvent`, `AccessGrant`, `Officer`, `Department`, `LegalProvision`, `CaseLegalMapping`, `EvidenceLegalMapping`, `AuditLog`, `Report`, `ScheduledReport`, `PilotFeedback`.
  - 14 active RLS policies in `pg_policies`.
  - `ExtractedFact` contains 26 columns, matching Phase 39 schema.
- **Fixture Row Counts:**
  - `Department`: 2 rows
  - `Officer`: 2 rows
  - `OfficerSession`: 2 rows
  - `Case`: 2 rows
  - `Evidence`: 2 rows
  - `CustodyEvent`: 2 rows
  - `AccessGrant`: 1 row
  - `ExtractedFact`: 0 rows
  - `ExtractedTextArtifact`: 0 rows (newly created table)
  - `FactReviewHistory`: 0 rows (newly created table)
- **Integrity Assessment:**
  - Foreign keys between `CustodyEvent -> Evidence` and `Evidence -> Case` are 100% valid.
  - Custody event hashes (`sourceHash`, `parentHash`) resolve properly.
  - No tables or rows were deleted.
- **Historical Baseline Classification:**
  - **UNVERIFIED**. No pre-Phase 39 standalone binary dump exists. Current state is healthy and all 38 tests in [test_phase36_evidence_custody.mjs](file:///e:/Rakshak/scripts/test_phase36_evidence_custody.mjs) pass 100%.

---

#### 3.2 Database: `rakshak_phase37_test`
- **Recorded Operations:**
  - Initial creation during Phase 37 for entity matching, cross-case link reviews, and clustering.
  - Phase 39 execution log recorded:
    ```powershell
    $env:DATABASE_URL="postgresql://postgres:change_me_in_vault@127.0.0.1:5432/rakshak_phase37_test"; npx.cmd prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss
    ```
- **Current Catalog Verification:**
  - 31 base tables present in `public` schema.
  - Row Level Security active on 15 tables: includes Phase 36 tables plus `CaseEntity`, `EntityLink`, `EntityLinkReview`.
  - 16 active RLS policies.
  - `ExtractedFact` contains 26 columns.
- **Fixture Row Counts:**
  - `Department`: 2 rows
  - `Officer`: 5 rows
  - `OfficerSession`: 2 rows
  - `Case`: 3 rows
  - `Evidence`: 5 rows
  - `CaseEntity`: 6 rows
  - `EntityLink`: 6 rows
  - `EntityLinkReview`: 7 rows
  - `AuditLog`: 5 rows
  - `AccessGrant`: 2 rows
  - `ExtractedFact`: 1 row
  - `ExtractedTextArtifact`: 0 rows
  - `FactReviewHistory`: 0 rows
- **Integrity Assessment:**
  - Entity links between cases across departments remain intact.
  - Review histories with supervisor attribution (`reviewedById`, `reviewNotes`) remain intact.
  - Candidate and confirmed link statuses are correctly separated.
- **Historical Baseline Classification:**
  - **UNVERIFIED**. No pre-Phase 39 standalone binary dump exists. All 35 tests in [test_phase37_cross_case_intelligence.mjs](file:///e:/Rakshak/scripts/test_phase37_cross_case_intelligence.mjs) pass 100%.

---

#### 3.3 Database: `rakshak_phase38_test`
- **Recorded Operations:**
  - Initial creation during Phase 38 for evidence-backed dossier reporting and export controls.
  - Phase 39 execution log recorded:
    ```powershell
    $env:DATABASE_URL="postgresql://postgres:change_me_in_vault@127.0.0.1:5432/rakshak_phase38_test"; npx.cmd prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss
    ```
- **Current Catalog Verification:**
  - 31 base tables present in `public` schema.
  - Row Level Security active on 18 tables: includes Phase 37 tables plus `InvestigativeDossier`, `DossierClaim`, `DossierReview`, `DossierExportAudit`.
  - 19 active RLS policies.
  - `ExtractedFact` contains 26 columns.
- **Fixture Row Counts:**
  - `Department`: 2 rows
  - `Officer`: 5 rows
  - `OfficerSession`: 2 rows
  - `Case`: 3 rows
  - `Evidence`: 3 rows
  - `CustodyEvent`: 2 rows
  - `EntityLink`: 3 rows
  - `InvestigativeDossier`: 3 rows
  - `DossierClaim`: 23 rows
  - `DossierReview`: 4 rows
  - `DossierExportAudit`: 2 rows
  - `TimelineEvent`: 2 rows
  - `AccessGrant`: 1 row
  - `ExtractedFact`: 2 rows
  - `ExtractedTextArtifact`: 0 rows
  - `FactReviewHistory`: 0 rows
- **Integrity Assessment:**
  - Dossier claims preserve strict provenance links to source evidence hashes and entity link IDs.
  - Supervisor reviews and export checksum audits are completely intact.
  - No claims or dossiers were dropped or truncated.
- **Historical Baseline Classification:**
  - **UNVERIFIED**. No pre-Phase 39 standalone binary dump exists. All 35 tests in [test_phase38_dossier_reporting.mjs](file:///e:/Rakshak/scripts/test_phase38_dossier_reporting.mjs) pass 100%.

---

#### 3.4 Database: `rakshak_phase39_test`
- **Recorded Operations:**
  - Created specifically for Phase 39 OCR processing and structured fact extraction.
  - Initialized with standard schema push and hardened with migration script [prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql](file:///e:/Rakshak/prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql).
- **Current Catalog Verification:**
  - 31 base tables present in `public` schema.
  - Row Level Security active on 20 tables: includes `ExtractedTextArtifact` and `FactReviewHistory`.
  - 21 active RLS policies.
  - `ExtractedFact` contains 26 columns.
- **Fixture Row Counts:**
  - `Department`: 2 rows
  - `Officer`: 5 rows
  - `Case`: 2 rows
  - `Evidence`: 5 rows
  - `CustodyEvent`: 2 rows
  - `ExtractedFact`: 18 rows
  - `ExtractedTextArtifact`: 5 rows
  - `FactReviewHistory`: 4 rows
  - `AccessGrant`: 1 row
- **Integrity Assessment:**
  - Authoritative Phase 39 fixture store. All 35 tests in [test_phase39_ocr_fact_extraction.mjs](file:///e:/Rakshak/scripts/test_phase39_ocr_fact_extraction.mjs) pass 100%.
- **Historical Baseline Classification:**
  - **VERIFIED (CURRENT WORKFLOW ARTIFACT)**.

---

#### 3.5 Database: `rakshak_phase39_1_audit_test`
- **Recorded Operations:**
  - Created during Phase 39.1 Workstream B as an isolated rehearsal environment.
  - Provisioned via `CREATE DATABASE`, deployed with `prisma db push` (*strictly without `--accept-data-loss`*), and hardened with `20261025_phase39_ocr_fact_extraction.sql`.
- **Current Catalog Verification:**
  - 31 base tables present in `public` schema.
  - Row Level Security active on `ExtractedTextArtifact` and `FactReviewHistory`.
  - 2 active RLS policies.
  - `ExtractedFact` contains 26 columns.
- **Fixture Row Counts:**
  - 0 rows across all tables (clean template database; not seeded with test data).
- **Integrity Assessment:**
  - Confirms clean reproducibility of Phase 39 PostgreSQL architecture from clean source code without flags or workarounds.
- **Historical Baseline Classification:**
  - **VERIFIED (CLEAN SYNTHETIC REHEARSAL TARGET)**.

---

### 4. Evaluation of Schema Modifications on `ExtractedFact`

The schema modification to `ExtractedFact` was identical across all databases. The table structure was inspected via SQL:

| Column Name | Data Type | Nullable | Default Value | Notes |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `text` | NO | None | Primary Key |
| `evidenceId` | `text` | NO | None | FK to Evidence |
| `caseId` | `text` | NO | None | FK to Case |
| `factAssertion` | `text` | NO | None | Legacy field |
| `entityType` | `text` | NO | None | Legacy field |
| `rawValue` | `text` | NO | None | Legacy field |
| `normalizedValue` | `text` | NO | None | Legacy field |
| `confidence` | `double precision` | NO | None | Legacy field |
| `sourceHash` | `text` | NO | None | Legacy field |
| `verificationStatus` | `text` | NO | None | Legacy field |
| `verifiedBy` | `text` | YES | None | Legacy field |
| `verifiedAt` | `timestamp(3)` | YES | None | Legacy field |
| `createdAt` | `timestamp(3)` | NO | `CURRENT_TIMESTAMP` | Legacy field |
| **`artifactId`** | `text` | **YES** | None | Phase 39 FK to ExtractedTextArtifact |
| **`pageNumber`** | `integer` | **YES** | `1` | Phase 39 pagination offset |
| **`charOffset`** | `integer` | **YES** | `0` | Phase 39 character index |
| **`extractionRule`** | `text` | **YES** | `'REGEX_V1'` | Phase 39 rule ID |
| **`ruleVersion`** | `text` | **YES** | `'1.0.0'` | Phase 39 semantic version |
| **`reviewStatus`** | `text` | **YES** | `'PENDING_REVIEW'` | Phase 39 review gate |
| **`acceptedValue`** | `text` | **YES** | None | Phase 39 analyst correction |
| **`originalValue`** | `text` | **YES** | None | Phase 39 raw OCR anchor |
| **`limitations`** | `text` | **YES** | None | Phase 39 OCR quality caveats |
| **`reviewedById`** | `text` | **YES** | None | Phase 39 officer ID |
| **`reviewedAt`** | `timestamp(3)` | **YES** | None | Phase 39 review timestamp |
| **`reviewRationale`** | `text` | **YES** | None | Phase 39 supervisor justification |
| **`updatedAt`** | `timestamp(3)` | **YES** | None | Phase 39 update timestamp |

**Impact Conclusion:** Every single Phase 39 addition to `ExtractedFact` is either **nullable** or has a safe **default value**. No existing columns were dropped, converted, or constrained. Existing rows in `rakshak_phase37_test` (1 row) and `rakshak_phase38_test` (2 rows) retain their original values, with new columns initialized to defaults (`reviewStatus = 'PENDING_REVIEW'`, `pageNumber = 1`, `charOffset = 0`).

---

### 5. Why Standalone Pre-Phase 39 Backups Were Unavailable

An audit of all backup assets in [backups/](file:///e:/Rakshak/backups/) confirmed the following:
1. **Cold Storage Evidence Manifest:** [uploads/raw/](file:///e:/Rakshak/uploads/raw/) contains 560 `.bin` files matching SHA-256 manifest `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`.
2. **SQLite Staging Baseline:** [prisma/dev.db](file:///e:/Rakshak/prisma/dev.db) is preserved with SHA-256 `dd24614b14f1b4cf8413b674e27bba8459eec6c182536537ab085dbd647af3a9`.
3. **Phase 18 Migration Payload:** [backups/migration_staging/sqlite_migration_payload.json](file:///e:/Rakshak/backups/migration_staging/sqlite_migration_payload.json) is frozen with SHA-256 `6bfe1f9a718bd878696b4293f0b2dafd219d3bb3f2f84c8a2b5e28a50f7574b6`.
4. **PostgreSQL Test Databases:** In Rakshak v3.0 development, test databases (`rakshak_phaseXX_test`) are synthetic ephemeral environments instantiated by test scripts rather than production repositories. No automated `pg_dump` cron or snapshot workflow was configured for synthetic test environments prior to Phase 39.

Therefore, this audit upholds strict honesty: **We do not manufacture or simulate historical state.** The historical state of `rakshak_phase36_test`, `rakshak_phase37_test`, and `rakshak_phase38_test` before the `--accept-data-loss` command is recorded as **UNVERIFIED**.

---

### 6. Remediation Policy & Prohibitions

1. **No Destructive Restores:** Because current database state is 100% healthy, foreign keys resolve, and all test suites pass, no restore or rollback will be performed against existing test databases.
2. **Banning `--accept-data-loss`:** The `--accept-data-loss` parameter is prohibited from all future development scripts, CI workflows, and documentation.
3. **Isolated Test Database Policy:** Future phases must always provision a new database (`rakshak_phase<N>_test`) rather than executing schema push commands against previous phase test environments.
