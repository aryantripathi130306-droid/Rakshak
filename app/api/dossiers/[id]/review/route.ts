// ─────────────────────────────────────────────────────────────────────────────
// app/api/dossiers/[id]/review/route.ts
// POST /api/dossiers/:id/review — Submit review transition or supervisor approval
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { submitDossierReview, type DossierStatus } from "@/lib/dossierReview";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to review investigative dossier." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { toStatus, decision = "STATUS_TRANSITION", rationale } = body;

    const result = await submitDossierReview(auth.officer, {
      dossierId: id,
      toStatus: toStatus as DossierStatus,
      decision,
      rationale,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: result.statusCode });
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: toStatus === "APPROVED" ? "DOSSIER_APPROVE" : "DOSSIER_REVIEW",
      module: "Reports",
      targetType: "Dossier",
      targetId: id,
      details: `Transitioned dossier ${id} to ${toStatus} (${decision}). Rationale: ${rationale}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, dossier: result.dossier }, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/dossiers/[id]/review] Error:", err);
    return Response.json({ error: "Failed to submit dossier review" }, { status: 500 });
  }
}
