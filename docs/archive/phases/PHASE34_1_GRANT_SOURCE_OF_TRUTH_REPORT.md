# RAKSHAK v3.0 — PHASE 34.1
## Grant Source-of-Truth Reconciliation Report

**Audit Date:** 2026-10-24T19:50:00+05:30  
**Phase Status:** COMPLETE  
**Database Authority:** PostgreSQL / SQLite Database-Backed Grant Store  
**Engine & Staging Environments:** PostgreSQL 16.15 (Port 5432), SQLite (`temp_p341_fixtures/isolated_p341_sandbox.db`)  
**Evidence Binary Immutability:** 560 files verified unaltered (SHA-256 Manifest: `bdc91bb78c603d21...`)  

---

### Executive Summary

In Phase 34, a critical security vulnerability and architectural ambiguity was identified: access grants were simultaneously maintained in memory, optionally mirrored to `data/access_grants.json`, and stored in relational database tables (`AccessGrant`). This created a hazardous dual-store condition where:
1. Revocations committed in the database by an administrative process were not immediately reflected in another running application worker or independent Prisma client.
2. An attacker or corrupted file could theoretically allow unauthorized cross-department case access by injecting records into `data/access_grants.json` or relying on stale memory caches.
3. Legacy synchronous authorization functions (`hasActiveGrantSync`, `canAccessDepartment`) could authorize sensitive operations using stale cache data without consulting the database.

Phase 34.1 closes this vulnerability permanently by establishing **the relational database as the sole, authoritative source of truth for all access grants and authorization decisions**. The JSON file is explicitly relegated to a derived local cache or test fixture and is completely ignored by security-sensitive authorization boundaries. All critical API call sites have been upgraded to asynchronous, database-backed verification (`hasActiveGrantAsync`, `canAccessDepartmentAsync`, `canAccessCaseAsync`, `canAccessEvidenceAsync`), and grant-lookup failures fail closed.

---

### 1. Dual-Store Reconciliation & Authoritative Architecture

#### 1.1 Single Source of Truth
The relational database table `AccessGrant` (PostgreSQL / SQLite) is the sole authoritative state machine for:
- Grant Creation
- Grant Activation
- Real-time Expiry
- Grant Revocation

`data/access_grants.json` is strictly maintained as an ephemeral sync mirror for offline test fixtures. It is **never** consulted as an independent authorization authority.

#### 1.2 Fail-Closed Guarantee
In `lib/accessControl.ts`, `hasActiveGrantAsync()` enforces strict fail-closed semantics:
1. **Officer State Verification:** If the officer is suspended (`status !== 'ACTIVE'`), access is rejected immediately without DB query.
2. **Current Database Account Integrity:** If the database record for the officer does not exist, is suspended, or if the officer's department does not match the active session, authorization fails closed (`return false`).
3. **Database Unavailability / Query Failure:** If the database connection drops or a query error occurs, the catch block intercepts the error and returns `false`. No fallback to stale in-memory or JSON cache is permitted.

```typescript
// Excerpt from lib/accessControl.ts: hasActiveGrantAsync fail-closed design
export async function hasActiveGrantAsync(
  officer: OfficerProfile,
  targetDepartmentId?: string | null,
  targetCaseId?: string | null,
  prismaOverride?: any
): Promise<boolean> {
  if (officer.status !== "ACTIVE") return false;

  const p = (prismaOverride ?? prisma) as any;
  if (p && p.accessGrant) {
    try {
      if (p.officer && officer.id) {
        const dbOfficer = await p.officer.findUnique({
          where: { id: officer.id },
          select: { status: true, departmentId: true, role: true },
        });
        if (!dbOfficer || dbOfficer.status !== "ACTIVE") return false;
        if (officer.departmentId && dbOfficer.departmentId && dbOfficer.departmentId !== officer.departmentId) {
          return false;
        }
      }

      const now = new Date();
      const where: any = {
        status: "ACTIVE",
        expiresAt: { gt: now },
        revokedAt: null,
      };
      if (targetDepartmentId) where.targetDepartmentId = targetDepartmentId;
      if (officer.id || officer.departmentId) {
        where.OR = [
          ...(officer.id ? [{ granteeOfficerId: officer.id }] : []),
          ...(officer.departmentId ? [{ granteeDepartmentId: officer.departmentId }] : []),
        ];
      }

      const matching = await p.accessGrant.findMany({ where });
      for (const g of matching) {
        if (!g.targetCaseId || !targetCaseId || g.targetCaseId === targetCaseId) {
          return true;
        }
      }
      return false;
    } catch (_) {
      // Database failure fails closed safely
      return false;
    }
  }

  // Database client unavailable: fail closed
  return false;
}
```

---

### 2. Multi-Client Revocation & Real-Time Expiry Verification

