// ─────────────────────────────────────────────────────────────────────────────
// app/api/officers/[id]/route.ts
// PATCH /api/officers/:id — Update role, status, or jurisdiction with RBAC & session revocation
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateOfficer,
  logAuditEvent,
  canManageOfficer,
  revokeAllOfficerSessions,
  ALL_ROLES,
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

    const p = prisma as any;
    const officer = await p.officer.findUnique({
      where: { id },
    });

    if (!officer) {
      return Response.json({ error: "Officer not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { role, status, jurisdiction, unit, designation, departmentId } = body;

    // Evaluate administrative authority and privilege escalation boundaries
    const manageCheck = canManageOfficer(
      auth.officer,
      { id: officer.id, departmentId: officer.departmentId, role: officer.role },
      role,
      departmentId
    );

    if (!manageCheck.allowed) {
      return Response.json(
        { error: manageCheck.reason || "Unauthorized administrative action" },
        { status: 403 }
      );
    }

    const data: any = {};
    const auditActions: string[] = [];
    let requiresSessionRevocation = false;

    if (role && role !== officer.role) {
      if (!ALL_ROLES.includes(role)) {
        return Response.json(
          { error: `Invalid role specified. Must be one of: ${ALL_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      data.role = role;
      auditActions.push(`Updated role from ${officer.role} to ${role}`);
      requiresSessionRevocation = true; // Revoke stale sessions immediately
    }

    if (status && status !== officer.status) {
      const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];
      if (!validStatuses.includes(status)) {
        return Response.json({ error: "Invalid status specified" }, { status: 400 });
      }
      data.status = status;
      auditActions.push(`Changed status from ${officer.status} to ${status}`);

      if (status !== "ACTIVE") {
        requiresSessionRevocation = true;
      }
    }

    if (departmentId && departmentId !== officer.departmentId) {
      data.departmentId = departmentId;
      auditActions.push(`Reassigned department from ${officer.departmentId} to ${departmentId}`);
      requiresSessionRevocation = true;
    }

    if (jurisdiction) data.jurisdiction = jurisdiction;
    if (unit) data.unit = unit;
    if (designation) data.designation = designation;

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

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
        departmentId: true,
        updatedAt: true,
      },
    });

    // Invalidate active sessions on privilege changes or deactivation
    if (requiresSessionRevocation) {
      await revokeAllOfficerSessions(id);
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: data.status && data.status !== "ACTIVE" ? "DEACTIVATE_OFFICER" : data.role ? "UPDATE_ROLE" : "UPDATE_OFFICER",
      module: "Officers",
      targetType: "Officer",
      targetId: id,
      details: auditActions.join("; ") || "Updated officer profile fields",
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json({ success: true, officer: updated }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/officers/:id] Error:", err);
    return Response.json(
      { error: "Failed to update officer account", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
