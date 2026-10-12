// ─────────────────────────────────────────────────────────────────────────────
// app/api/feedback/[id]/route.ts
// GET & PATCH /api/feedback/:id — Single Feedback Inspection & Status Workflow
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

const UpdateFeedbackSchema = z.object({
  status: z.enum(["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  assignedReviewer: z.string().max(100).optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const p = prisma as any;
    const item = await p.pilotFeedback.findFirst({
      where: { OR: [{ id }, { feedbackNumber: id }] },
    });

    if (!item) {
      return Response.json({ error: "Feedback item not found" }, { status: 404 });
    }

    return Response.json({ item });
  } catch (err: any) {
    console.error("[GET /api/feedback/[id]] Error:", err);
    return Response.json({ error: err.message || "Failed to fetch item" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    // Role gate: Only ADMIN or INVESTIGATOR can triage, reassign, or resolve items
    if (auth.officer.role !== "ADMIN" && auth.officer.role !== "INVESTIGATOR") {
      return Response.json(
        { error: "Forbidden: Only Admin or Investigator roles may update defect status or assignments" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const p = prisma as any;
    const existing = await p.pilotFeedback.findFirst({
      where: { OR: [{ id }, { feedbackNumber: id }] },
    });

    if (!existing) {
      return Response.json({ error: "Feedback item not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const updatePayload: any = {};
    if (data.status) updatePayload.status = data.status;
    if (data.assignedReviewer !== undefined) updatePayload.assignedReviewer = data.assignedReviewer;
    if (data.resolutionNotes !== undefined) updatePayload.resolutionNotes = data.resolutionNotes;

    const updated = await p.pilotFeedback.update({
      where: { id: existing.id },
      data: updatePayload,
    });

    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "FEEDBACK_STATUS_UPDATED",
      module: "PILOT_OPERATIONS",
      targetType: "PILOT_FEEDBACK",
      targetId: existing.id,
      details: `Pilot feedback ${existing.feedbackNumber} updated: Status ${existing.status} -> ${updated.status} by ${auth.officer.name}`,
      result: "SUCCESS",
      metadata: {
        feedbackNumber: existing.feedbackNumber,
        oldStatus: existing.status,
        newStatus: updated.status,
        assignedReviewer: updated.assignedReviewer,
      },
    });

    return Response.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("[PATCH /api/feedback/[id]] Error:", err);
    return Response.json({ error: err.message || "Failed to update item" }, { status: 500 });
  }
}
