// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/route.ts
// GET /api/evidence
//
// Cross-case Evidence Vault listing endpoint with comprehensive search,
// category filtering, integrity status filtering, sorting, and pagination.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission } from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to access Evidence Vault." },
        { status: 401 }
      );
    }
    if (!hasPermission(auth.officer.role, "evidence:view")) {
      return Response.json(
        { error: "Access denied: requires evidence:view permission." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const caseIdParam = searchParams.get("caseId")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const sortBy = searchParams.get("sortBy") || "uploadedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    // Build Prisma filter conditions
    const whereConditions: any = {};

    // Department isolation: Non-admin officers are scoped to their department's cases
    if (auth.officer.role !== "ADMIN" && auth.officer.jurisdiction) {
      whereConditions.case = {
        jurisdiction: { contains: auth.officer.jurisdiction },
      };
    }

    // 1. Case filter (supports case UUID or caseNumber)
    if (caseIdParam && caseIdParam !== "ALL") {
      whereConditions.case = {
        OR: [
          { id: caseIdParam },
          { caseNumber: caseIdParam },
        ],
      };
    }

    // 2. Category filter
    if (category && category !== "ALL") {
      whereConditions.evidenceCategory = category;
    }

    // 3. Search query across fileName, id, sha256Hash, and extracted entities
    if (q) {
      whereConditions.OR = [
        { fileName: { contains: q } },
        { id: { contains: q } },
        { sha256Hash: { contains: q.toLowerCase() } },
        { clientHash: { contains: q.toLowerCase() } },
        {
          facts: {
            some: {
              OR: [
                { normalizedValue: { contains: q } },
                { rawValue: { contains: q } },
                { factAssertion: { contains: q } },
              ],
            },
          },
        },
        {
          case: {
            OR: [
              { caseNumber: { contains: q } },
              { complainantName: { contains: q } },
            ],
          },
        },
      ];
    }

    // Allowed sort fields
    const validSortFields = ["uploadedAt", "fileName", "fileSize"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "uploadedAt";
    const orderBy = { [orderByField]: sortOrder };

    // Execute count and paginated query in parallel
    const [totalCount, evidenceRecords, allCategoriesGroup] = await Promise.all([
      prisma.evidence.count({ where: whereConditions }),
      prisma.evidence.findMany({
        where: whereConditions,
        include: {
          case: true,
          facts: {
            select: {
              id: true,
              entityType: true,
              normalizedValue: true,
              rawValue: true,
              confidence: true,
              verificationStatus: true,
            },
            orderBy: { extractedAt: "asc" },
          },
          custodyEvents: {
            select: {
              id: true,
              eventType: true,
              actor: true,
              action: true,
              result: true,
              timestamp: true,
            },
            orderBy: { timestamp: "desc" },
            take: 3,
          },
        } as any,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.evidence.groupBy({
        by: ["evidenceCategory"],
        _count: { _all: true },
      }),
    ]);

    // Compute category counts
    const categoryCounts: Record<string, number> = {};
    for (const group of allCategoriesGroup) {
      categoryCounts[group.evidenceCategory] = group._count._all;
    }

    // Format items
    const items = (evidenceRecords as any[]).map((ev: any) => {
      let parsedMetadata: Record<string, unknown> | undefined = undefined;
      if (ev.metadata) {
        try {
          parsedMetadata = JSON.parse(ev.metadata);
        } catch {}
      }

      const isVerified = ev.clientHash.toLowerCase() === ev.sha256Hash.toLowerCase();

      return {
        id: ev.id,
        fileName: ev.fileName,
        fileType: ev.fileType,
        mimeType: ev.mimeType,
        fileSize: formatBytes(ev.fileSize),
        rawFileSize: ev.fileSize,
        sha256Hash: ev.sha256Hash,
        clientHash: ev.clientHash,
        storagePath: ev.storagePath,
        evidenceCategory: ev.evidenceCategory,
        metadata: parsedMetadata,
        uploadedAt: ev.uploadedAt.toISOString(),
        integrityStatus: isVerified ? ("VERIFIED" as const) : ("TAMPERED" as const),
        case: ev.case,
        caseId: ev.case?.caseNumber || "",
        extractedEntities: (ev.facts || []).map((f: any) => ({
          type: f.entityType,
          value: f.normalizedValue,
          confidence: f.confidence,
          verificationStatus: f.verificationStatus,
        })),
        recentCustodyEvents: (ev.custodyEvents || []).map((c: any) => ({
          id: c.id,
          eventType: c.eventType,
          actor: c.actor,
          action: c.action,
          result: c.result,
          timestamp: c.timestamp.toISOString(),
        })),
      };
    });

    // If status filter is applied in memory (since clientHash vs sha256Hash comparison is deterministic)
    let filteredItems = items;
    if (status && status !== "ALL") {
      filteredItems = items.filter((item) => item.integrityStatus === status);
    }

    return Response.json(
      {
        evidence: filteredItems,
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit) || 1,
        limit,
        categoryCounts,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence] Error:", err);
    return Response.json(
      {
        error: "Failed to fetch evidence listing.",
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
