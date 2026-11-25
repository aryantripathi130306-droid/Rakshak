# RAKSHAK v3.0 — PHASE 35.1
# History Tables PostgreSQL RLS & Audit Immutability Report

**Status:** COMPLETE  
**Phase:** 35.1 — Supervisor Approval Verification, Migration Parity & Historical Record Protection  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  
**Database Target:** `rakshak_phase35_1_test` (Dedicated Non-Bypass Testing Database)  
**Runtime Role Tested:** `rakshak_app_user` (`rolsuper = false`, `rolbypassrls = false`)  

---

## 1. Executive Summary

Phase 35.1 provides rigorous verification of PostgreSQL Row-Level Security (RLS) on all workflow history tables and establishes concrete proof of database and application-level audit immutability.

Key security findings & protections:
1. **Non-Bypass Testing Invariant:** All security tests were performed against `rakshak_phase35_1_test` using the unprivileged application database user `rakshak_app_user` (verified via `pg_roles` to lack superuser privileges and RLS bypass).
2. **History Table RLS Enforcement:** Both `CaseAssignmentHistory` and `CaseStatusHistory` have kernel-level RLS and `FORCE ROW LEVEL SECURITY` enabled. An investigator in one department cannot read, alter, or insert fabricated records into another department's cases.
3. **Verified Session Tenant Context:** Context cannot be forged by client-settable session variables (e.g. `set_config('app.current_department_id')` or `set_config('app.is_platform_admin')`). Context requires a cryptographically verified, active session token in `OfficerSession` passed to `set_authenticated_tenant_context()`.
4. **Database-Level Immutability:**
   - Destructive operations (`UPDATE`, `DELETE`, `TRUNCATE`) on `CaseStatusHistory` are explicitly revoked from `rakshak_app_user` in PostgreSQL.
   - Destructive operations (`UPDATE`, `DELETE`, `TRUNCATE`) on `AuditLog` are explicitly revoked from `rakshak_app_user` in PostgreSQL.
   - Destructive deletion (`DELETE`, `TRUNCATE`) on `CaseAssignmentHistory` is explicitly revoked from `rakshak_app_user`.
5. **Application-Level Immutability:** The central audit endpoint `app/api/audit/route.ts` actively rejects `POST`, `PUT`, `PATCH`, and `DELETE` requests with HTTP 405 Method Not Allowed.

---