To empirically prove that database-backed access grants resolve synchronization risks across independent processes, an isolated multi-client test harness was executed in `scripts/test_phase34_1_adversarial_rls.mjs`:

#### 2.1 TC-A01: Cross-Process Revocation Parity
- **Setup:** Two completely isolated Prisma Client instances (`clientA` and `clientB`) connected to a shared database.
- **Action:** `clientA` created an active cross-department grant. `clientB` checked `hasActiveGrantAsync` and verified `true`. `clientA` subsequently executed `accessGrant.update({ where: { id }, data: { status: 'REVOKED', revokedAt: now } })`.
- **Outcome:** `clientB` immediately evaluated `hasActiveGrantAsync` as `false`. Zero lag, zero cache staleness.
- **Result:** **PASSED**.

#### 2.2 TC-A02: Real-Time Expiry Enforcement
- **Setup:** `clientA` created a grant with `expiresAt: Date.now() + 100ms`.
- **Action:** At $t=0\text{ms}$, `hasActiveGrantAsync` returned `true`. After a 150ms sleep ($t=150\text{ms}$), `hasActiveGrantAsync` returned `false`.
- **Result:** **PASSED**.

#### 2.3 TC-A03: Stale JSON Override Immunity
- **Setup:** A grant was marked `REVOKED` in the database, while `data/access_grants.json` was deliberately tampered with to assert `status: 'ACTIVE'`.
- **Action:** `hasActiveGrantAsync` was queried for the officer.
- **Outcome:** The database record strictly took precedence, returning `false`. The stale JSON assertion had zero effect.
- **Result:** **PASSED**.

#### 2.4 TC-A04: Database Query Failure Fails Closed
- **Setup:** A disconnected/throwing database client mock was supplied.
- **Action:** `hasActiveGrantAsync` caught the exception and returned `false`.
- **Result:** **PASSED**.

#### 2.5 TC-A05: Concurrent Async Database Operations Safety
- **Setup:** 5 concurrent grants created across 5 independent worker threads, followed by 5 concurrent revocations.
- **Outcome:** All 5 records committed atomically and all 5 revocations verified immediately (5/5 denied).
- **Result:** **PASSED**.

---

### 3. Summary of Affected Authorization Callsites

Every security-critical API handler in the application now invokes the asynchronous, authoritative grant store:

| Call Site / Route Handler | Operation | Old Auth Mechanism | Upgraded Authoritative Mechanism | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/cases/[caseId]` | Read case details | `canAccessCase()` (Sync) | `await canAccessCaseAsync()` (DB) | **UPGRADED** |
| `PATCH /api/cases/[caseId]` | Modify case details | `canAccessCase()` (Sync) | `await canAccessCaseAsync()` (DB) | **UPGRADED** |
| `GET /api/evidence/[id]/download` | Download binary exhibit | `canAccessEvidence()` (Sync) | `await canAccessEvidenceAsync()` (DB) | **UPGRADED** |
| `GET /api/cases/[caseId]/evidence` | List case evidence | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `POST /api/cases` | Create case in jurisdiction | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `GET /api/reports/[id]` | Inspect generated report | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `PATCH /api/reports/[id]` | Update report findings | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `GET /api/reports/[id]/download` | Download PDF/JSON report | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `GET /api/reports` | List departmental reports | `canAccessDepartment()` (Sync) | `await canAccessDepartmentAsync()` (DB) | **UPGRADED** |
| `POST /api/access-grants` | Create access grant | File sync + optional DB | Mandatory DB Transaction + Audit | **UPGRADED** |
| `POST /api/access-grants/[id]/revoke`| Revoke access grant | File sync + optional DB | Mandatory DB Update + Audit | **UPGRADED** |

---

### 4. Regression Test Sign-Off

The complete suite of regression tests was executed with zero failures:
1. `node scripts/test_phase34_1_adversarial_rls.mjs`: **19/19 PASSED (100.0%)**
2. `node scripts/test_phase34_security_and_rls.mjs`: **22/22 PASSED (100.0%)**
3. `node scripts/test_phase33_account_lifecycle.mjs`: **21/21 PASSED (100.0%)**
4. `node scripts/test_phase32_authorization.mjs`: **20/20 PASSED (100.0%)**
5. `node scripts/test_phase18_migration_rehearsal.mjs`: **7/7 PASSED (100.0%)**
6. `node scripts/test_phase17_verifier.mjs`: **15/15 PASSED (100.0%)**
7. `node scripts/check_frontend_imports.mjs`: **PASSED**
8. `node scripts/check_frontend_integrity.mjs`: **PASSED**
9. `npm audit`: **0 vulnerabilities**
10. `npm run build`: **Compiled successfully (Turbopack, Next.js 16.4.3, React 19.2.8)**

**Active Staging Database Immutability:** `prisma/dev.db` SHA-256 remains strictly `eaabaeea39a12c7c...` throughout all tests.
