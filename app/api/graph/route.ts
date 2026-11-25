// ─────────────────────────────────────────────────────────────────────────────
// app/api/graph/route.ts
// GET /api/graph
//
// Secure, explainable cross-case intelligence graph endpoint.
// Enforces:
// 1. Authenticated active officer session.
// 2. Role permission check (syndicate:view / syndicate:read).
// 3. Department tenancy & access-grant boundary on every expanded node.
// 4. Bounded depth and result limits to prevent unbounded traversal.
// 5. Attributable audit event recording.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { hasPermission } from "@/lib/accessControl";
import { resolveAuthorizedGraph, resolveGlobalCrossCaseGraph } from "@/lib/graphIntelligence";

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
        { error: "Forbidden: Officer lacks syndicate intelligence viewing authority." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId") || "";
    const depth = searchParams.get("depth") ? parseInt(searchParams.get("depth")!, 10) : undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const linkType = searchParams.get("linkType") || undefined;
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("q") || searchParams.get("search") || undefined;

    // If specific case requested, use Phase 37 bounded authorized graph
    if (caseId && caseId.toUpperCase() !== "ALL") {
      try {
        const payload = await resolveAuthorizedGraph(prisma, caseId, officer, {
          depth,
          limit,
          entityType,
          linkType,
          status,
          search,
        });

        // Audit graph exploration
        const p = prisma as any;
        if (p.auditLog) {
          await p.auditLog.create({
            data: {
              officerId: officer.id,
              officerName: officer.name,
              officerBadge: officer.badgeNumber || null,
              action: "VIEW_GRAPH",
              module: "Syndicate",
              targetType: "Case",
              targetId: caseId,
              details: `Officer accessed authorized intelligence graph for case '${caseId}' (depth: ${payload.summary.traversalDepthApplied}, nodes: ${payload.nodes.length}).`,
              result: "SUCCESS",
            },
          }).catch(() => {});
        }

        return Response.json(payload, {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Rakshak-Pipeline": "phase37-authorized-graph-v1",
          },
        });
      } catch (graphErr: any) {
        const msg = graphErr?.message || String(graphErr);
        if (msg.includes("Access Denied")) {
          return Response.json({ error: msg }, { status: 403 });
        }
        if (msg.includes("not found")) {
          return Response.json({ error: msg }, { status: 404 });
        }
        throw graphErr;
      }
    }

    // Global Case-to-Case Cross-Cluster Graph with strict authorization & RLS scoping
    const statusesParam = searchParams.get("statuses");
    const statuses = statusesParam
      ? statusesParam.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const globalPayload = await resolveGlobalCrossCaseGraph(prisma, officer, {
      limit,
      clusterId: searchParams.get("clusterId") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      incidentType: searchParams.get("incidentType") || undefined,
      caseStatus: searchParams.get("caseStatus") || undefined,
      entityType,
      statuses,
      confidenceCategory: searchParams.get("confidenceCategory") || undefined,
      includeGeneric: searchParams.get("includeGeneric") === "true",
      search,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    });

    return Response.json(globalPayload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Rakshak-Pipeline": "phase37-case-to-case-cross-cluster-v2",
      },
    });
  } catch (err) {
    console.error("[GET /api/graph] Error:", err);
    return Response.json(
      {
        error: "Cross-case graph resolution failed.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
