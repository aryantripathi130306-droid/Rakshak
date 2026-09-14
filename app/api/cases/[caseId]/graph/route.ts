// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/graph/route.ts
// GET /api/cases/:caseId/graph
//
// Returns the full React-Flow-compatible syndicate graph payload for a case.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { resolveGraphIntelligence } from "@/services/graphService";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    if (!caseId || typeof caseId !== "string") {
      return Response.json({ error: "Missing or invalid caseId" }, { status: 400 });
    }

    // Verify case exists by id OR caseNumber
    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      select: { id: true, caseNumber: true, status: true },
    });
    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    const graphPayload = await resolveGraphIntelligence(caseRecord.id, prisma);

    return Response.json(graphPayload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-NyayaSetu-Pipeline": "graph-resolver-v1",
      },
    });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/graph] Error:", err);
    return Response.json(
      {
        error: "Graph resolution failed.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
