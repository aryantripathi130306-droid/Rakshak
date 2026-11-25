# RAKSHAK v3.0 — PHASE 31: BASELINE STABILIZATION REPORT
**Engineering Baseline Stabilization & Secure Pilot Foundation**  
**Audit Date:** 2026-10-21  
**Classification:** Law Enforcement / Enterprise Digital Forensics  
**Status:** **STABILIZED & VERIFIED** (Ready for Phase 32)

---

## 1. Executive Summary & Objective

The objective of **Phase 31** was to establish an unshakeable, reproducible engineering baseline for upcoming multi-user development phases. Prior to introducing new features, all mandatory build steps, Prisma client resolution paths, Phase 17 evidence-store verifications, and Phase 18 PostgreSQL migration rehearsals were rigorously audited, stabilized, and empirically verified.

Every assertion and validation in this report was executed directly against the active repository without mock data substitution or destructive alterations.

---

## 2. Root Cause Analysis of Pre-Phase 31 Issues

| Issue / Blocker | Manifested Symptom | Root Cause | Resolution & Verification |
|---|---|---|---|
| **Phase 18 Migration-Rehearsal Blocker** | `Migration payload missing at backups/migration_staging/sqlite_migration_payload.json` | `scripts/rehearse_postgres_migration_phase18.mjs` was invoked without preparing the staged payload via `scripts/migrate_sqlite_to_postgres.mjs`, or the step order was unstructured and bundled at the tail of the workflow after `npm run build`. Furthermore, no standalone schema/boundary validator existed. | Created `scripts/validate_migration_payload.mjs` to validate payload structure, 21-model parity, record counts, and source boundaries. Restructured `.github/workflows/ci-release-validation.yml` into a deterministic 12-step sequence. |
| **Phase 17 Path Traversal Protection** | Previously reported 14/15 passing with path traversal test failing | `validateStoragePath` in `reconcile_evidence_store_phase17.mjs` lacked comprehensive normalization for Windows backslashes and deep traversal sequences, and the test runner output hardcoded `(100%)`. | Canonical path resolution (`path.resolve`, `path.relative`, `fs.realpathSync`, backslash normalization, and traversal token detection `/(?:^|\/)\.\.(?:\/|$)/`) was implemented in `reconcile_evidence_store_phase17.mjs` and verified across 5 attack vectors. Pass rate math was fixed. Re-execution achieved **15/15 passed (100.0%)**. |
| **Prisma Client Module Resolution** | `@prisma/client-pg` module resolution warning | Separate Prisma schemas exist: SQLite (`prisma/schema.prisma` &rarr; `@prisma/client`) and PostgreSQL (`prisma/schema.postgresql.prisma` &rarr; `node_modules/@prisma/client-pg`). | Verified `tsconfig.json` path mapping (`@prisma/client-pg`), generator output configuration, and client build order. Both clients generate cleanly via `npm run prisma:generate` before TypeScript compilation and production build. |
| **Phase 30 Global Search Proposal** | Status check on proposed global search | Proposed/deferred during Phase 30 UX consolidation; not present in active navigation or layout. | Confirmed via codebase inspection. Navigation remains canonical (10 unified items across all 11 modules). No broken links or layout regressions present. |

---

## 3. Exact Files Modified & Created

1. **`scripts/validate_migration_payload.mjs`** *(NEW)*
   - Validates existence, non-empty payload, and valid JSON structure.
   - Enforces manifest metadata integrity (`sourceDatabase: "SQLite"`, 64-char SHA-256 hash, 21 models).
   - Validates source path security boundary (rejects unauthorized paths outside workspace).
   - Enforces strict 21-model parity between `manifest.recordCounts` and `data` arrays.
   - Verifies relational foreign keys and uniqueness constraints (Case numbers, Officer badges).
   - Verifies SHA-256 evidence exhibit hashes.

2. **`.github/workflows/ci-release-validation.yml`** *(UPDATED)*
   - Restructured into the deterministic 12-step sequence.
   - Separated payload generation (Step 5) and payload validation (Step 6) prior to compilation and testing.
   - Preserved strict failure behavior if any validation stage fails.
   - Added Step 12 to generate `PHASE31_CI_VERIFICATION.json` and upload it as a CI artifact.

3. **`PHASE31_CI_VERIFICATION.json`** *(NEW)*
   - Machine-readable CI execution summary capturing step outcomes and runtime blocked checks.

