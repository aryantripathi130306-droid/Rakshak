// ─────────────────────────────────────────────────────────────────────────────
// app/api/access-grants/[id]/revoke/route.ts
// POST /api/access-grants/:id/revoke — Revoke an active access grant with audit logging
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import {
  authenticateOfficer,
  loadAccessGrants,
  revokeAccessGrant,
  logAuditEvent,
  hasPermission,
} from "@/services/authService";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to revoke access grants" },
        { status: 401 }
      );
    }

    const officer = auth.officer;
    const allGrants = await loadAccessGrants();
    const grant = allGrants.find((g) => g.id === id);

    if (!grant) {
      return Response.json({ error: "Access grant not found" }, { status: 404 });
    }

    // Check authority to revoke
    const isGlobalAdmin = officer.role === "SYS_ADMIN" || officer.role === "ADMIN";
    const isGrantor = grant.grantedByOfficerId === officer.id;
    const isTargetDeptSupervisor =
      (officer.role === "SUPERVISOR" || officer.role === "DEPT_ADMIN") &&
      (grant.targetDepartmentId === officer.departmentId || grant.granteeDepartmentId === officer.departmentId);

    if (!isGlobalAdmin && !isGrantor && !isTargetDeptSupervisor) {
      return Response.json(
        { error: "Access denied: You do not have authority to revoke this grant" },
        { status: 403 }
      );
    }

    await revokeAccessGrant(id, officer.id);

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: officer.id,
      officerName: officer.name,
      officerBadge: officer.badgeNumber,
      action: "GRANT_REVOKED",
      module: "Auth",
      targetType: "AccessGrant",
      targetId: id,
      details: `Revoked access grant ${id} for department ${grant.targetDepartmentId}`,
      result: "SUCCESS",
      ipAddress,
      metadata: {
        grantId: id,
        targetDepartmentId: grant.targetDepartmentId,
        targetCaseId: grant.targetCaseId,
        revokedBy: officer.badgeNumber,
      },
    });

    return Response.json(
      { success: true, message: "Access grant revoked successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/access-grants/:id/revoke] Error:", err);
    return Response.json(
      { error: "Failed to revoke access grant", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
