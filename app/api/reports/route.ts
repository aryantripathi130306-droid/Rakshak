// ─────────────────────────────────────────────────────────────────────────────
// app/api/reports/route.ts
// GET /api/reports — List recent generated reports
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission } from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "reports:view")) {
      return Response.json(
        { error: "Access denied: requires reports:view permission" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const p = prisma as any;
    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (type) where.reportType = type;
    if (status) where.status = status;

    const reports = await p.generatedReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(
      {
        total: reports.length,
        reports,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/reports] Error:", err);
    return Response.json(
      { error: "Failed to list reports", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
