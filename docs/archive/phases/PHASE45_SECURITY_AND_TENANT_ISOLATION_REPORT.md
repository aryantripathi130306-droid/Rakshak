# RAKSHAK v3.0 — PHASE 45
## Security Architecture, Tenant Isolation & Access Grant Verification Report

**Target Scope:** Department Boundaries, Inter-Agency Grants, Row-Level Security (RLS), and Cryptographic Chain-of-Custody  
**Target Database:** `rakshak_phase45_test` (PostgreSQL 17.6)  
**Security Baseline:** 31 Application Tables, 20 Tables with RLS & FORCE RLS Enabled, 21 Active Security Policies  
**Evaluator:** Rakshak Authoritative Integration Test Harness  

---

### 1. Executive Summary

Phase 45 verified that Rakshak's multi-department security architecture prevents unauthorized data leakage between law enforcement jurisdictions. The verification subjected the application to cross-tenant access attempts, adversarial direct-database queries, unauthorized role elevations, and access-grant revocation workflows.

All tests confirm that department tenant boundaries remain strictly enforced at both the application API layer and the PostgreSQL database engine layer. A foreign officer cannot read or mutate another department's cases, exhibits, or dossiers without an active, approved, unexpired, and unrevoked `AccessGrant`.

---

### 2. Cross-Department Tenant Isolation Test Matrix

The following test matrix details the empirical behavior observed between synthetic officers assigned to Delhi Police (`p45-dept-del`) and Mumbai Police (`p45-dept-mum`):

| Test Scenario ID | Actor Badge & Department | Target Resource | Authorization Context | Expected HTTP Status | Actual HTTP Status | Database Audit Verification |
|---|---|---|---|---|---|---|
| `P45-TEN-01` | `MH-INV-45` (`p45-dept-mum`) | Delhi Case `CASE-2026-9007` | No active access grant | HTTP 403 / 404 | HTTP 403 | RLS policy `case_tenant_isolation` blocks row retrieval; application returns 403. |
| `P45-TEN-02` | `MH-INV-45` (`p45-dept-mum`) | Evidence Upload on Delhi Case | No active access grant | HTTP 403 | HTTP 403 | `canAccessCase(..., "write:evidence")` evaluates to false; upload rejected prior to storage. |
| `P45-TEN-03` | `DL-SUP-45` (`p45-dept-del`) | Grant delegation for `MH-INV-45` | Supervisor authority | HTTP 201 | HTTP 201 | Row created in `AccessGrant` with `status: "ACTIVE"`, `scope: "CASE_READ"`, and 24h expiration. |
| `P45-TEN-04` | `MH-INV-45` (`p45-dept-mum`) | Delhi Case `CASE-2026-9007` | Active, approved grant present | HTTP 200 | HTTP 200 | Case details successfully retrieved; read audited in `AuditLog` table. |
| `P45-TEN-05` | `DL-SUP-45` (`p45-dept-del`) | Revoke grant (`grantId`) | Supervisor authority | HTTP 200 | HTTP 200 | `AccessGrant.revokedAt` set to `NOW()`; status transitioned to `REVOKED`. |
| `P45-TEN-05-Post` | `MH-INV-45` (`p45-dept-mum`) | Delhi Case `CASE-2026-9007` | Revoked grant | HTTP 403 / 404 | HTTP 403 | Access immediately blocked; zero latency in revocation enforcement. |

---

### 3. PostgreSQL Direct Database RLS & Security Baseline

The database engine enforces Row-Level Security independently of application logic. Even if an attacker were to bypass application-level checks, PostgreSQL session context prevents cross-tenant leakage.

```
                          POSTGRESQL RLS ENFORCEMENT ENGINE
                                  (rakshak_app_role)
                                          │
                                          ▼
                         SET LOCAL app.current_officer_id = '...'
                         SET LOCAL app.current_department_id = '...'
                                          │
               ┌──────────────────────────┴──────────────────────────┐
               ▼                                                     ▼
     Direct Table Selects                                  Cross-Tenant Infiltration
   WHERE departmentId = 'p45-dept-del'                   WHERE departmentId = 'p45-dept-mum'
               │                                                     │
               ▼                                                     ▼
        [ROWS RETURNED]                                       [0 ROWS RETURNED]
     (Authorized Tenancy)                                  (Blocked by Tenant Policy)
```

The authoritative catalog audit confirmed the following database security invariants:
1. **Catalog Completeness:** 31 application tables defined and verified.
2. **RLS Coverage:** 20 sensitive tables have `rowsecurity = true`.
3. **FORCE RLS Constraints:** 20 sensitive tables have `relforcerowsecurity = true` in `pg_class`, ensuring table owners cannot bypass policies.
4. **Authoritative Policies:** 21 row-level policies active in `pg_policy`.
5. **No Superuser Bypass:** Application connections run as `rakshak_app_role`, which possesses no `BYPASSRLS` or superuser privileges.

---

### 4. Cryptographic Chain-of-Custody & Evidence Immutability

Evidence handling was verified against tampering, collision, and out-of-order manipulation:

1. **Client-Side SHA-256 Verification:**
   - Every exhibit upload requires a client-side calculated hash (`clientHash`).
   - The server independently computes the SHA-256 digest of the received byte stream.
   - Any difference immediately raises `HashMismatchError` (HTTP 422) and deletes the temporary file.
2. **Sequential Hash Chaining:**
   - Every `CustodyEvent` includes a `prevEventHash` pointing to the previous event's hash, forming a cryptographic merkle-like chain anchored at the genesis upload event.
   - Verification via `POST /api/evidence/[id]/verify` recalculates the entire chain from genesis to the latest leaf and compares disk content against the initial genesis hash.
3. **Sequence Uniqueness Constraint:**
   - PostgreSQL enforces a unique composite index `CustodyEvent_evidence_seq_unique_idx` on `(evidenceId, sequenceNumber)`.
   - Direct SQL attempts to inject duplicate sequence numbers fail with duplicate key violation errors (`P45-EVI-05`).

---

### 5. Identified Weaknesses & Applied Remediations

During Phase 45 integration analysis, two architectural weaknesses were identified and permanently remediated:

| Vulnerability / Weakness | Impact Description | Permanent Remediation Applied |
|---|---|---|
| **Independent Prisma Client in `accessControl.ts`** | `lib/accessControl.ts` previously instantiated a standalone `new PrismaClient()` from `@prisma/client`, which defaulted to SQLite (`prisma/dev.db`) instead of the active PostgreSQL database URL when resolving `AccessGrant` records in hybrid configurations. | Replaced standalone instantiation with `import prisma from "./prisma.ts";`, ensuring that all cross-department access grant lookups route through the unified client pointing to the active PostgreSQL database. |
| **Hardcoded Storage Root in Text Route** | `app/api/evidence/[id]/text/route.ts` previously had a fallback pointing directly to `uploads/raw/`, risking accidental reads from protected exhibits during synthetic testing. | Updated the file path resolver to prioritize `process.env.EVIDENCE_STORAGE_PATH`, safely routing all synthetic text reads to `uploads/synthetic_test_p45/`. |

---

### 6. Security & Tenancy Verification Conclusion

Rakshak's security architecture enforces defense-in-depth across the API, application service, and PostgreSQL storage layers. Tenant isolation, RBAC role gating, custody immutability, and access-grant revocation operate correctly and safely under synthetic integration workloads.
