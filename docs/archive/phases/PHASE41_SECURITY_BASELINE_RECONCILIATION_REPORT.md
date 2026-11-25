# RAKSHAK v3.0 — PHASE 41 SECURITY BASELINE RECONCILIATION REPORT
## Comprehensive Audit of PostgreSQL Row-Level Security (RLS), Table Inventory & Direct Isolation Proof

**Date:** 2026-10-25  
**Version:** 3.0.0-phase41  
**Status:** COMPLETE / RECONCILED  
**Isolated Target Database:** `rakshak_phase41_test` (Provisioned fresh, verified non-existent prior to execution)  
**Target Connection Role:** `rakshak_app_user` (Least-privilege application runtime role: `rolsuper = false`, `rolbypassrls = false`)  
**Security Invariant:** Active Development Database (`prisma/dev.db`) & Evidence Cold Storage (`uploads/raw/`) 100% Preserved & Untouched.

---

## 1. Executive Summary & Problem Statement

In Phase 39, the database reconciliation report documented **20 RLS-protected tables** and **21 active RLS policies** in `rakshak_phase39_test`. In Phase 40, the setup script for `rakshak_phase40_test` reported **14 RLS-protected tables** and **13 active RLS policies**.

Workstream B mandated a rigorous investigation to determine whether this discrepancy represented:
- A weakened security posture or missing migrations.
- An incomplete test-database setup.
- A legitimate difference in database scope.

