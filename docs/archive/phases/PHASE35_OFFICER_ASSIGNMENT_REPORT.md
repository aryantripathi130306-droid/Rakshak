# RAKSHAK v3.0 — PHASE 35
# Officer Assignment & Investigation Team Management Report

**Status:** COMPLETE  
**Phase:** 35 — Case Lifecycle, Officer Assignment & Investigation Workflow  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  

---

## 1. Executive Summary

Workstream B of Phase 35 establishes a robust, auditable officer assignment subsystem. Cases are no longer bound by static single-string columns alone; instead, investigation ownership is governed by the relational `CaseAssignmentHistory` model, enabling primary investigator reallocation, multi-officer collaboration, departmental boundary enforcement, cross-department access grant verification, and complete historical auditability.

Key achievements:
1. **Relational Assignment Model:** Tracks `PRIMARY` and `COLLABORATOR` roles, assignment lifecycles (`ACTIVE`, `REPLACED`, `REVOKED`), timestamps, assigner identity, and rationale.
2. **Strict Server-Side Validation:** Target officers must exist, have status `ACTIVE` (never `SUSPENDED` or `INACTIVE`), possess suitable roles (`INVESTIGATOR` or `SUPERVISOR`), and belong to the case's department unless authorized by a persistent database-backed access grant.
3. **Primary Reassignment Archiving:** Assigning a new primary investigator automatically transitions the prior primary record to `REPLACED` with an `endedAt` timestamp in an atomic database transaction.
4. **Collaborator Revocation:** Collaborators can be explicitly revoked by authorized supervisors or administrators, transitioning to `REVOKED` without destroying historical records.
5. **Department Transfer Protection:** Officers transferring departments immediately lose access to their prior department's cases unless a valid grant exists, ensuring no stale assignment privilege leakage.

---

## 2. Workstream B — Assignment Model & Business Logic

### 2.1 Prisma Relational Schema

```prisma
model CaseAssignmentHistory {
  id             String    @id @default(uuid())
  caseId         String
  case           Case      @relation(fields: [caseId], references: [id], onDelete: Cascade)
  officerId      String
  officerName    String
  officerBadge   String?
  departmentId   String
  assignedById   String
  assignedByName String
  assignmentType String    // "PRIMARY" | "COLLABORATOR"
  status         String    // "ACTIVE" | "REPLACED" | "REVOKED"
  reason         String?
  assignedAt     DateTime  @default(now())
  endedAt        DateTime?

  @@index([caseId])
  @@index([officerId])
  @@index([departmentId])
  @@index([status])
}
```

### 2.2 Officer Eligibility & Department Boundaries

Every assignment attempt undergoes server-side checks in `lib/caseAssignment.ts`:
1. **Assigner Authority:** The requesting officer must have the `"case:assign"` permission (`SUPERVISOR`, `DEPT_ADMIN`, or `SYS_ADMIN`). Investigators and Auditors cannot assign officers.
2. **Target Account Liveness:** If the target officer's account is `SUSPENDED` or `INACTIVE`, the assignment is rejected with HTTP 400.
3. **Role Suitability:** The target officer must have role `INVESTIGATOR` or `SUPERVISOR`. Administrative or viewer accounts cannot be assigned as case investigators.
4. **Department Boundary & Cross-Department Grants:**
   - If `targetOfficer.departmentId === case.departmentId`: Permitted within department.
   - If `targetOfficer.departmentId !== case.departmentId`: Strictly requires an active, database-backed `AccessGrant` targeting either the specific case (`scope: "CASE_READ"` or `"CASE_FULL"`) or the department (`scope: "DEPARTMENT_READ"`). If no active grant exists or if the grant is expired or revoked, assignment is rejected with HTTP 403 (`Cross-department assignment requires an active access grant`).

---

## 3. Workstream C — Assignment REST APIs

