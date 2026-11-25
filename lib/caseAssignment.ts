// ─────────────────────────────────────────────────────────────────────────────
// lib/caseAssignment.ts
// Rakshak v3.0 — Phase 35 Officer Assignment & Reassignment Management
// Enforces role suitability, active status, departmental boundaries, and traceable history
// ─────────────────────────────────────────────────────────────────────────────
import prisma from "./prisma.ts";
import { hasPermission, hasActiveGrantAsync, type OfficerProfile } from "./accessControl.ts";

export type AssignmentType = "PRIMARY" | "COLLABORATOR" | "REASSIGNMENT";
export type AssignmentStatus = "ACTIVE" | "REPLACED" | "REVOKED";

export interface AssignmentValidationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
  targetOfficer?: any;
}

export const ELIGIBLE_INVESTIGATOR_ROLES = ["INVESTIGATOR", "SUPERVISOR"];

export async function validateCaseAssignment(
  assignerOfficer: OfficerProfile,
  caseRecord: {
    id: string;
    caseNumber?: string;
    departmentId?: string | null;
    jurisdiction?: string | null;
    officerBadge?: string | null;
  },
  targetOfficerId: string,
  assignmentType: AssignmentType = "PRIMARY",
  reason?: string | null,
  prismaOverride?: any
): Promise<AssignmentValidationResult> {
  const p = (prismaOverride ?? prisma) as any;

  // 1. Assigner status check
  if (assignerOfficer.status !== "ACTIVE") {
    return {
      valid: false,
      statusCode: 403,
      error: `Access denied: Account status is ${assignerOfficer.status}. Suspended officers cannot perform assignments.`,
    };
  }

  // 2. Assigner permission check
  if (!hasPermission(assignerOfficer.role, "case:assign")) {
    return {
      valid: false,
      statusCode: 403,
      error: `Access denied: Role "${assignerOfficer.role}" lacks case assignment authority ("case:assign").`,
    };
  }

  // 3. Dept admin department boundary
  if (assignerOfficer.role === "DEPT_ADMIN" && caseRecord.departmentId) {
    if (assignerOfficer.departmentId !== caseRecord.departmentId) {
      return {
        valid: false,
        statusCode: 403,
        error: "Access denied: Department administrators cannot assign cases outside their department boundary.",
      };
    }
  }

  // 4. Resolve target officer from DB
  const targetOfficer = await p.officer.findUnique({
    where: { id: targetOfficerId },
    select: {
      id: true,
      name: true,
      badgeNumber: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      jurisdiction: true,
    },
  });

  if (!targetOfficer) {
    return {
      valid: false,
      statusCode: 404,
      error: `Target officer with ID "${targetOfficerId}" not found.`,
    };
  }

  // 5. Target officer must be ACTIVE
  if (targetOfficer.status !== "ACTIVE") {
    return {
      valid: false,
      statusCode: 422,
      error: `Cannot assign case to officer ${targetOfficer.name} (${targetOfficer.badgeNumber}): Account is ${targetOfficer.status}.`,
    };
  }

  // 6. Role suitability: must be eligible investigator role
  if (!ELIGIBLE_INVESTIGATOR_ROLES.includes(targetOfficer.role)) {
    return {
      valid: false,
      statusCode: 422,
      error: `Officer role "${targetOfficer.role}" is not eligible for investigative case assignment. Must be one of: ${ELIGIBLE_INVESTIGATOR_ROLES.join(", ")}.`,
    };
  }

  // 7. Department & Cross-Department Grant Verification
  if (caseRecord.departmentId && targetOfficer.departmentId !== caseRecord.departmentId) {
    const hasGrant = await hasActiveGrantAsync(
      targetOfficer,
      caseRecord.departmentId,
      caseRecord.id,
      p
    );

    if (!hasGrant) {
      return {
        valid: false,
        statusCode: 403,
        error: `Cross-department assignment rejected: Target officer ${targetOfficer.name} belongs to department ${targetOfficer.departmentId || "unassigned"} and lacks an approved access grant for case ${caseRecord.caseNumber || caseRecord.id}.`,
      };
    }
  }

  return {
    valid: true,
    statusCode: 200,
    targetOfficer,
  };
}

