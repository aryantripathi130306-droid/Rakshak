# RAKSHAK v3.0 — PHASE 34.1
## Authorization Callsite Audit & Route Handler Hardening Report

**Audit Date:** 2026-10-24T19:50:00+05:30  
**Phase Status:** COMPLETE  
**Architecture:** Database-Backed Asynchronous Authorization Boundary  
**Repository State:** `main` branch, Next.js 16.4.3 (Turbopack), TypeScript 5.x  

---

### 1. Architectural Scope & Purpose

Prior to Phase 34.1, the application maintained two distinct families of authorization helpers:
1. **Synchronous Helpers (`hasActiveGrantSync`, `canAccessDepartment`, `canAccessCase`, `canAccessEvidence`):**  
   Evaluated in-memory cache arrays and checked timestamps against local files (`data/access_grants.json`). While fast, these functions could grant access based on stale cache data if another worker had revoked a grant in the relational database.
2. **Asynchronous Database Helpers (`hasActiveGrantAsync`, `canAccessDepartmentAsync`, `canAccessCaseAsync`, `canAccessEvidenceAsync`):**  
   Introduced in Phase 34 to directly query the database for fresh account status and active access grants.

The objective of Workstream A in Phase 34.1 was to audit every authorization call site in the application and ensure that **no security-critical API route handler relies on synchronous in-memory caches**, refactoring them to use the database-backed asynchronous authorization pipeline.

---

### 2. Comprehensive Callsite Inventory & Status Matrix

| Module / Route Handler | HTTP Method | Target Entity | Authorization Check Performed | Authorization Function Used | Relies on Stale Cache? | Uses Authoritative DB? | Fail-Closed Verified? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app/api/cases/[caseId]/route.ts` | `GET` | Case Record | Read case details & metadata | `canAccessCaseAsync(officer, caseRecord, "read:content")` | **NO** | **YES** | **YES** |
| `app/api/cases/[caseId]/route.ts` | `PATCH` | Case Record | Modify case investigative fields | `canAccessCaseAsync(officer, caseRecord, "write")` | **NO** | **YES** | **YES** |
| `app/api/evidence/[id]/download/route.ts` | `GET` | Evidence Binary | Download raw binary exhibit from cold storage | `canAccessEvidenceAsync(officer, evidence, "read:binary")` | **NO** | **YES** | **YES** |
| `app/api/cases/[caseId]/evidence/route.ts` | `GET` | Case Evidence List | Enumerate exhibits linked to case | `canAccessDepartmentAsync(officer, caseItem.jurisdiction, caseItem.departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/cases/route.ts` | `POST` | New Case Creation | Create case in officer's jurisdiction | `canAccessDepartmentAsync(officer, jurisdiction, departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/reports/[id]/route.ts` | `GET` | Generated Report | Inspect forensic report findings | `canAccessDepartmentAsync(officer, report.jurisdiction, report.departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/reports/[id]/route.ts` | `PATCH` | Generated Report | Update report conclusions | `canAccessDepartmentAsync(officer, report.jurisdiction, report.departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/reports/[id]/download/route.ts` | `GET` | Report Export | Download finalized report binary | `canAccessDepartmentAsync(officer, report.jurisdiction, report.departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/reports/route.ts` | `GET` | Reports Catalog | Filter catalog to accessible departmental reports | `canAccessDepartmentAsync(officer, r.jurisdiction, r.departmentId, ...)` | **NO** | **YES** | **YES** |
| `app/api/access-grants/route.ts` | `POST` | AccessGrant Record | Provision new cross-department grant | Enforces SYS_ADMIN or DEPT_ADMIN role check, then persists directly via `prisma.accessGrant.create()` | **NO** | **YES** | **YES** |
| `app/api/access-grants/[id]/revoke/route.ts` | `POST` | AccessGrant Record | Terminate existing access grant | Validates revoker permissions, executes `prisma.accessGrant.update()`, and logs audit trail | **NO** | **YES** | **YES** |
| `app/api/auth/login/route.ts` | `POST` | Officer Session | Authenticate credentials & issue token | Verifies password hash in DB, confirms `status = 'ACTIVE'`, issues unrevoked `OfficerSession` | **NO** | **YES** | **YES** |
| `app/api/auth/me/route.ts` | `GET` | Officer Profile | Return active session details | Queries DB session, confirms unrevoked & unexpired, returns live officer data | **NO** | **YES** | **YES** |
| `app/api/officers/route.ts` | `POST` | Officer Account | Provision new officer profile | Enforces administrative role check and unique badge/email database constraints | **NO** | **YES** | **YES** |
| `app/api/officers/[id]/route.ts` | `PATCH` | Officer Account | Modify role, department, or status | Enforces administrative boundary; role/department change revokes existing sessions | **NO** | **YES** | **YES** |
| `app/api/audit/route.ts` | `GET` | Audit Log History | Inspect security audit events | Enforces `audit:read` permission; returns immutable database audit entries | **NO** | **YES** | **YES** |

---

### 3. Separation of Asynchronous and Synchronous Authorization Paths

To preserve legacy test scripts, backward-compatible unit tests, and lightweight UI helper utilities, synchronous functions have been cleanly separated from security boundaries:

1. **Deprecated / Synthetic-Only Synchronous Utilities:**
   - `hasActiveGrantSync()`
   - `canAccessDepartment()`
   - `canAccessCase()`
   - `canAccessEvidence()`
   *Usage Policy:* These synchronous functions operate solely on in-memory arrays and local fixtures. They are explicitly **prohibited** from being used in server-side HTTP route handlers. All HTTP route handlers must use their asynchronous counterparts.

2. **Authoritative Asynchronous Boundaries:**
   - `hasActiveGrantAsync()`
   - `canAccessDepartmentAsync()`
   - `canAccessCaseAsync()`
   - `canAccessEvidenceAsync()`
   *Usage Policy:* Mandatory across all Next.js API endpoints (`app/api/**`). Each function re-queries the database for the active officer's status, department assignment, and valid grants. If the database cannot be queried, the function fails closed and denies access.

---

### 4. Verification and Audit Sign-Off

- **0** API route handlers remain on legacy synchronous grant checks.
- **100%** of sensitive routes (`cases`, `evidence`, `reports`, `access-grants`) now execute asynchronous database validation.
- All 19 Phase 34.1 adversarial and multi-client parity tests passed.
- Full Next.js production build (`npm run build`) succeeded with zero TypeScript or routing errors.
