// ─────────────────────────────────────────────────────────────────────────────
// lib/factReview.ts
// RAKSHAK v3.0 — Phase 39: Human Validation, Correction & Downstream Gates
//
// Governs human review of extracted candidate facts.
// Enforces state-machine transitions, role authorizations, mandatory rationales,
// historical audit immutability, and safe downstream intelligence gates.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import prisma from "./prisma.ts";
import { canAccessDepartmentAsync } from "./accessControl.ts";

export type FactReviewState = "PENDING_REVIEW" | "ACCEPTED" | "CORRECTED" | "REJECTED" | "SUPERSEDED";
export type FactReviewDecision = "ACCEPT" | "CORRECT" | "REJECT" | "SUPERSEDE" | "REOPEN";

export interface FactReviewInput {
  reviewerId: string;
  reviewerName: string;
  reviewerBadge?: string;
  reviewerRole: string;
  reviewerDeptId: string;
  isReviewerSuspended?: boolean;
  decision: FactReviewDecision;
  correctedValue?: string;
  rationale: string;
}

export interface FactReviewResult {
  success: boolean;
  fact: any;
  historyRecord: any;
}

const VALID_TRANSITIONS: Record<FactReviewState, FactReviewState[]> = {
  PENDING_REVIEW: ["ACCEPTED", "CORRECTED", "REJECTED"],
  ACCEPTED: ["CORRECTED", "REJECTED", "SUPERSEDED"],
  CORRECTED: ["ACCEPTED", "REJECTED", "SUPERSEDED"],
  REJECTED: ["PENDING_REVIEW"],
  SUPERSEDED: [],
};

/**
 * Validates state transition according to the formal state-machine matrix.
 */
