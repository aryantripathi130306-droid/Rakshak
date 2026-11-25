// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/approval/route.ts
// Rakshak v3.0 — Dedicated Supervisor Approval Issuance Endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { createSupervisorApprovalAsync } from "@/lib/supervisorApproval";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to grant workflow approval." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!body.fromStatus || !body.toStatus) {
      return Response.json(
        { error: "Parameters 'fromStatus' and 'toStatus' are required." },
        { status: 400 }
      );
    }

    if (!body.requesterOfficerId) {
      return Response.json(
        { error: "Parameter 'requesterOfficerId' is required." },
        { status: 400 }
      );
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return Response.json(
        { error: "A justification reason is required for supervisor approval." },
        { status: 400 }
      );
    }

    const result = await createSupervisorApprovalAsync(
      auth.officer,
      {
        caseId,
        fromStatus: body.fromStatus,
        toStatus: body.toStatus,
        requesterOfficerId: body.requesterOfficerId,
        reason: body.reason,
        validHours: body.validHours || 24,
      },
      prisma
    );

    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "ISSUE_WORKFLOW_APPROVAL",
      module: "Cases",
      targetType: "Case",
      targetId: caseId,
      details: `Issued workflow approval for transition from ${body.fromStatus} to ${body.toStatus}. Requester: ${body.requesterOfficerId}. Reason: ${body.reason}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json(
      {
        success: true,
        approvalId: result.approvalId,
        message: "Supervisor workflow approval issued successfully.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error(`[POST /api/cases/${caseId}/approval] Error:`, err);
    return Response.json(
      { error: "Failed to issue supervisor approval.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
