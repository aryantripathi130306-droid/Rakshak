# RAKSHAK v3.0 — PHASE 35
# Authorization, PostgreSQL RLS & Audit Immutability Report

**Status:** COMPLETE  
**Phase:** 35 — Case Lifecycle, Officer Assignment & Investigation Workflow  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  

---

## 1. Executive Summary

Phase 35 extends Rakshak's defense-in-depth security architecture to all newly introduced case lifecycle and officer assignment operations. The security perimeter ensures that neither application flaws, forged client claims, nor direct database queries can violate departmental boundaries or forge administrative authority.

Highlights:
1. **PostgreSQL RLS & Force RLS:** Both `CaseAssignmentHistory` and `CaseStatusHistory` have row-level security enabled and forced in PostgreSQL 16.15.
2. **Phase 34.1 Verified-Session Context:** Context cannot be established by client-supplied `set_config('app.current_department_id')` or `set_config('app.is_platform_admin')`. Context requires a cryptographically verified, active session token in `OfficerSession` passed to `set_authenticated_tenant_context()`.
3. **Immutable Audit Trail:** All case creations, state transitions, officer assignments, and assignment revocations generate append-only audit events in `AuditLog`. The application provides zero endpoints for modifying or deleting audit entries.
4. **Cold Evidence Binaries Preserved:** The 560 physical cold storage binaries under `uploads/raw/` remain 100% unaltered (manifest SHA-256: `bdc91bb78c603d21...`).

---

## 2. PostgreSQL RLS Policies on Lifecycle Models

### 2.1 Table Configuration & Policies

In `prisma/migrations_pg/20261024_case_lifecycle.sql`, both new tables are secured with kernel-level RLS:

```sql
-- Enable RLS and Force RLS
ALTER TABLE "CaseAssignmentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseAssignmentHistory" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CaseStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseStatusHistory" FORCE ROW LEVEL SECURITY;

-- Assignment History Tenant Policy
CREATE POLICY "case_assignment_history_tenant_isolation" ON "CaseAssignmentHistory"
  AS RESTRICTIVE
  FOR ALL
  TO rakshak_app_user
  USING (
    private_auth.is_verified_platform_admin()
    OR "departmentId" = private_auth.get_verified_tenant_department()
  )
  WITH CHECK (
    private_auth.is_verified_platform_admin()
    OR "departmentId" = private_auth.get_verified_tenant_department()
  );

-- Status History Tenant Policy
CREATE POLICY "case_status_history_tenant_isolation" ON "CaseStatusHistory"
  AS RESTRICTIVE
  FOR ALL
  TO rakshak_app_user
  USING (
    private_auth.is_verified_platform_admin()
    OR "departmentId" = private_auth.get_verified_tenant_department()
  )
  WITH CHECK (
    private_auth.is_verified_platform_admin()
    OR "departmentId" = private_auth.get_verified_tenant_department()
  );
```

### 2.2 Adversarial Immunity (Scenario 25 Verification)

In the synthetic database `rakshak_phase35_test`:
1. **Unverified Claims Rejected:** Attempting to query `Case` or `CaseAssignmentHistory` using client-set `set_config('app.current_department_id', 'dept-chd', true)` returns **0 rows**.
2. **Verified Session Context:** Invoking `SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p35-valid')` validates the session token against `OfficerSession` and activates the tenant context.
3. **Strict Boundary Isolation:** The Chandigarh tenant sees strictly Chandigarh cases (`case-chd-1`) and assignments (`cah-chd-1`). Delhi records (`case-del-1`, `cah-del-1`) are completely hidden by the database engine.
4. **Role Attributes:** The runtime user `rakshak_app_user` has `rolsuper = false` and `rolbypassrls = false`.

---

## 3. RBAC Permissions Matrix

The `Permission` union in `lib/accessControl.ts` was expanded to include `"case:assign"`.

