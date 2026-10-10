// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/legal/review/route.ts
// Review workflow for statutory legal mappings (SUGGESTED, REVIEWED, APPROVED, REJECTED)
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
    const { mappingId, sectionCode, status, reviewerName, reviewerNotes, rationale } = body;

    if (!status || (!mappingId && !sectionCode)) {
      return Response.json(
        { error: "Missing required fields: status and (mappingId or sectionCode)" },
        { status: 400 }
      );
    }

    const validStatuses = ["SUGGESTED", "REVIEWED", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });
    if (!caseRecord) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const p = prisma as any;
    let updated;
    if (mappingId) {
      updated = await p.caseLegalMapping.update({
        where: { id: mappingId },
        data: {
          status,
          reviewerName: reviewerName || "ACP Vikram Singh (Badge #DL-002)",
          reviewedAt: new Date(),
          reviewerNotes: reviewerNotes !== undefined ? reviewerNotes : undefined,
          rationale: rationale !== undefined ? rationale : undefined,
        },
      });
    } else {
      updated = await p.caseLegalMapping.update({
        where: {
          caseId_sectionCode: {
            caseId: caseRecord.id,
            sectionCode,
          },
        },
        data: {
          status,
          reviewerName: reviewerName || "ACP Vikram Singh (Badge #DL-002)",
          reviewedAt: new Date(),
          reviewerNotes: reviewerNotes !== undefined ? reviewerNotes : undefined,
          rationale: rationale !== undefined ? rationale : undefined,
        },
      });
    }

    return Response.json({ success: true, updated }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/cases/[caseId]/legal/review] Error:", err);
    return Response.json(
      { error: "Failed to record legal review decision", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
