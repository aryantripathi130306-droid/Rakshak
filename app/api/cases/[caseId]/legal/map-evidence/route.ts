// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/legal/map-evidence/route.ts
// Evidence-to-Statutory Provision mapping endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();
    const { evidenceId, section, relevance, rationale, mappedBy } = body;

    if (!evidenceId || !section) {
      return Response.json(
        { error: "Missing required fields: evidenceId and section" },
        { status: 400 }
      );
    }

    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });
    if (!caseRecord) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    // Verify evidence exists and belongs to case
    const evidence = await prisma.evidence.findFirst({
      where: { id: evidenceId, caseId: caseRecord.id },
    });
    if (!evidence) {
      return Response.json({ error: "Evidence not found in this case" }, { status: 404 });
    }

    const p = prisma as any;
    const existing = await p.evidenceLegalMapping.findFirst({
      where: { caseId: caseRecord.id, evidenceId },
    });

    let mapping;
    if (existing) {
      mapping = await p.evidenceLegalMapping.update({
        where: { id: existing.id },
        data: {
          section,
          relevance: relevance?.toUpperCase() || "HIGH",
          rationale: rationale || `Verified electronic record supporting ${section}`,
          mappedBy: mappedBy || "ACP Vikram Singh (Badge #DL-002)",
        },
      });
    } else {
      mapping = await p.evidenceLegalMapping.create({
        data: {
          caseId: caseRecord.id,
          evidenceId,
          section,
          relevance: relevance?.toUpperCase() || "HIGH",
          rationale: rationale || `Verified electronic record supporting ${section}`,
          status: "VERIFIED",
          mappedBy: mappedBy || "ACP Vikram Singh (Badge #DL-002)",
        },
      });
    }

    return Response.json({ success: true, mapping }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/cases/[caseId]/legal/map-evidence] Error:", err);
    return Response.json(
      { error: "Failed to map evidence to statutory provision", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
