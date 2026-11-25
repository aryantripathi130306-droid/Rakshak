// ─────────────────────────────────────────────────────────────────────────────
// lib/dossierReview.ts
// Rakshak v3.0 — Phase 38 Controlled Dossier Review, Approval & Finalization
//
// Enforces:
// 1. Explicit finite-state machine transitions
// 2. Exact content hash binding to supervisor approvals (anti-tamper)
// 3. Separation of duties (investigator cannot approve their own dossier)
// 4. Live approver role and status verification at commit time
// 5. Immutable review ledger recording all decisions
// ─────────────────────────────────────────────────────────────────────────────
import prisma from "./prisma.ts";
import { hasPermission, type OfficerProfile } from "./accessControl.ts";

export type DossierStatus =
  | "DRAFT"
  | "GENERATED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED"
  | "FINALIZED"
  | "SUPERSEDED";

const ALLOWED_TRANSITIONS: Record<DossierStatus, DossierStatus[]> = {
  DRAFT: ["GENERATED"],
  GENERATED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "NEEDS_REVISION"],
  NEEDS_REVISION: ["UNDER_REVIEW", "GENERATED"],
  APPROVED: ["FINALIZED", "SUPERSEDED", "NEEDS_REVISION"],
  FINALIZED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export interface SubmitReviewParams {
  dossierId: string;
  toStatus: DossierStatus;
  decision: "APPROVE" | "REJECT" | "REQUEST_REVISION" | "STATUS_TRANSITION";
  rationale: string;
}

/**
 * Validates state transition server-side.
 */
export function validateDossierTransition(
  fromStatus: string,
  toStatus: string
): { valid: boolean; reason?: string } {
  const from = fromStatus.toUpperCase() as DossierStatus;
  const to = toStatus.toUpperCase() as DossierStatus;

  if (!ALLOWED_TRANSITIONS[from]) {
    return { valid: false, reason: `Unknown source status: ${fromStatus}` };
  }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return {
      valid: false,
      reason: `Invalid transition from ${from} to ${to}. Allowed transitions: ${ALLOWED_TRANSITIONS[from].join(", ") || "None"}`,
    };
  }

  return { valid: true };
}

/**
 * Submits a controlled review decision or supervisor approval for an investigative dossier.
 */
export async function submitDossierReview(
  reviewer: OfficerProfile,
  params: SubmitReviewParams,
  prismaOverride?: any
): Promise<{
  success: boolean;
  statusCode: number;
  dossier?: any;
  error?: string;
}> {
  const p = (prismaOverride ?? prisma) as any;

  // 1. Validate reviewer identity & status in DB
  const dbReviewer = await p.officer.findUnique({
    where: { id: reviewer.id },
    select: { id: true, name: true, badgeNumber: true, role: true, status: true, departmentId: true },
  });

  if (!dbReviewer || dbReviewer.status !== "ACTIVE") {
    return {
      success: false,
      statusCode: 403,
      error: `Review denied: Reviewer account is ${dbReviewer ? dbReviewer.status : "NON_EXISTENT"}. Active account required.`,
    };
  }

  // 2. Fetch target dossier
  const dossier = await p.investigativeDossier.findUnique({
    where: { id: params.dossierId },
    include: { case: true },
  });

  if (!dossier) {
    return {
      success: false,
      statusCode: 404,
      error: `Investigative dossier not found: ${params.dossierId}`,
    };
  }

  // 3. Finalized dossiers cannot be modified
  if (dossier.status === "FINALIZED" && params.toStatus !== "SUPERSEDED") {
    return {
      success: false,
      statusCode: 400,
      error: "Modification rejected: Finalized dossiers cannot be edited or transitioned except to SUPERSEDED by newer versions.",
    };
  }

  // 4. Validate transition
  const transCheck = validateDossierTransition(dossier.status, params.toStatus);
  if (!transCheck.valid) {
    return {
      success: false,
      statusCode: 400,
      error: transCheck.reason,
    };
  }

  // 5. Mandatory rationale validation
  if (!params.rationale || params.rationale.trim().length < 5) {
    return {
      success: false,
      statusCode: 400,
      error: "Review submission requires a detailed investigative rationale (minimum 5 characters).",
    };
  }

  // 6. Supervisor Approval Constraints
  if (params.toStatus === "APPROVED") {
    // A. Must possess supervisor role
    if (dbReviewer.role !== "SUPERVISOR" && dbReviewer.role !== "ADMIN") {
      return {
        success: false,
        statusCode: 403,
        error: `Approval denied: Officer role ${dbReviewer.role} lacks supervisor approval authority. Only SUPERVISOR or ADMIN can approve dossiers.`,
      };
    }

    // B. Separation of Duties: Generator cannot self-approve their own dossier
    if (dossier.generatedById === dbReviewer.id && dbReviewer.role !== "ADMIN") {
      return {
        success: false,
        statusCode: 403,
        error: "Approval denied: Separation of duties violation. An investigator cannot approve their own generated dossier.",
      };
    }
  }

  // 7. Execute atomic update
  const updated = await p.$transaction(async (tx: any) => {
    const updateData: any = {
      status: params.toStatus,
      updatedAt: new Date(),
    };

    if (params.toStatus === "APPROVED") {
      updateData.approvedById = dbReviewer.id;
      updateData.approvedByName = dbReviewer.name;
      updateData.approvedByBadge = dbReviewer.badgeNumber;
      updateData.approvedAt = new Date();
      updateData.approvalBoundHash = dossier.contentHash; // Anti-tamper binding
    }

    if (params.toStatus === "FINALIZED") {
      // Must verify that prior approval bound hash matches current contentHash
      if (dossier.approvalBoundHash && dossier.approvalBoundHash !== dossier.contentHash) {
        throw new Error("Finalization blocked: Dossier content has changed since supervisor approval. Approval is invalidated.");
      }
      updateData.finalizedAt = new Date();
    }

    const updatedDossier = await tx.investigativeDossier.update({
      where: { id: dossier.id },
      data: updateData,
    });

    // Record in immutable review ledger
    await tx.dossierReview.create({
      data: {
        dossierId: dossier.id,
        fromStatus: dossier.status,
        toStatus: params.toStatus,
        reviewerId: dbReviewer.id,
        reviewerName: dbReviewer.name,
        reviewerBadge: dbReviewer.badgeNumber,
        reviewerRole: dbReviewer.role,
        decision: params.decision,
        rationale: params.rationale.trim(),
        contentHashBound: dossier.contentHash,
      },
    });

    return updatedDossier;
  });

  return {
    success: true,
    statusCode: 200,
    dossier: updated,
  };
}

/**
 * Validates that an approved dossier has not had its content altered.
 */
export function verifyApprovalIntegrity(dossier: any): { valid: boolean; reason?: string } {
  if (dossier.status !== "APPROVED" && dossier.status !== "FINALIZED") {
    return { valid: true };
  }
  if (!dossier.approvalBoundHash) {
    return { valid: false, reason: "Dossier is marked approved but lacks approvalBoundHash." };
  }
  if (dossier.approvalBoundHash !== dossier.contentHash) {
    return {
      valid: false,
      reason: `Approval invalidated: approvalBoundHash (${dossier.approvalBoundHash.slice(0, 12)}...) differs from contentHash (${dossier.contentHash.slice(0, 12)}...).`,
    };
  }
  return { valid: true };
}
