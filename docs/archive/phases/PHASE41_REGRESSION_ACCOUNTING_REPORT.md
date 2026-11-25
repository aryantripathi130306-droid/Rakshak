# RAKSHAK v3.0 — PHASE 41 REGRESSION ACCOUNTING REPORT
## Empirical Audit, Arithmetic Reconciliation & Machine-Readable Verification

**Date:** 2026-10-25  
**Version:** 3.0.0-phase41  
**Status:** COMPLETE / RECONCILED  
**Historical Invariant:** Active Development Database (`prisma/dev.db`) & Evidence Cold Storage (`uploads/raw/`) 100% Preserved & Untouched.

---

## 1. Executive Summary & The 408 vs 409 Arithmetic Discrepancy

In the Phase 40 completion report, the headline aggregate stated **408 regression assertions passed**, while the 17 individual test suites listed in the report table summed to:

$$15 + 1 + 7 + 20 + 21 + 22 + 19 + 25 + 26 + 38 + 40 + 27 + 35 + 35 + 35 + 13 + 30 = 409$$

Workstream A mandated a rigorous investigation of every suite's command, terminal output, and assertion semantics to determine the exact root cause of this discrepancy without arbitrarily altering numbers.

### The Precise Root Cause
In Phase 39.2 ([PHASE39_2_TEST_RESULTS.json](file:///E:/Rakshak/PHASE39_2_TEST_RESULTS.json)), the regression accounting framework partitioned tests into two distinct categories:
1. **Pure Scenario Assertions (`pureScenarioAssertionsTotal`):** Sum of all end-to-end scenario test scripts (Phases 17, 18 Rehearsal, 32, 33, 34, 34.1, 35, 35.1, 36, 36.1, 36.2, 37, 38, 39, 39.1).
   $$15 + 7 + 20 + 21 + 22 + 19 + 25 + 26 + 38 + 40 + 27 + 35 + 35 + 35 + 13 = 378$$
2. **Schema & Boundary Validations (`type: "models_and_schema_rules"`):** [scripts/validate_migration_payload.mjs](file:///E:/Rakshak/scripts/validate_migration_payload.mjs), which validates 21 models and 475 records.

When Phase 40 added its 30 new identifier-normalization scenarios ([scripts/test_phase40_identifier_normalization.mjs](file:///E:/Rakshak/scripts/test_phase40_identifier_normalization.mjs)):
- **Scenario Assertion Sum:** $378 + 30 = 408$ (This formed the headline number 408).
- **Table Discrepancy:** The Phase 40 table included `validate_migration_payload.mjs` as row 2 with count `1 / 1`. Adding that single execution row resulted in $408 + 1 = 409$.

### Reconciled Baseline Accounting
To eliminate ambiguity, Phase 41 explicitly partitions the accounting totals:
- **Pure Scenario Assertions (Pre-Phase 41):** **408**
- **Phase 41 Direct RLS Enforcement Scenarios:** **18**
- **Total Pure Scenario Assertions (Cumulative):** **426** ($408 + 18$)
- **Schema & Migration Boundary Validations:** **1** (`validate_migration_payload.mjs`, covering 21 models & 475 records)
- **Total Machine-Executable Test Suite Assertions:** **427** ($426 + 1$)

---

## 2. Comprehensive Master Regression Suite Accounting Table

Every suite listed below was executed and verified against its empirical terminal output, exit code, and log artifacts:

| # | Suite / Script Identifier | Command Line Executed | Type / Scope | Exit Code | Executed | Passed | Failed | Skipped | Blocked | Evidence Location |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **1** | Phase 17 Evidence Verifier | `node scripts/test_phase17_verifier.mjs` | Scenario Assertions | **0** | 15 | 15 | 0 | 0 | 0 | Terminal stdout / test harness |
| **2** | Phase 18 Migration Payload | `node scripts/validate_migration_payload.mjs` | Schema Boundary | **0** | 1 | 1 | 0 | 0 | 0 | Terminal stdout (21 models verified) |
| **3** | Phase 18 Migration Rehearsal | `node scripts/test_phase18_migration_rehearsal.mjs` | Scenario Assertions | **0** | 7 | 7 | 0 | 0 | 0 | `migration_rehearsal_results.json` |
| **4** | Phase 32 Authorization Suite | `node scripts/test_phase32_authorization.mjs` | Scenario Assertions | **0** | 20 | 20 | 0 | 0 | 0 | `PHASE32_TEST_RESULTS.json` |
| **5** | Phase 33 Account Lifecycle | `node scripts/test_phase33_account_lifecycle.mjs` | Scenario Assertions | **0** | 21 | 21 | 0 | 0 | 0 | `PHASE33_TEST_RESULTS.json` |
| **6** | Phase 34 Security & RLS | `node scripts/test_phase34_security_and_rls.mjs` | Scenario Assertions | **0** | 22 | 22 | 0 | 0 | 0 | `PHASE34_TEST_RESULTS.json` |
| **7** | Phase 34.1 Adversarial RLS | `node scripts/test_phase34_1_adversarial_rls.mjs` | Scenario Assertions | **0** | 19 | 19 | 0 | 0 | 0 | `PHASE34_1_TEST_RESULTS.json` |
| **8** | Phase 35 Case Lifecycle | `node scripts/test_phase35_case_lifecycle.mjs` | Scenario Assertions | **0** | 25 | 25 | 0 | 0 | 0 | `PHASE35_TEST_RESULTS.json` |
| **9** | Phase 35.1 Supervisor RLS | `node scripts/test_phase35_1_supervisor_and_rls.mjs` | Scenario Assertions | **0** | 26 | 26 | 0 | 0 | 0 | `PHASE35_1_TEST_RESULTS.json` |
| **10** | Phase 36 Custody & Intake | `node scripts/test_phase36_evidence_custody.mjs` | Scenario Assertions | **0** | 38 | 38 | 0 | 0 | 0 | `PHASE36_TEST_RESULTS.json` |
| **11** | Phase 36.1 Custody Adversarial | `node scripts/test_phase36_1_custody_adversarial.mjs` | Scenario Assertions | **0** | 40 | 40 | 0 | 0 | 0 | `PHASE36_1_TEST_RESULTS.json` |
| **12** | Phase 36.2 Multi-Process Custody | `node scripts/test_phase36_2_distributed_custody.mjs` | Scenario Assertions | **0** | 27 | 27 | 0 | 0 | 0 | `PHASE36_2_TEST_RESULTS.json` |
| **13** | Phase 37 Cross-Case Intel | `node scripts/test_phase37_cross_case_intelligence.mjs` | Scenario Assertions | **0** | 35 | 35 | 0 | 0 | 0 | `PHASE37_TEST_RESULTS.json` |
| **14** | Phase 38 Dossier Reporting | `node scripts/test_phase38_dossier_reporting.mjs` | Scenario Assertions | **0** | 35 | 35 | 0 | 0 | 0 | `PHASE38_TEST_RESULTS.json` |
| **15** | Phase 39 OCR Fact Extraction | `node scripts/test_phase39_ocr_fact_extraction.mjs` | Scenario Assertions | **0** | 35 | 35 | 0 | 0 | 0 | `PHASE39_TEST_RESULTS.json` |
| **16** | Phase 39.1 Release Integrity | `node scripts/test_phase39_1_release_integrity.mjs` | Scenario Assertions | **0** | 13 | 13 | 0 | 0 | 0 | `PHASE39_1_TEST_RESULTS.json` |
| **17** | Phase 40 Normalization Suite | `node scripts/test_phase40_identifier_normalization.mjs` | Scenario Assertions | **0** | 30 | 30 | 0 | 0 | 0 | `PHASE40_TEST_RESULTS.json` |
| **18** | Phase 41 Direct RLS Enforcement | `node scripts/test_phase41_direct_rls_enforcement.mjs` | Scenario Assertions | **0** | 18 | 18 | 0 | 0 | 0 | `PHASE41_RLS_ENFORCEMENT_RESULTS.json` |

---

## 3. Strict Categorical Separation of Auxiliary Checks

Per Workstream A guidelines, static-analysis findings, catalog counts, build routes, and dependency scans are segregated from scenario assertions:

| Auxiliary Check Category | Verification Command | Exit Code | Verified Count | Status | Notes |
|---|---|:---:|:---:|:---:|---|
| **TypeScript Typecheck** | `npx.cmd tsc --noEmit` | **0** | Entire Codebase | **PASSED** | Zero type errors |
| **Frontend Script Imports** | `node scripts/check_frontend_imports.mjs` | **0** | 100% of Scripts | **PASSED** | All ES module imports valid |
| **Frontend Static Integrity** | `node scripts/check_frontend_integrity.mjs` | **0** | 18 Pages | **PASSED** | Zero broken links or syntax issues |
| **Production Application Build** | `npm.cmd run build` | **0** | 33 Routes | **PASSED** | Next.js 16.4.3 Turbopack build |
| **Dependency Security Audit** | `npm.cmd audit` | **0** | 0 Vulnerabilities | **PASSED** | Clean advisory state |
| **Relational Model Parity** | Prisma SQLite vs PostgreSQL Schema | — | 31 Models | **PASSED** | 100% field & model parity |
| **Evidence Exhibit Store** | `uploads/raw/` Directory Manifest | — | 560 Files | **PASSED** | Hash `bdc91bb78c603d21...` |
| **Active SQLite Database** | `prisma/dev.db` Checksum | — | 1 Database | **PASSED** | Hash `dd24614b14f1b4cf...` |

---

## 4. Reconciled Cumulative Arithmetic

$$\begin{aligned}
\text{Total Pure Scenario Assertions} &= 15 + 7 + 20 + 21 + 22 + 19 + 25 + 26 + 38 + 40 + 27 + 35 + 35 + 35 + 13 + 30 + 18 \\
&= \mathbf{426} \quad (100.0\% \text{ Passed, } 0 \text{ Failed})
\end{aligned}$$

$$\begin{aligned}
\text{Total Executed Suite Assertions} &= 426 + 1 \text{ (Migration Payload Validator)} \\
&= \mathbf{427} \quad (100.0\% \text{ Passed, } 0 \text{ Failed})
\end{aligned}$$

Zero tests were skipped, blocked, or simulated. All 427 assertions represent genuine, recorded terminal execution outcomes.
