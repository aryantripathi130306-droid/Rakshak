// ─────────────────────────────────────────────────────────────────────────────
// services/authService.ts
// Secure Officer Authentication, Session Management & RBAC Permissions Engine
// Re-exports and integrates with Phase 32 Centralized Access Control Engine
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { type NextRequest } from "next/server";
import {
  type Role,
  type TargetRole,
  type LegacyRole,
  type OfficerProfile,
  type AccessGrant,
  ROLE_PERMISSIONS,
  TARGET_ROLES,
  LEGACY_ROLES,
  ALL_ROLES,
  DEPT_ADMIN_PERMITTED_ROLES,
  hasPermission,
  getEffectivePermissions,
  canAccessDepartment,
  canAccessDepartmentAsync,
  canAccessCase,
  canAccessCaseAsync,
  canAccessEvidence,
  canAccessEvidenceAsync,
  canManageOfficer,
  canModifyAudit,
  getDepartmentScopeFilter,
  createAccessGrant,
  revokeAccessGrant,
  loadAccessGrants,
  saveAccessGrants,
  hasActiveGrantSync,
  hasActiveGrantAsync,
} from "@/lib/accessControl";

export type { Role, TargetRole, LegacyRole, OfficerProfile, AccessGrant };
export {
  ROLE_PERMISSIONS,
  TARGET_ROLES,
  LEGACY_ROLES,
  ALL_ROLES,
  DEPT_ADMIN_PERMITTED_ROLES,
  hasPermission,
  getEffectivePermissions,
  canAccessDepartment,
  canAccessDepartmentAsync,
  canAccessCase,
  canAccessCaseAsync,
  canAccessEvidence,
  canAccessEvidenceAsync,
  canManageOfficer,
  canModifyAudit,
  getDepartmentScopeFilter,
  createAccessGrant,
  revokeAccessGrant,
  loadAccessGrants,
  saveAccessGrants,
  hasActiveGrantSync,
  hasActiveGrantAsync,
};

// ─── Password Hashing & Verification ──────────────────────────────────────────

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

// ─── Session Management ───────────────────────────────────────────────────────

const SESSION_TTL_HOURS = 24;

export async function createSession(
  officerId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  const p = prisma as any;
  try {
    await p.officerSession.create({
      data: {
        token,
        officerId,
        expiresAt,
        ipAddress: ipAddress || "103.45.67.89",
        userAgent: userAgent || "Rakshak-Workstation",
      },
    });

    // Update last activity timestamp on officer record
    await p.officer.update({
      where: { id: officerId },
      data: { updatedAt: new Date(), lastLogin: new Date() },
    }).catch(() => {});
  } catch (sessionErr) {
    console.error("[authService] Fatal: Could not persist session record to database:", sessionErr);
    throw new Error(`Failed to persist authenticated session: ${sessionErr instanceof Error ? sessionErr.message : String(sessionErr)}`);
  }

  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  const p = prisma as any;
  await p.officerSession.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

/**
 * Revokes all active sessions for an officer upon account suspension,
 * deactivation, or role/department change.
 */
export async function revokeAllOfficerSessions(officerId: string): Promise<void> {
  const p = prisma as any;
  await p.officerSession.updateMany({
    where: { officerId },
    data: { revoked: true },
  });
}

// ─── Request Authentication & Authorization ───────────────────────────────────

export async function authenticateOfficer(
  request: NextRequest
): Promise<{ officer: OfficerProfile; token: string } | null> {
  const p = prisma as any;

  // 1. Check Bearer token in Authorization header
  let token: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to session cookie with CSRF mitigation for state-changing methods
  let isCookieAuth = false;
  if (!token) {
    const cookie = request.cookies.get("rakshak_session");
    if (cookie) {
      token = cookie.value;
      isCookieAuth = true;
    }
  }

  // 3. Reject unauthenticated requests when no token provided
  if (!token) {
    return null;
  }

  // 4. CSRF Defense for ambient cookie authentication on state-changing requests
  if (isCookieAuth && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite && secFetchSite === "cross-site") {
      console.warn("[CSRF Protection] Rejected cross-site state-changing request relying on session cookie.");
      return null;
    }

    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const hostHeader = request.headers.get("host") || request.nextUrl.host;
        const requestHost = hostHeader.split(":")[0];
        if (originUrl.hostname !== requestHost && originUrl.hostname !== "localhost" && originUrl.hostname !== "127.0.0.1") {
          console.warn(`[CSRF Protection] Origin mismatch: ${originUrl.hostname} vs ${requestHost}`);
          return null;
        }
      } catch {
        return null;
      }
    }
  }

  // Verify session in database
  const session = await p.officerSession.findFirst({
    where: {
      token,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      officer: true,
    },
  });

  if (!session || !session.officer || session.officer.status !== "ACTIVE") {
    return null;
  }

  const off = session.officer;
  return {
    officer: {
      id: off.id,
      badgeNumber: off.badgeNumber,
      name: off.name,
      email: off.email,
      designation: off.designation,
      role: off.role as Role,
      jurisdiction: off.jurisdiction,
      unit: off.unit,
      status: off.status,
      departmentId: (off as any).departmentId ?? null,
    },
    token,
  };
}

// ─── Centralized Audit Logging ────────────────────────────────────────────────

export interface AuditLogInput {
  officerId?: string | null;
  officerName: string;
  officerBadge?: string | null;
  action: string;
  module: string;
  targetType?: string | null;
  targetId?: string | null;
  details: string;
  result?: "SUCCESS" | "FAILED" | "BLOCKED";
  ipAddress?: string | null;
  metadata?: Record<string, any> | null;
}

export async function logAuditEvent(input: AuditLogInput): Promise<any> {
  const p = prisma as any;
  try {
    return await p.auditLog.create({
      data: {
        officerId: input.officerId || null,
        officerName: input.officerName,
        officerBadge: input.officerBadge || null,
        action: input.action,
        module: input.module,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        details: input.details,
        result: input.result || "SUCCESS",
        ipAddress: input.ipAddress || "103.45.67.89",
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
    return null;
  }
}
