// ─────────────────────────────────────────────────────────────────────────────
// app/api/graph/route.ts
// GET /api/graph
//
// Authoritative Cross-Case Syndicate Intelligence API endpoint.
// Accepts optional filters: caseId, entityType, riskLevel, jurisdiction, q.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { resolveGraphIntelligence } from "@/services/graphService";

export const runtime = "nodejs";

let cachedGlobalGraph: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId") || "ALL";
    const entityType = searchParams.get("entityType") || undefined;
    const riskLevel = searchParams.get("riskLevel") || undefined;
    const jurisdiction = searchParams.get("jurisdiction") || undefined;
    const search = searchParams.get("q") || searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const isSimpleGlobal =
      caseId === "ALL" &&
      !entityType &&
      !riskLevel &&
      !jurisdiction &&
      !search &&
      !startDate &&
      !endDate;

    if (isSimpleGlobal && cachedGlobalGraph && Date.now() - cachedGlobalGraph.timestamp < CACHE_TTL_MS) {
      return Response.json(cachedGlobalGraph.data, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Rakshak-Pipeline": "syndicate-intelligence-v3-cached",
        },
      });
    }

    const graphPayload = await resolveGraphIntelligence(caseId, prisma, {
      entityType,
      riskLevel,
      jurisdiction,
      search,
      startDate,
      endDate,
    });

    if (isSimpleGlobal) {
      cachedGlobalGraph = { data: graphPayload, timestamp: Date.now() };
    }

    return Response.json(graphPayload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Rakshak-Pipeline": "syndicate-intelligence-v3",
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
