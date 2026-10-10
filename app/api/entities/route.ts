// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/route.ts
// GET /api/entities
//
// Cross-evidence extracted entity listing with search, type filter,
// case filter, evidence filter, sorting, and pagination.
// All results come from the ExtractedFact table in the database.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const entityType = searchParams.get("entityType")?.trim() || "";
    const caseId = searchParams.get("caseId")?.trim() || "";
    const evidenceId = searchParams.get("evidenceId")?.trim() || "";
    const verificationStatus = searchParams.get("verificationStatus")?.trim() || "";
    const sortBy = searchParams.get("sortBy") || "extractedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Build Prisma filter conditions
    const whereConditions: any = {};

    // Entity type filter
    if (entityType && entityType !== "ALL") {
      whereConditions.entityType = entityType;
    }

    // Case filter (supports case UUID or caseNumber)
    if (caseId && caseId !== "ALL") {
      whereConditions.OR = [
        { caseId: caseId },
        {
          evidence: {
            case: {
              OR: [{ id: caseId }, { caseNumber: caseId }],
            },
          },
        },
      ];
    }

    // Evidence filter
    if (evidenceId && evidenceId !== "ALL") {
      whereConditions.evidenceId = evidenceId;
    }

    // Verification status filter
    if (verificationStatus && verificationStatus !== "ALL") {
      whereConditions.verificationStatus = verificationStatus;
    }

    // Search query across extracted values
    if (q) {
      const searchConditions = [
        { rawValue: { contains: q } },
        { normalizedValue: { contains: q } },
        { factAssertion: { contains: q } },
      ];
      if (whereConditions.OR) {
        // Combine with existing OR from caseId filter using AND
        whereConditions.AND = [
          { OR: whereConditions.OR },
          { OR: searchConditions },
        ];
        delete whereConditions.OR;
      } else {
        whereConditions.OR = searchConditions;
      }
    }

    // Allowed sort fields
    const validSortFields = ["extractedAt", "entityType", "confidence", "normalizedValue"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "extractedAt";
    const orderBy = { [orderByField]: sortOrder };

    // Execute count and paginated query in parallel
    const [totalCount, facts, entityTypeCounts] = await Promise.all([
      prisma.extractedFact.count({ where: whereConditions }),
      prisma.extractedFact.findMany({
        where: whereConditions,
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
                },
              },
            },
          },
        } as any,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.extractedFact.groupBy({
        by: ["entityType"],
        _count: { _all: true },
      }),
    ]);

    // Compute entity type counts
    const typeCounts: Record<string, number> = {};
    for (const group of entityTypeCounts) {
      typeCounts[group.entityType] = group._count._all;
    }

    // Format items
    const entities = (facts as any[]).map((f: any) => {
      let parsedBbox: any = null;
      if (f.boundingBox && f.boundingBox !== "{}") {
        try {
          parsedBbox = JSON.parse(f.boundingBox);
        } catch {}
      }

      return {
        id: f.id,
        entityType: f.entityType,
        rawValue: f.rawValue,
        normalizedValue: f.normalizedValue,
        factAssertion: f.factAssertion,
        confidence: f.confidence,
        sourceHash: f.sourceHash,
        verificationStatus: f.verificationStatus,
        verifiedBy: f.verifiedBy,
        boundingBox: parsedBbox,
        extractedAt: f.extractedAt ? new Date(f.extractedAt).toISOString() : "",
        evidenceId: f.evidenceId,
        caseId: f.caseId,
        evidence: f.evidence
          ? {
              id: f.evidence.id,
              fileName: f.evidence.fileName,
              evidenceCategory: f.evidence.evidenceCategory,
              sha256Hash: f.evidence.sha256Hash,
              mimeType: f.evidence.mimeType,
              case: f.evidence.case || null,
            }
          : null,
      };
    });

    return Response.json(
      {
        entities,
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit) || 1,
        limit,
        typeCounts,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/entities] Error:", err);
    return Response.json(
      {
        error: "Failed to fetch entities listing.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
