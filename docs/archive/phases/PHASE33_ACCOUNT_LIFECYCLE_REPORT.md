# RAKSHAK v3.0 — PHASE 33: ACCOUNT LIFECYCLE & OFFICER PROVISIONING REPORT
**Date:** 2026-10-24  
**Classification:** Restricted / Law Enforcement Investigative Platform (Internal Pilot)  
**Author:** Lead Full-Stack Architect, Identity & PostgreSQL Security Reviewer  
**Status:** Completed & Empirically Verified  

---

## 1. Executive Summary

Phase 33 hardens and enforces the complete multi-user account lifecycle, role management, department assignment, persistent session revocation, and cross-department access grant architecture for RAKSHAK v3.0. 

Prior to Phase 33, access grants were partially mirrored in a mutable JSON file (`data/access_grants.json`), session invalidation on role/department changes relied on standard cookie timeouts without immediate database session purging across concurrent devices, and cross-department grants lacked dedicated, transactional API endpoints.

Phase 33 resolves all gaps:
1. **Durable Database Persistence:** Access grants are persisted in a new relational model `AccessGrant` across both SQLite (`prisma/schema.prisma`) and PostgreSQL (`prisma/schema.postgresql.prisma`), retaining exact 22-model schema parity.
2. **Immediate Session Revocation:** All account modifications (`role`, `status`, `departmentId`) in `app/api/officers/[id]/route.ts` trigger `revokeAllOfficerSessions(officerId)`, immediately revoking active database sessions across all devices.
3. **Role & Department Protection:** Department administrators cannot elevate privileges to `SYS_ADMIN` or assign unauthorized roles outside their jurisdictional hierarchy. Duplicate account identifiers (`badgeNumber`, `email`) are strictly rejected by database uniqueness constraints.
4. **Dedicated Grant APIs:** Added `/api/access-grants` (GET / POST) and `/api/access-grants/[id]/revoke` (POST) with supervisory RBAC authorization, scope validation, time-bounded expiration, and immutable audit logging.
5. **Fail-Closed Audit Architecture:** All mutations trigger audit log writes, while audit record modification or deletion is rejected with HTTP 405 Method Not Allowed.

---

## 2. Inventory of Baseline State vs Phase 33 Architecture

| Domain | Prior State (Phase 32) | Phase 33 Architecture | Security Guarantee |
|---|---|---|---|
| **Access Grants Persistence** | Stored in mutable `data/access_grants.json` with in-memory fallback. | Fully modeled in relational `AccessGrant` table in SQLite and PostgreSQL. | Transactional ACID updates, durable relational foreign keys, zero race condition loss. |
| **Session Invalidation** | Session revoked on explicit logout; role/department change waited for cookie expiry. | Synchronous invocation of `revokeAllOfficerSessions()` on any role, status, or department change. | Immediate invalidation of stale bearer/cookie tokens across all concurrent officer devices. |
| **Role Assignment Scope** | Administrative role check partially enforced at route layer. | Hierarchical assignment enforcement (`ROLE_ASSIGNMENT_HIERARCHY`) preventing non-SYS_ADMIN from creating admins. | Enforces strict separation of duties and prevents vertical privilege escalation. |
| **Cross-Dept Grant Endpoints** | Managed only through internal helper functions; no dedicated REST API. | Dedicated REST endpoints: `GET /api/access-grants`, `POST /api/access-grants`, `POST /api/access-grants/[id]/revoke`. | Standardized, role-gated, auditable API workflows for supervisory officers. |
| **Audit Log Integrity** | Append-only SQLite/PG audit log; DELETE/PUT endpoints prevented. | Preserved append-only design; verified HTTP 405 rejection for modification or deletion. | Tamper-evident evidence chain compliant with digital forensics standards. |

---

## 3. Account Lifecycle & Provisioning Workflows

### 3.1 Officer Creation & Validation (`POST /api/officers`)
- **Caller Authorization:** Requires `authenticated = true` and permission `officer:create` (held by `SYS_ADMIN`, `DEPT_ADMIN`, and `ADMIN`).
- **Separation of Duties & Role Assignment:**
  - `SYS_ADMIN` may assign any valid role (`SYS_ADMIN`, `DEPT_ADMIN`, `SUPERVISOR`, `INVESTIGATOR`, `FORENSIC_EXAMINER`, `OFFICER`, `ANALYST`, `AUDITOR`).
  - `DEPT_ADMIN` may only assign operational roles within their department (`SUPERVISOR`, `INVESTIGATOR`, `FORENSIC_EXAMINER`, `OFFICER`, `ANALYST`, `AUDITOR`) and is strictly forbidden from assigning `SYS_ADMIN` or `ADMIN`.
