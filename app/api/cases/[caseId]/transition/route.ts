// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/transition/route.ts
// Rakshak v3.0 — Dedicated Case State Transition & Supervisor Approval Endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import {
  normalizeCaseStatus,
  validateCaseTransition,
  executeCaseTransition,
  CaseStatus,
} from "@/lib/caseLifecycle";

export const runtime = "nodejs";

async function resolveCase(caseId: string) {
  return prisma.case.findFirst({
    where: {
      OR: [{ id: caseId }, { caseNumber: caseId }],
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to execute case transitions." },
        { status: 401 }
      );
    }

    if (auth.officer.status !== "ACTIVE") {
      return Response.json(
        { error: `Account status is ${auth.officer.status}. Suspended officers cannot execute transitions.` },
        { status: 403 }
      );
    }

    const existing = await resolveCase(caseId);
    if (!existing) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.toStatus) {
      return Response.json({ error: "Destination status 'toStatus' is required." }, { status: 400 });
    }

    const validation = await validateCaseTransition(
      auth.officer,
      existing,
      body.toStatus,
      body.reason
    );

    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: validation.statusCode }
      );
    }

    const fromStatus = normalizeCaseStatus(existing.status) as CaseStatus;
    const toStatus = normalizeCaseStatus(body.toStatus) as CaseStatus;

    const result = await executeCaseTransition(
      auth.officer,
      existing.id,
      fromStatus,
      toStatus,
      body.reason,
      body.approvalGrantId || body.approvalId || body.approvalToken
    );

    if (!result.success) {
      const isConflict = result.error?.includes("conflict");
      const isForbidden =
        result.error?.includes("Unauthorized") ||
        result.error?.includes("denied") ||
        result.error?.includes("Separation") ||
        result.error?.includes("Replay") ||
        result.error?.includes("revoked") ||
        result.error?.includes("expired");
      const status = result.statusCode || (isConflict ? 409 : isForbidden ? 403 : 500);

      return Response.json(
        { error: result.error || "Failed to execute case transition." },
        { status }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "TRANSITION_CASE_STATUS",
      module: "Cases",
      targetType: "Case",
      targetId: existing.id,
      details: `Transitioned case ${existing.caseNumber} from ${fromStatus} to ${toStatus}. Reason: ${body.reason || "Operational transition"}. Approver: ${result.historyRecord?.approvedBy || auth.officer.name}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json(
      {
        success: true,
        case: result.caseRecord,
        statusHistoryEntry: result.historyRecord,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[POST /api/cases/${caseId}/transition] Error:`, err);
    return Response.json(
      { error: "Case transition failed.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
