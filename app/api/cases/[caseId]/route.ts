// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/route.ts
// GET  /api/cases/:caseId — get single case detail
// PATCH /api/cases/:caseId — update case fields (partial update)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

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

function normalizeStatus(s?: string): "OPEN" | "UNDER_INQUIRY" | "CHARGESHEETED" | "CLOSED" | undefined {
  if (!s) return undefined;
  const upper = s.toUpperCase().trim();
  if (upper === "UNDER_INVESTIGATION" || upper === "UNDER_INQUIRY") return "UNDER_INQUIRY";
  if (upper === "CHARGESHEET_FILED" || upper === "CHARGESHEETED") return "CHARGESHEETED";
  if (upper === "CLOSED") return "CLOSED";
  return "OPEN";
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
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const kase = await resolveCase(caseId);
    if (!kase) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    // Attach alias fields for UI compatibility
    const enriched = {
      ...kase,
      totalLossINR: kase.amountDefrauded ?? 0,
      fraudAmountINR: kase.amountDefrauded ?? 0,
      investigatingOfficer: kase.officerName ?? "Unassigned",
    };

    return Response.json({ case: enriched }, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/cases/${caseId}] Error:`, err);
    return Response.json({ error: "Failed to fetch case." }, { status: 500 });
  }
}

// ─── PATCH /api/cases/:caseId ─────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const existing = await resolveCase(caseId);
    if (!existing) {
      return Response.json({ error: "Case not found." }, { status: 404 });
    }

    const body = await request.json();
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
    if (body.status !== undefined) {
      updateData.status = normalizeStatus(body.status);
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.firNumber !== undefined) {
      updateData.firNumber = body.firNumber;
    }
    if (body.officerName !== undefined || body.investigatingOfficer !== undefined) {
      updateData.officerName = body.officerName ?? body.investigatingOfficer;
    }
    if (body.officerBadge !== undefined) {
      updateData.officerBadge = body.officerBadge;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: updateData,
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
