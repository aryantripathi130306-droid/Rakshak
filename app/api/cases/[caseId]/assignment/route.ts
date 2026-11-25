// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/assignment/route.ts
// Rakshak v3.0 — Dedicated Case Assignment & Reassignment Endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, canAccessCaseAsync, logAuditEvent } from "@/services/authService";
import {
  validateCaseAssignment,
  executeCaseAssignment,
  getCaseAssignments,
  AssignmentType,
} from "@/lib/caseAssignment";

export const runtime = "nodejs";

async function resolveCase(caseId: string) {
  return prisma.case.findFirst({
    where: {
      OR: [{ id: caseId }, { caseNumber: caseId }],
    },
  });
}

// ─── GET /api/cases/:caseId/assignment ────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to view case assignments." },
        { status: 401 }
      );
    }

    const existing = await resolveCase(caseId);
    if (!existing) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    const accessCheck = await canAccessCaseAsync(auth.officer, existing, "read:content");
    if (!accessCheck.allowed) {
      return Response.json(
        { error: accessCheck.reason || "Access denied: Unauthorized case assignment query." },
        { status: 403 }
      );
    }

    const assignments = await getCaseAssignments(existing.id);

    return Response.json(
      {
        caseId: existing.id,
        caseNumber: existing.caseNumber,
        ...assignments,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[GET /api/cases/${caseId}/assignment] Error:`, err);
    return Response.json(
      { error: "Failed to fetch case assignments.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

// ─── POST /api/cases/:caseId/assignment ───────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to assign officers." },
        { status: 401 }
      );
    }

    if (auth.officer.status !== "ACTIVE") {
      return Response.json(
        { error: `Account status is ${auth.officer.status}. Suspended officers cannot assign cases.` },
        { status: 403 }
      );
    }

    const existing = await resolveCase(caseId);
    if (!existing) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const targetOfficerId = body.officerId || body.targetOfficerId;
    if (!targetOfficerId) {
      return Response.json({ error: "Target officer ID ('officerId') is required." }, { status: 400 });
    }

    const assignmentType = (body.assignmentType || "PRIMARY") as AssignmentType;
    if (!["PRIMARY", "COLLABORATOR", "REASSIGNMENT"].includes(assignmentType)) {
      return Response.json(
        { error: `Invalid assignmentType "${assignmentType}". Must be PRIMARY, COLLABORATOR, or REASSIGNMENT.` },
        { status: 400 }
      );
    }

    const validation = await validateCaseAssignment(
      auth.officer,
      existing,
      targetOfficerId,
      assignmentType,
      body.reason
    );

    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: validation.statusCode }
      );
    }

    const result = await executeCaseAssignment(
      auth.officer,
      existing.id,
      validation.targetOfficer,
      assignmentType,
      body.reason
    );

    if (!result.success) {
      return Response.json(
        { error: result.error || "Failed to execute officer assignment." },
        { status: 500 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "ASSIGN_CASE_OFFICER",
      module: "Cases",
      targetType: "Case",
      targetId: existing.id,
      details: `Assigned officer ${validation.targetOfficer.name} (${validation.targetOfficer.badgeNumber}) as ${assignmentType} on case ${existing.caseNumber}. Reason: ${body.reason || "Operational assignment"}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json(
      {
        success: true,
        case: result.caseRecord,
        assignment: result.assignmentRecord,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[POST /api/cases/${caseId}/assignment] Error:`, err);
    return Response.json(
      { error: "Officer assignment failed.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