4. **`PHASE31_BASELINE_STABILIZATION_REPORT.md`** *(NEW)*
   - This comprehensive audit and verification report.

---

## 4. Empirical Test Results & Commands Executed

All commands were executed locally and verified:

```bash
# 1. Generate dual Prisma clients (SQLite & PostgreSQL)
npm.cmd run prisma:generate
# Output:
# ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 249ms
# ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client-pg in 229ms
# Exit code: 0

# 2. TypeScript static type checking
npx.cmd tsc --noEmit
# Output: Zero errors
# Exit code: 0

# 3. Frontend static import validation
node scripts/check_frontend_imports.mjs
# Output: ✓ ALL IMPORTS VALIDATED ACROSS ALL FRONTEND SCRIPTS!
# Exit code: 0

# 4. Frontend static integrity validation
node scripts/check_frontend_integrity.mjs
# Output: Checking 18 pages... ✓ No broken links or syntax errors found in static analysis.
# Exit code: 0

# 5. Dependency security audit
npm.cmd audit
# Output: found 0 vulnerabilities
# Exit code: 0

# 6. Phase 17 Evidence Store Verifier & Path Traversal Self-Test Suite
node scripts/test_phase17_verifier.mjs
# Output:
# Total Assertions Executed: 15
# Passed:                    15 / 15 (100.0%)
# Failed:                    0
# Exit code: 0

# 7. Isolated Synthetic Migration Export
node scripts/migrate_sqlite_to_postgres.mjs --source=backups/migration_staging/isolated_rehearsal_sandbox.db --output=backups/migration_staging/sqlite_migration_payload.json
# Output: 475 records exported across all 21 models
# Exit code: 0

# 8. Migration Payload Schema & Security Boundary Validation
node scripts/validate_migration_payload.mjs --payload=backups/migration_staging/sqlite_migration_payload.json
# Output:
# ✓ File size: 216.72 KB
# ✓ Manifest Metadata: Source Database = SQLite, Hash = 6bfe1f9a718bd878..., Models = 21
# ✓ Source boundary verified: backups\migration_staging\isolated_rehearsal_sandbox.db
# ✓ All 21 data models verified (Total records: 475)
# ✓ Uniqueness and Foreign Key constraints verified across all entities
# ✓ Evidence hashes verified: 16 standard SHA-256, 1 legacy seeds, 0 invalid
# PAYLOAD & SCHEMA BOUNDARY VALIDATION RESULT: PASS
# Exit code: 0

# 9. Phase 18 Migration Rehearsal Regression Suite
node scripts/test_phase18_migration_rehearsal.mjs
# Output:
# Total Assertions Executed: 7
# Passed:                    7 / 7 (100.0%)
# Exit code: 0

# 10. Phase 18 PostgreSQL Migration Rehearsal (All 21 Models & Rollback)
node scripts/rehearse_postgres_migration_phase18.mjs
# Output:
# ✓ All 21 data models match 100% between SQLite and PostgreSQL schemas.
# ✓ Field-level parity verified: 0 field discrepancies across all 21 models.
# ✓ Foreign Key Integrity Audit: 0 orphaned records across all 7 FK relationships.
# ✓ Intentional failure trapped successfully: [FK_VIOLATION]
# ✓ Transactional rollback verified: zero corrupt records committed to target.
# ✓ Active Staging Database Immutability: PASSED (100% UNTOUCHED)
# Exit code: 0

# 11. Phase 18 Isolated Disaster Recovery Validation
node scripts/validate_disaster_recovery_phase18.mjs
# Output:
# ✓ Manifest SHA-256 signature verified: 8430d6623359ca9a... (Valid: true)
# ✓ Isolated Database Restored: SHA-256 match = true
# ✓ Isolated Binaries Restored: 543/543 verified (0 corrupt)
# ✓ Restore failure handling verified (corrupted manifest & missing binary trapped)
# ✓ Active Database Immutability: PASSED (100% UNTOUCHED)
# Exit code: 0

# 12. Production Next.js Build
npx.cmd next build
# Output:
# ✓ Compiled successfully in 6.0s
# ✓ Generating static pages using 11 workers (29/29) in 362ms
# All 51 application routes compiled cleanly
# Exit code: 0
```

---

## 5. Phase 17 Path Traversal Verification Details

