// ─────────────────────────────────────────────────────────────────────────────
// app/api/clusters/route.ts
// GET /api/clusters — list all clusters with member cases
// POST /api/clusters — create or merge cluster
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { autoDetectClusters } from "@/services/clusterService";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    const clusters = await autoDetectClusters(prisma);
    return Response.json({ clusters }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/clusters] Error:", err);
    return Response.json(
      { error: "Failed to fetch clusters", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, theme, caseIds, notes } = body;

    if (!name || !caseIds || !Array.isArray(caseIds)) {
      return Response.json({ error: "Missing required fields: name, caseIds" }, { status: 400 });
    }

    const cluster = await prisma.caseCluster.create({
      data: {
        name,
        theme: theme || "Task_Scam",
        status: "ACTIVE",
        confidence: "CONFIRMED",
        notes: notes || "",
        memberships: {
          create: caseIds.map((cid: string) => ({
            caseId: cid,
            reason: "Investigator manual linkage",
          })),
        },
      },
      include: {
        memberships: {
          include: {
            case: true,
          },
        },
      },
    });

    return Response.json({ cluster }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clusters] Error:", err);
    return Response.json(
      { error: "Failed to create cluster", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
