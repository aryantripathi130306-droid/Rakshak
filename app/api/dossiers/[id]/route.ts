// ─────────────────────────────────────────────────────────────────────────────
// app/api/dossiers/[id]/route.ts
// GET /api/dossiers/:id — Fetch full dossier record, claims, reviews, and staleness check
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, canAccessDepartmentAsync, hasPermission } from "@/services/authService";
import { checkDossierStaleness } from "@/lib/dossierGeneration";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || (!hasPermission(auth.officer.role, "reports:view") && !hasPermission(auth.officer.role, "case:read"))) {
      return Response.json(
        { error: "Access denied: requires reports:view permission" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const p = prisma as any;

    const dossier = await p.investigativeDossier.findFirst({
      where: { OR: [{ id }, { dossierNumber: id }] },
      include: {
        case: { select: { id: true, caseNumber: true, departmentId: true, jurisdiction: true } },
        claims: { orderBy: { claimNumber: "asc" } },
        reviews: { orderBy: { reviewedAt: "desc" } },
      },
    });

    if (!dossier) {
      return Response.json({ error: "Dossier not found" }, { status: 404 });
    }

    // Verify department access
    const isAllowed = await canAccessDepartmentAsync(
      auth.officer,
      dossier.case.jurisdiction,
      dossier.case.departmentId
    );

    if (!isAllowed) {
      return Response.json(
        { error: "Access denied across departmental boundary" },
        { status: 403 }
      );
    }

    // Check staleness
    const staleness = await checkDossierStaleness(dossier.id);

    let parsedContent = {};
    try {
      parsedContent = JSON.parse(dossier.contentJson);
    } catch (_) {}

    return Response.json(
      {
        success: true,
        dossier: {
          id: dossier.id,
          dossierNumber: dossier.dossierNumber,
          caseId: dossier.caseId,
          caseNumber: dossier.case.caseNumber,
          version: dossier.version,
          title: dossier.title,
          status: dossier.status,
          templateVersion: dossier.templateVersion,
          generatorVersion: dossier.generatorVersion,
          summary: dossier.summary,
          contentHash: dossier.contentHash,
          approvalBoundHash: dossier.approvalBoundHash,
          isStale: dossier.isStale || staleness.isStale,
          staleReason: dossier.staleReason || staleness.reason,
          generatedByName: dossier.generatedByName,
          generatedByBadge: dossier.generatedByBadge,
          generatedAt: dossier.generatedAt,
          approvedByName: dossier.approvedByName,
          approvedByBadge: dossier.approvedByBadge,
          approvedAt: dossier.approvedAt,
          finalizedAt: dossier.finalizedAt,
          previousVersionId: dossier.previousVersionId,
        },
        content: parsedContent,
        claims: dossier.claims,
        reviews: dossier.reviews,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[GET /api/dossiers/[id]] Error:", err);
    return Response.json({ error: "Failed to fetch dossier details" }, { status: 500 });
  }
}
