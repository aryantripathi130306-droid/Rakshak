import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateOfficer,
  canAccessCaseAsync,
  hasPermission,
  logAuditEvent,
} from "@/services/authService";
import {
  normalizeCaseStatus,
  validateCaseTransition,
  executeCaseTransition,
  getPermittedTransitions,
  CaseStatus,
} from "@/lib/caseLifecycle";
import {
  validateCaseAssignment,
  executeCaseAssignment,
  getCaseAssignments,
} from "@/lib/caseAssignment";

export const runtime = "nodejs";

// ─── Resolve case by id OR caseNumber ────────────────────────────────────────
async function resolveCase(caseId: string) {
  return prisma.case.findFirst({
    where: {
      OR: [{ id: caseId }, { caseNumber: caseId }],
    },
    include: {
      _count: {
        select: { evidence: true, timeline: true, entities: true, clusterMemberships: true },
      },
    },
  });
}

function normalizeType(t?: string): "Task_Scam" | "Digital_Arrest" | "Investment_Fraud" | "KYC_Freeze" | "Romance_Scam" | undefined {
  if (!t) return undefined;
  const s = t.replace(/\s+/g, "_");
  if (s.toLowerCase().includes("digital")) return "Digital_Arrest";
  if (s.toLowerCase().includes("investment")) return "Investment_Fraud";
  if (s.toLowerCase().includes("kyc")) return "KYC_Freeze";
  if (s.toLowerCase().includes("romance")) return "Romance_Scam";
  return "Task_Scam";
}

