// ─────────────────────────────────────────────────────────────────────────────
// app/api/dossiers/[id]/export/route.ts
// GET /api/dossiers/:id/export — Controlled export (JSON or Text/PDF)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { exportInvestigativeDossier, type ExportFormat } from "@/lib/dossierExport";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to export dossier." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "JSON").toUpperCase() as ExportFormat;

    const result = await exportInvestigativeDossier(id, auth.officer, format);

    if (!result.success || !result.buffer) {
      return Response.json({ error: result.error }, { status: result.statusCode });
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "DOSSIER_EXPORT",
      module: "Reports",
      targetType: "Dossier",
      targetId: id,
      details: `Exported dossier ${id} in ${format} format. Artifact SHA-256: ${result.artifactHash}`,
      result: "SUCCESS",
      ipAddress,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Artifact-Hash": result.artifactHash || "",
        "X-Dossier-Audit-Id": result.auditId || "",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/dossiers/[id]/export] Error:", err);
    return Response.json({ error: "Failed to export dossier" }, { status: 500 });
  }
}
