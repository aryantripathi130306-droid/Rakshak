// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/extract/route.ts
// POST /api/evidence/:id/extract
//
// Triggers re-extraction of entities from the stored evidence file.
// Uses the existing deterministic extraction service.
// Returns the extraction result with entity counts and types.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import {
  extractEntities,
  bufferToText,
} from "@/services/extractionService";

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

    // 3. Convert to text using existing buffer-to-text converter
    const text = bufferToText(fileBuffer, evidence.mimeType, evidence.fileName);

    if (!text || text.trim().length === 0) {
      return Response.json(
        {
          status: "COMPLETED",
          message: "No extractable text content found in this evidence file.",
          entityCount: 0,
          entities: [],
          evidenceId: evidence.id,
          textLength: 0,
        },
        { status: 200 }
      );
    }

    // 4. Run the deterministic extraction pipeline
    const payload = await extractEntities(text, evidence.id, evidence.sha256Hash);

    // 5. Delete existing extracted facts for this evidence (re-extraction replaces old results)
    await prisma.extractedFact.deleteMany({
      where: { evidenceId: evidence.id },
    });

    // 6. Persist new ExtractedFact rows
    if (payload.entities.length > 0) {
      await prisma.extractedFact.createMany({
        data: payload.entities.map((ent) => ({
          evidenceId: evidence.id,
          caseId: (evidence as any).case?.id || evidence.caseId,
          factAssertion: `${ent.type} identifier detected: ${ent.normalizedValue}`,
          entityType: ent.type,
          rawValue: ent.rawValue,
          normalizedValue: ent.normalizedValue,
          confidence: ent.confidence,
          sourceHash: ent.sourceHash,
          verificationStatus: ent.verificationStatus || "UNVERIFIED",
          verifiedBy: ent.verifiedBy || null,
          boundingBox: ent.boundingBox ? JSON.stringify(ent.boundingBox) : null,
        })),
      });

      // Upsert CaseEntity entries for cross-case graph resolution
      for (const ent of payload.entities) {
        if (!["UPI", "PHONE", "ACCOUNT", "IFSC", "DOMAIN", "EMAIL", "NAME", "IP", "GPS_COORD"].includes(ent.type))
          continue;
        const caseIdVal = (evidence as any).case?.id || evidence.caseId;
        await prisma.caseEntity
          .upsert({
            where: {
              caseId_entityType_normalizedValue: {
                caseId: caseIdVal,
                entityType: ent.type,
                normalizedValue: ent.normalizedValue,
              },
            },
            update: {},
            create: {
              caseId: caseIdVal,
              entityType: ent.type,
              rawValue: ent.rawValue,
              normalizedValue: ent.normalizedValue,
            },
          })
          .catch(() => {});
      }
    }

    // 7. Record custody event for re-extraction
    await (prisma as any).custodyEvent.create({
      data: {
        evidenceId: evidence.id,
        eventType: "EXTRACTION_COMPLETED",
        actor: "Forensic Intelligence Extractor (Re-run)",
        action: `Re-extraction completed: ${payload.entities.length} entities extracted using pipeline ${payload.pipelineVersion}`,
        result: "SUCCESS",
        details: JSON.stringify({
          entityCount: payload.entities.length,
          types: Array.from(new Set(payload.entities.map((e: any) => e.type))),
          pipelineVersion: payload.pipelineVersion,
          rawTextLength: payload.rawTextLength,
          trigger: "MANUAL_RE_EXTRACTION",
        }),
      },
    }).catch((e: unknown) => console.error("[Re-extraction] Custody log error:", e));

    // 8. Return extraction results
    const typeSummary: Record<string, number> = {};
    for (const ent of payload.entities) {
      typeSummary[ent.type] = (typeSummary[ent.type] || 0) + 1;
    }

    return Response.json(
      {
        status: "COMPLETED",
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        entityCount: payload.entities.length,
        textLength: payload.rawTextLength,
        pipelineVersion: payload.pipelineVersion,
        extractedAt: payload.extractedAt,
        typeSummary,
        entities: payload.entities.map((ent) => ({
          type: ent.type,
          rawValue: ent.rawValue,
          normalizedValue: ent.normalizedValue,
          confidence: ent.confidence,
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
