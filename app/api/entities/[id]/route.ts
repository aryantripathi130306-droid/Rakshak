// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/[id]/route.ts
// GET /api/entities/:id
//
// Returns complete provenance details for a single extracted entity/fact,
// including source evidence, associated case, cross-case occurrences,
// and all other facts sharing the same normalized value.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Missing or invalid entity id" }, { status: 400 });
    }

    // Fetch the fact with its evidence and case
    const fact = await prisma.extractedFact.findUnique({
      where: { id },
      include: {
        evidence: {
          include: {
            case: true,
            custodyEvents: {
              orderBy: { timestamp: "desc" as const },
              take: 5,
            },
          },
        },
      } as any,
    });

    if (!fact) {
      return Response.json({ error: `Entity not found: ${id}` }, { status: 404 });
    }

    const factAny = fact as any;

    // Find all other ExtractedFact records with the same normalized value and entity type
    const relatedFacts = await prisma.extractedFact.findMany({
      where: {
        normalizedValue: factAny.normalizedValue,
        entityType: factAny.entityType,
        id: { not: factAny.id },
      },
      include: {
        evidence: {
          select: {
            id: true,
            fileName: true,
            evidenceCategory: true,
            sha256Hash: true,
            mimeType: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                incidentType: true,
                complainantName: true,
                status: true,
                jurisdiction: true,
              },
            },
          },
        },
      } as any,
      orderBy: { extractedAt: "desc" as const },
      take: 50,
    });

    // Find cross-case entity links (CaseEntity table)
    const crossCaseLinks = await prisma.caseEntity.findMany({
      where: {
        normalizedValue: factAny.normalizedValue,
        entityType: factAny.entityType,
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            incidentType: true,
            complainantName: true,
            status: true,
            jurisdiction: true,
            amountDefrauded: true,
          },
        },
      },
    });

    // Parse bounding box
    let parsedBbox: any = null;
    if (factAny.boundingBox && factAny.boundingBox !== "{}") {
      try {
        parsedBbox = JSON.parse(factAny.boundingBox);
      } catch {}
    }

    // Determine extraction method from confidence
    const extractionMethod = factAny.confidence >= 0.95
      ? "DETERMINISTIC_REGEX"
      : factAny.confidence >= 0.85
      ? "CONTEXTUAL_HEURISTIC"
      : "NER_CONTEXTUAL";

    return Response.json(
      {
        entity: {
          id: factAny.id,
          entityType: factAny.entityType,
          rawValue: factAny.rawValue,
          normalizedValue: factAny.normalizedValue,
          factAssertion: factAny.factAssertion,
          confidence: factAny.confidence,
          sourceHash: factAny.sourceHash,
          verificationStatus: factAny.verificationStatus,
          verifiedBy: factAny.verifiedBy,
          boundingBox: parsedBbox,
          extractedAt: factAny.extractedAt ? new Date(factAny.extractedAt).toISOString() : "",
          extractionMethod,
          evidenceId: factAny.evidenceId,
          caseId: factAny.caseId,
          evidence: factAny.evidence
            ? {
                id: factAny.evidence.id,
                fileName: factAny.evidence.fileName,
                fileType: factAny.evidence.fileType,
                mimeType: factAny.evidence.mimeType,
                fileSize: factAny.evidence.fileSize,
                sha256Hash: factAny.evidence.sha256Hash,
                evidenceCategory: factAny.evidence.evidenceCategory,
                uploadedAt: factAny.evidence.uploadedAt
                  ? new Date(factAny.evidence.uploadedAt).toISOString()
                  : "",
                case: factAny.evidence.case || null,
              }
            : null,
        },
        relatedFacts: (relatedFacts as any[]).map((rf: any) => ({
          id: rf.id,
          entityType: rf.entityType,
          rawValue: rf.rawValue,
          normalizedValue: rf.normalizedValue,
          confidence: rf.confidence,
          extractedAt: rf.extractedAt ? new Date(rf.extractedAt).toISOString() : "",
          evidenceId: rf.evidenceId,
          evidence: rf.evidence
            ? {
                id: rf.evidence.id,
                fileName: rf.evidence.fileName,
                evidenceCategory: rf.evidence.evidenceCategory,
                case: rf.evidence.case || null,
              }
            : null,
        })),
        crossCaseLinks: crossCaseLinks.map((cl: any) => ({
          id: cl.id,
          entityType: cl.entityType,
          normalizedValue: cl.normalizedValue,
          caseId: cl.caseId,
          case: cl.case || null,
        })),
        totalOccurrences: relatedFacts.length + 1,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/entities/[id]] Error:", err);
    return Response.json(
      {
        error: "Failed to fetch entity details.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
