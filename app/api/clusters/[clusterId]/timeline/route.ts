// ─────────────────────────────────────────────────────────────────────────────
// app/api/clusters/[clusterId]/timeline/route.ts
// GET /api/clusters/:clusterId/timeline — combined chronological timeline
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getClusterTimeline } from "@/services/clusterService";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const { clusterId } = await params;
    const timeline = await getClusterTimeline(clusterId, prisma);
    return Response.json({ timeline }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/clusters/[clusterId]/timeline] Error:", err);
    return Response.json(
      { error: "Failed to fetch cluster timeline", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
