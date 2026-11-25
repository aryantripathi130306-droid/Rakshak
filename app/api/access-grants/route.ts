// ─────────────────────────────────────────────────────────────────────────────
// app/api/access-grants/route.ts
// GET  /api/access-grants — List active and historical access grants with RBAC scoping
// POST /api/access-grants — Issue a new cross-department access grant with audit logging
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import {
  authenticateOfficer,
  loadAccessGrants,
  createAccessGrant,
  logAuditEvent,
  hasPermission,
} from "@/services/authService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to inspect access grants" },
        { status: 401 }
      );
    }

    const officer = auth.officer;
    const isGlobalAuditor =
      officer.role === "SYS_ADMIN" ||
      officer.role === "ADMIN" ||
      officer.role === "AUDITOR";

    const isSupervisor =
      officer.role === "SUPERVISOR" || officer.role === "DEPT_ADMIN";

    if (!isGlobalAuditor && !isSupervisor) {
      return Response.json(
        { error: "Access denied: Supervisory or auditor privileges required" },
        { status: 403 }
      );
    }

    const allGrants = await loadAccessGrants();

    // Departmental officers can only see grants involving their department
    const filteredGrants = isGlobalAuditor
      ? allGrants
      : allGrants.filter(
          (g) =>
            g.granteeDepartmentId === officer.departmentId ||
            g.targetDepartmentId === officer.departmentId
        );

    return Response.json(
      {
        total: filteredGrants.length,
        grants: filteredGrants,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/access-grants] Error:", err);
    return Response.json(
      { error: "Failed to list access grants", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to issue access grants" },
        { status: 401 }
      );
    }

    const officer = auth.officer;
    const canApprove = hasPermission(officer.role, "grant:approve");

    if (!canApprove) {
      return Response.json(
        { error: "Access denied: Role lacks grant:approve permission" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      granteeOfficerId,
      granteeDepartmentId,
      targetDepartmentId,
      targetCaseId,
      scope,
      expiresAt,
      reason,
    } = body;

    if (!targetDepartmentId || !scope || !expiresAt || !reason) {
      return Response.json(
        { error: "Missing required fields: targetDepartmentId, scope, expiresAt, reason" },
        { status: 400 }
      );
    }

    const validScopes = ["CASE_READ", "CASE_FULL", "EVIDENCE_READ", "DEPT_SUPERVISION"];
    if (!validScopes.includes(scope)) {
      return Response.json(
        { error: `Invalid scope. Must be one of: ${validScopes.join(", ")}` },
        { status: 400 }
      );
    }

    const parsedExpiry = new Date(expiresAt);
    if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      return Response.json(
        { error: "expiresAt must be a valid future ISO timestamp" },
        { status: 400 }
      );
    }

    // Department supervisor/admin can only grant access involving their department
    if (officer.role === "SUPERVISOR" || officer.role === "DEPT_ADMIN") {
      const involvesOwnDept =
        targetDepartmentId === officer.departmentId ||
        granteeDepartmentId === officer.departmentId;

      if (!involvesOwnDept) {
        return Response.json(
          { error: "Supervisors may only grant or approve access involving their authorized department" },
          { status: 403 }
        );
      }
    }

    const grant = await createAccessGrant({
      granteeOfficerId: granteeOfficerId || null,
      granteeDepartmentId: granteeDepartmentId || officer.departmentId || "dept_general",
      targetDepartmentId,
      targetCaseId: targetCaseId || null,
      scope,
      grantedByOfficerId: officer.id,
      expiresAt: parsedExpiry.toISOString(),
      reason,
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: officer.id,
      officerName: officer.name,
      officerBadge: officer.badgeNumber,
      action: "GRANT_APPROVED",
      module: "Auth",
      targetType: "AccessGrant",
      targetId: grant.id,
      details: `Approved cross-department access grant ${grant.id} (${scope}) for target department ${targetDepartmentId}`,
      result: "SUCCESS",
      ipAddress,
      metadata: {
        grantId: grant.id,
        targetDepartmentId,
        targetCaseId: targetCaseId || null,
        scope,
        expiresAt: parsedExpiry.toISOString(),
      },
    });

    return Response.json({ success: true, grant }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/access-grants] Error:", err);
    return Response.json(
      { error: "Failed to create access grant", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