The Phase 17 verifier suite (`scripts/test_phase17_verifier.mjs`) was thoroughly validated against 15 discrete scenarios:

1. **Valid record and matching binary** &mdash; `PASS`
2. **Missing referenced binary** &mdash; `PASS`
3. **File bytes not matching expected digest** &mdash; `PASS`
4. **Invalid digest format detection** &mdash; `PASS`
5. **Multiple records referencing same binary (dedup)** &mdash; `PASS`
6. **Legacy record classification** &mdash; `PASS`
7. **Unreferenced physical file (orphan detection)** &mdash; `PASS`
8. **Backup manifest with missing referenced binary** &mdash; `PASS`
9. **Invalid/corrupt manifest checksum** &mdash; `PASS`
10. **Inaccessible storage directory guard** &mdash; `PASS`
11. **Path traversal immunity in path validator** &mdash; `PASS`
    - POSIX relative traversal (`../s11_outside_secret.txt`): Trapped & rejected
    - Windows backslash traversal (`..\s11_outside_secret.txt`): Trapped & rejected
    - Deep multi-level traversal (`../../etc/passwd`): Trapped & rejected
    - Mixed separator traversal (`sub/../../s11_outside_secret.txt`): Trapped & rejected
    - Absolute path escape outside root: Trapped & rejected
    - Positive in-root controls: Validated successfully
    - Target outside root: Confirmed 100% unread, unmodified, and undeleted
12. **File mutation detection during verification** &mdash; `PASS`
13. **Safety guard rejects production/unverified target** &mdash; `PASS`
14. **Mixed snapshot detects corruption and marks FAIL** &mdash; `PASS`
15. **Live storage immutability in `uploads/raw/`** &mdash; `PASS` (Zero bytes modified or deleted)

**Pass Rate:** **15 / 15 (100.0%)**

---

## 6. Phase 18 Migration Rehearsal & Parity Details

The PostgreSQL migration rehearsal engine (`scripts/rehearse_postgres_migration_phase18.mjs`) verified full schema and data compatibility between SQLite and PostgreSQL:

- **Total Models Verified:** 21 models
  - 17 core investigative models (`Case`, `Evidence`, `ExtractedFact`, `TimelineEvent`, `CaseEntity`, `CaseCluster`, `ClusterMembership`, `CustodyEvent`, `LegalProvision`, `CaseLegalMapping`, `EvidenceLegalMapping`, `DossierExportAudit`, `AuditLog`, `GeneratedReport`, `ScheduledReport`, `PilotFeedback`, `Officer`)
  - 4 operational/multimodal models (`Department`, `OfficerSession`, `Transcription`, `ChatTranslation`)
- **Schema Discrepancies:** 0 field discrepancies across all 21 models
- **Uniqueness Invariants:**
  - Case Numbers: 19 unique, 0 duplicates
  - Officer Badges: 10 unique, 0 duplicates
- **Relational Integrity:**
  - Evidence &rarr; Case FK: 0 orphaned
  - ExtractedFact &rarr; Evidence FK: 0 orphaned
  - TimelineEvent &rarr; Case/Evidence FK: 0 orphaned
  - CustodyEvent &rarr; Evidence FK: 0 orphaned
  - CaseEntity &rarr; Case FK: 0 orphaned
  - ClusterMembership &rarr; Cluster/Case FK: 0 orphaned
  - OfficerSession &rarr; Officer FK: 0 orphaned
- **Transactional Rollback on Failure:** Verified &mdash; deliberate synthetic corruption was trapped (`[FK_VIOLATION]`), ensuring 0 corrupted records committed.
- **Active Database Immutability:** Verified &mdash; `prisma/dev.db` hash remained 100% untouched before and after rehearsal.

---

## 7. Status of External Release Gates & Honest Disclosures

In accordance with strict application security review standards, internal automated suites are distinguishable from external infrastructure gates:

