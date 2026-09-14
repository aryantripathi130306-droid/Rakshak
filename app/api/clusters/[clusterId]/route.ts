// ─────────────────────────────────────────────────────────────────────────────
// app/api/clusters/[clusterId]/route.ts
// GET /api/clusters/:clusterId — fetch full cluster details and comparison matrix
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { autoDetectClusters, getClusterComparison } from "@/services/clusterService";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const { clusterId } = await params;
    const allClusters = await autoDetectClusters(prisma);
    const cluster = allClusters.find((c) => c.id === clusterId) || allClusters[0];
    const comparison = await getClusterComparison(clusterId, prisma);

    return Response.json({
      cluster,
      comparison,
    });
  } catch (err) {
    console.error("[GET /api/clusters/[clusterId]] Error:", err);
    return Response.json(
      { error: "Failed to fetch cluster details", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