### 3.1 `GET /api/cases/[caseId]/assignment`
- **Purpose:** Retrieves the current investigation team and historical assignment records.
- **Response Structure:**
  ```json
  {
    "caseId": "case-del-1",
    "primary": {
      "id": "cah-01",
      "officerId": "off-del-inv-2",
      "officerName": "Sub-Inspector Priya Sharma",
      "officerBadge": "DEL-02",
      "assignedAt": "2026-10-24T18:30:00Z"
    },
    "collaborators": [
      {
        "id": "cah-02",
        "officerId": "off-del-inv-3",
        "officerName": "Inspector A. Verma",
        "officerBadge": "DEL-03",
        "assignedAt": "2026-10-24T18:45:00Z"
      }
    ],
    "history": [ ... ]
  }
  ```

### 3.2 `POST /api/cases/[caseId]/assignment`
- **Purpose:** Assigns or reassigns an officer.
- **Payload:**
  ```json
  {
    "officerId": "off-del-inv-2",
    "assignmentType": "PRIMARY", // or "COLLABORATOR"
    "reason": "Reassigned per administrative reallocation order AO-2026-88"
  }
  ```
- **Atomicity:** When assigning a new `PRIMARY`, all currently `ACTIVE` primary records for that case are marked `REPLACED` with `endedAt = new Date()`, and the `Case` table's `officerName` and `officerBadge` columns are synchronized inside the same transaction.

### 3.3 `DELETE /api/cases/[caseId]/assignment/[assignmentId]`
- **Purpose:** Revokes an active collaborator's assignment.
- **Enforcement:** Cannot revoke a `PRIMARY` assignment directly (primary must be replaced via reassignment). Marks the collaborator record `REVOKED` and sets `endedAt`. Emits `REVOKE_CASE_ASSIGNMENT` audit event.

---

## 4. Frontend Integration

In `public/frontend/pages/cases.html` and `public/frontend/js/cases.js`:
- **Team Roster:** Renders the Primary Officer with a highlighted "Lead Investigator" badge and each collaborator with their badge number and join date.
- **Assign Officer Modal (`#assignment-case-modal`):** Allows supervisors to select from eligible officers, choose role (`PRIMARY` or `COLLABORATOR`), and provide mandatory justification.
- **Revoke Button:** Provides one-click revocation for collaborating officers with instant confirmation and optimistic UI update.

---

## 5. Verification & Test Evidence

The automated test suite `scripts/test_phase35_case_lifecycle.mjs` validated all 25 scenarios:
- **Scenario 16 (Unauthorized Assignment Denied):** Auditor officer attempting assignment rejected (lacks `case:assign` permission).
- **Scenario 17 (Eligible Assignment Succeeds):** Active investigator assigned as collaborator; appears in active roster.
- **Scenario 18 (Suspended Target Rejected):** Assignment to `SUSPENDED` officer rejected with descriptive error.
- **Scenario 19 (Cross-Department Assignment Denied):** Mumbai investigator cannot be assigned to Delhi case without an approved access grant.
- **Scenario 20 (Authorized Reassignment & History):** Primary investigator replaced; prior assignment marked `REPLACED` with valid `endedAt`, new primary active.
- **Scenario 21 (Department Transfer Leak Prevention):** When an investigator is transferred to another department, prior department cases become strictly inaccessible via `canAccessCaseAsync`.
- **Scenario 23 (Concurrent Assignment Safety):** Competing simultaneous primary assignment updates arbitrated safely, resulting in exactly 1 active primary officer.

---

## 6. Security & Invariant Summary

1. **No Stale Privilege Persistence:** A suspended officer's token is revoked and active assignments do not permit login or API execution.
2. **Knowledge $\neq$ Authorization:** Knowing a case ID does not grant case access; access is evaluated against department matching, active assignment in `CaseAssignmentHistory`, or active database-backed `AccessGrant`.
3. **No Role Escalation:** Department administrators cannot assign officers to `SYS_ADMIN` or grant platform-wide bypasses.