## 2. PostgreSQL Role Attributes & Security Catalog

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';
```
- `rolname`: `rakshak_app_user`
- `rolsuper`: `false` (Non-superuser)
- `rolbypassrls`: `false` (Kernel RLS enforced)

### Table Catalog RLS Attributes
```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class 
WHERE relname IN ('Case', 'CaseAssignmentHistory', 'CaseStatusHistory', 'AccessGrant', 'AuditLog') 
ORDER BY relname;
```
| Table Name | `relrowsecurity` (RLS Enabled) | `relforcerowsecurity` (FORCE RLS) |
| :--- | :---: | :---: |
| `AccessGrant` | `true` | `true` |
| `AuditLog` | `true` | `true` |
| `Case` | `true` | `true` |
| `CaseAssignmentHistory` | `true` | `true` |
| `CaseStatusHistory` | `true` | `true` |

---

## 3. Workstream C: Direct PostgreSQL RLS Test Results

All 12 direct database test cases were executed using `rakshak_app_user`:

| Test ID | Test Scenario | Database Operation | Expected Outcome | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-C01** | Authorized investigator reads assignment history | `SELECT ... WHERE caseId = 'case-chd-1'` under verified CHD context | History records returned | `cah-chd-1` visible to CHD tenant | **PASSED** |
| **TC-C02** | Foreign department history isolation | `SELECT ... WHERE caseId = 'case-del-1'` under verified CHD context | 0 records returned | Delhi assignment completely hidden | **PASSED** |
| **TC-C03** | Unauthorized assignment insertion | `INSERT INTO "CaseAssignmentHistory" ...` targeting `dept-del` | Blocked by RLS `WITH CHECK` | `ERROR: violates row-level security policy` | **PASSED** |
| **TC-C04** | Unauthorized assignment deletion | `DELETE FROM "CaseAssignmentHistory" WHERE id = 'cah-chd-1'` | Blocked by database privileges | `ERROR: permission denied for table CaseAssignmentHistory` | **PASSED** |
| **TC-C05** | Authorized status transition logging | `INSERT INTO "CaseStatusHistory" ...` targeting `dept-chd` | Allowed under tenant scope | `csh-chd-2` committed cleanly | **PASSED** |
| **TC-C06** | Unauthorized status insertion | `INSERT INTO "CaseStatusHistory" ...` targeting `dept-del` | Blocked by RLS `WITH CHECK` | `ERROR: violates row-level security policy` | **PASSED** |
| **TC-C07** | Unauthorized status mutation or deletion | Direct `UPDATE` and `DELETE` on `"CaseStatusHistory"` | Blocked by database privileges | `ERROR: permission denied for table CaseStatusHistory` | **PASSED** |
| **TC-C08** | Missing tenant context handling | Query without calling `set_authenticated_tenant_context` | Fails closed; 0 rows returned | 0 rows returned across all history tables | **PASSED** |
| **TC-C09** | Forged client context rejection | Client calls `set_config('app.current_department_id', ...)` | Ignored by kernel RLS policies | 0 rows returned | **PASSED** |
| **TC-C10** | Verified session scoping | `SELECT ...` under verified Delhi supervisor context | Strictly Delhi records visible | DEL records visible; CHD hidden | **PASSED** |
| **TC-C11** | Pooled connection context hygiene | `clear_tenant_context()` followed by query | Context purged; 0 rows returned | Count = 0 after context cleared | **PASSED** |
| **TC-C12** | Expired/revoked grant fail-closed | Query dependent on expired access grant | Fails closed | Expired status enforced; access denied | **PASSED** |

---

## 4. Workstream D: Audit Immutability Verification

### 4.1 Database Privilege Restrictions
In `prisma/migrations_pg/20261024_phase35_1_hardening.sql`:
```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM rakshak_app_user;
GRANT SELECT, INSERT ON TABLE "AuditLog" TO rakshak_app_user;
```

Direct SQL testing as `rakshak_app_user`:
- **UPDATE Attempt:** `UPDATE "AuditLog" SET "details" = 'Tampered';`
  - Result: `ERROR: permission denied for table AuditLog` (**PASSED - TC-D01**)
- **DELETE Attempt:** `DELETE FROM "AuditLog";`
  - Result: `ERROR: permission denied for table AuditLog` (**PASSED - TC-D02**)

### 4.2 Application Route Protection (`app/api/audit/route.ts`)
The audit API exposes only `GET` for authenticated officers with `audit:read` or `audit:view` permissions. All mutation endpoints return HTTP 405 Method Not Allowed:
- `POST /api/audit`: Returns HTTP 405 (`Audit records are immutable and cannot be created manually via API.`)
- `PUT /api/audit`: Returns HTTP 405 (`Audit records are immutable and cannot be modified.`)
- `PATCH /api/audit`: Returns HTTP 405 (`Audit records are immutable and cannot be modified.`)
- `DELETE /api/audit`: Returns HTTP 405 (`Audit records are immutable and cannot be deleted.`)

---

## 5. Cold Evidence Storage & Database Immutability Invariant

- **Active SQLite DB (`prisma/dev.db`):** Pre-test SHA-256 = Post-test SHA-256 (`2ef582ba31484687...`). 100% untouched.
- **Cold Evidence Binaries (`uploads/raw/`):** 560 physical `.bin` files verified before and after test execution. Manifest hash: `bdc91bb78c603d21...`. Zero bytes modified, moved, or deleted.
- **Dedicated Synthetic Target:** `rakshak_phase35_1_test` created exclusively for Phase 35.1 verification; historical databases (`rakshak_phase26_test`, `rakshak_phase34_test`, `rakshak_phase34_1_test`, `rakshak_phase35_test`) were left completely untouched.
