// ─────────────────────────────────────────────────────────────────────────────
// lib/entityReview.ts
// Rakshak v3.0 — Phase 37 Controlled Human Review & Audit Trail for Entity Links
//
// Implements:
// 1. Explicit review state transitions: CANDIDATE, UNDER_REVIEW, CONFIRMED, REJECTED, REVOKED.
// 2. Role authorization verification (investigators, analysts, supervisors only).
// 3. Mandatory rationale validation (minimum 5 characters).
// 4. Optimistic concurrency control (version trapping -> HTTP 409).
// 5. Immutable review history preservation (EntityLinkReview).
// 6. Source-record dispute & evidence-incident invalidation hooks.
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from "@prisma/client";
import type { OfficerProfile } from "./accessControl.ts";
import { type ReviewStatus } from "./entityResolution.ts";

export const PERMITTED_REVIEW_ROLES = new Set([
  "INVESTIGATOR",
  "SUPERVISOR",
  "ANALYST",
  "ADMIN",
]);

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Validates whether a state transition is permitted by the state machine.
 */
export function validateStateTransition(
  fromStatus: string,
  toStatus: string
): TransitionValidationResult {
  const f = fromStatus.toUpperCase();
  const t = toStatus.toUpperCase();

  if (f === t) {
    return { valid: false, error: `Link is already in state '${f}'.`, statusCode: 400 };
  }

  // Allowed transitions
  const allowedTransitions: Record<string, string[]> = {
    CANDIDATE: ["UNDER_REVIEW", "CONFIRMED", "REJECTED"],
    UNDER_REVIEW: ["CONFIRMED", "REJECTED", "CANDIDATE"],
    CONFIRMED: ["REVOKED", "UNDER_REVIEW"],
    REJECTED: ["UNDER_REVIEW"], // Can reopen for review if new evidence arrives
    REVOKED: ["UNDER_REVIEW"],  // Can re-examine if dispute resolved
  };

  const allowedNext = allowedTransitions[f] || [];
  if (!allowedNext.includes(t)) {
    return {
      valid: false,
      error: `Invalid state transition: Cannot transition from '${f}' to '${t}'.`,
      statusCode: 400,
    };
  }

  return { valid: true };
}

/**
 * Validates whether an officer is authorized to perform candidate link reviews.
 */
export function validateReviewerAuthority(officer: OfficerProfile): TransitionValidationResult {
  if (!officer || officer.status !== "ACTIVE") {
    return {
      valid: false,
      error: `Access Denied: Officer account is ${officer?.status || "INACTIVE"}.`,
      statusCode: 403,
    };
  }

  const role = (officer.role || "").toUpperCase();
  if (!PERMITTED_REVIEW_ROLES.has(role)) {
    return {
      valid: false,
      error: `Access Denied: Role '${role}' lacks authority to confirm, reject, or revoke entity links.`,
      statusCode: 403,
    };
  }

  return { valid: true };
}

export interface SubmitReviewInput {
  linkId: string;
  toStatus: ReviewStatus;
  rationale: string;
  expectedVersion?: number;
  officer: OfficerProfile;
}

export interface SubmitReviewResult {
  success: boolean;
  link?: any;
  review?: any;
  error?: string;
  statusCode?: number;
}

/**
 * Executes a controlled review status transition on an EntityLink with:
 * - Role permission checks
 * - Rationale requirements
 * - Optimistic concurrency trapping
 * - Immutable review log persistence
 */
