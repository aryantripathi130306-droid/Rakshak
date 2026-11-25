// ─────────────────────────────────────────────────────────────────────────────
// lib/caseLifecycle.ts
// Rakshak v3.0 — Phase 35 Case Lifecycle State Machine & Transition Rules
// Enforces formal state transitions, role-based supervisor approvals, and audit
// ─────────────────────────────────────────────────────────────────────────────
import prisma from "./prisma.ts";
import { hasPermission, canAccessCaseAsync, type OfficerProfile } from "./accessControl.ts";
import { verifyAndConsumeSupervisorApprovalAsync } from "./supervisorApproval.ts";

export type CaseStatus = "OPEN" | "UNDER_INQUIRY" | "CHARGESHEETED" | "CLOSED";

export const VALID_CASE_STATUSES: CaseStatus[] = [
  "OPEN",
  "UNDER_INQUIRY",
  "CHARGESHEETED",
  "CLOSED",
];

export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ["UNDER_INQUIRY"],
  UNDER_INQUIRY: ["CHARGESHEETED", "CLOSED"],
  CHARGESHEETED: ["CLOSED"],
  CLOSED: ["UNDER_INQUIRY"], // Authorized Reopening
};

export const SUPERVISOR_APPROVAL_TRANSITIONS: Array<{ from: CaseStatus; to: CaseStatus }> = [
  { from: "UNDER_INQUIRY", to: "CHARGESHEETED" },
  { from: "UNDER_INQUIRY", to: "CLOSED" },
  { from: "CHARGESHEETED", to: "CLOSED" },
  { from: "CLOSED", to: "UNDER_INQUIRY" },
];

export interface TransitionValidationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
  isApprovalRequired?: boolean;
}

export function normalizeCaseStatus(s?: string | null): CaseStatus | null {
  if (!s) return null;
  const upper = s.toUpperCase().trim();
  if (upper === "UNDER_INVESTIGATION" || upper === "UNDER_INQUIRY" || upper === "IN_PROGRESS" || upper === "TRIAGED") {
    return "UNDER_INQUIRY";
  }
  if (upper === "CHARGESHEET_FILED" || upper === "CHARGESHEETED") {
    return "CHARGESHEETED";
  }
  if (upper === "CLOSED" || upper === "DISPOSED") {
    return "CLOSED";
  }
  if (upper === "OPEN" || upper === "REGISTERED") {
    return "OPEN";
  }
  return null;
}

export function getPermittedTransitions(
  currentStatus: string,
  officerRole: string
): CaseStatus[] {
  const norm = normalizeCaseStatus(currentStatus) || "OPEN";
  const potential = VALID_TRANSITIONS[norm] || [];
  const canApprove = hasPermission(officerRole, "case:workflow:approve");

  return potential.filter((toStatus) => {
    const requiresApproval = SUPERVISOR_APPROVAL_TRANSITIONS.some(
      (t) => t.from === norm && t.to === toStatus
    );
    if (requiresApproval && !canApprove) {
      return false;
    }
    return true;
  });
}

export async function validateCaseTransition(
  officer: OfficerProfile,
  caseRecord: {
    id: string;
    caseNumber?: string;
    status: string;
    jurisdiction?: string | null;
    departmentId?: string | null;
    officerBadge?: string | null;
  },
  requestedTargetStatus: string,
  reason?: string | null,
  prismaOverride?: any
): Promise<TransitionValidationResult> {
  // 1. Authenticated officer status check
  if (officer.status !== "ACTIVE") {
    return {
      valid: false,
      statusCode: 403,
      error: `Access denied: Account status is ${officer.status}. Suspended or inactive officers cannot execute state transitions.`,
    };
  }

  // 2. Validate target status syntax
  const targetNorm = normalizeCaseStatus(requestedTargetStatus);
  if (!targetNorm) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid destination status: "${requestedTargetStatus}". Permitted statuses are ${VALID_CASE_STATUSES.join(", ")}.`,
    };
  }

  const currentNorm = normalizeCaseStatus(caseRecord.status) || "OPEN";

  // 3. Prevent no-op self-transitions
  if (currentNorm === targetNorm) {
    return {
      valid: false,
      statusCode: 400,
      error: `Case ${caseRecord.caseNumber || caseRecord.id} is already in status ${currentNorm}.`,
    };
  }

  // 4. Validate transition against formal lifecycle matrix
  const permitted = VALID_TRANSITIONS[currentNorm] || [];
  if (!permitted.includes(targetNorm)) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid case-state transition from ${currentNorm} to ${targetNorm}. Allowed transitions from ${currentNorm} are: ${permitted.length > 0 ? permitted.join(", ") : "None"}.`,
    };
  }

  // 5. Check if supervisor workflow approval is required
  const requiresSupervisorApproval = SUPERVISOR_APPROVAL_TRANSITIONS.some(
    (t) => t.from === currentNorm && t.to === targetNorm
  );

  if (requiresSupervisorApproval) {
    const hasApprovalPermission = hasPermission(officer.role, "case:workflow:approve");
    if (!hasApprovalPermission) {
      return {
        valid: false,
        statusCode: 403,
        error: `Unauthorized: Transition from ${currentNorm} to ${targetNorm} requires supervisor workflow approval authority.`,
        isApprovalRequired: true,
      };
    }

    if (!reason || reason.trim().length === 0) {
      return {
        valid: false,
        statusCode: 400,
        error: `A mandatory justification reason is required for transition to ${targetNorm}.`,
        isApprovalRequired: true,
      };
    }
  }

  // 6. Case access check with fresh DB authority
  const accessCheck = await canAccessCaseAsync(
    officer,
    caseRecord,
    requiresSupervisorApproval ? "workflow:approve" : "write",
    prismaOverride
  );

  if (!accessCheck.allowed) {
    return {
      valid: false,
      statusCode: 403,
      error: accessCheck.reason || "Unauthorized: Officer lacks case modification authority.",
    };
  }

  return {
    valid: true,
    statusCode: 200,
    isApprovalRequired: requiresSupervisorApproval,
  };
}