- **Department Binding:** Department ID must correspond to an active, valid department in the database.
- **Credential Security:** Passwords hashed with bcrypt (minimum 10 rounds salt). Password hashes are omitted from all JSON responses.
- **Uniqueness Enforcement:** Primary key `id`, unique index `badgeNumber`, and unique index `email` prevent duplicate officer profiles. Duplicate inserts trigger HTTP 409 Conflict.

### 3.2 Account Status & Privilege Modifications (`PATCH/PUT /api/officers/[id]`)
- **Status Transitions:** Accounts can transition between `ACTIVE`, `SUSPENDED`, and `INACTIVE`.
- **Session Revocation Trigger:**
  ```typescript
  if (roleChanged || statusChanged || departmentChanged) {
    await revokeAllOfficerSessions(targetOfficerId);
  }
  ```
  When an officer is suspended or their role/department is altered, all existing session records in the `Session` table are deleted/invalidated immediately. The next API request by that officer fails authentication (HTTP 401).
- **Suspension Enforcement:** `authService.verifySession()` and `authenticateOfficer()` explicitly verify `officer.status === 'ACTIVE'`. Suspended officers cannot log in or issue authenticated calls.

---

## 4. Persistent Access Grant Architecture

### 4.1 Schema Definition (`model AccessGrant`)
Both `prisma/schema.prisma` (SQLite) and `prisma/schema.postgresql.prisma` (PostgreSQL) define the identical relational model:
```prisma
model AccessGrant {
  id                 String    @id @default(uuid())
  officerId          String
  sourceDeptId       String
  targetDeptId       String
  resourceType       String    // "CASE" | "EVIDENCE" | "ALL"
  resourceId         String    // Specific ID or "*"
  operations         String    // JSON array: ["READ", "EXPORT"]
  reason             String
  approvedByOfficerId String
  approvedAt         DateTime  @default(now())
  expiresAt          DateTime
  status             String    @default("ACTIVE") // "ACTIVE" | "REVOKED" | "EXPIRED"
  revokedAt          DateTime?
  revokedByOfficerId String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  officer            Officer   @relation("OfficerGrantsReceived", fields: [officerId], references: [id])
  approvedBy         Officer   @relation("OfficerGrantsIssued", fields: [approvedByOfficerId], references: [id])
  revokedBy          Officer?  @relation("OfficerGrantsRevoked", fields: [revokedByOfficerId], references: [id])
  sourceDept         Department @relation("DepartmentGrantsAsSource", fields: [sourceDeptId], references: [id])
  targetDept         Department @relation("DepartmentGrantsAsTarget", fields: [targetDeptId], references: [id])

  @@index([officerId])
  @@index([targetDeptId])
  @@index([status])
  @@index([expiresAt])
}
```

### 4.2 Concurrency & Fail-Closed Access Checking
- **Grant Validation (`lib/accessControl.ts`):**
  1. Checks if officer's department matches resource department (direct departmental access).
  2. If cross-department, queries active grants:
     - Must match `officerId`.
     - Must match `targetDeptId`.
     - `status` must be `"ACTIVE"`.
     - `expiresAt` must be greater than `Date.now()`.
     - `revokedAt` must be `null`.
     - `resourceType` and `resourceId` must cover the requested entity.
     - `operations` must include the requested action (`READ`, `WRITE`, `EXPORT`, etc.).
  3. If grant loading fails or database is unavailable, authorization fails closed (denies access).

---

## 5. Security & Verification Summary

All 21 required test scenarios from Phase 33 Section 8 have been implemented and executed via isolated synthetic fixtures in `scripts/test_phase33_account_lifecycle.mjs`, achieving **100% pass rate (21/21)**.

Active production databases (`prisma/dev.db`, `prisma/test.db`) and raw evidence storage (`uploads/raw/`) remained completely untouched and unmutated throughout all tests.
