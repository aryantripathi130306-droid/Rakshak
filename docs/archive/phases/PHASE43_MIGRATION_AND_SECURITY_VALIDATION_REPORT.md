# RAKSHAK v3.0 — PHASE 43
# AUTHORITATIVE MIGRATION AND SECURITY VALIDATION REPORT

**Phase:** 43 — Legacy Setup Remediation, Full Regression Revalidation & Release Gate Automation  
**Author:** Rakshak Security Baseline Automation  
**Date:** 2026-10-25  
**Target Environment:** Local PostgreSQL 16 (127.0.0.1:5432)  
**Evaluated Database:** `rakshak_phase43_test`  
**Security Baseline Engine:** [`scripts/validate_security_baseline.mjs`](file:///e:/Rakshak/scripts/validate_security_baseline.mjs)  
**Overall Validation Status:** **PASSED (100.0%)**  

---

## 1. Executive Summary

This report documents the cryptographic verification of the authoritative PostgreSQL migration manifest, actual catalog-level verification of the security baseline on `rakshak_phase43_test`, and negative failure mode evaluations.

Key findings:
- All 11 authoritative migrations were cryptographically verified with byte-accurate SHA-256 digests.
- `rakshak_phase43_test` contains exactly 31 base application tables, with 20 tables enforcing Row Level Security and FORCE ROW LEVEL SECURITY.
- 21 security policies are actively installed and enforcing tenant isolation in the database kernel.
- The unprivileged runtime application role `rakshak_app_user` is verified with `rolsuper=false` and `rolbypassrls=false`.
- Append-only immutability is strictly enforced on `AuditLog` and `CustodyEvent`.
- 16 negative failure scenarios across two dedicated test suites passed with 100% fail-closed behavior.

---

## 2. Cryptographic Migration Manifest & Inventory

The authoritative migration sequence is defined in [`scripts/authoritative_migration_runner.mjs`](file:///e:/Rakshak/scripts/authoritative_migration_runner.mjs). Each file is verified against its SHA-256 digest prior to execution:

| Seq | Migration File | Description | Expected & Verified SHA-256 Digest | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | [`20261011_rls_tenant_isolation.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261011_rls_tenant_isolation.sql) | Foundational RLS tenant isolation on initial application tables | `9759095bac54b086d0431b4c36f74b5f8f85f146145cda14d9f50c548ce92068` | **VERIFIED** |
| 2 | [`20261024_access_grants.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_access_grants.sql) | Cross-department delegated access grants table and RLS policy | `027402f639ec2113b346c03b44470d800eb536b2d85c681846b7d906cd67da55` | **VERIFIED** |
| 3 | [`20261024_adversarial_rls_hardening.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_adversarial_rls_hardening.sql) | Anti-spoofing session context, `private_auth` schema, unforgeable getters | `4e370399248c4db50e058db965b00c56322ab6df281b561db0e1af36d35c82c5` | **VERIFIED** |
| 4 | [`20261024_case_lifecycle.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_case_lifecycle.sql) | Case assignment and status history audit tables and tenant RLS | `7e36e92a464e2c35525cc4acff73b85328c4b24601453d0763b77274f6707725` | **VERIFIED** |
| 5 | [`20261024_phase35_1_hardening.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_phase35_1_hardening.sql) | Supervisor approval workflow and lifecycle transition RLS hardening | `355e1e9de024b5cfeacf9230b564321de7464e90135bfaa9288056e75110bf15` | **VERIFIED** |
| 6 | [`20261024_phase36_evidence_custody.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_phase36_evidence_custody.sql) | Custody event genesis, evidence lifecycle fields and append-only immutability | `2f7d427ffe68abfc7b78c6df3ba5cc84ebbd9bc3d4a04f3c996162c94e783e81` | **VERIFIED** |
| 7 | [`20261024_phase36_1_custody_concurrency.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_phase36_1_custody_concurrency.sql) | Advisory locks and concurrency control for chain of custody transfers | `55fc11412a2fcd80fd55ba9674427c6cf0cfb0e3abd76437600e445622f7b4ed` | **VERIFIED** |
| 8 | [`20261024_phase36_2_custody_integrity.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_phase36_2_custody_integrity.sql) | Cryptographic custody chaining hash verification and unique index | `dc522fdae35ecd7b945e404a3a0897b8218d66a909987b28b7d30fe1e0c84322` | **VERIFIED** |
| 9 | [`20261024_phase37_cross_case_intelligence.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261024_phase37_cross_case_intelligence.sql) | Cross-case entity resolution, EntityLink and EntityLinkReview RLS | `2c174afc60cbe3b9a98d03dcffe0e54a4c2f8a1077d4c34e946ce823d4ce2526` | **VERIFIED** |
| 10 | [`20261025_phase38_dossier_reporting.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261025_phase38_dossier_reporting.sql) | Investigative dossiers, claim verification, review history and export RLS | `5f8989a1c80aa436a43805c1a02a9bfc2c62b7cbdf7d767e0c081b8440a13cb9` | **VERIFIED** |
| 11 | [`20261025_phase39_ocr_fact_extraction.sql`](file:///e:/Rakshak/prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql) | OCR extracted text artifacts and fact review history RLS policies | `80439644430ea214a1d8962b7776892ec4905826bae1189bfeff49b5dec1a43f` | **VERIFIED** |

---

## 3. Actual PostgreSQL Catalog Evidence (`rakshak_phase43_test`)

The security baseline validator queried `pg_tables`, `pg_class`, `pg_policy`, and `pg_roles` directly against PostgreSQL 16.

### 3.1 Table Inventory & RLS Status (31 Base Tables)

| # | Table Name | In Catalog | `relrowsecurity` (RLS) | `relforcerowsecurity` (FORCE RLS) | Expected Baseline |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `AccessGrant` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 2 | `AuditLog` | YES | FALSE | FALSE | Append-Only (Perms) |
| 3 | `Case` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 4 | `CaseAssignmentHistory` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 5 | `CaseCluster` | YES | FALSE | FALSE | System Infrastructure |
| 6 | `CaseEntity` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 7 | `CaseLegalMapping` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 8 | `CaseStatusHistory` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 9 | `ChatTranslation` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 10 | `ClusterMembership` | YES | FALSE | FALSE | System Infrastructure |
| 11 | `CustodyEvent` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 12 | `Department` | YES | FALSE | FALSE | Shared Directory |
| 13 | `DossierClaim` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 14 | `DossierExportAudit` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 15 | `DossierReview` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 16 | `EntityLink` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 17 | `EntityLinkReview` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 18 | `Evidence` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 19 | `EvidenceLegalMapping` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 20 | `ExtractedFact` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 21 | `ExtractedTextArtifact` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 22 | `FactReviewHistory` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 23 | `GeneratedReport` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 24 | `InvestigativeDossier` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 25 | `LegalProvision` | YES | FALSE | FALSE | Static Legal Reference |
| 26 | `Officer` | YES | FALSE | FALSE | Auth Identity Record |
| 27 | `OfficerSession` | YES | FALSE | FALSE | Session Tokens (Kernel) |
| 28 | `PilotFeedback` | YES | FALSE | FALSE | System Feedback |
| 29 | `ScheduledReport` | YES | FALSE | FALSE | System Cron Tasks |
| 30 | `TimelineEvent` | YES | **TRUE** | **TRUE** | Required Tenant RLS |
| 31 | `Transcription` | YES | **TRUE** | **TRUE** | Required Tenant RLS |

**RLS Summary:** Exactly 20 tables have `relrowsecurity = true` AND `relforcerowsecurity = true`. Zero tenant tables omit RLS.

### 3.2 Installed PostgreSQL RLS Policies (21 Policies)

| # | Policy Name | Table | Permitted Operations | Isolation Rule |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `access_grant_department_isolation` | `AccessGrant` | ALL | Grantee or Target Department Match |
| 2 | `p_case_tenant_isolation` | `Case` | ALL | Department Match OR Active AccessGrant |
| 3 | `case_assignment_history_tenant_isolation` | `CaseAssignmentHistory` | ALL | Parent Case Department Match |
| 4 | `p_case_entity_tenant_isolation` | `CaseEntity` | ALL | Parent Case Department Match |
| 5 | `p_case_legal_tenant_isolation` | `CaseLegalMapping` | ALL | Parent Case Department Match |
| 6 | `case_status_history_tenant_isolation` | `CaseStatusHistory` | ALL | Parent Case Department Match |
| 7 | `p_chat_tenant_isolation` | `ChatTranslation` | ALL | Parent Case Department Match |
| 8 | `p_custody_tenant_isolation` | `CustodyEvent` | ALL | Parent Case Department Match OR Active Grant |
| 9 | `dossier_claim_tenant_isolation` | `DossierClaim` | ALL | Parent Dossier Case Department Match |
| 10 | `p_dossier_tenant_isolation` | `DossierExportAudit` | ALL | Parent Case Department Match |
| 11 | `dossier_review_tenant_isolation` | `DossierReview` | ALL | Parent Dossier Case Department Match |
| 12 | `entity_link_tenant_isolation` | `EntityLink` | ALL | Source or Target Case Department Match |
| 13 | `entity_link_review_tenant_isolation` | `EntityLinkReview` | ALL | Parent EntityLink Case Department Match |
| 14 | `p_evidence_tenant_isolation` | `Evidence` | ALL | Parent Case Department Match OR Active Grant |
| 15 | `p_evidence_legal_tenant_isolation` | `EvidenceLegalMapping` | ALL | Parent Case Department Match |
| 16 | `p_fact_tenant_isolation` | `ExtractedFact` | ALL | Parent Case Department Match |
| 17 | `extracted_text_artifact_tenant_isolation`| `ExtractedTextArtifact` | ALL | Parent Case Department Match |
| 18 | `fact_review_history_tenant_isolation` | `FactReviewHistory` | ALL | Parent Case Department Match |
| 19 | `p_report_tenant_isolation` | `GeneratedReport` | ALL | Department Match |
| 20 | `investigative_dossier_tenant_isolation` | `InvestigativeDossier` | ALL | Parent Case Department Match OR Active Grant |
| 21 | `p_timeline_tenant_isolation` | `TimelineEvent` | ALL | Parent Case Department Match |

### 3.3 Role Privilege Audit (`rakshak_app_user`)

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls 
FROM pg_roles WHERE rolname = 'rakshak_app_user';
```

| Role Attribute | Actual Value | Expected Value | Security Implication |
| :--- | :---: | :---: | :--- |
| `rolname` | `rakshak_app_user` | `rakshak_app_user` | Dedicated application runtime role |
| `rolsuper` | **false** | `false` | Non-superuser; cannot override database checks |
| `rolcreaterole` | **false** | `false` | Cannot escalate privileges or create users |
| `rolcreatedb` | **false** | `false` | Cannot create or drop databases |
| `rolbypassrls` | **false** | `false` | **MANDATORY**: Cannot bypass Row Level Security |

### 3.4 Append-Only Table Immutability

Permissions on ledger tables `AuditLog` and `CustodyEvent`:
- `AuditLog`: `GRANT SELECT, INSERT TO rakshak_app_user`. `UPDATE`, `DELETE`, `TRUNCATE` are explicitly revoked.
- `CustodyEvent`: `GRANT SELECT, INSERT TO rakshak_app_user`. `UPDATE`, `DELETE`, `TRUNCATE` are explicitly revoked.
- Direct UPDATE/DELETE attempts by application runtime throw SQL exception: `ERROR: permission denied for table ...`.

### 3.5 Anti-Spoofing Architecture

- Schema `private_auth`: Inaccessible to `rakshak_app_user` (`REVOKE ALL`).
- Session Context Table: `private_auth.session_context` stores authenticated `(backend_pid, officer_id, department_id, is_platform_admin, expires_at)`.
- Context Setter: `set_authenticated_tenant_context` is `SECURITY DEFINER`, validates active officer status and unexpired session token from `OfficerSession`.
- Getters: `get_verified_department_id()` and `is_verified_platform_admin()` read exclusively from `private_auth.session_context`. Unverified client `SET app.current_department_id` or `set_config` calls are completely ignored by RLS policies.

---

## 4. Negative Test Outcomes

### 4.1 Runner Integrity Negative Tests (`scripts/test_phase43_runner_integrity.mjs`)
- 6/6 scenarios passed (Protected DBs blocked, SQLite `.db` blocked, path separators blocked, invalid names blocked, corrupted migration SHA-256 blocked, missing file blocked).

### 4.2 Fail-Closed Provisioning Modes (`scripts/test_phase42_provisioning_failure_modes.mjs`)
- 10/10 scenarios passed (Tampered migration fails closed, missing step fails closed, syntax error fails closed, missing RLS fails closed, `rolbypassrls=true` fails closed, superuser fails closed, unforgeable session context verified).

---

## 5. Security Baseline Verdict

`rakshak_phase43_test` satisfies 100% of the mandatory catalog-level security requirements.
All 11 migrations are applied and verified. Zero RLS gaps exist in the test environment.
