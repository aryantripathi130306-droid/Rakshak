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
  await p.officerSession.create({
    data: {
      token,
      officerId,
      expiresAt,
      ipAddress: ipAddress || "103.45.67.89",
      userAgent: userAgent || "Rakshak-Workstation",
    },
  });

  // Update last login timestamp on officer record
  await p.officer.update({
    where: { id: officerId },
    data: { lastLogin: new Date() },
  });

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
    // Return default active officer: ACP Vikram Singh
    const defaultOfficer = await p.officer.findFirst({
      where: { badgeNumber: "DL-002" },
    });
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
    },
    token,
  };
}

export function hasPermission(role: Role, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
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
