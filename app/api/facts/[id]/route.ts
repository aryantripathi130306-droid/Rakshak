// ─────────────────────────────────────────────────────────────────────────────
// app/api/facts/[id]/route.ts
// GET /api/facts/:id — Fetch candidate/reviewed fact, history & downstream links
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { canAccessDepartmentAsync } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);

    const fact = await (prisma as any).extractedFact.findUnique({
      where: { id },
      include: {
        evidence: {
          include: {
            case: true,
          },
        },
        reviewHistory: {
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!fact) {
      return Response.json({ error: `Fact record not found: ${id}` }, { status: 404 });
    }

    if (auth && auth.officer) {
      if (auth.officer.status === "SUSPENDED") {
        return Response.json(
          { error: "Access denied: Officer account is SUSPENDED." },
          { status: 403 }
        );
      }

      const caseObj = fact.evidence?.case;
      if (caseObj) {
        const hasAccess = await canAccessDepartmentAsync(
          auth.officer,
          caseObj.jurisdiction,
          caseObj.departmentId,
          { targetCaseId: caseObj.id },
          prisma
        );

        if (!hasAccess) {
          return Response.json(
            { error: "Access denied: Target evidence belongs to another jurisdiction without an active access grant." },
            { status: 403 }
          );
        }
      }
    }

    // Check downstream references: EntityLinks, TimelineEvents, DossierClaims
    const caseId = fact.caseId;
    const normVal = fact.normalizedValue;

    const downstreamLinks = await (prisma as any).entityLink.findMany({
      where: {
        OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }],
        normalizedValue: normVal,
      },
    });

    const downstreamClaims = await (prisma as any).dossierClaim.findMany({
      where: {
        sourceRecordId: fact.id,
      },
    });

    return Response.json(
      {
        success: true,
        fact: {
          id: fact.id,
          artifactId: fact.artifactId,
          evidenceId: fact.evidenceId,
          caseId: fact.caseId,
          entityType: fact.entityType,
          rawValue: fact.rawValue,
          normalizedValue: fact.normalizedValue,
          acceptedValue: fact.acceptedValue,
          originalValue: fact.originalValue,
          confidence: fact.confidence,
          sourceHash: fact.sourceHash,
          pageNumber: fact.pageNumber,
          charOffset: fact.charOffset,
          extractionRule: fact.extractionRule,
          ruleVersion: fact.ruleVersion,
          reviewStatus: fact.reviewStatus,
          verificationStatus: fact.verificationStatus,
          limitations: fact.limitations,
          reviewedById: fact.reviewedById,
          reviewedAt: fact.reviewedAt,
          reviewRationale: fact.reviewRationale,
          boundingBox: fact.boundingBox ? JSON.parse(fact.boundingBox) : null,
        },
        reviewHistory: fact.reviewHistory || [],
        downstreamReferences: {
          entityLinksCount: downstreamLinks.length,
          entityLinks: downstreamLinks,
          dossierClaimsCount: downstreamClaims.length,
          dossierClaims: downstreamClaims,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/facts/[id]] Error:", err);
    return Response.json(
      { error: "Failed to fetch fact details", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
