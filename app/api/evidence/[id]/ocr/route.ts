// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/ocr/route.ts
// POST /api/evidence/:id/ocr — Explicit forensic OCR trigger
// GET  /api/evidence/:id/ocr — Fetch OCR processing status & telemetry
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { executeOcrAndEntityExtraction } from "@/services/ocrService";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    let meta: Record<string, any> = {};
    try {
      if (evidence.metadata) meta = JSON.parse(evidence.metadata);
    } catch {
      meta = {};
    }

    const ocr = meta.ocr || {
      status: "NOT_RUN",
      message: "OCR has not been run on this evidence artifact.",
    };

    return Response.json(
      {
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        sourceHash: evidence.sha256Hash,
        ocr,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]/ocr] Error:", err);
    return Response.json(
      { error: "Failed to fetch OCR status", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
      include: {
        case: { select: { id: true, caseNumber: true } },
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    const caseId = (evidence as any).case?.id || evidence.caseId;
    const { ocr, entities } = await executeOcrAndEntityExtraction(evidence.id, caseId);

    // Audit Log Entry for Phase 8/9 audit compliance
    await (prisma as any).auditLog
      .create({
        data: {
          officerName: "Inspector Rajesh Kumar (DL-002)",
          officerBadge: "DL-002",
          action: "OCR_EXTRACTION",
          module: "Evidence",
          targetType: "Evidence",
          targetId: evidence.id,
          details: `Forensic OCR processed evidence ${evidence.fileName} (${ocr.status}, ${ocr.charCount} chars, ${entities.length} entities)`,
          result: ocr.status === "SUCCESS" ? "SUCCESS" : "FAILED",
          metadata: JSON.stringify({
            engine: ocr.engine,
            confidence: ocr.confidence,
            charCount: ocr.charCount,
            entitiesCount: entities.length,
          }),
        },
      })
      .catch(() => {});

    return Response.json(
      {
        success: ocr.status === "SUCCESS",
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        sourceHash: evidence.sha256Hash,
        ocr: {
          status: ocr.status,
          engine: ocr.engine,
          engineVersion: ocr.engineVersion,
          confidence: ocr.confidence,
          charCount: ocr.charCount,
          lineCount: ocr.lineCount,
          pageCount: ocr.pageCount,
          processingTimeMs: ocr.processingTimeMs,
          extractedAt: ocr.extractedAt,
          rawText: ocr.rawText,
          words: ocr.words || [],
          error: ocr.error,
        },
        entitiesCount: entities.length,
        entities,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/evidence/[id]/ocr] Error:", err);
    return Response.json(
      { error: "Forensic OCR execution failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
