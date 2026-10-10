// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/legal/route.ts
// GET /api/cases/:caseId/legal — retrieve complete Legal Matrix intelligence
// POST /api/cases/:caseId/legal — add or update statutory provision mapping
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getCaseLegalIntelligence } from "@/services/legalService";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    if (!caseId) {
      return Response.json({ error: "Missing caseId" }, { status: 400 });
    }

    const legalData = await getCaseLegalIntelligence(caseId, prisma);

    return Response.json(legalData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Rakshak-Module": "legal-matrix-v3",
      },
    });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/legal] Error:", err);
    return Response.json(
      {
        error: "Failed to resolve legal matrix.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();
    const { act, section, description, relevance, rationale, reviewerName, reviewerNotes } = body;

    if (!section || !act) {
      return Response.json({ error: "Missing required fields: act, section" }, { status: 400 });
    }

    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });
    if (!caseRecord) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const sectionCode = `${act.replace(/[^a-zA-Z0-9]/g, "_")}_${section.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const p = prisma as any;
    const mapping = await p.caseLegalMapping.upsert({
      where: {
        caseId_sectionCode: {
          caseId: caseRecord.id,
          sectionCode,
        },
      },
      update: {
        act,
        section,
        description: description || "Statutory provision",
        relevance: relevance?.toUpperCase() === "SECONDARY" ? "SECONDARY" : "PRIMARY",
        status: "REVIEWED",
        rationale: rationale || null,
        reviewerName: reviewerName || "Investigating Officer",
        reviewedAt: new Date(),
        reviewerNotes: reviewerNotes || null,
      },
      create: {
        caseId: caseRecord.id,
        sectionCode,
        act,
        section,
        description: description || "Statutory provision",
        relevance: relevance?.toUpperCase() === "SECONDARY" ? "SECONDARY" : "PRIMARY",
        status: "REVIEWED",
        rationale: rationale || null,
        reviewerName: reviewerName || "Investigating Officer",
        reviewedAt: new Date(),
        reviewerNotes: reviewerNotes || null,
      },
    });

    return Response.json({ success: true, mapping }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/cases/[caseId]/legal] Error:", err);
    return Response.json(
      { error: "Failed to update legal provision.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const mappingId = searchParams.get("mappingId");
    const sectionCode = searchParams.get("sectionCode");

    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });
    if (!caseRecord) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const p = prisma as any;
    if (mappingId) {
      await p.caseLegalMapping.delete({
        where: { id: mappingId },
      });
    } else if (sectionCode) {
      await p.caseLegalMapping.deleteMany({
        where: { caseId: caseRecord.id, sectionCode },
      });
    } else {
      return Response.json({ error: "Specify mappingId or sectionCode to delete" }, { status: 400 });
    }

    return Response.json({ success: true, message: "Section mapping removed" }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/cases/[caseId]/legal] Error:", err);
    return Response.json(
      { error: "Failed to delete legal mapping.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
