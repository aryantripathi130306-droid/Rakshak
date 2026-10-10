// ─────────────────────────────────────────────────────────────────────────────
// app/api/audit/export/route.ts
// GET /api/audit/export — Secure audit log export (CSV or JSON) with CSV formula-injection defense
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

function sanitizeCsvCell(value: any): string {
  if (value == null) return "";
  let str = String(value);
  // CSV Formula Injection Defense: If cell starts with '=', '+', '-', '@', '\t', '\r', prefix with single-quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "audit:export")) {
      return Response.json(
        { error: "Access denied: requires audit:export permission" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "CSV").toUpperCase();
    const moduleFilter = searchParams.get("module");
    const actionFilter = searchParams.get("action");
    const userFilter = searchParams.get("user");

    const where: any = {};
    if (moduleFilter && moduleFilter !== "All Modules") where.module = moduleFilter;
    if (actionFilter && actionFilter !== "All Actions") where.action = actionFilter;
    if (userFilter && userFilter !== "All Users") {
      where.OR = [
        { officerName: { contains: userFilter } },
        { officerBadge: { contains: userFilter } },
      ];
    }

    const p = prisma as any;
    const events = await p.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 1000,
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "EXPORT_AUDIT",
      module: "Audit",
      targetType: "AuditLog",
      targetId: "ALL",
      details: `Exported ${events.length} audit records in ${format} format`,
      result: "SUCCESS",
      ipAddress,
    });

    if (format === "JSON") {
      return new Response(JSON.stringify(events, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="Rakshak_Audit_Logs_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // Generate CSV
    const headers = [
      "Event ID",
      "Timestamp UTC",
      "Officer Name",
      "Badge",
      "Action",
      "Module",
      "Target Type",
      "Target ID",
      "Details",
      "Result",
      "IP Address",
    ];

    const rows = events.map((ev: any) => [
      sanitizeCsvCell(ev.id),
      sanitizeCsvCell(ev.timestamp?.toISOString ? ev.timestamp.toISOString() : ev.timestamp),
      sanitizeCsvCell(ev.officerName),
      sanitizeCsvCell(ev.officerBadge || ""),
      sanitizeCsvCell(ev.action),
      sanitizeCsvCell(ev.module),
      sanitizeCsvCell(ev.targetType || ""),
      sanitizeCsvCell(ev.targetId || ""),
      sanitizeCsvCell(ev.details),
      sanitizeCsvCell(ev.result),
      sanitizeCsvCell(ev.ipAddress || ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Rakshak_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/audit/export] Error:", err);
    return Response.json(
      { error: "Audit export failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "audit:export")) {
      return Response.json(
        { error: "Access denied: requires audit:export permission" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const format = (body.format || "CSV").toUpperCase();
    const moduleFilter = body.module;
    const actionFilter = body.action;
    const userFilter = body.user;

    const where: any = {};
    if (moduleFilter && moduleFilter !== "All Modules") where.module = moduleFilter;
    if (actionFilter && actionFilter !== "All Actions") where.action = actionFilter;
    if (userFilter && userFilter !== "All Users") {
      where.OR = [
        { officerName: { contains: userFilter } },
        { officerBadge: { contains: userFilter } },
      ];
    }

    const p = prisma as any;
    const events = await p.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 1000,
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "EXPORT_AUDIT",
      module: "Audit",
      targetType: "AuditLog",
      targetId: "ALL",
      details: `Exported ${events.length} audit records in ${format} format`,
      result: "SUCCESS",
      ipAddress,
    });

    if (format === "JSON") {
      return new Response(JSON.stringify(events, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="Rakshak_Audit_Logs_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // Generate CSV
    const headers = [
      "Event ID",
      "Timestamp UTC",
      "Officer Name",
      "Badge",
      "Action",
      "Module",
      "Target Type",
      "Target ID",
      "Details",
      "Result",
      "IP Address",
    ];

    const rows = events.map((ev: any) => [
      sanitizeCsvCell(ev.id),
      sanitizeCsvCell(ev.timestamp?.toISOString ? ev.timestamp.toISOString() : ev.timestamp),
      sanitizeCsvCell(ev.officerName),
      sanitizeCsvCell(ev.officerBadge || ""),
      sanitizeCsvCell(ev.action),
      sanitizeCsvCell(ev.module),
      sanitizeCsvCell(ev.targetType || ""),
      sanitizeCsvCell(ev.targetId || ""),
      sanitizeCsvCell(ev.details),
      sanitizeCsvCell(ev.result),
      sanitizeCsvCell(ev.ipAddress || ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Rakshak_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[POST /api/audit/export] Error:", err);
    return Response.json(
      { error: "Audit export failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

