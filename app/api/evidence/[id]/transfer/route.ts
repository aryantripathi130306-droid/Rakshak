// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/transfer/route.ts
// POST /api/evidence/:id/transfer
//
// Controlled custody transfer initiation and acknowledgement/acceptance.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { authenticateOfficer } from "@/services/authService";
import {
  initiateCustodyTransferAsync,
  acceptCustodyTransferAsync,
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
        { error: "Authentication required for custody transfers." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action = "initiate", toOfficerId, reason, notes } = body;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    if (action === "initiate") {
      if (!toOfficerId) {
        return Response.json(
          { error: "Missing required field: toOfficerId" },
          { status: 400 }
        );
      }
      if (!reason) {
        return Response.json(
          { error: "Missing required field: reason" },
          { status: 400 }
        );
      }

      const res = await initiateCustodyTransferAsync({
        evidenceId: id,
        fromOfficer: auth.officer,
        toOfficerId,
        reason,
        ipAddress,
      });

      if (!res.success) {
        return Response.json({ error: res.error }, { status: res.statusCode || 400 });
      }

      return Response.json({ success: true, transfer: res.transfer }, { status: 200 });
    } else if (action === "accept") {
      const res = await acceptCustodyTransferAsync({
        evidenceId: id,
        acceptingOfficer: auth.officer,
        notes,
        ipAddress,
      });

      if (!res.success) {
        return Response.json({ error: res.error }, { status: res.statusCode || 400 });
      }

      return Response.json(
        {
          success: true,
          evidence: res.evidence,
          message: "Custody transfer successfully accepted.",
        },
        { status: 200 }
      );
    } else {
      return Response.json(
        { error: `Invalid transfer action: '${action}'. Permitted: 'initiate', 'accept'.` },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[POST /api/evidence/[id]/transfer] Error:", err);
    return Response.json(
      {
        error: "Internal server error during custody transfer.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
