// ─────────────────────────────────────────────────────────────────────────────
// services/authService.ts
// Secure Officer Authentication, Session Management & RBAC Permissions Engine
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { type NextRequest } from "next/server";

export type Role = "ADMIN" | "INVESTIGATOR" | "ANALYST" | "VIEWER";

export interface OfficerProfile {
  id: string;
  badgeNumber: string;
  name: string;
  email: string;
  designation: string;
  role: Role;
  jurisdiction: string;
  unit: string | null;
  status: string;
  departmentId?: string | null;
}

// ─── Canonical Permission Definitions ─────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [
    "case:view",
    "case:create",
    "case:edit",
    "case:delete",
    "evidence:view",
    "evidence:upload",
    "evidence:download",
    "evidence:verify",
    "entities:view",
    "timeline:view",
    "syndicate:view",
    "legal:view",
    "legal:edit",
    "reports:view",
    "reports:generate",
    "reports:download",
    "audit:view",
    "audit:export",
    "officer:view",
    "officer:create",
    "officer:edit",
    "officer:deactivate",
    "system:settings",
  ],
  INVESTIGATOR: [
    "case:view",
    "case:create",
    "case:edit",
    "evidence:view",
    "evidence:upload",
    "evidence:download",
    "evidence:verify",
    "entities:view",
    "timeline:view",
    "syndicate:view",
    "legal:view",
    "legal:edit",
    "reports:view",
    "reports:generate",
    "reports:download",
    "audit:view",
    "officer:view",
  ],
  ANALYST: [
    "case:view",
    "evidence:view",
    "entities:view",
    "timeline:view",
    "syndicate:view",
    "legal:view",
    "reports:view",
    "reports:generate",
    "reports:download",
    "audit:view",
    "officer:view",
  ],
  VIEWER: [
    "case:view",
    "evidence:view",
    "entities:view",
    "timeline:view",
    "legal:view",
    "reports:view",
    "officer:view",
  ],
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
      data: { updatedAt: new Date() },
    }).catch(() => {});
  } catch (sessionErr) {
    console.warn("[authService] Warning: Could not persist session record to database:", sessionErr);
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

  // 2. Fallback to session cookie
  if (!token) {
    const cookie = request.cookies.get("rakshak_session");
    if (cookie) {
      token = cookie.value;
    }
  }

  // 3. Fallback to active demo officer if no token provided (preserves seamless lab access)
  if (!token) {
    if (process.env.STRICT_AUTH === "true" || process.env.NODE_ENV === "production") {
      return null;
    }
    // Return default active officer: DL-CYBER-001, ADMIN-001, DL-002, INS-001, or any active officer
    const defaultOfficer = (await p.officer.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { badgeNumber: "DL-CYBER-001" },
          { badgeNumber: "ADMIN-001" },
          { badgeNumber: "DL-002" },
          { badgeNumber: "INS-001" },
        ],
      },
    })) || (await p.officer.findFirst({ where: { status: "ACTIVE" } }));

    if (defaultOfficer && defaultOfficer.status === "ACTIVE") {
      return {
        officer: {
          id: defaultOfficer.id,
          badgeNumber: defaultOfficer.badgeNumber,
          name: defaultOfficer.name,
          email: defaultOfficer.email,
          designation: defaultOfficer.designation,
          role: defaultOfficer.role as Role,
          jurisdiction: defaultOfficer.jurisdiction,
          unit: defaultOfficer.unit,
          status: defaultOfficer.status,
          departmentId: (defaultOfficer as any).departmentId ?? null,
        },
        token: "demo-session-token",
      };
    }
    return null;
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

export function hasPermission(role: Role, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

// ─── Department Access & Multi-Tenant Scoping (Phase 21) ──────────────────────

/**
 * Validates whether an authenticated officer has permission to access
 * data within the target jurisdiction/department.
 *
 * Rules:
 * - ADMIN role has supervisory cross-department access for audit and platform oversight.
 * - Non-ADMIN officers are restricted to cases matching their assigned department/jurisdiction.
 * - Unmapped legacy records (null jurisdiction and null departmentId) fail closed for ordinary officers.
 */
export function canAccessDepartment(
  officer: OfficerProfile,
  targetJurisdiction?: string | null,
  targetDepartmentId?: string | null
): boolean {
  if (officer.role === "ADMIN") return true;

  // Fails closed if neither jurisdiction nor departmentId is specified
  if (!targetJurisdiction && !targetDepartmentId) return false;

  // Direct department ID comparison
  if (targetDepartmentId && officer.departmentId) {
    return targetDepartmentId === officer.departmentId;
  }

  // Jurisdiction comparison
  if (targetJurisdiction && officer.jurisdiction) {
    const offNorm = (officer.jurisdiction || "").trim().toLowerCase();
    const targetNorm = targetJurisdiction.trim().toLowerCase();
    if (!offNorm) return false;

    return (
      offNorm === targetNorm ||
      targetNorm.includes(offNorm) ||
      offNorm.includes(targetNorm)
    );
  }

  return false;
}

/**
 * Returns Prisma filter criteria for department-level data isolation.
 */
export function getDepartmentScopeFilter(officer: OfficerProfile): Record<string, any> {
  if (officer.role === "ADMIN") {
    return {}; // Unrestricted platform administrator
  }
  if (officer.departmentId) {
    return {
      OR: [
        { departmentId: officer.departmentId },
        { jurisdiction: { contains: officer.jurisdiction } },
      ],
    };
  }
  return {
    jurisdiction: { contains: officer.jurisdiction },
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
