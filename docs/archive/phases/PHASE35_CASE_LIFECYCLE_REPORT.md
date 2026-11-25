# RAKSHAK v3.0 — PHASE 35
# Case Lifecycle & Investigation Workflow Engineering Report

**Status:** COMPLETE  
**Phase:** 35 — Case Lifecycle, Officer Assignment & Investigation Workflow  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  

---

## 1. Executive Summary

Phase 35 implements an end-to-end operational case-management workflow on top of the Rakshak v3.0 platform without compromising existing architectural baselines, department boundaries, or evidentiary immutability. 

The implementation delivers:
1. **Deterministic State Machine:** Formalized state transition rules (`OPEN` $\rightarrow$ `UNDER_INQUIRY` $\rightarrow$ `CHARGESHEETED` / `CLOSED`, `CLOSED` $\rightarrow$ `UNDER_INQUIRY`) with role-based transition validation, required justifications, supervisor approval enforcement, and optimistic concurrency locking.
2. **Traceable Relational Lifecycle Tracking:** Introduction of `CaseStatusHistory` tracking all transitions, actor identity, supervisory badges, timestamp, and justification reason.
3. **Multi-Tenant REST APIs:** Production-ready endpoints for case creation, listing, detail retrieval, and state transitions with server-side identity resolution and tenant verification.
4. **Rich Neumorphic UI Controls:** Dynamic transition actions, supervisor badge verification dialogs, and visual lifecycle progression timelines embedded into the existing case details interface.
5. **Zero Evidence Mutation:** 100% preservation of cold evidence binaries in `uploads/raw/` (560 files, SHA-256 manifest verified).

---

## 2. Workstream A — Case Lifecycle State Machine

### 2.1 State Transition Matrix

The case lifecycle adheres to the following transition graph:

| Current State | Permitted Next States | Minimum Authorized Roles | Supervisor Approval Required | Mandatory Justification Reason |
| :--- | :--- | :--- | :---: | :---: |
| `OPEN` | `UNDER_INQUIRY` | `INVESTIGATOR`, `SUPERVISOR`, `DEPT_ADMIN`, `SYS_ADMIN` | No | Recommended |
| `UNDER_INQUIRY` | `CHARGESHEETED` | `SUPERVISOR`, `DEPT_ADMIN`, `SYS_ADMIN` | Yes | Yes (Chargesheet filing details) |
| `UNDER_INQUIRY` | `CLOSED` | `SUPERVISOR`, `DEPT_ADMIN`, `SYS_ADMIN` | Yes | Yes (Investigation closure rationale) |
| `CHARGESHEETED` | `CLOSED` | `SUPERVISOR`, `DEPT_ADMIN`, `SYS_ADMIN` | Yes | Yes (Court disposal / final report) |
| `CLOSED` | `UNDER_INQUIRY` | `SUPERVISOR`, `DEPT_ADMIN`, `SYS_ADMIN` | Yes | Yes (New evidence / appellate order) |

Direct transition from `OPEN` to `CLOSED` or `CHARGESHEETED` is rejected with HTTP 400 (`Invalid case-state transition`). Investigators attempting closure or reopening without supervisor role/badge are rejected with HTTP 403 (`Supervisor authority required`).

### 2.2 Concurrency-Safe State Transitions

To prevent simultaneous requests from producing conflicting or stale states, transitions execute inside an atomic transaction using an optimistic lock check:
```typescript
const updated = await tx.case.updateMany({
  where: {
    id: caseId,
    status: expectedCurrentStatus, // Guards against race condition
  },
  data: {
    status: targetStatus,
    updatedAt: new Date(),
  },
});

if (updated.count === 0) {
  throw new Error("Concurrency Conflict: Case status changed concurrently");
}
```

Simultaneous competing transitions (e.g. one thread filing a chargesheet and another thread closing the inquiry) are safely arbitrated: exactly one succeeds and the other fails safely with HTTP 409 Conflict.

---

## 3. Workstream C — REST API Architecture

The following endpoints were built and integrated into the Next.js App Router:

### 3.1 `POST /api/cases`
- **Purpose:** Creates and registers a new investigation case.
- **Authentication:** Mandatory session token via `Authorization: Bearer <token>` or `auth_token` cookie.
- **Validation:** Enforces `caseNumber`, `incidentType`, `complainantName`, and `jurisdiction`.
- **Department Isolation:** Automatically scopes the case to the authenticated officer's department (or client-selected department for platform administrators).
- **Relational Seeding:** Atomically registers initial status record (`INITIAL` $\rightarrow$ `OPEN`) in `CaseStatusHistory` and primary officer assignment in `CaseAssignmentHistory`.
- **Audit:** Emits `CREATE_CASE` audit log with full actor attribution.