// ─── GET /api/cases/:caseId ───────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to view case details." },
        { status: 401 }
      );
    }

    const kase = await resolveCase(caseId);
    if (!kase) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    // Granular resource-aware case authorization with fresh DB grant validation
    const accessCheck = await canAccessCaseAsync(auth.officer, kase, "read:content");
    if (!accessCheck.allowed) {
      return Response.json(
        { error: accessCheck.reason || "Access denied: Unauthorized case inspection." },
        { status: 403 }
      );
    }

    // Fetch assignment and status history
    const p = prisma as any;
    let assignmentHistory: any[] = [];
    let statusHistory: any[] = [];
    let assignmentsSummary = { primary: null as any, collaborators: [] as any[] };

    try {
      if (p.caseAssignmentHistory) {
        const assignData = await getCaseAssignments(kase.id);
        assignmentsSummary = { primary: assignData.primary, collaborators: assignData.collaborators };
        assignmentHistory = assignData.history;
      }
      if (p.caseStatusHistory) {
        statusHistory = await p.caseStatusHistory.findMany({
          where: { caseId: kase.id },
          orderBy: { changedAt: "desc" },
        });
      }
    } catch (_) {}

    const permittedTransitions = getPermittedTransitions(kase.status, auth.officer.role);

    // Attach alias fields for UI compatibility
    const enriched = {
      ...kase,
      totalLossINR: kase.amountDefrauded ?? 0,
      fraudAmountINR: kase.amountDefrauded ?? 0,
      investigatingOfficer: kase.officerName ?? "Unassigned",
      currentAssignment: assignmentsSummary,
      assignmentHistory,
      statusHistory,
      permittedTransitions,
    };

    return Response.json({ case: enriched }, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/cases/${caseId}] Error:`, err);
    return Response.json({ error: "Failed to fetch case." }, { status: 500 });
  }
}

// ─── PATCH /api/cases/:caseId ──────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to update a case." },
        { status: 401 }
      );
    }

    if (auth.officer.status !== "ACTIVE") {
      return Response.json(
        { error: `Account status is ${auth.officer.status}. Suspended officers cannot modify cases.` },
        { status: 403 }
      );
    }

    const existing = await resolveCase(caseId);
    if (!existing) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // 1. Handle Status Transition if requested
    if (body.status !== undefined) {
      const validation = await validateCaseTransition(
        auth.officer,
        existing,
        body.status,
        body.reason
      );

      if (!validation.valid) {
        return Response.json(
          { error: validation.error },
          { status: validation.statusCode }
        );
      }

      const targetStatus = normalizeCaseStatus(body.status) as CaseStatus;
      const transitionResult = await executeCaseTransition(
        auth.officer,
        existing.id,
        normalizeCaseStatus(existing.status) as CaseStatus,
        targetStatus,
        body.reason,
        body.approvedBy
      );

      if (!transitionResult.success) {
        return Response.json(
          { error: transitionResult.error || "Failed to execute case transition." },
          { status: transitionResult.error?.includes("conflict") ? 409 : 500 }
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
        details: `Transitioned case ${existing.caseNumber} from ${existing.status} to ${targetStatus}. Reason: ${body.reason || "Standard operational transition"}`,
        result: "SUCCESS",
        ipAddress,
      });

      // If only status was being updated, return updated case
      if (Object.keys(body).filter((k) => k !== "status" && k !== "reason" && k !== "approvedBy").length === 0) {
        const enriched = {
          ...transitionResult.caseRecord,
          totalLossINR: transitionResult.caseRecord.amountDefrauded ?? 0,
          fraudAmountINR: transitionResult.caseRecord.amountDefrauded ?? 0,
          investigatingOfficer: transitionResult.caseRecord.officerName ?? "Unassigned",
          statusHistoryEntry: transitionResult.historyRecord,
        };
        return Response.json({ case: enriched }, { status: 200 });
      }
    }

    // 2. Handle Officer Assignment if requested
    if (body.targetOfficerId || body.officerId) {
      const targetId = body.targetOfficerId || body.officerId;
      const assignType = body.assignmentType || "PRIMARY";

      const assignValidation = await validateCaseAssignment(
        auth.officer,
        existing,
        targetId,
        assignType,
        body.reason
      );

      if (!assignValidation.valid) {
        return Response.json(
          { error: assignValidation.error },
          { status: assignValidation.statusCode }
        );
      }

      const assignResult = await executeCaseAssignment(
        auth.officer,
        existing.id,
        assignValidation.targetOfficer,
        assignType,
        body.reason
      );

      if (!assignResult.success) {
        return Response.json(
          { error: assignResult.error || "Failed to assign officer to case." },
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
        details: `Assigned officer ${assignValidation.targetOfficer.name} (${assignValidation.targetOfficer.badgeNumber}) as ${assignType} on case ${existing.caseNumber}`,
        result: "SUCCESS",
        ipAddress,
      });

      if (Object.keys(body).filter((k) => k !== "targetOfficerId" && k !== "officerId" && k !== "assignmentType" && k !== "reason").length === 0) {
        const enriched = {
          ...assignResult.caseRecord,
          totalLossINR: assignResult.caseRecord.amountDefrauded ?? 0,
          fraudAmountINR: assignResult.caseRecord.amountDefrauded ?? 0,
          investigatingOfficer: assignResult.caseRecord.officerName ?? "Unassigned",
          assignmentEntry: assignResult.assignmentRecord,
        };
        return Response.json({ case: enriched }, { status: 200 });
      }
    }

    // 3. Handle General Field Updates
    const accessCheck = await canAccessCaseAsync(auth.officer, existing, "write");
    if (!accessCheck.allowed) {
      return Response.json(
        { error: accessCheck.reason || "Access denied: Unauthorized case modification." },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (body.incidentType !== undefined) {
      updateData.incidentType = normalizeType(body.incidentType);
    }
    if (body.complainantName !== undefined) {
      updateData.complainantName = body.complainantName;
    }
    if (body.jurisdiction !== undefined) {
      updateData.jurisdiction = body.jurisdiction;
    }
    if (body.amountDefrauded !== undefined || body.totalLossINR !== undefined || body.fraudAmountINR !== undefined) {
      const amt = body.amountDefrauded ?? body.totalLossINR ?? body.fraudAmountINR;
      updateData.amountDefrauded = typeof amt === 'number' ? Math.round(amt) : null;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.firNumber !== undefined) {
      updateData.firNumber = body.firNumber;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: updateData,
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "UPDATE_CASE",
      module: "Cases",
      targetType: "Case",
      targetId: existing.id,
      details: `Updated case fields on ${existing.caseNumber}`,
      result: "SUCCESS",
      ipAddress,
    });

    const enriched = {
      ...updated,
      totalLossINR: updated.amountDefrauded ?? 0,
      fraudAmountINR: updated.amountDefrauded ?? 0,
      investigatingOfficer: updated.officerName ?? "Unassigned",
    };

    return Response.json({ case: enriched }, { status: 200 });
  } catch (err) {
    console.error(`[PATCH /api/cases/${caseId}] Error:`, err);
    return Response.json(
      { error: "Case update failed.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
