// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/evidence/route.ts
// GET /api/cases/:caseId/evidence
//
// Returns all evidence records for a given case, including their extracted facts,
// dual SHA-256 hashes, integrity verification status, category, and metadata.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

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

    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      select: { id: true, caseNumber: true },
    });

    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    const evidenceList = await prisma.evidence.findMany({
      where: { caseId: caseRecord.id },
      include: {
        facts: {
          orderBy: { extractedAt: "asc" },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const items = evidenceList.map((ev: typeof evidenceList[number]) => {
      let parsedMetadata: Record<string, unknown> | undefined = undefined;
      if (ev.metadata) {
        try {
          parsedMetadata = JSON.parse(ev.metadata);
        } catch {}
      }

      return {
        id: ev.id,
        fileName: ev.fileName,
        fileType: ev.fileType,
        fileSize: formatBytes(ev.fileSize),
        rawFileSize: ev.fileSize,
        sha256Hash: ev.sha256Hash,
        clientHash: ev.clientHash,
        evidenceCategory: ev.evidenceCategory,
        metadata: parsedMetadata,
        uploadedAt: ev.uploadedAt.toISOString(),
        mimeType: ev.mimeType,
        integrityStatus: ev.clientHash === ev.sha256Hash ? ("VERIFIED" as const) : ("TAMPERED" as const),
        storagePath: ev.storagePath,
        extractedEntities: ev.facts.map((f: typeof ev.facts[number]) => ({
          type: f.entityType,
          value: f.normalizedValue,
          confidence: f.confidence,
          evidenceId: f.evidenceId,
          verificationStatus: f.verificationStatus,
          verifiedBy: f.verifiedBy,
        })),
      };
    });

    return Response.json({ caseId: caseRecord.caseNumber, evidence: items }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/evidence] Error:", err);
    return Response.json(
      { error: "Failed to fetch evidence.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
