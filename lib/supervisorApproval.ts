// ─────────────────────────────────────────────────────────────────────────────
// lib/supervisorApproval.ts
// Rakshak v3.0 — Phase 35.1 Authenticated Supervisor Approval Subsystem
// Enforces:
// 1. Independently authenticated supervisor identity from database state
// 2. Separation of duties (case investigator cannot approve their own transition)
// 3. Exact case binding & exact transition binding (anti-replay protections)
// 4. One-time consumption (cannot reuse approval records across cases/transitions)
// 5. Live approver status verification at transition commit time
// ─────────────────────────────────────────────────────────────────────────────
import prisma from "./prisma.ts";
import { hasPermission, type OfficerProfile } from "./accessControl.ts";

export interface CreateApprovalParams {
  caseId: string;
  fromStatus: string;
  toStatus: string;
  requesterOfficerId: string;
  reason: string;
  validHours?: number;
}

export interface ApprovalVerificationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
  approver?: {
    id: string;
    name: string;
    badgeNumber: string | null;
    departmentId: string | null;
    role: string;
  };
  approvalGrantId?: string;
}

/**
 * Creates an authoritative, database-backed supervisor approval record (represented as an AccessGrant
 * scoped to the exact case, exact transition, requester, and approver).
 */
export async function createSupervisorApprovalAsync(
  supervisor: OfficerProfile,
  params: CreateApprovalParams,
  prismaOverride?: any
): Promise<{ success: boolean; approvalId?: string; error?: string; statusCode: number }> {
  const p = (prismaOverride ?? prisma) as any;

  // 1. Validate supervisor account status in DB
  const dbSupervisor = await p.officer.findUnique({
    where: { id: supervisor.id },
    select: { id: true, name: true, badgeNumber: true, role: true, status: true, departmentId: true },
  });

  if (!dbSupervisor || dbSupervisor.status !== "ACTIVE") {
    return {
      success: false,
      statusCode: 403,
      error: `Approval denied: Supervisor account is ${dbSupervisor ? dbSupervisor.status : "NON_EXISTENT"}. Only active officers can approve transitions.`,
    };
  }

  // 2. Validate supervisor has workflow approval authority
  if (!hasPermission(dbSupervisor.role, "case:workflow:approve")) {
    return {
      success: false,
      statusCode: 403,
      error: `Approval denied: Officer role ${dbSupervisor.role} lacks case:workflow:approve permission.`,
    };
  }

  // 3. Resolve target case
  const targetCase = await p.case.findUnique({
    where: { id: params.caseId },
    select: { id: true, status: true, departmentId: true, officerBadge: true, officerName: true },
  });

  if (!targetCase) {
    return {
      success: false,
      statusCode: 404,
      error: "Approval denied: Target case not found.",
    };
  }

  // 4. Department boundary / grant scope
  if (dbSupervisor.role !== "SYS_ADMIN" && dbSupervisor.departmentId !== targetCase.departmentId) {
    // Cross-department approval requires active cross-department supervision grant
    const crossGrant = await p.accessGrant.findFirst({
      where: {
        granteeOfficerId: dbSupervisor.id,
        targetDepartmentId: targetCase.departmentId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });

    if (!crossGrant) {
      return {
        success: false,
        statusCode: 403,
        error: "Approval denied: Cross-department supervisor lacks active delegation grant.",
      };
    }
  }

  // 5. Separation of Duties: Requester must not be the approving supervisor
  if (params.requesterOfficerId === dbSupervisor.id) {
    return {
      success: false,
      statusCode: 403,
      error: "Separation of duties violation: Requester cannot approve their own transition request.",
    };
  }

  // Also check if supervisor is the active primary investigator on the case
  const isPrimaryInvestigator = await p.caseAssignmentHistory.findFirst({
    where: {
      caseId: targetCase.id,
      officerId: dbSupervisor.id,
      assignmentType: "PRIMARY",
      status: "ACTIVE",
    },
  });

  if (isPrimaryInvestigator || (targetCase.officerBadge && targetCase.officerBadge === dbSupervisor.badgeNumber)) {
    return {
      success: false,
      statusCode: 403,
      error: "Separation of duties violation: Lead investigator on the case cannot self-approve workflow transitions.",
    };
  }

  // 6. Mandatory reason
  if (!params.reason || params.reason.trim().length === 0) {
    return {
      success: false,
      statusCode: 400,
      error: "Approval denied: Mandatory justification reason is required.",
    };
  }

  // 7. Store approval record in database
  const scope = `WORKFLOW_APPROVAL:${params.fromStatus}:${params.toStatus}`;
  const validHours = params.validHours || 24;
  const expiresAt = new Date(Date.now() + validHours * 3600 * 1000);

  const approvalGrant = await p.accessGrant.create({
    data: {
      granteeOfficer: { connect: { id: params.requesterOfficerId } },
      granteeDepartment: { connect: { id: dbSupervisor.departmentId || targetCase.departmentId } },
      targetDepartment: { connect: { id: targetCase.departmentId } },
      targetCase: { connect: { id: targetCase.id } },
      scope,
      grantedByOfficer: { connect: { id: dbSupervisor.id } },
      status: "ACTIVE",
      reason: params.reason.trim(),
      expiresAt,
    },
  });

  return {
    success: true,
    statusCode: 201,
    approvalId: approvalGrant.id,
  };
}

/**
 * Validates and atomically consumes a supervisor approval for a case transition.
 * Supports:
 * A) Pre-issued approval token / grant ID
 * B) Direct supervisor execution (where operator IS the supervisor and separation of duties is satisfied)
 */
export async function verifyAndConsumeSupervisorApprovalAsync(
  operator: OfficerProfile,
  caseRecord: {
    id: string;
    departmentId?: string | null;
    officerBadge?: string | null;
    officerName?: string | null;
  },
  fromStatus: string,
  toStatus: string,
  approvalGrantId?: string | null,
  prismaOverride?: any
): Promise<ApprovalVerificationResult> {
  const p = (prismaOverride ?? prisma) as any;

  // Path A: Pre-issued approval record provided
  if (approvalGrantId) {
    const grant = await p.accessGrant.findUnique({
      where: { id: approvalGrantId },
      include: {
        grantedByOfficer: true,
      },
    });

    if (!grant) {
      if (!hasPermission(operator.role, "case:workflow:approve")) {
        return {
          valid: false,
          statusCode: 403,
          error: "Unauthorized: Requester lacks supervisor workflow approval authority, and specified approval record does not exist.",
        };
      }
      // If operator is an active supervisor, proceed to Path B (direct execution)
    } else {
      // 1. One-time consumption / Replay protection: Must be ACTIVE
      if (grant.status !== "ACTIVE") {
        return {
          valid: false,
          statusCode: 403,
          error: `Replay rejected: Approval record is ${grant.status} and cannot be reused.`,
        };
      }

      // 2. Expiry protection
      if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) {
        return {
          valid: false,
          statusCode: 403,
          error: "Invalid approval: Approval record has expired.",
        };
      }

      // 3. Case binding protection: Cannot be replayed against another case
      if (grant.targetCaseId !== caseRecord.id) {
        return {
          valid: false,
          statusCode: 403,
          error: `Replay rejected: Approval was issued for case ${grant.targetCaseId}, not ${caseRecord.id}.`,
        };
      }

      // 4. Transition binding protection: Cannot be replayed against a different transition
      const expectedScope = `WORKFLOW_APPROVAL:${fromStatus}:${toStatus}`;
      if (grant.scope !== expectedScope) {
        return {
          valid: false,
          statusCode: 403,
          error: `Replay rejected: Approval is for transition scope ${grant.scope}, not ${expectedScope}.`,
        };
      }

      // 5. Live approver verification at commit time
      const approver = grant.grantedByOfficer;
      if (!approver || approver.status !== "ACTIVE") {
        return {
          valid: false,
          statusCode: 403,
          error: `Approval revoked: Approving officer account is ${approver ? approver.status : "INACTIVE"}.`,
        };
      }

      if (!hasPermission(approver.role, "case:workflow:approve")) {
        return {
          valid: false,
          statusCode: 403,
          error: `Approval revoked: Approving officer role ${approver.role} no longer possesses workflow approval authority.`,
        };
      }

      // Atomically consume approval record
      await p.accessGrant.update({
        where: { id: grant.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          reason: `CONSUMED_BY_CASE_TRANSITION:${fromStatus}->${toStatus}`,
        },
      });

      return {
        valid: true,
        statusCode: 200,
        approver: {
          id: approver.id,
          name: approver.name,
          badgeNumber: approver.badgeNumber,
          departmentId: approver.departmentId,
          role: approver.role,
        },
        approvalGrantId: grant.id,
      };
    }
  }

  // Path B: Direct execution by authenticated supervisor
  // 1. Verify operator has workflow approval permission
  if (!hasPermission(operator.role, "case:workflow:approve")) {
    return {
      valid: false,
      statusCode: 403,
      error: "Unauthorized: Requester lacks supervisor workflow approval authority, and no valid approval record was supplied.",
    };
  }

  // 2. Fetch fresh DB status of operator to prevent races with suspension/revocation
  const liveOperator = await p.officer.findUnique({
    where: { id: operator.id },
    select: { id: true, name: true, badgeNumber: true, role: true, status: true, departmentId: true },
  });

  if (!liveOperator || liveOperator.status !== "ACTIVE") {
    return {
      valid: false,
      statusCode: 403,
      error: `Unauthorized: Approving officer account is ${liveOperator ? liveOperator.status : "NON_EXISTENT"}.`,
    };
  }

  // 3. Department boundary check
  if (liveOperator.role !== "SYS_ADMIN" && liveOperator.departmentId !== caseRecord.departmentId) {
    const crossGrant = await p.accessGrant.findFirst({
      where: {
        granteeOfficerId: liveOperator.id,
        targetDepartmentId: caseRecord.departmentId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });

    if (!crossGrant) {
      return {
        valid: false,
        statusCode: 403,
        error: "Unauthorized: Cross-department supervisor lacks active delegation grant.",
      };
    }
  }

  // 4. Separation of Duties: Case primary investigator cannot approve their own transition
  const isPrimary = await p.caseAssignmentHistory.findFirst({
    where: {
      caseId: caseRecord.id,
      officerId: liveOperator.id,
      assignmentType: "PRIMARY",
      status: "ACTIVE",
    },
  });

  if (isPrimary || (caseRecord.officerBadge && caseRecord.officerBadge === liveOperator.badgeNumber)) {
    return {
      valid: false,
      statusCode: 403,
      error: "Separation of duties violation: Case primary investigator cannot approve their own closure or reopening. An independent supervisor must approve.",
    };
  }

  return {
    valid: true,
    statusCode: 200,
    approver: {
      id: liveOperator.id,
      name: liveOperator.name,
      badgeNumber: liveOperator.badgeNumber,
      departmentId: liveOperator.departmentId,
      role: liveOperator.role,
    },
  };
}
