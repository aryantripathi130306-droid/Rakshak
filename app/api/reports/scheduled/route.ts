// ─────────────────────────────────────────────────────────────────────────────
// app/api/reports/scheduled/route.ts
// GET /api/reports/scheduled  — List automated scheduled reports
// POST /api/reports/scheduled — Add new report schedule
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission } from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "reports:view")) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const p = prisma as any;
    const scheduled = await p.scheduledReport.findMany({
      orderBy: { createdAt: "asc" },
    });

    return Response.json(
      {
        total: scheduled.length,
        scheduled,
        scheduledReports: scheduled,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/reports/scheduled] Error:", err);
    return Response.json({ error: "Failed to list schedules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "reports:generate")) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, reportType, frequency } = body;

    if (!name || !reportType || !frequency) {
      return Response.json({ error: "Missing required schedule fields" }, { status: 400 });
    }

    const nextRun = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const p = prisma as any;
    const created = await p.scheduledReport.create({
      data: {
        name,
        reportType,
        frequency: frequency.toUpperCase(),
        nextRun,
        status: "ACTIVE",
      },
    });

    return Response.json({ success: true, schedule: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reports/scheduled] Error:", err);
    return Response.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
