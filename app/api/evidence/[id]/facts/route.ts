// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/facts/route.ts
// GET /api/evidence/:id/facts — List candidate & reviewed facts for evidence exhibit
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

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
      include: {
        case: true,
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    if (auth && auth.officer) {
      if (auth.officer.status === "SUSPENDED") {
        return Response.json(
          { error: "Access denied: Officer account is SUSPENDED." },
          { status: 403 }
        );
      }

      if (evidence.case) {
        const hasAccess = await canAccessDepartmentAsync(
          auth.officer,
          evidence.case.jurisdiction,
          evidence.case.departmentId,
          { targetCaseId: evidence.case.id },
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

    const facts = await (prisma as any).extractedFact.findMany({
      where: { evidenceId: evidence.id },
      include: {
        reviewHistory: {
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { extractedAt: "asc" },
    });

    return Response.json(
      {
        success: true,
        evidenceId: evidence.id,
        caseId: evidence.caseId,
        factsCount: facts.length,
        facts: facts.map((f: any) => ({
          id: f.id,
          artifactId: f.artifactId,
          evidenceId: f.evidenceId,
          caseId: f.caseId,
          entityType: f.entityType,
          rawValue: f.rawValue,
          normalizedValue: f.normalizedValue,
          acceptedValue: f.acceptedValue,
          originalValue: f.originalValue,
          confidence: f.confidence,
          sourceHash: f.sourceHash,
          pageNumber: f.pageNumber,
          charOffset: f.charOffset,
          extractionRule: f.extractionRule,
          ruleVersion: f.ruleVersion,
          reviewStatus: f.reviewStatus,
          verificationStatus: f.verificationStatus,
          limitations: f.limitations,
          reviewedById: f.reviewedById,
          reviewedAt: f.reviewedAt,
          reviewRationale: f.reviewRationale,
          boundingBox: f.boundingBox ? JSON.parse(f.boundingBox) : null,
          historyCount: f.reviewHistory?.length || 0,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]/facts] Error:", err);
    return Response.json(
      { error: "Failed to fetch candidate facts", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
