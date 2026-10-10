// ─────────────────────────────────────────────────────────────────────────────
// app/api/audit/route.ts
// GET /api/audit — Centralized audit log query with filters & pagination
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission } from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "audit:view")) {
      return Response.json(
        { error: "Access denied: requires audit:view permission" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const moduleFilter = searchParams.get("module");
    const actionFilter = searchParams.get("action");
    const userFilter = searchParams.get("user");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (moduleFilter && moduleFilter !== "All Modules") {
      where.module = moduleFilter;
    }
    if (actionFilter && actionFilter !== "All Actions") {
      where.action = actionFilter;
    }
    if (userFilter && userFilter !== "All Users") {
      where.OR = [
        { officerName: { contains: userFilter } },
        { officerBadge: { contains: userFilter } },
      ];
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const p = prisma as any;
    const [total, events] = await Promise.all([
      p.auditLog.count({ where }),
      p.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return Response.json(
      {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        events,
        logs: events,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/audit] Error:", err);
    return Response.json(
      { error: "Failed to retrieve audit log", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