export function validateFactTransition(from: FactReviewState, to: FactReviewState): void {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid state transition: Cannot transition candidate fact from '${from}' to '${to}'`);
  }
}

/**
 * Checks whether an extracted fact is authorized to feed confirmed cross-case intelligence
 * or confirmed conclusions in dossiers.
 */
export function canFactFeedConfirmedIntelligence(fact: {
  reviewStatus: string;
  limitations?: string | null;
  isIntegrityVerified?: boolean;
}): { allowed: boolean; reason?: string } {
  if (fact.reviewStatus !== "ACCEPTED" && fact.reviewStatus !== "CORRECTED") {
    return {
      allowed: false,
      reason: `Fact review status is '${fact.reviewStatus}'. Only human-reviewed ACCEPTED or CORRECTED facts can feed confirmed intelligence.`,
    };
  }

  if (fact.limitations?.includes("INTEGRITY ALERT") || fact.isIntegrityVerified === false) {
    return {
      allowed: false,
      reason: "Associated source evidence has an active integrity alert or hash mismatch.",
    };
  }

  return { allowed: true };
}

/**
 * Submit an authorized human review decision for an extracted candidate fact.
 */
export async function submitFactReviewAsync(
  factId: string,
  input: FactReviewInput,
  prismaClient: any = prisma
): Promise<FactReviewResult> {
  const p = prismaClient as any;

  // 1. Authenticated Reviewer Validation
  if (!input.reviewerId) {
    throw new Error("Authentication required: Missing reviewer identity");
  }

  if (input.isReviewerSuspended) {
    throw new Error("Access denied: Reviewer account is SUSPENDED. Active account required.");
  }

  // 2. Role Check: Only INVESTIGATOR, SUPERVISOR, or ADMIN can review facts
  const authorizedRoles = ["INVESTIGATOR", "SUPERVISOR", "ADMIN"];
  if (!authorizedRoles.includes(input.reviewerRole.toUpperCase())) {
    throw new Error(
      `Access denied: Role '${input.reviewerRole}' lacks authority to validate or correct extracted facts. Only INVESTIGATOR, SUPERVISOR, or ADMIN authorized.`
    );
  }

  // 3. Rationale Validation (Mandatory >= 5 chars)
  if (!input.rationale || input.rationale.trim().length < 5) {
    throw new Error("Validation failed: A substantive review rationale (minimum 5 characters) is required.");
  }

  // 4. Fetch Target Fact
  const fact = await p.extractedFact.findUnique({
    where: { id: factId },
    include: {
      evidence: {
        include: {
          case: true,
        },
      },
    },
  });

  if (!fact) {
    throw new Error(`Extracted fact not found: ${factId}`);
  }

  const caseObj = fact.evidence?.case;
  if (!caseObj) {
    throw new Error(`Associated case record missing for fact ${factId}`);
  }

  // 5. Department Tenancy & Access Grant Check
  const reviewerProfile = {
    id: input.reviewerId,
    badgeNumber: input.reviewerBadge || "DL-001",
    name: input.reviewerName,
    email: "reviewer@domain.com",
    designation: "Officer",
    role: (input.reviewerRole as any) || "INVESTIGATOR",
    jurisdiction: caseObj.jurisdiction || "Delhi NCR",
    unit: null,
    status: input.isReviewerSuspended ? "SUSPENDED" : "ACTIVE",
    departmentId: input.reviewerDeptId,
  };

  const hasAccess = await canAccessDepartmentAsync(
    reviewerProfile,
    caseObj.jurisdiction,
    caseObj.departmentId,
    { targetCaseId: caseObj.id },
    p
  );

  if (!hasAccess) {
    throw new Error(
      `Access denied: Target evidence belongs to department '${caseObj.departmentId}' without an active access grant.`
    );
  }

  // 6. Map Decision to Target State
  const currentStatus = (fact.reviewStatus || "PENDING_REVIEW") as FactReviewState;
  let targetStatus: FactReviewState;

  switch (input.decision) {
    case "ACCEPT":
      targetStatus = "ACCEPTED";
      break;
    case "CORRECT":
      targetStatus = "CORRECTED";
      break;
    case "REJECT":
      targetStatus = "REJECTED";
      break;
    case "SUPERSEDE":
      targetStatus = "SUPERSEDED";
      break;
    case "REOPEN":
      targetStatus = "PENDING_REVIEW";
      break;
    default:
      throw new Error(`Unsupported review decision: '${input.decision}'`);
  }

  // 7. Validate State Transition
  validateFactTransition(currentStatus, targetStatus);

  // 8. Handle Correction Logic
  let acceptedVal = fact.acceptedValue;
  let correctedVal: string | null = null;
  let normalizedVal = fact.normalizedValue;
  let origVal = fact.originalValue || fact.rawValue;

  if (targetStatus === "CORRECTED") {
    if (!input.correctedValue || input.correctedValue.trim().length === 0) {
      throw new Error("Validation failed: Correction decision requires a non-empty 'correctedValue'.");
    }
    correctedVal = input.correctedValue.trim();
    acceptedVal = correctedVal;
    normalizedVal = correctedVal;
  } else if (targetStatus === "ACCEPTED") {
    acceptedVal = fact.normalizedValue;
  }

  // 9. Update Fact in Database
  const updatedFact = await p.extractedFact.update({
    where: { id: factId },
    data: {
      reviewStatus: targetStatus,
      verificationStatus: targetStatus === "REJECTED" ? "DISPUTED" : targetStatus === "PENDING_REVIEW" ? "UNVERIFIED" : "VERIFIED",
      acceptedValue: acceptedVal,
      originalValue: origVal,
      normalizedValue: normalizedVal,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewRationale: input.rationale.trim(),
    },
  });

  // 10. Record Attributable Review History (Audit Log)
  const historyRecord = await p.factReviewHistory.create({
    data: {
      id: crypto.randomUUID(),
      factId: fact.id,
      caseId: caseObj.id,
      evidenceId: fact.evidenceId,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      reviewerBadge: input.reviewerBadge || null,
      reviewerRole: input.reviewerRole,
      departmentId: input.reviewerDeptId,
      decision: targetStatus,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      previousValue: fact.normalizedValue,
      correctedValue: correctedVal,
      rationale: input.rationale.trim(),
      timestamp: new Date(),
    },
  });

  return {
    success: true,
    fact: updatedFact,
    historyRecord,
  };
}
