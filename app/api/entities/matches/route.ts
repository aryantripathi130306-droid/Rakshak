// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/matches/route.ts
// GET /api/entities/matches
//
// Lists candidate and confirmed entity matches across authorized cases.
// Enforces department tenancy boundaries and filters.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { canAccessCase, hasPermission } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;

    if (!hasPermission(officer.role, "syndicate:view") && !hasPermission(officer.role, "entities:view")) {
      return Response.json(
        { error: "Forbidden: Officer lacks entity match viewing authority." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const entityType = searchParams.get("entityType") || undefined;
    const status = searchParams.get("status") || undefined;
    const linkType = searchParams.get("linkType") || undefined;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));

    const where: any = {};
    if (entityType && entityType !== "ALL") where.entityType = entityType;
    if (status && status !== "ALL") where.status = status;
    if (linkType && linkType !== "ALL") where.linkType = linkType;
    if (q) {
      where.OR = [
        { normalizedValue: { contains: q } },
        { explanation: { contains: q } },
      ];
    }

    const p = prisma as any;
    const allLinks = await p.entityLink.findMany({
      where,
      include: {
        sourceCase: {
          select: { id: true, caseNumber: true, jurisdiction: true, departmentId: true, status: true },
        },
        targetCase: {
          select: { id: true, caseNumber: true, jurisdiction: true, departmentId: true, status: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit * 2, // Take extra to filter unauthorized
    });

    // Authorization filter: officer must have access to at least one case
    const authorizedLinks: any[] = [];
    for (const link of allLinks) {
      const srcAllowed = canAccessCase(officer, link.sourceCase, "read:metadata").allowed;
      const tgtAllowed = canAccessCase(officer, link.targetCase, "read:metadata").allowed;

      if (!srcAllowed && !tgtAllowed) {
        continue;
      }

      authorizedLinks.push({
        ...link,
        sourceCase: srcAllowed ? link.sourceCase : { id: link.sourceCase.id, caseNumber: "[RESTRICTED]" },
        targetCase: tgtAllowed ? link.targetCase : { id: link.targetCase.id, caseNumber: "[RESTRICTED]" },
      });

      if (authorizedLinks.length >= limit) break;
    }

    return Response.json(
      {
        total: authorizedLinks.length,
        matches: authorizedLinks,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[GET /api/entities/matches] Error:", err);
    return Response.json(
      { error: "Failed to query entity matches.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
