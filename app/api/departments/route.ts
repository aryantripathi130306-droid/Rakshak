// ─────────────────────────────────────────────────────────────────────────────
// app/api/departments/route.ts
// GET /api/departments  — List departments with membership statistics
// POST /api/departments — Create department (Requires ADMIN role)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateOfficer,
  hasPermission,
  logAuditEvent,
} from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required to view departments" }, { status: 401 });
    }

    const p = prisma as any;
    const departments = await p.department.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        state: true,
        jurisdiction: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            officers: true,
            cases: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(
      {
        total: departments.length,
        departments: departments.map((d: any) => ({
          ...d,
          officerCount: d._count?.officers || 0,
          caseCount: d._count?.cases || 0,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/departments] Error:", err);
    return Response.json(
      { error: "Failed to list departments", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    if (auth.officer.role !== "ADMIN") {
      return Response.json(
        { error: "Access denied: Platform Administrator privileges required to create departments." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = body.code?.trim().toUpperCase();
    const name = body.name?.trim();
    const state = body.state?.trim() || "National";
    const jurisdiction = body.jurisdiction?.trim() || name;

    if (!code || !name) {
      return Response.json(
        { error: "Department code and name are required." },
        { status: 400 }
      );
    }

    const p = prisma as any;
    const existing = await p.department.findUnique({
      where: { code },
    });

    if (existing) {
      return Response.json(
        { error: `A department with code '${code}' already exists.` },
        { status: 409 }
      );
    }

    const newDept = await p.department.create({
      data: {
        code,
        name,
        state,
        jurisdiction,
        status: "ACTIVE",
      },
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "ADD_OFFICER", // module: Officers/Departments
      module: "Officers",
      targetType: "Department",
      targetId: newDept.id,
      details: `Created new government department '${name}' (${code})`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, department: newDept }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/departments] Error:", err);
    return Response.json(
      { error: "Failed to create department", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
