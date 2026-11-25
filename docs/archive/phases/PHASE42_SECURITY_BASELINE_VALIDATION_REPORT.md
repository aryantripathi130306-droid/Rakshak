# RAKSHAK v3.0 — PHASE 42 AUDIT REPORT
## Workstream C & E: Security Baseline Validation & Direct RLS Table-by-Table Enforcement Matrix

**Document Classification:** Internal Technical Audit & Database Security Verification Report  
**Phase:** 42 (Migration Completeness, Security Baseline Automation & Fail-Closed Test Setup)  
**Execution Timestamp:** 2026-10-25T13:49:15+05:30  
**Target Environment:** Isolated Test Database `rakshak_phase42_test`  
**Execution Role:** `rakshak_app_user` (`rolsuper = false`, `rolbypassrls = false`)  

---

### 1. Executive Summary

Phase 42 authored and executed an automated catalog security validator ([scripts/validate_security_baseline.mjs](file:///E:/Rakshak/scripts/validate_security_baseline.mjs)) and an expanded direct SQL RLS enforcement suite ([scripts/test_phase42_direct_rls_coverage.mjs](file:///E:/Rakshak/scripts/test_phase42_direct_rls_coverage.mjs)) on the fresh, isolated test database `rakshak_phase42_test`.

All 31 relational models were audited. All 20 tenant-scoped tables were verified to have both `relrowsecurity = true` and `relforcerowsecurity = true`. All 21 RLS policies were verified in PostgreSQL catalogs and tested via direct SQL as the unprivileged runtime application role `rakshak_app_user`. Across all 26 direct enforcement scenarios, **26 of 26 passed (100.0%)**.

---

### 2. Comprehensive Relational Model & RLS Catalog Matrix

PostgreSQL catalog queries on `pg_class`, `information_schema.tables`, and `pg_policies` confirm the exact security baseline on `rakshak_phase42_test`:

| # | Table Name | Type / Scope | Owner | RLS Enabled (`relrowsecurity`) | FORCE RLS (`relforcerowsecurity`) | Active RLS Policy Name | Permitted Commands & Roles | Direct SQL Test ID | Enforcement Outcome |
|---|---|---|---|---|---|---|---|---|---|
| **1** | `AccessGrant` | Tenant Delegation | `postgres` | **TRUE** | **TRUE** | `access_grant_department_isolation` | ALL (`public`) | `RLS-T13` | **PASS (100%)** |
| **2** | `AuditLog` | Audit Ledger | `postgres` | **TRUE** | **TRUE** | `p_auditlog_insert`<br>`p_auditlog_select` | INSERT (`rakshak_app_user`)<br>SELECT (`admin/migrator`) | `RLS-T10` | **PASS (100%)** |
| **3** | `Case` | Tenant Root | `postgres` | **TRUE** | **TRUE** | `p_case_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T01`, `RLS-T21` | **PASS (100%)** |
| **4** | `CaseAssignmentHistory` | Tenant Audit Trail | `postgres` | **TRUE** | **TRUE** | `case_assignment_history_tenant_isolation` | ALL (`public`) | `RLS-T11` | **PASS (100%)** |
| **5** | `CaseCluster` | Master / Analytics | `postgres` | FALSE | FALSE | *None (Global Master)* | N/A | Global Table | **VERIFIED** |
| **6** | `CaseEntity` | Tenant Scoped | `postgres` | **TRUE** | **TRUE** | `p_caseentity_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T05` | **PASS (100%)** |
| **7** | `CaseLegalMapping` | Tenant Scoped | `postgres` | **TRUE** | **TRUE** | `p_legal_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T14` | **PASS (100%)** |
| **8** | `CaseStatusHistory` | Tenant Audit Trail | `postgres` | **TRUE** | **TRUE** | `case_status_history_tenant_isolation` | ALL (`public`) | `RLS-T12` | **PASS (100%)** |
| **9** | `ChatTranslation` | Master / Utility | `postgres` | FALSE | FALSE | *None (Transient Cache)* | N/A | Global Table | **VERIFIED** |
| **10** | `ClusterMembership` | Master / Join | `postgres` | FALSE | FALSE | *None (Global Join)* | N/A | Global Table | **VERIFIED** |
| **11** | `CustodyEvent` | Tenant Immutability | `postgres` | **TRUE** | **TRUE** | `p_custody_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T03` | **PASS (100%)** |
| **12** | `Department` | Master Root | `postgres` | FALSE | FALSE | *None (Tenant Master)* | N/A | Global Master | **VERIFIED** |
| **13** | `DossierClaim` | Tenant Scoped | `postgres` | **TRUE** | **TRUE** | `dossier_claim_tenant_isolation` | ALL (`public`) | `RLS-T07` | **PASS (100%)** |
| **14** | `DossierExportAudit` | Tenant Audit Trail | `postgres` | **TRUE** | **TRUE** | `p_dossier_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T09` | **PASS (100%)** |
| **15** | `DossierReview` | Tenant Approval | `postgres` | **TRUE** | **TRUE** | `dossier_review_tenant_isolation` | ALL (`public`) | `RLS-T08` | **PASS (100%)** |
| **16** | `EntityLink` | Tenant Intelligence | `postgres` | **TRUE** | **TRUE** | `entity_link_tenant_isolation` | ALL (`public`) | `RLS-T15` | **PASS (100%)** |
| **17** | `EntityLinkReview` | Tenant Decisions | `postgres` | **TRUE** | **TRUE** | `entity_link_review_tenant_isolation` | ALL (`public`) | `RLS-T16` | **PASS (100%)** |
| **18** | `Evidence` | Tenant Exhibits | `postgres` | **TRUE** | **TRUE** | `p_evidence_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T02` | **PASS (100%)** |
| **19** | `EvidenceLegalMapping` | Reference Join | `postgres` | FALSE | FALSE | *None (Global Join)* | N/A | Global Table | **VERIFIED** |
| **20** | `ExtractedFact` | Tenant Intelligence | `postgres` | **TRUE** | **TRUE** | `p_fact_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T04` | **PASS (100%)** |
| **21** | `ExtractedTextArtifact` | Tenant OCR Data | `postgres` | **TRUE** | **TRUE** | `ExtractedTextArtifact_tenant_isolation` | ALL (`rakshak_app_user`) | `RLS-T17` | **PASS (100%)** |
| **22** | `FactReviewHistory` | Tenant Audit Trail | `postgres` | **TRUE** | **TRUE** | `FactReviewHistory_tenant_isolation` | ALL (`rakshak_app_user`) | `RLS-T18` | **PASS (100%)** |
| **23** | `GeneratedReport` | Tenant Reports | `postgres` | **TRUE** | **TRUE** | `p_report_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T19` | **PASS (100%)** |
| **24** | `InvestigativeDossier` | Tenant Dossiers | `postgres` | **TRUE** | **TRUE** | `investigative_dossier_tenant_isolation` | ALL (`public`) | `RLS-T06` | **PASS (100%)** |
| **25** | `LegalProvision` | Master Statutory Law | `postgres` | FALSE | FALSE | *None (Statutory Master)* | N/A | Global Master | **VERIFIED** |
| **26** | `Officer` | System Directory | `postgres` | FALSE | FALSE | *None (Identity Master)* | N/A | Global Master | **VERIFIED** |
| **27** | `OfficerSession` | Auth Token Directory | `postgres` | FALSE | FALSE | *None (Session Table)* | N/A | Global Table | **VERIFIED** |
| **28** | `PilotFeedback` | System Telemetry | `postgres` | FALSE | FALSE | *None (Telemetry)* | N/A | Global Table | **VERIFIED** |
| **29** | `ScheduledReport` | System Cron Job | `postgres` | FALSE | FALSE | *None (Scheduler)* | N/A | Global Table | **VERIFIED** |
| **30** | `TimelineEvent` | Tenant Chronology | `postgres` | **TRUE** | **TRUE** | `p_timeline_tenant_isolation` | ALL (`app_user`, `admin_user`) | `RLS-T20` | **PASS (100%)** |
| **31** | `Transcription` | Master / Audio Cache | `postgres` | FALSE | FALSE | *None (Media Cache)* | N/A | Global Table | **VERIFIED** |

**Summary Totals:**
- Total Base Tables: **31**
- RLS-Protected Tables: **20**
- FORCE RLS Tables: **20**
- Total Active RLS Policies: **21** (2 policies on `AuditLog`, 1 on each of the other 19 tables)

---

### 3. Application Role Privileges & Immutability Verification

Catalog queries on `pg_roles` and `information_schema.table_privileges` verified the exact security posture of the runtime application role:

```
Role: rakshak_app_user
  • rolsuper:       f (false) — NOT superuser
  • rolcreaterole:  f (false) — Cannot alter roles
  • rolcreatedb:    f (false) — Cannot create/drop databases
  • rolbypassrls:   f (false) — CANNOT BYPASS ROW LEVEL SECURITY
```

**Table Privilege Verification on AuditLog & History Tables:**
- `SELECT privilege_type FROM information_schema.table_privileges WHERE table_name='AuditLog' AND grantee='rakshak_app_user'`
  - Permitted: `INSERT`
  - Explicitly Denied: `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`
- Immutability on `CaseAssignmentHistory`: Direct `DELETE` denied.
- Immutability on `CaseStatusHistory`: Direct `UPDATE` denied.

---

### 4. Direct SQL RLS Enforcement Execution Results

Test suite [scripts/test_phase42_direct_rls_coverage.mjs](file:///E:/Rakshak/scripts/test_phase42_direct_rls_coverage.mjs) was executed connecting exclusively as unprivileged role `rakshak_app_user` with tenant context established via `private_auth.set_authenticated_tenant_context(officerId, departmentId, sessionToken)`.

A 3-tenant test topology was utilized:
1. **Delhi (`p42-dept-del`):** Home department of authenticated officer.
2. **Mumbai (`p42-dept-mum`):** Delegated department with an active `AccessGrant` for `p42-case-mum-1`.
3. **Kolkata (`p42-dept-kol`):** Completely isolated foreign department with **NO** access grant.

| Scenario ID | Target Model | Operation Tested | Expected Outcome | Actual Outcome | Status |
|---|---|---|---|---|---|
| `RLS-T01` | `Case` | Read cases | Delhi & delegated Mumbai visible; Kolkata invisible | `[p42-case-del-1, p42-case-mum-1]` visible, Kolkata invisible | **PASSED** |
| `RLS-T02` | `Evidence` | Read exhibits | Delhi visible; Kolkata strictly invisible | `p42-evi-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T03` | `CustodyEvent` | Read custody events | Delhi visible; Kolkata strictly invisible | `p42-cust-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T04` | `ExtractedFact` | Read candidate facts | Delhi visible; Kolkata strictly invisible | `p42-fact-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T05` | `CaseEntity` | Read case entities | Delhi visible; Kolkata strictly invisible | `p42-cent-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T06` | `InvestigativeDossier` | Read dossiers | Delhi visible; Kolkata strictly invisible | `p42-doss-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T07` | `DossierClaim` | Read dossier claims | Delhi visible; Kolkata strictly invisible | `p42-clm-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T08` | `DossierReview` | Read dossier reviews | Delhi visible; Kolkata strictly invisible | `p42-drev-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T09` | `DossierExportAudit` | Read export audits | Delhi visible; Kolkata strictly invisible | `p42-dexp-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T10` | `AuditLog` | Audit immutability | Read denied (0 rows), UPDATE/DELETE denied | Read 0 rows, UPDATE/DELETE blocked with error | **PASSED** |
| `RLS-T11` | `CaseAssignmentHistory` | Read assignments | Delhi visible; Kolkata strictly invisible | `p42-cah-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T12` | `CaseStatusHistory` | Read status history | Delhi visible; Kolkata strictly invisible | `p42-csh-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T13` | `AccessGrant` | Read access grants | Delhi grant visible; Mumbai-Kolkata grant invisible | `p42-ag-del-1` visible, foreign grant invisible | **PASSED** |
| `RLS-T14` | `CaseLegalMapping` | Read legal mappings | Delhi visible; Kolkata strictly invisible | `p42-clm-map-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T15` | `EntityLink` | Read entity links | Delhi links visible; foreign links invisible | `p42-elink-del-1` visible, foreign link invisible | **PASSED** |
| `RLS-T16` | `EntityLinkReview` | Read link reviews | Delhi reviews visible; foreign reviews invisible | `p42-elr-del-1` visible, foreign review invisible | **PASSED** |
| `RLS-T17` | `ExtractedTextArtifact` | Read OCR artifacts | Delhi visible; Kolkata strictly invisible | `p42-eta-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T18` | `FactReviewHistory` | Read fact reviews | Delhi visible; Kolkata strictly invisible | `p42-frh-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T19` | `GeneratedReport` | Read generated reports | Delhi visible; Kolkata strictly invisible | `p42-grep-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T20` | `TimelineEvent` | Read timeline events | Delhi visible; Kolkata strictly invisible | `p42-tle-del-1` visible, Kolkata invisible | **PASSED** |
| `RLS-T21` | `Case` | Cross-tenant write | Unauthorized INSERT into Kolkata rejected | RLS WITH CHECK policy violation trapped | **PASSED** |
| `RLS-T22` | `SecurityContext` | Missing context | Queries return 0 rows | 0 rows returned | **PASSED** |
| `RLS-T23` | `SecurityContext` | Direct `set_config` spoof | Client `set_config` fails closed | 0 rows returned | **PASSED** |
| `RLS-T24` | `SecurityContext` | Suspended officer session | Context establishment fails closed | Exception: "Officer account is inactive or suspended" | **PASSED** |
| `RLS-T25` | `SecurityContext` | Pooled teardown | `clear_tenant_context()` cleanses session | 0 rows returned after teardown | **PASSED** |
| `RLS-T26` | `RoleInvariants` | Privilege inspection | `rakshak_app_user|f|f` | `rakshak_app_user|f|f` verified | **PASSED** |

**Direct RLS Coverage Result:** **26 of 26 scenarios passed (100.0%)**.
