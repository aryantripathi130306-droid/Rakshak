// ─────────────────────────────────────────────────────────────────────────────
// app/api/officers/[id]/route.ts
// PATCH /api/officers/:id — Update role, status, or jurisdiction (Requires ADMIN)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateOfficer,
  hasPermission,
  logAuditEvent,
  type Role,
} from "@/services/authService";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);

    if (!auth) {
      return Response.json(
        { error: "Authentication required to edit officer accounts" },
        { status: 401 }
      );
    }
    if (!hasPermission(auth.officer.role, "officer:edit")) {
      return Response.json(
        { error: "Access denied: Administrator role required to edit officer accounts" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { role, status, jurisdiction, unit, designation } = body;

    const p = prisma as any;
    const officer = await p.officer.findUnique({
      where: { id },
    });

    if (!officer) {
      return Response.json({ error: "Officer not found" }, { status: 404 });
    }

    const data: any = {};
    const auditActions: string[] = [];

    if (role && role !== officer.role) {
      const validRoles: Role[] = ["ADMIN", "INVESTIGATOR", "ANALYST", "VIEWER"];
      if (!validRoles.includes(role)) {
        return Response.json({ error: "Invalid role specified" }, { status: 400 });
      }
      data.role = role;
      auditActions.push(`Updated role from ${officer.role} to ${role}`);
    }

    if (status && status !== officer.status) {
      const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];
      if (!validStatuses.includes(status)) {
        return Response.json({ error: "Invalid status specified" }, { status: 400 });
      }
      data.status = status;
      auditActions.push(`Changed status from ${officer.status} to ${status}`);

      // If officer was deactivated, revoke all their active sessions immediately
      if (status !== "ACTIVE") {
        await p.officerSession.updateMany({
          where: { officerId: id },
          data: { revoked: true },
        });
      }
    }

    if (jurisdiction) data.jurisdiction = jurisdiction;
    if (unit) data.unit = unit;
    if (designation) data.designation = designation;

    const updated = await p.officer.update({
      where: { id },
      data,
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
        updatedAt: true,
      },
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: status === "INACTIVE" ? "DEACTIVATE_OFFICER" : "UPDATE_ROLE",
      module: "Officers",
      targetType: "Officer",
      targetId: id,
      details: `${auditActions.join("; ")} for officer ${officer.name} (${officer.badgeNumber})`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, officer: updated }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/officers/[id]] Error:", err);
    return Response.json(
      { error: "Failed to update officer", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
