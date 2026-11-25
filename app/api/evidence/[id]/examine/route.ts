// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/examine/route.ts
// POST /api/evidence/:id/examine
//
// Authorized forensic examination workflow:
// - Start examination: updates status to EXAMINATION_IN_PROGRESS, locks examiner
// - Complete examination: updates status to EXAMINATION_COMPLETED, records derived findings and facts
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer } from "@/services/authService";
import {
  startForensicExaminationAsync,
  completeForensicExaminationAsync,
} from "@/lib/evidenceOperations";

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
        { error: "Authentication required for forensic examination operations." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action = "start", taskReference, findings, derivedFacts } = body;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    if (action === "start") {
      const res = await startForensicExaminationAsync({
        evidenceId: id,
        examiner: auth.officer,
        taskReference,
        ipAddress,
      });

      if (!res.success) {
        return Response.json({ error: res.error }, { status: res.statusCode || 400 });
      }

      return Response.json(
        {
          success: true,
          evidence: res.evidence,
          message: "Forensic examination successfully initiated.",
        },
        { status: 200 }
      );
    } else if (action === "complete") {
      const res = await completeForensicExaminationAsync({
        evidenceId: id,
        examiner: auth.officer,
        findings,
        derivedFacts,
        ipAddress,
      });

      if (!res.success) {
        return Response.json({ error: res.error }, { status: res.statusCode || 400 });
      }

      return Response.json(
        {
          success: true,
          evidence: res.evidence,
          message: "Forensic examination successfully completed and derived artifacts recorded.",
        },
        { status: 200 }
      );
    } else {
      return Response.json(
        { error: `Invalid examination action: '${action}'. Permitted: 'start', 'complete'.` },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[POST /api/evidence/[id]/examine] Error:", err);
    return Response.json(
      {
        error: "Internal server error during forensic examination.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