### 3.2 `GET /api/cases`
- **Purpose:** Lists cases scoped to the officer's department and permitted cross-department grants.
- **Filtering:** Filters by `status`, `incidentType`, and search query (`caseNumber`, `complainantName`).
- **Authorization:** Applies `canAccessDepartmentAsync` and database-backed `hasActiveGrantAsync`.

### 3.3 `GET /api/cases/[caseId]`
- **Purpose:** Retrieves full case dossier, active investigation team, and status/assignment histories.
- **Scope Check:** Verified via `canAccessCaseAsync`.

### 3.4 `POST /api/cases/[caseId]/transition`
- **Purpose:** Advances case through the lifecycle state machine.
- **Payload:**
  ```json
  {
    "fromStatus": "OPEN",
    "toStatus": "UNDER_INQUIRY",
    "reason": "Preliminary inquiries complete; notices issued to telecom operators.",
    "supervisorBadge": "DEL-SUP-01"
  }
  ```
- **Enforcement:** Enforces state transition matrix, supervisor approval badge match, active account status, and transaction safety.
- **Audit:** Emits `TRANSITION_CASE_STATUS` audit record.

---

## 4. Workstream D — Frontend Integration

The user interface was enhanced in `public/frontend/pages/cases.html`, `public/frontend/js/cases.js`, and `public/frontend/css/cases-neumorphic.css`:

1. **Case Lifecycle Card:** Displays current stage badge with distinct neumorphic styling, allowed transition buttons, and a timeline of prior state modifications.
2. **Transition Modal (`#transition-case-modal`):**
   - Contextual form dynamically populated with valid destination states.
   - Conditional supervisor badge verification input for privileged transitions (`CLOSED`, `CHARGESHEETED`, or reopening).
   - Mandatory reason/justification textarea.
3. **Investigation Team Card:** Lists active primary investigator, assigned collaborators, and action buttons for reassignment and revocation.
4. **History Audit Modal (`#history-case-modal`):** Chronological visual timeline displaying status shifts, supervisor approvers, assignment transfers, and actor badges.

---

## 5. Non-Destructive Migrations & Schema Parity

Both SQLite and PostgreSQL schemas were upgraded in lockstep:

### Schema Additions:
```prisma
model CaseStatusHistory {
  id            String    @id @default(uuid())
  caseId        String
  case          Case      @relation(fields: [caseId], references: [id], onDelete: Cascade)
  fromStatus    String
  toStatus      String
  changedById   String
  changedByName String
  changedByBadge String?
  departmentId  String
  reason        String
  approvedBy    String?
  changedAt     DateTime  @default(now())

  @@index([caseId])
  @@index([departmentId])
}
```

### Execution Path:
- **Prisma Client Generation:** Generated cleanly for `@prisma/client` (SQLite) and `@prisma/client-pg` (PostgreSQL) with exit code 0.
- **SQLite Dev DB (`prisma/dev.db`):** Applied via `scripts/apply_phase35_migration.mjs` using `CREATE TABLE IF NOT EXISTS` and index creation. All 19 pre-existing cases and historical data preserved intact.
- **PostgreSQL (`rakshak_phase35_test`):** Applied `prisma/migrations_pg/20261024_case_lifecycle.sql` enabling full `ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.

---

## 6. Verification & Automated Test Results

The dedicated suite `scripts/test_phase35_case_lifecycle.mjs` validated the state machine across multiple scenarios:
- **Scenario 11:** Invalid state transition (`OPEN` $\rightarrow$ `CLOSED`) rejected with HTTP 400.
- **Scenario 12:** Authorized transition (`OPEN` $\rightarrow$ `UNDER_INQUIRY`) successfully committed.
- **Scenario 13:** Unauthorized closure by non-supervisor investigator rejected with HTTP 403.
- **Scenario 14:** Unauthorized reopening of closed case by investigator rejected with HTTP 403.
- **Scenario 15:** Authorized reopening with supervisor badge approval recorded in history.
- **Scenario 22:** Concurrent competing transitions arbitrated safely by database optimistic locking without silent overwrites.

---

## 7. Operational Constraints & Boundaries

- **Zero Live Ingestion:** No live external police APIs or production feeds connected.
- **Evidentiary Immutability:** Case status updates strictly forbidden from modifying evidence binaries, hashes, or chain-of-custody logs.
- **Synthetic Data Exclusively:** All test fixtures utilize synthetic names and badges (`CASE/DEL/2026/...`, `DEL-01`, `CHD-01`).