| Role | `case:create` | `case:read` | `case:update` | `case:assign` | `case:close` (Supervisor review) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `SYS_ADMIN` | Yes | Yes (Metadata / Scope) | Yes | Yes | Yes |
| `DEPT_ADMIN` | Yes | Yes (Dept Scope) | Yes | Yes | Yes |
| `SUPERVISOR` | Yes | Yes (Dept Scope) | Yes | Yes | Yes |
| `INVESTIGATOR` | Yes | Yes (Assigned / Dept) | Yes (Active Inquiry) | No | No |
| `FORENSIC_EXAMINER` | No | Yes (Evidence Scope) | No | No | No |
| `AUDITOR` | No | Yes (Audit Scope) | No | No | No |
| `VIEWER` | No | Yes (Read Only) | No | No | No |

---

## 4. Audit Trail Specification

Every lifecycle operation appends an immutable audit entry via `prisma.auditLog.create`:

| Action | Target Type | Target ID | Details Logged |
| :--- | :--- | :--- | :--- |
| `CREATE_CASE` | `Case` | `caseId` | `caseNumber`, `incidentType`, `jurisdiction`, `departmentId` |
| `TRANSITION_CASE_STATUS` | `Case` | `caseId` | `fromStatus`, `toStatus`, `reason`, `approvedBy` |
| `ASSIGN_CASE_OFFICER` | `Case` | `caseId` | `officerId`, `officerName`, `assignmentType`, `reason` |
| `REVOKE_CASE_ASSIGNMENT` | `Case` | `caseId` | `assignmentId`, `officerId`, `officerName`, `reason` |

Audit logs are strictly append-only. There are no API routes or application methods to edit or remove records in `AuditLog`.

---

## 5. Comprehensive Regression Validation Results

All regression suites and static checks were executed against the codebase:

| Check / Test Command | Exit Code | Result | Notes |
| :--- | :---: | :---: | :--- |
| `npm run prisma:generate` | 0 | PASSED | Generated clients for SQLite and PostgreSQL |
| `npx tsc --noEmit` | 0 | PASSED | 0 TypeScript type errors across entire codebase |
| `node scripts/test_phase17_verifier.mjs` | 0 | PASSED | 15/15 assertions passed; cold storage immutability verified |
| `node scripts/validate_migration_payload.mjs` | 0 | PASSED | 21 models, 475 entities, 0 FK violations |
| `node scripts/test_phase18_migration_rehearsal.mjs` | 0 | PASSED | 7/7 assertions passed; rollback safety confirmed |
| `node scripts/test_phase32_authorization.mjs` | 0 | PASSED | 20/20 scenarios passed; multi-user authorization intact |
| `node scripts/test_phase33_account_lifecycle.mjs` | 0 | PASSED | 21/21 scenarios passed; provisioning & session revocation intact |
| `node scripts/test_phase34_security_and_rls.mjs` | 0 | PASSED | 22/22 scenarios passed; persistent grants & Next.js security intact |
| `node scripts/test_phase34_1_adversarial_rls.mjs` | 0 | PASSED | 19/19 scenarios passed; adversarial context forgery rejected |
| `node scripts/test_phase35_case_lifecycle.mjs` | 0 | PASSED | **25/25 scenarios passed (100.0%)** |
| `node scripts/check_frontend_imports.mjs` | 0 | PASSED | All imports validated across all frontend scripts |
| `node scripts/check_frontend_integrity.mjs` | 0 | PASSED | 18 pages verified; 0 broken links or syntax errors |
| `npm audit` | 0 | PASSED | 0 vulnerabilities found |
| `npm run build` | 0 | PASSED | Production Turbopack build succeeded (30 static & dynamic routes compiled) |

---

## 6. Cold Storage & Database Invariant Verification

- **Cold Storage Binaries (`uploads/raw/`):** 560 files present; SHA-256 manifest hash before and after execution: `bdc91bb78c603d21...` (Zero bytes modified).
- **Active Dev Database (`prisma/dev.db`):** SHA-256: `2ef582ba31484687...` (Non-destructive migration preserved all 19 existing cases and historical data).
- **Synthetic PostgreSQL DB:** `rakshak_phase35_test` created and utilized exclusively for Phase 35 PostgreSQL RLS validation. Existing databases `rakshak_phase26_test`, `rakshak_phase34_test`, and `rakshak_phase34_1_test` were untouched.
