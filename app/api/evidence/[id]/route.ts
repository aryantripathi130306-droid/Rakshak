// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/route.ts
// GET /api/evidence/:id
//
// Returns complete forensic details for an evidence item, including:
// - Cryptographic verification state & hashes
// - Associated case details
// - Extracted facts & entity confidence
// - Related timeline events
// - Transcriptions & Chat translations
// - Full chronological Chain of Custody log
// - Cross-case syndicate linkages (other cases sharing the same entities)
// - Real-time disk storage validation
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { sha256OfBuffer } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Missing or invalid evidence id" }, { status: 400 });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { fileName: id }, { sha256Hash: id }],
      },
      include: {
        case: true,
        facts: {
          orderBy: { extractedAt: "asc" },
        },
        timelineRefs: {
          orderBy: { timestamp: "asc" },
        },
        transcriptions: true,
        chatTranslations: true,
        custodyEvents: {
          orderBy: { timestamp: "asc" },
        },
      } as any,
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    // 1. Check raw file presence on disk and compute live hash
    let fileExistsOnDisk = false;
    let diskSha256: string | null = null;
    let diskSizeBytes: number | null = null;
    try {
      const fullDiskPath = path.join(process.cwd(), "uploads", "raw", `${evidence.sha256Hash}.bin`);
      const stat = await fs.stat(fullDiskPath);
      if (stat.isFile()) {
        fileExistsOnDisk = true;
        diskSizeBytes = stat.size;
        const buf = await fs.readFile(fullDiskPath);
        diskSha256 = sha256OfBuffer(buf);
      }
    } catch {
      fileExistsOnDisk = false;
    }

    // 2. Cross-case intelligence lookup: find other cases sharing any normalized entity from this evidence
    const evAny = evidence as any;
    const factsList = (evAny.facts || []) as any[];
    const normalizedValues = factsList.map((f: any) => f.normalizedValue).filter(Boolean);
    let crossCaseMatches: Array<{
      entityType: string;
      normalizedValue: string;
      otherCaseNumber: string;
      otherCaseComplainant: string;
      otherCaseIncidentType: string;
      otherCaseStatus: string;
    }> = [];

    if (normalizedValues.length > 0) {
      const matchedEntities = await prisma.caseEntity.findMany({
        where: {
          normalizedValue: { in: normalizedValues },
          caseId: { not: evidence.caseId },
        },
        include: {
          case: {
            select: {
              caseNumber: true,
              complainantName: true,
              incidentType: true,
              status: true,
            },
          },
        },
      });

      crossCaseMatches = (matchedEntities as any[]).map((me: any) => ({
        entityType: me.entityType,
        normalizedValue: me.normalizedValue,
        otherCaseNumber: me.case?.caseNumber || "",
        otherCaseComplainant: me.case?.complainantName || "",
        otherCaseIncidentType: me.case?.incidentType || "",
        otherCaseStatus: me.case?.status || "",
      }));
    }

    // 3. Parse metadata JSON safely
    let parsedMetadata: Record<string, unknown> = {};
    if (evidence.metadata) {
      try {
        parsedMetadata = JSON.parse(evidence.metadata);
      } catch {}
    }

    const isVerified = evidence.clientHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
    const isLiveMatch = diskSha256 ? diskSha256.toLowerCase() === evidence.sha256Hash.toLowerCase() : null;

    return Response.json(
      {
        evidence: {
          id: evidence.id,
          fileName: evidence.fileName,
          fileType: evidence.fileType,
          mimeType: evidence.mimeType,
          fileSize: formatBytes(evidence.fileSize),
          rawFileSize: evidence.fileSize,
          sha256Hash: evidence.sha256Hash,
          clientHash: evidence.clientHash,
          storagePath: evidence.storagePath,
          evidenceCategory: evidence.evidenceCategory,
          metadata: parsedMetadata,
          uploadedAt: evidence.uploadedAt.toISOString(),
          integrityStatus: isVerified ? "VERIFIED" : "TAMPERED",
          case: evAny.case,
          facts: factsList.map((f: any) => ({
            id: f.id,
            entityType: f.entityType,
            normalizedValue: f.normalizedValue,
            rawValue: f.rawValue,
            factAssertion: f.factAssertion,
            confidence: f.confidence,
            sourceHash: f.sourceHash,
            verificationStatus: f.verificationStatus,
            verifiedBy: f.verifiedBy,
            boundingBox: f.boundingBox ? parseJsonSafe(f.boundingBox) : null,
            extractedAt: f.extractedAt ? new Date(f.extractedAt).toISOString() : "",
          })),
          timelineRefs: (evAny.timelineRefs || []).map((t: any) => ({
            id: t.id,
            timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : "",
            description: t.description,
            sourceType: t.sourceType,
            phase: t.phase,
          })),
          transcriptions: (evAny.transcriptions || []).map((tr: any) => ({
            id: tr.id,
            originalLanguage: tr.originalLanguage,
            originalText: tr.originalText,
            translatedText: tr.translatedText,
            targetLanguage: tr.targetLanguage,
            speakerCount: tr.speakerCount,
            confidence: tr.confidence,
            segments: parseJsonSafe(tr.segments),
          })),
          chatTranslations: (evAny.chatTranslations || []).map((ct: any) => ({
            id: ct.id,
            originalLanguage: ct.originalLanguage,
            messages: parseJsonSafe(ct.messages),
          })),
          custodyEvents: (evAny.custodyEvents || []).map((c: any) => ({
            id: c.id,
            eventType: c.eventType,
            actor: c.actor,
            action: c.action,
            result: c.result,
            details: c.details ? parseJsonSafe(c.details) : null,
            timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : "",
          })),
          crossCaseMatches,
          verificationDetails: {
            algorithm: "SHA-256",
            clientHash: evidence.clientHash,
            databaseHash: evidence.sha256Hash,
            diskHash: diskSha256,
            hashMatch: isVerified && isLiveMatch !== false,
            fileExistsOnDisk,
            diskSizeBytes,
            verifiedAt: evidence.uploadedAt.toISOString(),
            status: isVerified ? "VERIFIED" : "TAMPERED",
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]] Error:", err);
    return Response.json(
      {
        error: "Failed to fetch evidence details.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseJsonSafe(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return jsonStr;
  }
}
