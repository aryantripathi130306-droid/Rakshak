# RAKSHAK v3.0 — PHASE 35.1
# Independently Authenticated Supervisor Approval Verification Report

**Status:** COMPLETE  
**Phase:** 35.1 — Supervisor Approval Verification, Migration Parity & Historical Record Protection  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  
**Database Target:** `rakshak_phase35_1_test` (Isolated Synthetic Fixture)  

---

## 1. Executive Summary

Phase 35.1 addresses the verification and authentication hardening required for case lifecycle workflow approvals (specifically case closure, chargesheeting, and reopening). 

In Phase 35, client requests could submit unauthenticated supervisor badge numbers (e.g. `body.approvedBy = "DEL-SUP-01"`), and self-approval checks were not enforced. Phase 35.1 establishes an independently authenticated supervisor approval subsystem governed by `lib/supervisorApproval.ts` and `app/api/cases/[caseId]/approval/route.ts`.

Key architectural enhancements:
1. **Server-Side Verified Identity:** Untrusted client strings (such as badge numbers or names passed in request payloads) are strictly rejected as proof of approval. Approvers are authenticated from verified server-side session tokens and live database checks.
2. **Separation of Duties:** The lead investigator on a case is prohibited from approving their own case closure, chargesheeting, or reopening. An independent supervisor must authorize privileged workflow transitions.
3. **Exact Case & Transition Binding:** Pre-issued approval records (`AccessGrant` with scope `WORKFLOW_APPROVAL:<fromStatus>:<toStatus>`) are cryptographically bound to the exact case ID and exact destination status. Replaying an approval on a different case or transition is actively rejected.
4. **Single-Use Consumption & Concurrency Locking:** Approval records are atomically consumed upon transition (`status: "REVOKED"` with reason `CONSUMED_BY_CASE_TRANSITION`), preventing replay attacks and race conditions across parallel threads.
5. **Live Commit-Time Verification:** If an approver's account is suspended or their supervisor role is revoked prior to transition commit, the transition fails closed.

---

## 2. Architecture & Implementation

### 2.1 The Approval Model

Approvals are backed by the database-backed `AccessGrant` model:
- `targetCaseId`: Bound to the specific case ID.
- `scope`: Formatted as `WORKFLOW_APPROVAL:${fromStatus}:${toStatus}`.
- `granteeOfficerId`: Bound to the requesting investigator.
- `grantedByOfficerId`: Bound to the authenticated supervisor.
- `status`: `"ACTIVE"` $\rightarrow$ transitions to `"REVOKED"` upon atomic consumption.
- `expiresAt`: Configurable expiry window (default 24 hours).

### 2.2 Direct vs. Delegated Supervisor Transitions

The subsystem supports two legitimate approval workflows:
1. **Delegated Approval (Investigator Request):**
   - An active supervisor calls `POST /api/cases/[caseId]/approval` to issue an approval record for an investigator.
   - The investigator submits the transition request with `approvalGrantId` (or `approvalId`).
   - The system verifies case binding, transition scope, expiry, and approver account status, then atomically consumes the grant.
2. **Direct Supervisor Execution:**
   - An active supervisor directly calls `POST /api/cases/[caseId]/transition`.
   - The system confirms the supervisor's active account in the database and verifies that separation of duties is preserved (the supervisor is not the primary investigator on the case).

---

## 3. Automated Test Evidence (10/10 Passed)

The test suite in `scripts/test_phase35_1_supervisor_and_rls.mjs` validated all 10 scenarios enumerated in Workstream A:

| Test ID | Test Scenario | Expected Outcome | Observed Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-A01** | Valid supervisor approval | Transition succeeds; approver recorded | Case advanced to `CLOSED`; approver badge recorded | **PASSED** |
| **TC-A02** | Investigator submits another's badge string | Rejected with HTTP 403; badge ignored | Rejection: "Unauthorized: Requester lacks supervisor authority" | **PASSED** |
| **TC-A03** | Suspended supervisor attempts approval | Rejected on account status | Rejection: "Supervisor account is SUSPENDED" | **PASSED** |
| **TC-A04** | Unauthorized cross-department supervisor | Rejected without cross-dept grant | Rejection: "Cross-department supervisor lacks active delegation grant" | **PASSED** |
| **TC-A05** | Requester attempts self-approval | Blocked by separation of duties | Rejection: "Lead investigator cannot self-approve workflow transitions" | **PASSED** |
| **TC-A06** | Approval replayed on different case | Blocked by case mismatch | Rejection: "Approval was issued for case X, not Y" | **PASSED** |
| **TC-A07** | Approval replayed on different transition | Blocked by scope mismatch | Rejection: "Approval is for transition scope X, not Y" | **PASSED** |
| **TC-A08** | Concurrent approval consumption | Exactly 1 consumes; other rejected | 1 fulfilled, 1 rejected with replay error | **PASSED** |
| **TC-A09** | Approver permissions revoked before commit | Commit fails closed | Rejection: "Approving officer role VIEWER no longer possesses authority" | **PASSED** |
| **TC-A10** | Missing and invalid approval | Both fail closed | Missing and non-existent IDs both rejected | **PASSED** |

---

## 4. API Specification

### `POST /api/cases/[caseId]/approval`
- **Requires:** Authenticated officer with `case:workflow:approve` permission (`SUPERVISOR`, `DEPT_ADMIN`, or `SYS_ADMIN`).
- **Body:**
  ```json
  {
    "fromStatus": "UNDER_INQUIRY",
    "toStatus": "CLOSED",
    "requesterOfficerId": "off-del-inv-1",
    "reason": "Recovered stolen funds; final inquiry report verified",
    "validHours": 24
  }
  ```
- **Returns:**
  ```json
  {
    "success": true,
    "approvalId": "grant-9a4f-...",
    "message": "Supervisor workflow approval issued successfully."
  }
  ```

---

## 5. Security & Operational Boundary Summary

- **Zero Untrusted Claims:** The server ignores `body.approvedBy` or `body.supervisorBadge` strings. Identity is exclusively derived from authenticated sessions and database foreign keys.
- **Fail-Closed Guarantee:** Any discrepancy in case ID, status transition, officer account state, or grant validity results in immediate HTTP 403 rejection.
- **Evidence Protection:** Approval operations are strictly isolated from evidence storage. Zero evidence binaries were modified or accessed.
