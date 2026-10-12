// ─────────────────────────────────────────────────────────────────────────────
// app/api/officers/route.ts
// GET /api/officers  — List officers with RBAC
// POST /api/officers — Provision new officer account (Requires ADMIN role)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateOfficer,
  hasPermission,
  hashPassword,
  logAuditEvent,
  type Role,
} from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required to view officers" }, { status: 401 });
    }
    if (!hasPermission(auth.officer.role, "officer:view")) {
      return Response.json({ error: "Access denied: requires officer:view permission" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase();
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    const p = prisma as any;
    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { badgeNumber: { contains: q } },
        { email: { contains: q } },
        { jurisdiction: { contains: q } },
      ];
    }

    const officers = await p.officer.findMany({
      where,
      select: {
        id: true,
        badgeNumber: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        jurisdiction: true,
        unit: true,
        status: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        updatedAt: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return Response.json(
      {
        total: officers.length,
        officers,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/officers] Error:", err);
    return Response.json(
      { error: "Failed to list officers", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required to provision officer accounts" }, { status: 401 });
    }
    if (!hasPermission(auth.officer.role, "officer:create")) {
      return Response.json(
        { error: "Access denied: Administrator role required to provision officer accounts" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim();
    const badgeNumber = body.badgeNumber?.trim();
    const designation = (body.designation || body.rank || "Sub-Inspector").trim();
    const role = body.role;
    const jurisdiction = body.jurisdiction?.trim();
    const unit = body.unit?.trim() || "Cyber Crime Cell";
    const password = body.password || "Rakshak@2026";
    const email = (body.email || `${badgeNumber?.toLowerCase().replace(/[^a-z0-9]/g, '')}@police.gov.in`).trim();

    if (!name || !badgeNumber || !role || !jurisdiction) {
      return Response.json(
        { error: "Missing required officer fields: name, badgeNumber, role, jurisdiction" },
        { status: 400 }
      );
    }

    const validRoles: Role[] = ["ADMIN", "INVESTIGATOR", "ANALYST", "VIEWER"];
    if (!validRoles.includes(role)) {
      return Response.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    const p = prisma as any;
    const existing = await p.officer.findFirst({
      where: {
        OR: [{ badgeNumber }, { email: email.toLowerCase() }],
      },
    });

    if (existing) {
      return Response.json(
        { error: "An officer with this badge number or email already exists." },
        { status: 409 }
      );
    }

    const plainPassword = password || "Rakshak@2026";
    const passwordHash = await hashPassword(plainPassword);

    const newOfficer = await p.officer.create({
      data: {
        name,
        badgeNumber,
        email: email.toLowerCase(),
        passwordHash,
        designation,
        role,
        jurisdiction,
        unit: unit || "Cyber Crime Cell",
        status: "ACTIVE",
      },
      select: {
        id: true,
        badgeNumber: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        jurisdiction: true,
        unit: true,
        status: true,
        createdAt: true,
      },
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "ADD_OFFICER",
      module: "Officers",
      targetType: "Officer",
      targetId: newOfficer.id,
      details: `Provisioned officer account ${newOfficer.name} (${newOfficer.badgeNumber}) with role ${newOfficer.role}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, officer: newOfficer }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/officers] Error:", err);
    return Response.json(
      { error: "Failed to create officer account", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