### Core Finding
The investigation revealed that `scripts/setup_phase40_test_db.mjs` inadvertently omitted the foundational RLS migration [prisma/migrations_pg/20261011_rls_tenant_isolation.sql](file:///E:/Rakshak/prisma/migrations_pg/20261011_rls_tenant_isolation.sql) from its execution list, running only the subsequent incremental phase migrations starting from `20261024_access_grants.sql`.

As a consequence:
1. **6 foundational tables** (`CaseEntity`, `CaseLegalMapping`, `DossierExportAudit`, `ExtractedFact`, `GeneratedReport`, `TimelineEvent`) that received RLS exclusively in `20261011_rls_tenant_isolation.sql` were not enabled for RLS in `rakshak_phase40_test`.
2. **8 policies** (the 6 policies on those tables plus `p_auditlog_insert` and `p_auditlog_select` on `AuditLog`) were omitted.
3. The arithmetic reconciles with exact precision:
   - **RLS Tables:** `20 (Phase 39 baseline) - 6 (omitted) = 14 (Phase 40 count)`
   - **RLS Policies:** `21 (Phase 39 baseline) - 8 (omitted) = 13 (Phase 40 count)`

By restoring `20261011_rls_tenant_isolation.sql` as the initial migration in the authoritative setup sequence for `rakshak_phase41_test`, the complete baseline of **20 RLS tables** and **21 policies** was restored and verified with 100% catalog integrity.

---

## 2. Table-by-Table Reconciliation Matrix: Phase 39 vs Phase 40 vs Phase 41

| Table Name | Phase 39 (`rakshak_phase39_test`) | Phase 40 (`rakshak_phase40_test`) | Phase 41 (`rakshak_phase41_test`) | Governing Migration | Root Cause / Reconciliation Classification |
|---|:---:|:---:|:---:|---|---|
| **AccessGrant** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_adversarial_rls_hardening.sql` | Identical across all baselines |
| **AuditLog** | RLS Enabled (2 policies) | RLS Enabled (0 policies) | RLS Enabled (2 policies) | `20261011_rls_tenant_isolation.sql` | In Phase 40, RLS was forced by ALTER TABLE but policies were omitted from setup |
| **Case** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_phase36_evidence_custody.sql` | Identical across all baselines |
| **CaseAssignmentHistory** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_case_lifecycle.sql` | Identical across all baselines |
| **CaseEntity** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |
| **CaseLegalMapping** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |
| **CaseStatusHistory** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_case_lifecycle.sql` | Identical across all baselines |
| **CustodyEvent** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_phase36_evidence_custody.sql` | Identical across all baselines |
| **DossierClaim** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261025_phase38_dossier_reporting.sql` | Identical across all baselines |
| **DossierExportAudit** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |
| **DossierReview** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261025_phase38_dossier_reporting.sql` | Identical across all baselines |
| **EntityLink** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_phase37_cross_case_intelligence.sql` | Identical across all baselines |
| **EntityLinkReview** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_phase37_cross_case_intelligence.sql` | Identical across all baselines |
| **Evidence** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261024_phase36_evidence_custody.sql` | Identical across all baselines |
| **ExtractedFact** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |
| **ExtractedTextArtifact** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261025_phase39_ocr_fact_extraction.sql` | Identical across all baselines |
| **FactReviewHistory** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261025_phase39_ocr_fact_extraction.sql` | Identical across all baselines |
| **GeneratedReport** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |
| **InvestigativeDossier** | RLS Enabled (1 policy) | RLS Enabled (1 policy) | RLS Enabled (1 policy) | `20261025_phase38_dossier_reporting.sql` | Identical across all baselines |
| **TimelineEvent** | RLS Enabled (1 policy) | RLS Disabled (0 policies) | RLS Enabled (1 policy) | `20261011_rls_tenant_isolation.sql` | Omitted in Phase 40 setup; Restored in Phase 41 |

**Total RLS Tables:** Phase 39: 20 | Phase 40: 14 | **Phase 41: 20**  
**Total Policies:** Phase 39: 21 | Phase 40: 13 | **Phase 41: 21**

---

## 3. Comprehensive Authoritative Policy Catalog (`rakshak_phase41_test`)

The following 21 policies are verified active in `rakshak_phase41_test` via `pg_policies`:

1. `AccessGrant` -> `access_grant_department_isolation` (ALL, public)
2. `AuditLog` -> `p_auditlog_insert` (INSERT, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
3. `AuditLog` -> `p_auditlog_select` (SELECT, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
4. `Case` -> `p_case_tenant_isolation` (ALL, public)
5. `CaseAssignmentHistory` -> `case_assignment_history_tenant_isolation` (ALL, public)
6. `CaseEntity` -> `p_caseentity_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
7. `CaseLegalMapping` -> `p_legal_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
8. `CaseStatusHistory` -> `case_status_history_tenant_isolation` (ALL, public)
9. `CustodyEvent` -> `p_custody_tenant_isolation` (ALL, public)
10. `DossierClaim` -> `dossier_claim_tenant_isolation` (ALL, public)
11. `DossierExportAudit` -> `p_dossier_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
12. `DossierReview` -> `dossier_review_tenant_isolation` (ALL, public)
13. `EntityLink` -> `entity_link_tenant_isolation` (ALL, public)
14. `EntityLinkReview` -> `entity_link_review_tenant_isolation` (ALL, public)
15. `Evidence` -> `p_evidence_tenant_isolation` (ALL, public)
16. `ExtractedFact` -> `p_fact_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
17. `ExtractedTextArtifact` -> `ExtractedTextArtifact_tenant_isolation` (ALL, rakshak_app_user)
18. `FactReviewHistory` -> `FactReviewHistory_tenant_isolation` (ALL, rakshak_app_user)
19. `GeneratedReport` -> `p_report_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)
20. `InvestigativeDossier` -> `investigative_dossier_tenant_isolation` (ALL, public)
21. `TimelineEvent` -> `p_timeline_tenant_isolation` (ALL, rakshak_admin_user, rakshak_app_user, rakshak_test_admin)

---

## 4. Workstream C — Direct PostgreSQL RLS Enforcement Test Results

Direct SQL isolation tests were executed using `scripts/test_phase41_direct_rls_enforcement.mjs` connecting exclusively as the unprivileged runtime role `rakshak_app_user`:

| Test ID | Operation & Target Table | Session Authorization Context | Expected Outcome | Actual Database Outcome | Verdict |
|---|---|---|---|---|:---:|
| **RLS-01** | `SELECT id FROM "Case"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads Delhi case (`p41-case-del-1`) | Returned `p41-case-del-1` | **PASSED** |
| **RLS-02** | `SELECT count(*) FROM "Case"` (Foreign) | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Mumbai case invisible (0 rows) | Returned `0` | **PASSED** |
| **RLS-03** | `INSERT INTO "Case"` (Cross-Dept) | Verified Delhi Officer attempting write to Mumbai | RLS `WITH CHECK` violation | Trapped `violates row-level security policy` | **PASSED** |
| **RLS-04** | `SELECT id FROM "Evidence"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads only Delhi evidence exhibit | Returned `p41-evi-del-1` (Mumbai hidden) | **PASSED** |
| **RLS-05** | `SELECT id FROM "CustodyEvent"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads only Delhi custody event | Returned `p41-cust-del-1` (Mumbai hidden) | **PASSED** |
| **RLS-06** | `SELECT id FROM "ExtractedFact"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads only Delhi candidate facts | Returned `p41-fact-del-1` (Mumbai hidden) | **PASSED** |
| **RLS-07** | `SELECT id FROM "CaseEntity"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads only Delhi case entities | Returned `p41-cent-del-1` (Mumbai hidden) | **PASSED** |
| **RLS-08** | `SELECT id FROM "InvestigativeDossier"` | Verified Delhi Officer (`p41-off-del-1`, `p41-dept-del`) | Reads only Delhi dossier | Returned `p41-doss-del-1` (Mumbai hidden) | **PASSED** |
| **RLS-09** | `UPDATE "AuditLog"` | Unprivileged `rakshak_app_user` | Mutation denied (Append-Only) | `permission denied for table AuditLog` | **PASSED** |
| **RLS-10** | `DELETE FROM "AuditLog"` | Unprivileged `rakshak_app_user` | Deletion denied (Append-Only) | `permission denied for table AuditLog` | **PASSED** |
| **RLS-11** | `UPDATE "CaseStatusHistory"` | Unprivileged `rakshak_app_user` | Mutation denied (Append-Only) | `permission denied for table CaseStatusHistory` | **PASSED** |
| **RLS-12** | `DELETE FROM "CaseAssignmentHistory"` | Unprivileged `rakshak_app_user` | Deletion denied (Append-Only) | `permission denied for table CaseAssignmentHistory` | **PASSED** |
| **RLS-13** | Direct SQL client `set_config('app.current_department_id')` | Unverified client parameter spoofing | Fails closed (0 rows visible) | Returned `0` rows | **PASSED** |
| **RLS-14** | Direct SQL client `set_config('app.is_platform_admin')` | Unverified admin privilege escalation | Fails closed (0 rows visible) | Returned `0` rows | **PASSED** |
| **RLS-15** | `SELECT count(*) FROM "Case"` | Missing authorization context | Fails closed (0 rows visible) | Returned `0` rows | **PASSED** |
| **RLS-16** | `set_authenticated_tenant_context` (Suspended) | Suspended Officer account (`p41-off-del-susp`) | Fails closed with exception | `Access Denied: Officer account is inactive or suspended` | **PASSED** |
| **RLS-17** | `clear_tenant_context()` | Reset across pooled connection reuse | Context purged; 0 rows visible | Returned `0` rows | **PASSED** |
| **RLS-18** | Query `pg_roles` for `rakshak_app_user` | Direct catalog inspection | Unprivileged (`rolsuper=f`, `rolbypassrls=f`) | `rakshak_app_user\|f\|f` verified | **PASSED** |

**Execution Result:** 18 / 18 Scenarios Passed (100.0%).

---

## 5. Minimal Additive Remediation Applied

To permanently resolve this discrepancy without altering historical migrations:
1. Updated [scripts/setup_phase41_test_db.mjs](file:///E:/Rakshak/scripts/setup_phase41_test_db.mjs) to prepend `prisma/migrations_pg/20261011_rls_tenant_isolation.sql` to the migration array before incremental phase migrations.
2. Verified that all incremental migrations execute idempotently using `DROP POLICY IF EXISTS` and `CREATE OR REPLACE FUNCTION`.
3. Validated that `rakshak_phase41_test` enforces the complete 20-table, 21-policy security baseline.
