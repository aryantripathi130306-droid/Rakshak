// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/transition/route.ts
// POST /api/evidence/:id/transition
//
// Validated evidence lifecycle transitions:
// INTAKE_INITIATED -> RECEIVED_STAGING -> ACCEPTED -> IN_CUSTODY
//   <-> EXAMINATION_IN_PROGRESS -> EXAMINATION_COMPLETED
//   -> SEALED / TRANSFERRED / RELEASED / QUARANTINED / REJECTED
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer } from "@/services/authService";
import { executeEvidenceTransition, type EvidenceLifecycleStatus } from "@/lib/evidenceLifecycle";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to perform evidence transitions." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { toStatus, reason, options = {} } = body;

    if (!toStatus || typeof toStatus !== "string") {
      return Response.json(
        { error: "Missing required field: toStatus" },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    const result = await executeEvidenceTransition(
      id,
      toStatus as EvidenceLifecycleStatus,
      auth.officer,
      reason,
      { ...options, ipAddress }
    );

    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return Response.json(
      {
        success: true,
        evidence: result.evidence,
        message: `Evidence exhibit successfully transitioned to ${toStatus}.`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/evidence/[id]/transition] Error:", err);
    return Response.json(
      {
        error: "Internal server error during evidence transition.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