export async function executeCaseAssignment(
  assignerOfficer: OfficerProfile,
  caseId: string,
  targetOfficer: {
    id: string;
    name: string;
    badgeNumber: string;
    departmentId?: string | null;
  },
  assignmentType: AssignmentType = "PRIMARY",
  reason?: string | null,
  prismaOverride?: any
): Promise<{ success: boolean; caseRecord: any; assignmentRecord: any; error?: string }> {
  const p = (prismaOverride ?? prisma) as any;

  try {
    const result = await p.$transaction(async (tx: any) => {
      const caseRecord = await tx.case.findUnique({
        where: { id: caseId },
        select: { id: true, caseNumber: true, officerName: true, officerBadge: true, departmentId: true },
      });

      if (!caseRecord) {
        throw new Error("CASE_NOT_FOUND");
      }

      let assignmentRecord: any = null;

      if (assignmentType === "PRIMARY" || assignmentType === "REASSIGNMENT") {
        // 1. Mark existing active primary assignment as REPLACED
        await tx.caseAssignmentHistory.updateMany({
          where: {
            caseId,
            assignmentType: { in: ["PRIMARY", "REASSIGNMENT"] },
            status: "ACTIVE",
          },
          data: {
            status: "REPLACED",
            endedAt: new Date(),
          },
        });

        // 2. Update case primary officer fields
        await tx.case.update({
          where: { id: caseId },
          data: {
            officerName: targetOfficer.name,
            officerBadge: targetOfficer.badgeNumber,
            updatedAt: new Date(),
          },
        });

        // 3. Create new primary assignment record
        assignmentRecord = await tx.caseAssignmentHistory.create({
          data: {
            case: { connect: { id: caseId } },
            officerId: targetOfficer.id,
            officerName: targetOfficer.name,
            officerBadge: targetOfficer.badgeNumber,
            departmentId: caseRecord.departmentId || targetOfficer.departmentId || null,
            assignedById: assignerOfficer.id,
            assignedByName: assignerOfficer.name,
            assignedByBadge: assignerOfficer.badgeNumber || null,
            assignmentType,
            status: "ACTIVE",
            reason: reason ? reason.trim() : (assignmentType === "REASSIGNMENT" ? "Reassigned primary investigator" : "Assigned primary investigator"),
            assignedAt: new Date(),
          },
        });
      } else {
        // COLLABORATOR assignment
        const existingCollab = await tx.caseAssignmentHistory.findFirst({
          where: {
            caseId,
            officerId: targetOfficer.id,
            assignmentType: "COLLABORATOR",
            status: "ACTIVE",
          },
        });

        if (existingCollab) {
          assignmentRecord = existingCollab;
        } else {
          assignmentRecord = await tx.caseAssignmentHistory.create({
            data: {
              case: { connect: { id: caseId } },
              officerId: targetOfficer.id,
              officerName: targetOfficer.name,
              officerBadge: targetOfficer.badgeNumber,
              departmentId: caseRecord.departmentId || targetOfficer.departmentId || null,
              assignedById: assignerOfficer.id,
              assignedByName: assignerOfficer.name,
              assignedByBadge: assignerOfficer.badgeNumber || null,
              assignmentType: "COLLABORATOR",
              status: "ACTIVE",
              reason: reason ? reason.trim() : "Added collaborating investigator",
              assignedAt: new Date(),
            },
          });
        }
      }

      const refreshedCase = await tx.case.findUnique({
        where: { id: caseId },
      });

      return { refreshedCase, assignmentRecord };
    });

    return {
      success: true,
      caseRecord: result.refreshedCase,
      assignmentRecord: result.assignmentRecord,
    };
  } catch (err: any) {
    return {
      success: false,
      caseRecord: null,
      assignmentRecord: null,
      error: err?.message || String(err),
    };
  }
}

export async function revokeCaseAssignment(
  assignerOfficer: OfficerProfile,
  caseId: string,
  assignmentId: string,
  reason?: string | null,
  prismaOverride?: any
): Promise<{ success: boolean; error?: string }> {
  const p = (prismaOverride ?? prisma) as any;

  if (assignerOfficer.status !== "ACTIVE") {
    return { success: false, error: "Suspended officers cannot revoke assignments." };
  }

  if (!hasPermission(assignerOfficer.role, "case:assign")) {
    return { success: false, error: "Officer lacks case assignment authority." };
  }

  try {
    await p.$transaction(async (tx: any) => {
      const assignment = await tx.caseAssignmentHistory.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment || assignment.caseId !== caseId) {
        throw new Error("ASSIGNMENT_NOT_FOUND");
      }

      await tx.caseAssignmentHistory.update({
        where: { id: assignmentId },
        data: {
          status: "REVOKED",
          endedAt: new Date(),
          reason: reason ? `${assignment.reason ? assignment.reason + " | Revocation: " : ""}${reason.trim()}` : assignment.reason,
        },
      });

      // If revoking active primary, clear case fields
      if (assignment.assignmentType === "PRIMARY" && assignment.status === "ACTIVE") {
        await tx.case.update({
          where: { id: caseId },
          data: {
            officerName: null,
            officerBadge: null,
            updatedAt: new Date(),
          },
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function getCaseAssignments(
  caseId: string,
  prismaOverride?: any
): Promise<{ primary: any | null; collaborators: any[]; history: any[] }> {
  const p = (prismaOverride ?? prisma) as any;

  const history = await p.caseAssignmentHistory.findMany({
    where: { caseId },
    orderBy: { assignedAt: "desc" },
  });

  const activePrimary = history.find(
    (a: any) => (a.assignmentType === "PRIMARY" || a.assignmentType === "REASSIGNMENT") && a.status === "ACTIVE"
  ) || null;

  const collaborators = history.filter(
    (a: any) => a.assignmentType === "COLLABORATOR" && a.status === "ACTIVE"
  );

  return {
    primary: activePrimary,
    collaborators,
    history,
  };
}
