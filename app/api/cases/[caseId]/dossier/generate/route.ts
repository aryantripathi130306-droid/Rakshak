// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/dossier/generate/route.ts
// POST /api/cases/:caseId/dossier/generate — Assemble & persist evidence-backed dossier
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { assembleInvestigativeDossier } from "@/lib/dossierGeneration";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to generate investigative dossier." },
        { status: 401 }
      );
    }

    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const { title, summary, templateVersion, generatorVersion, forceNewVersion } = body;

    const result = await assembleInvestigativeDossier(
      caseId,
      auth.officer,
      { title, summary, templateVersion, generatorVersion, forceNewVersion }
    );

    if (!result.success) {
      return Response.json({ error: result.error }, { status: result.statusCode });
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "DOSSIER_GENERATE",
      module: "Reports",
      targetType: "Dossier",
      targetId: result.dossier.id,
      details: `Generated dossier ${result.dossier.dossierNumber} (v${result.dossier.version}) with ${result.claims?.length || 0} claims`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json(
      {
        success: true,
        dossier: result.dossier,
        claimsCount: result.claims?.length || 0,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/cases/[caseId]/dossier/generate] Error:", err);
    return Response.json({ error: "Failed to generate investigative dossier" }, { status: 500 });
  }
}