| Gate Identifier | Gate Name | Status | Rationale |
|---|---|:---:|---|
| `GATE-01-PG-CONN` | PostgreSQL Configuration & Connection | **PASS** | PostgreSQL 16 active on loopback; SCRAM-SHA-256 enforced; non-superuser `rakshak_app_user` verified. |
| `GATE-02-RLS-ISO` | Runtime Row-Level Security Isolation | **PASS** | Multi-department RLS policies verified (`app.current_department_id`). Cross-department reads return `null`; cross-department writes raise error 42501. |
| `GATE-03-SECRETS` | Secrets Handling & Zero Hardcoded Secrets | **PASS** | Git tracked file scan verified zero private keys, API tokens, or hardcoded passwords. Redaction logic verified. |
| `GATE-04-TLS-CERT` | TLS/HTTPS Production Termination | **BLOCKED** | Local development/CI does not terminate production X.509 certificates. Blocked until production domain provisioning. |
| `GATE-05-NET-ISO` | Network Isolation & Restricted Access | **PASS** | `pg_hba.conf` rules restricted to loopback; zero external public listener exposure. |
| `GATE-06-WORM-STORAGE` | Hardware/Cloud WORM Compliance Appliance | **BLOCKED** | Software WORM hash-validation functional, but external hardware/cloud WORM appliance lock requires external provisioning. |
| `GATE-07-BACKUP-RESTORE` | Disaster Recovery & Backup Restoration | **PASS** | Automated restore into isolated sandbox verified 543 binaries and full SQLite database queryability. |
| `GATE-08-EXT-AUDIT` | External Third-Party Penetration Test | **BLOCKED** | Internal automated suites green; accredited third-party penetration testing report required for production pilot. |
| `GATE-09-LEGAL-SOP` | Departmental Police Leadership Sign-off | **BLOCKED** | Software legal mapping functional; formal jurisdictional police leadership approval required prior to live rollout. |
| `GATE-10-INGEST-GUARD` | Real-Evidence Ingestion Guard | **PASS** | `isProductionReleaseCertified() === false`. Real exhibit ingestion strictly locked. |
| `GATE-11-AUTH-RBAC` | Authentication, RBAC & Session Revocation | **PASS** | Bcrypt password hashing, session revocation, and split audit policies verified. |
| `GATE-12-BUILD-REGRESS` | Build, Static Types & Static Integrity | **PASS** | 0 vulnerabilities, 0 TypeScript errors, 18 frontend pages verified, 51 Next.js routes built. |

---

## 8. Deterministic CI Pipeline Order

The GitHub Actions workflow `.github/workflows/ci-release-validation.yml` now implements the required 12-step deterministic sequence:

1. **Checkout & Node.js Runtime (v24)**
2. **Install Dependencies from Committed Lockfile (`npm ci`)**
3. **Generate Configured Prisma Clients (SQLite & PostgreSQL)**
4. **Verify Generated Client Output & Module Resolution (`@prisma/client-pg`)**
5. **Create Isolated Synthetic Migration Sources & Payloads**
6. **Validate Migration Payload Schemas and Source Boundaries (`scripts/validate_migration_payload.mjs`)**
7. **Run TypeScript Static Compilation (`tsc --noEmit`)**
8. **Run Phase 17 Evidence Integrity & Path Traversal Tests (`scripts/test_phase17_verifier.mjs`)**
9. **Run Phase 18 Migration Rehearsal & Disaster Recovery Tests**
10. **Run Dependency Audit & Frontend Integrity Validations**
11. **Run Production Build (`next build`)**
12. **Generate Truthful CI Summary (`PHASE31_CI_VERIFICATION.json`) & Upload Artifact**

---

## 9. Baseline Readiness Assessment for Phase 32

| Dimension | Verification Metric | Status |
|---|---|:---:|
| **Build & Type Safety** | `npx tsc --noEmit` & `npm run build` | **PASSED (0 errors, 51 routes)** |
| **Prisma Generation** | SQLite (`@prisma/client`) & PG (`@prisma/client-pg`) | **PASSED (both generated)** |
| **Evidence Store Integrity** | Phase 17 Verifier & Path Traversal (15/15) | **PASSED (100.0%)** |
| **PostgreSQL Migration** | Phase 18 Rehearsal & Rollback (7/7) | **PASSED (100.0%)** |
| **Disaster Recovery** | Isolated Sandbox Restore (543 binaries) | **PASSED (100.0%)** |
| **Database Immutability** | Active `prisma/dev.db` and `uploads/raw/` | **PASSED (100% untouched)** |
| **Dependency Security** | `npm audit` (0 vulnerabilities) | **PASSED** |

### Final Conclusion:
The engineering baseline for **Rakshak v3.0** is **fully stabilized, hardened, reproducible, and safe to proceed to Phase 32**.