export async function executeCaseTransition(
  officer: OfficerProfile,
  caseId: string,
  fromStatus: CaseStatus,
  toStatus: CaseStatus,
  reason?: string | null,
  approvalGrantId?: string | null,
  prismaOverride?: any
): Promise<{ success: boolean; caseRecord: any; historyRecord: any; error?: string; statusCode?: number }> {
  const p = (prismaOverride ?? prisma) as any;

  try {
    const requiresSupervisorApproval = SUPERVISOR_APPROVAL_TRANSITIONS.some(
      (t) => t.from === fromStatus && t.to === toStatus
    );

    // Concurrency-safe atomic transaction
    const result = await p.$transaction(async (tx: any) => {
      // 1. Optimistic locking on id and current status
      const existing = await tx.case.findUnique({
        where: { id: caseId },
        select: { id: true, status: true, departmentId: true, caseNumber: true, officerName: true, officerBadge: true },
      });

      if (!existing) {
        throw new Error("CASE_NOT_FOUND");
      }

      const currentNorm = normalizeCaseStatus(existing.status);
      if (currentNorm !== fromStatus) {
        throw new Error("CONCURRENCY_CONFLICT");
      }

      // 2. Authenticated Supervisor Approval Verification
      let approverBadge: string | null = null;
      let approverName: string | null = null;

      if (requiresSupervisorApproval) {
        const approvalCheck = await verifyAndConsumeSupervisorApprovalAsync(
          officer,
          existing,
          fromStatus,
          toStatus,
          approvalGrantId,
          tx
        );

        if (!approvalCheck.valid) {
          const err: any = new Error(approvalCheck.error || "Supervisor approval verification failed");
          err.statusCode = approvalCheck.statusCode;
          throw err;
        }

        approverName = approvalCheck.approver?.name || null;
        approverBadge = approvalCheck.approver?.badgeNumber || null;
      }

      // 3. Perform atomic update
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: {
          status: toStatus,
          updatedAt: new Date(),
        },
      });

      // 4. Record status transition in CaseStatusHistory
      const historyEntry = await tx.caseStatusHistory.create({
        data: {
          case: { connect: { id: caseId } },
          fromStatus,
          toStatus,
          changedById: officer.id,
          changedByName: officer.name,
          changedByBadge: officer.badgeNumber || null,
          departmentId: existing.departmentId || null,
          reason: reason ? reason.trim() : null,
          approvedBy: approverBadge || approverName,
          changedAt: new Date(),
        },
      });

      return { updatedCase, historyEntry };
    });

    return {
      success: true,
      caseRecord: result.updatedCase,
      historyRecord: result.historyEntry,
    };
  } catch (err: any) {
    if (err.message === "CASE_NOT_FOUND") {
      return { success: false, caseRecord: null, historyRecord: null, error: "Case not found." };
    }
    if (err.message === "CONCURRENCY_CONFLICT") {
      return {
        success: false,
        caseRecord: null,
        historyRecord: null,
        error: `Concurrency conflict: Case status was concurrently modified from ${fromStatus}.`,
      };
    }
    return {
      success: false,
      caseRecord: null,
      historyRecord: null,
      error: err?.message || String(err),
    };
  }
}
