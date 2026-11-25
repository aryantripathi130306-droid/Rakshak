// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/assignment/[assignmentId]/route.ts
// Rakshak v3.0 — Dedicated Case Assignment Revocation Endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { revokeCaseAssignment } from "@/lib/caseAssignment";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; assignmentId: string }> }
) {
  const { caseId, assignmentId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to revoke assignments." },
        { status: 401 }
      );
    }

    if (auth.officer.status !== "ACTIVE") {
      return Response.json(
        { error: `Account status is ${auth.officer.status}. Suspended officers cannot revoke assignments.` },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const result = await revokeCaseAssignment(
      auth.officer,
      caseId,
      assignmentId,
      body.reason
    );

    if (!result.success) {
      return Response.json(
        { error: result.error || "Failed to revoke assignment." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "REVOKE_CASE_ASSIGNMENT",
      module: "Cases",
      targetType: "Case",
      targetId: caseId,
      details: `Revoked assignment ${assignmentId} on case ${caseId}. Reason: ${body.reason || "Operational revocation"}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, message: "Assignment revoked successfully." }, { status: 200 });
  } catch (err: any) {
    console.error(`[DELETE /api/cases/${caseId}/assignment/${assignmentId}] Error:`, err);
    return Response.json(
      { error: "Assignment revocation failed.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
