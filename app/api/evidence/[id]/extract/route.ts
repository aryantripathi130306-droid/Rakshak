// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/extract/route.ts
// POST /api/evidence/:id/extract
//
// Triggers forensic text extraction / OCR and deterministic entity extraction
// from the stored evidence file.
// Returns the extraction result with OCR telemetry and entity counts.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { executeOcrAndEntityExtraction } from "@/services/ocrService";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify evidence exists
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

    // 2. Read the raw file from cold storage
    const storagePath = path.join(process.cwd(), "uploads", "raw", `${evidence.sha256Hash}.bin`);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(storagePath);
    } catch {
      return Response.json(
        { error: "Original evidence file not found in cold storage. Cannot re-extract." },
        { status: 404 }
      );
    }

    // 3. Execute OCR & Entity Extraction pipeline
    const caseIdVal = (evidence as any).case?.id || evidence.caseId;
    const { ocr, entities } = await executeOcrAndEntityExtraction(evidence.id, caseIdVal, fileBuffer);

    // 4. Summarize entity types
    const typeSummary: Record<string, number> = {};
    for (const ent of entities) {
      typeSummary[ent.type] = (typeSummary[ent.type] || 0) + 1;
    }

    return Response.json(
      {
        status: ocr.status === "FAILED" ? "FAILED" : "COMPLETED",
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        entityCount: entities.length,
        textLength: ocr.charCount,
        pipelineVersion: `4.0-ocr-${ocr.engine.toLowerCase()}`,
        extractedAt: ocr.extractedAt,
        typeSummary,
        ocr: {
          engine: ocr.engine,
          engineVersion: ocr.engineVersion,
          confidence: ocr.confidence,
          status: ocr.status,
          processingTimeMs: ocr.processingTimeMs,
          error: ocr.error,
        },
        entities: entities.map((ent) => ({
          type: ent.type,
          rawValue: ent.rawValue,
          normalizedValue: ent.normalizedValue,
          confidence: ent.confidence,
          boundingBox: ent.boundingBox,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/evidence/[id]/extract] Error:", err);
    return Response.json(
      {
        error: "Failed to run entity extraction.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
