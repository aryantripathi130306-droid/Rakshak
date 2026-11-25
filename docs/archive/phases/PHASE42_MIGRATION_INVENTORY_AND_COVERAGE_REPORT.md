# RAKSHAK v3.0 — PHASE 42 AUDIT REPORT
## Workstream A & B: PostgreSQL Test Database Setup Script Inventory & Authoritative Migration Coverage

**Document Classification:** Internal Technical Audit & Database Security Infrastructure Report  
**Phase:** 42 (Migration Completeness, Security Baseline Automation & Fail-Closed Test Setup)  
**Execution Timestamp:** 2026-10-25T13:48:30+05:30  
**Environment:** Local Windows Node.js Staging / PostgreSQL 16.4  
**Cluster Target:** `127.0.0.1:5432`  

---

### 1. Executive Mission & Problem Statement

Phase 41 revealed that [scripts/setup_phase40_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase40_test_db.mjs) omitted the foundational tenant-isolation migration [prisma/migrations_pg/20261011_rls_tenant_isolation.sql](file:///E:/Rakshak/prisma/migrations_pg/20261011_rls_tenant_isolation.sql). This defect caused `rakshak_phase40_test` to lack Row-Level Security on 6 critical investigative tables (`CaseEntity`, `CaseLegalMapping`, `DossierExportAudit`, `ExtractedFact`, `GeneratedReport`, `TimelineEvent`) and omitted 8 tenant-isolation policies.

Phase 42 conducted a project-wide audit of all setup scripts, eliminated ad-hoc and divergent migration arrays, established a single authoritative migration runner with cryptographic hash verification, and automated mandatory baseline validation.

---

### 2. Comprehensive Setup Script Inventory

Every project script that creates, prepares, migrates, seeds, or validates a PostgreSQL test database was inventoried and audited:

| Script Name | Target Database Naming | Migrations Applied | Missing / Duplicated Migrations | Exit on Error (`ON_ERROR_STOP`) | Can Target Protected DB? | Post-Setup Catalog Validation | Fixture Cleanup Scope | Audit Classification |
|---|---|---|---|---|---|---|---|---|
| [scripts/setup_phase40_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase40_test_db.mjs) | Hardcoded `rakshak_phase40_test` | 10 migrations hardcoded in local array | **MISSING:** `20261011_rls_tenant_isolation.sql` | **FAIL-OPEN:** `-v ON_ERROR_STOP=0` (errors ignored!) | YES: Overwrites existing DB without failing | Logs count only; no assertion on RLS or policy count | N/A (Setup only) | **DEFECTIVE / VULNERABLE** |
| [scripts/setup_phase41_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase41_test_db.mjs) | Hardcoded `rakshak_phase41_test` | 11 migrations hardcoded in local array | None (all 11 included) | **FAIL-OPEN:** `-v ON_ERROR_STOP=0` | NO: Explicit pre-existence abort | Asserts 31 tables, 20 RLS, 21 policies | N/A (Setup only) | **SUPERSEDED (Phase 41 Baseline)** |
| [scripts/setup_phase42_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase42_test_db.mjs) | Verified-new `rakshak_phase42_test` | 11 migrations via [authoritative_migration_runner.mjs](file:///E:/Rakshak/scripts/authoritative_migration_runner.mjs) | None (Authoritative Manifest) | **FAIL-CLOSED:** `-v ON_ERROR_STOP=1` (aborts on first SQL error) | **FAIL-CLOSED:** Protected DB blacklist + pre-existence check | Automated invocation of [validate_security_baseline.mjs](file:///E:/Rakshak/scripts/validate_security_baseline.mjs) | N/A (Setup only) | **VERIFIED AUTHORITATIVE** |
| [scripts/setup_postgres_phase26.mjs](file:///E:/Rakshak/scripts/setup_postgres_phase26.mjs) | N/A (Cluster configuration) | None | N/A | Exits on command error | N/A | Version check only | N/A | **MAINTENANCE UTILITY** |
| [scripts/test_phase39_1_release_integrity.mjs](file:///E:/Rakshak/scripts/test_phase39_1_release_integrity.mjs) | Hardcoded `rakshak_phase39_1_audit_test` | 1 migration only (`20261025_phase39_ocr_fact_extraction.sql`) | Omitted migrations 1–10 (rehearsal only tested Phase 39 delta) | `-v ON_ERROR_STOP=1` | Creates DB if not present | Checks 31 tables count only | Hardcoded cleanup of audit test DB | **HISTORICAL REHEARSAL** |
| [scripts/apply_phase33_migration.mjs](file:///E:/Rakshak/scripts/apply_phase33_migration.mjs) | SQLite `prisma/dev.db` | AccessGrant DDL | N/A | Nonzero exit on error | Guarded by hash check | Schema check | Dev fixtures | **HISTORICAL SQLITE** |
| [scripts/apply_phase35_migration.mjs](file:///E:/Rakshak/scripts/apply_phase35_migration.mjs) | SQLite `prisma/dev.db` | CaseAssignment/StatusHistory DDL | N/A | Nonzero exit on error | Guarded by hash check | Schema check | Dev fixtures | **HISTORICAL SQLITE** |
| [scripts/apply_phase36_migration.mjs](file:///E:/Rakshak/scripts/apply_phase36_migration.mjs) | SQLite `prisma/dev.db` | Evidence / CustodyEvent DDL | N/A | Nonzero exit on error | Guarded by hash check | Schema check | Dev fixtures | **HISTORICAL SQLITE** |

---

### 3. Root Cause Analysis: How the Omission Occurred

In Phase 40, the developer implemented [scripts/setup_phase40_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase40_test_db.mjs) by manually copying file names from `prisma/migrations_pg/`. 

Three critical infrastructure defects allowed the omission to pass undetected:
1. **Decoupled Migration Manifest:** There was no central manifest or runner. Each setup script defined its own arbitrary JavaScript array of file paths.
2. **Fail-Open Execution Flag (`ON_ERROR_STOP=0`):** Both Phase 40 and Phase 41 setup scripts invoked `psql` with `-v ON_ERROR_STOP=0`. When errors occurred, PostgreSQL continued execution and returned exit code 0.
3. **Absence of Post-Setup Policy Assertions:** In Phase 40, `setup_phase40_test_db.mjs` checked `tableCount === 31`, but only printed RLS table and policy counts to `console.log` without asserting `rlsCount === 20` or `policyCount === 21`.

---

### 4. The Authoritative Ordered PostgreSQL Migration Sequence

To permanently prevent omission, duplication, or reordering, Phase 42 implemented [scripts/authoritative_migration_runner.mjs](file:///E:/Rakshak/scripts/authoritative_migration_runner.mjs). It enforces the canonical 11-step migration sequence:

| Seq | Migration File | Relative Path | SHA-256 Checksum Digest | Required Order Rationale & Dependencies |
|---|---|---|---|---|
| **1** | `20261011_rls_tenant_isolation.sql` | `prisma/migrations_pg/20261011_rls_tenant_isolation.sql` | `9759095bac54b086d0431b4c36f74b5f8f85f146145cda14d9f50c548ce92068` | Foundational tenant isolation on first 10 core tables (`Case`, `Evidence`, `ExtractedFact`, `CaseEntity`, `CustodyEvent`, `CaseLegalMapping`, `DossierExportAudit`, `AuditLog`, `GeneratedReport`, `TimelineEvent`). |
| **2** | `20261024_access_grants.sql` | `prisma/migrations_pg/20261024_access_grants.sql` | `027402f639ec2113b346c03b44470d800eb536b2d85c681846b7d906cd67da55` | Creates `AccessGrant` table and sets up multi-department delegation RLS. Must follow table genesis. |
| **3** | `20261024_adversarial_rls_hardening.sql` | `prisma/migrations_pg/20261024_adversarial_rls_hardening.sql` | `4e370399248c4db50e058db965b00c56322ab6df281b561db0e1af36d35c82c5` | Hardens session-token validation, creates `private_auth.session_context`, prevents spoofing of `set_config`. |
| **4** | `20261024_case_lifecycle.sql` | `prisma/migrations_pg/20261024_case_lifecycle.sql` | `7e36e92a464e2c35525cc4acff73b85328c4b24601453d0763b77274f6707725` | Creates `CaseAssignmentHistory` and `CaseStatusHistory` with audit RLS and transition triggers. |
| **5** | `20261024_phase35_1_hardening.sql` | `prisma/migrations_pg/20261024_phase35_1_hardening.sql` | `355e1e9de024b5cfeacf9230b564321de7464e90135bfaa9288056e75110bf15` | Supervisor approval and role authorization triggers. |
| **6** | `20261024_phase36_evidence_custody.sql` | `prisma/migrations_pg/20261024_phase36_evidence_custody.sql` | `2f7d427ffe68abfc7b78c6df3ba5cc84ebbd9bc3d4a04f3c996162c94e783e81` | Custody event genesis, evidence lifecycle columns, append-only immutability. |
| **7** | `20261024_phase36_1_custody_concurrency.sql` | `prisma/migrations_pg/20261024_phase36_1_custody_concurrency.sql` | `55fc11412a2fcd80fd55ba9674427c6cf0cfb0e3abd76437600e445622f7b4ed` | Advisory locks and custody concurrency control. |
| **8** | `20261024_phase36_2_custody_integrity.sql` | `prisma/migrations_pg/20261024_phase36_2_custody_integrity.sql` | `dc522fdae35ecd7b945e404a3a0897b8218d66a909987b28b7d30fe1e0c84322` | Cryptographic SHA-256 chain validation and anti-tamper triggers. |
| **9** | `20261024_phase37_cross_case_intelligence.sql` | `prisma/migrations_pg/20261024_phase37_cross_case_intelligence.sql` | `2c174afc60cbe3b9a98d03dcffe0e54a4c2f8a1077d4c34e946ce823d4ce2526` | Creates `EntityLink` and `EntityLinkReview` with cross-case matching RLS. |
| **10** | `20261025_phase38_dossier_reporting.sql` | `prisma/migrations_pg/20261025_phase38_dossier_reporting.sql` | `5f8989a1c80aa436a43805c1a02a9bfc2c62b7cbdf7d767e0c081b8440a13cb9` | Creates `InvestigativeDossier`, `DossierClaim`, and `DossierReview` with export auditing and RLS. |
| **11** | `20261025_phase39_ocr_fact_extraction.sql` | `prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql` | `80439644430ea214a1d8962b7776892ec4905826bae1189bfeff49b5dec1a43f` | Creates `ExtractedTextArtifact` (OCR) and `FactReviewHistory` with provenance RLS. |

---

### 5. Remediation Architecture & Invariant Enforcement

1. **Cryptographic Directory Inventory (`verifyMigrationInventory`):**
   - Automatically scans `prisma/migrations_pg/`.
   - Computes SHA-256 digests of all `.sql` files.
   - Throws `SECURITY INVARIANT VIOLATION` if any unlisted, rogue, modified, or missing SQL file is detected.
2. **Fail-Closed Execution (`ON_ERROR_STOP=1`):**
   - Every migration file is applied via `psql` with `-v ON_ERROR_STOP=1`.
   - If any statement fails, execution terminates immediately with a nonzero exit code.
3. **Protected Database Blacklist:**
   - Any attempt to target a historical or active database (`rakshak_phase26_test`, `rakshak_phase34_test`–`rakshak_phase41_test`) is aborted immediately.
4. **Automated Baseline Verification:**
   - Immediately upon applying the 11th migration, the runner invokes [scripts/validate_security_baseline.mjs](file:///E:/Rakshak/scripts/validate_security_baseline.mjs).
   - If any table, policy, grant, or flag is missing, the setup fails closed.