export async function submitEntityLinkReview(
  prisma: any,
  input: SubmitReviewInput
): Promise<SubmitReviewResult> {
  const { linkId, toStatus, rationale, expectedVersion, officer } = input;

  // 1. Authorize reviewer
  const authCheck = validateReviewerAuthority(officer);
  if (!authCheck.valid) {
    return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
  }

  // 2. Validate rationale
  if (!rationale || typeof rationale !== "string" || rationale.trim().length < 5) {
    return {
      success: false,
      error: "Validation failed: A detailed review rationale (at least 5 characters) is required.",
      statusCode: 400,
    };
  }

  const cleanRationale = rationale.trim();

  // 3. Load target link
  const link = await prisma.entityLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    return { success: false, error: `Entity link '${linkId}' not found.`, statusCode: 404 };
  }

  // 4. Concurrency check
  if (expectedVersion !== undefined && link.version !== expectedVersion) {
    return {
      success: false,
      error: `Conflict: Entity link was modified by another reviewer (version ${link.version} != expected ${expectedVersion}). Please refresh and review current state.`,
      statusCode: 409,
    };
  }

  // 5. State machine transition check
  const transitionCheck = validateStateTransition(link.status, toStatus);
  if (!transitionCheck.valid) {
    return { success: false, error: transitionCheck.error, statusCode: transitionCheck.statusCode };
  }

  const fromStatus = link.status;
  const newVersion = link.version + 1;
  const now = new Date();

  // 6. Execute atomic update and review insertion
  try {
    const [updatedLink, reviewRecord] = await prisma.$transaction([
      prisma.entityLink.update({
        where: { id: linkId, version: link.version },
        data: {
          status: toStatus,
          reviewedBy: `${officer.name} (${officer.badgeNumber})`,
          reviewedAt: now,
          reviewRationale: cleanRationale,
          confidenceCategory: toStatus === "CONFIRMED" ? "ANALYST_CONFIRMED" : link.confidenceCategory,
          version: newVersion,
          updatedAt: now,
        },
      }),
      prisma.entityLinkReview.create({
        data: {
          linkId,
          fromStatus,
          toStatus,
          reviewerId: officer.id,
          reviewerName: officer.name,
          reviewerBadge: officer.badgeNumber || null,
          reviewerRole: officer.role,
          rationale: cleanRationale,
          reviewedAt: now,
        },
      }),
    ]);

    return {
      success: true,
      link: updatedLink,
      review: reviewRecord,
    };
  } catch (err: any) {
    if (err?.code === "P2025") {
      return {
        success: false,
        error: "Conflict: Concurrent modification detected during transaction commit.",
        statusCode: 409,
      };
    }
    throw err;
  }
}

/**
 * Invalidation hook: When a source ExtractedFact is disputed or corrected,
 * dependent candidate links are flagged or reverted to UNDER_REVIEW.
 */
export async function invalidateEntityLinksForFact(
  prisma: any,
  factId: string,
  reason: string,
  actor: OfficerProfile
): Promise<number> {
  const links = await prisma.entityLink.findMany({
    where: {
      OR: [{ sourceEntityId: factId }, { targetEntityId: factId }],
      status: { in: ["CANDIDATE", "CONFIRMED"] },
    },
  });

  let count = 0;
  for (const link of links) {
    await submitEntityLinkReview(prisma, {
      linkId: link.id,
      toStatus: "UNDER_REVIEW",
      rationale: `Automated status reversion: Supporting extracted fact '${factId}' was altered or disputed: ${reason}`,
      expectedVersion: link.version,
      officer: actor,
    });
    count++;
  }

  return count;
}

/**
 * Invalidation hook: When an evidence integrity incident is detected (e.g. quarantine, tampering),
 * dependent links receive an explicit limitation warning.
 */
export async function flagEntityLinksForEvidenceIncident(
  prisma: any,
  evidenceId: string,
  incidentDetails: string
): Promise<number> {
  const result = await prisma.entityLink.updateMany({
    where: {
      OR: [{ sourceEvidenceId: evidenceId }, { targetEvidenceId: evidenceId }],
    },
    data: {
      limitations: `INTEGRITY ALERT: Associated evidence '${evidenceId}' has active integrity or quarantine warnings: ${incidentDetails}`,
      status: "UNDER_REVIEW",
    },
  });

  return result.count;
}
