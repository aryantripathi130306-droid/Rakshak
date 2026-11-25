// ─────────────────────────────────────────────────────────────────────────────
// app/api/graph/path/route.ts
// GET /api/graph/path
//
// Shortest explainable path finding between two authorized nodes.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { hasPermission } from "@/lib/accessControl";
import { findExplainablePath } from "@/lib/graphIntelligence";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;

    if (!hasPermission(officer.role, "syndicate:view") && !hasPermission(officer.role, "syndicate:read")) {
      return Response.json(
        { error: "Forbidden: Officer lacks intelligence viewing authority." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return Response.json(
        { error: "Bad Request: 'from' and 'to' query parameters are required." },
        { status: 400 }
      );
    }

    const pathResult = await findExplainablePath(prisma, from, to, officer);

    return Response.json(pathResult, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Rakshak-Pipeline": "phase37-path-explanation-v1",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/graph/path] Error:", err);
    return Response.json(
      { error: "Path finding failed.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
