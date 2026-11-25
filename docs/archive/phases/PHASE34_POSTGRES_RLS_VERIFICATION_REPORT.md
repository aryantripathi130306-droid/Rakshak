# RAKSHAK v3.0 — PHASE 34: POSTGRESQL RLS VERIFICATION REPORT
**Date:** 2026-10-24  
**Classification:** Confidential / Database Security & Row-Level Isolation Audit  
**Author:** Principal PostgreSQL Security Engineer & Infrastructure Auditor  
**Status:** 100% Empirically Verified on Dedicated Database  

---

## 1. Executive Summary

Phase 34 Workstream C established direct, empirical verification of PostgreSQL Row-Level Security (RLS) policies for the newly introduced `AccessGrant` model.

In accordance with mandatory security rules:
- Active production/staging databases (`prisma/dev.db`, `prisma/clean_deployment.db`, `prisma/test.db`) and the prior test database `rakshak_phase26_test` were strictly preserved without mutation or reset.
- An isolated synthetic database named **`rakshak_phase34_test`** was created on the local PostgreSQL 16 instance.
- Dual schemas and migration DDLs were pushed to `rakshak_phase34_test`.
- RLS tests were executed directly using the application runtime role **`rakshak_app_user`**, which strictly lacks superuser privileges (`rolsuper=false`) and lacks RLS bypass privileges (`rolbypassrls=false`). Table ownership remains with `postgres`, preventing owner bypass.

---

## 2. Server Runtime & Catalog Security Invariants

| Attribute | Verified Value | Security Meaning |
|---|---|---|
| **Database Engine** | PostgreSQL 16.15, Visual C++ 64-bit | Enterprise relational kernel with RLS support. |
| **Dedicated Test DB** | `rakshak_phase34_test` | Complete isolation from active databases. |
| **Application Role** | `rakshak_app_user` | `rolsuper = false`, `rolbypassrls = false` (cannot bypass RLS). |
| **Admin Role** | `rakshak_admin_user` | Inherits `rakshak_admin_role`; cannot bypass without explicit context. |
| **Table Owner** | `postgres` | Neither app user nor admin user owns the table. |
| **`relrowsecurity`** | `true` | RLS enabled on table `AccessGrant`. |
| **`relforcerowsecurity`** | `true` | FORCE RLS active; applies even if queried by table owners. |

---

## 3. Discrepancy Investigation: Phase 26 vs Phase 33 Counts

Phase 34 investigated the historical discrepancy between the Phase 26 test assertion counts and the figures cited in Phase 33 documentation:
- **Verified Source of Truth:** `backups/phase26_postgres_results.json` records **31 total assertions** executed:
  - Catalog Checks: 13 passed
  - Privilege Escalation Defenses: 6 passed
  - Department Isolation Policies: 10 passed
  - Administrative Controls: 2 passed
  - **Overall Status:** `PASSED` (31/31, 100.0%)
- **Source of Discrepancy:** The Phase 33 narrative referred to "30/30 passed" due to omitting the server version catalog assertion from the report summary. The canonical record in `phase26_postgres_results.json` confirms 31 total assertions.

---

## 4. Phase 34 Direct RLS Test Matrix (`rakshak_phase34_test`)

Tested via `scripts/test_phase34_security_and_rls.mjs`:

| Test ID | Test Scenario | Actor / Role Used | Policy Evaluated | Expected Result | Actual Outcome | Status |
|---|---|---|---|---|---|---|
| **TC-C01** | Role Security Invariants | `rakshak_app_user` | `pg_roles` catalog | `rolsuper=f`, `rolbypassrls=f` | Verified `false` for both | **PASSED** |
| **TC-C02** | Catalog RLS & FORCE RLS | `AccessGrant` | `pg_class` catalog | `relrowsecurity=t`, `relforcerowsecurity=t` | Verified `true` for both | **PASSED** |
| **TC-C03** | Authorized Department Grant Read | `rakshak_app_user` (dept-chd) | `access_grant_department_isolation` | Visible: DEL-to-CHD active & expired grants | 2 grants visible to CHD | **PASSED** |
| **TC-C04** | Denied Foreign Department Grant Read | `rakshak_app_user` (dept-chd) | `access_grant_department_isolation` | MUM internal & DEL-to-MUM invisible | 0 foreign grants returned | **PASSED** |
| **TC-C05** | Missing Tenant Context Fails Closed | `rakshak_app_user` (empty ctx) | `access_grant_department_isolation` | Denies all rows (`count = 0`) | Exactly 0 rows returned | **PASSED** |
| **TC-C06** | Unauthorized Grant Insertion | `rakshak_app_user` (dept-chd) | `access_grant_department_isolation` WITH CHECK | Denies grant targeting MUM without authority | RLS policy check violation raised | **PASSED** |
| **TC-C07** | Client Admin Self-Elevation Rejected | `rakshak_app_user` (tampered ctx) | `pg_has_role(SESSION_USER, 'rakshak_admin_role')` | Self-asserted admin flag ignored | Count strictly bounded to 2 tenant grants | **PASSED** |
| **TC-C08** | Platform Admin Explicit Context | `rakshak_admin_user` (admin ctx) | `set_platform_admin_context()` | Full catalog visibility | All 4 grants visible | **PASSED** |
| **TC-C09** | Direct SQL Enforcement Independence | `rakshak_app_user` | Database Kernel RLS | Bounded regardless of client headers | Direct SQL restricted | **PASSED** |
| **TC-C10** | Evidence Cold Storage Baseline | Filesystem Hash | SHA-256 Manifest | 560 files, SHA-256 untouched | 560 files, hash identical | **PASSED** |

---

## 5. Cold Storage & Evidence Binary Preservation

Before and after test execution:
- **Baseline Evidence Directory:** `uploads/raw/`
- **Pre-Test File Count:** 560 `.bin` exhibit files
- **Pre-Test Manifest SHA-256:** `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`
- **Post-Test File Count:** 560 `.bin` exhibit files
- **Post-Test Manifest SHA-256:** `bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8`
- **Result:** 100% UNTOUCHED and PRESERVED. Zero real investigative data was ingested or accessed.
