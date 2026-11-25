// ─────────────────────────────────────────────────────────────────────────────
// app/api/clusters/route.ts
// GET /api/clusters — list all clusters with member cases
// POST /api/clusters — create or merge cluster
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { canAccessCaseAsync, hasPermission } from "@/lib/accessControl";
import { autoDetectClusters } from "@/services/clusterService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;
    if (!hasPermission(officer.role, "syndicate:view") && !hasPermission(officer.role, "syndicate:read")) {
      return Response.json({ error: "Forbidden: Officer lacks syndicate viewing authority." }, { status: 403 });
    }

    const clusters = await autoDetectClusters(prisma);
    const allCaseIds = Array.from(
      new Set(clusters.flatMap((cl) => (cl.cases || []).map((c) => c.id)))
    );
    const dbCases =
      allCaseIds.length > 0
        ? await (prisma as any).case.findMany({
            where: { id: { in: allCaseIds } },
            select: { id: true, departmentId: true, officerBadge: true },
          })
        : [];
    const caseLookup = new Map<string, any>(dbCases.map((c: any) => [c.id, c]));

    const scopedClusters = [];
    for (const cl of clusters) {
      const allowedCases = [];
      for (const c of cl.cases || []) {
        const fullCase = caseLookup.get(c.id) || { id: c.id, departmentId: null };
        const auth = await canAccessCaseAsync(officer, fullCase, "read:metadata");
        if (auth.allowed) allowedCases.push(c);
      }
      if (allowedCases.length > 0) {
        scopedClusters.push({ ...cl, cases: allowedCases });
      }
    }

    return Response.json({ clusters: scopedClusters }, { status: 200 });
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
