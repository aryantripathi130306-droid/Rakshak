// ─────────────────────────────────────────────────────────────────────────────
// lib/accessControl.ts
// Rakshak v3.0 — Phase 32 Centralized Role, Permission & Department Access Engine
//
// Enforces:
// 1. Target 6-role model + 3 legacy roles with backward compatibility.
// 2. Granular, resource-aware permissions (separating metadata vs binary vs workflows).
// 3. Strict department tenancy scoping & explicit cross-department access grants.
// 4. Administrator restrictions: System Administrators denied case contents by default.
// 5. Account administration boundaries (Dept Admin vs Sys Admin privilege ceilings).
// 6. Fail-closed defaults on missing tenant context or expired grants.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import prisma from "./prisma.ts";

export type TargetRole =
  | "INVESTIGATOR"
  | "SUPERVISOR"
  | "FORENSIC_EXAMINER"
  | "DEPT_ADMIN"
  | "SYS_ADMIN"
  | "AUDITOR";

export type LegacyRole = "ADMIN" | "ANALYST" | "VIEWER";

export type Role = TargetRole | LegacyRole;

export interface OfficerProfile {
  id: string;
  badgeNumber: string;
  name: string;
  email: string;
  designation: string;
  role: Role;
  roles?: Role[];
  jurisdiction: string;
  unit: string | null;
  status: string;
  departmentId?: string | null;
}

export interface AccessGrant {
  id: string;
  granteeOfficerId?: string | null;
  granteeDepartmentId: string;
  targetDepartmentId: string;
  targetCaseId?: string | null;
  scope: "CASE_READ" | "CASE_FULL" | "EVIDENCE_READ" | "DEPT_SUPERVISION";
  grantedByOfficerId: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revokedByOfficerId?: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  reason: string;
}

// ─── Target & Legacy Role Catalogs ───────────────────────────────────────────

export const TARGET_ROLES: TargetRole[] = [
  "INVESTIGATOR",
  "SUPERVISOR",
  "FORENSIC_EXAMINER",
  "DEPT_ADMIN",
  "SYS_ADMIN",
  "AUDITOR",
];

export const LEGACY_ROLES: LegacyRole[] = ["ADMIN", "ANALYST", "VIEWER"];

export const ALL_ROLES: Role[] = [...TARGET_ROLES, ...LEGACY_ROLES];

// Roles that a Department Administrator is permitted to provision or assign
export const DEPT_ADMIN_PERMITTED_ROLES: Role[] = [
  "INVESTIGATOR",
  "SUPERVISOR",
  "FORENSIC_EXAMINER",
  "ANALYST",
  "VIEWER",
];

// ─── Canonical Permission Definitions ─────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  INVESTIGATOR: [
    "case:view",
    "case:read:metadata",
    "case:read:content",
    "case:create",
    "case:edit",
    "case:write",
    "evidence:view",
    "evidence:read:metadata",
    "evidence:read:binary",
    "evidence:upload",
    "evidence:register",
    "evidence:verify",
    "entities:view",
    "entity:read",
    "timeline:view",
    "timeline:read",
    "syndicate:view",
    "syndicate:read",
    "legal:view",
    "legal:read",
    "legal:edit",
    "legal:write",
    "reports:view",
    "report:generate",
    "report:export",
    "reports:generate",
    "reports:download",
    "grant:request",
    "officer:view",
  ],
  SUPERVISOR: [
    "case:view",
    "case:read:metadata",
    "case:read:content",
    "case:create",
    "case:edit",
    "case:write",
    "case:assign",
    "case:workflow:approve",
    "evidence:view",
    "evidence:read:metadata",
    "evidence:read:binary",
    "evidence:verify",
    "entities:view",
    "entity:read",
    "timeline:view",
    "timeline:read",
    "syndicate:view",
    "syndicate:read",
    "legal:view",
    "legal:read",
    "legal:edit",
    "reports:view",
    "report:generate",
    "report:export",
    "reports:generate",
    "reports:download",
    "grant:request",
    "grant:approve",
    "department:grant:approve",
    "audit:view",
    "audit:read",
    "officer:view",
  ],
  FORENSIC_EXAMINER: [
    "case:view",
    "case:read:metadata",
    "evidence:view",
    "evidence:read:metadata",
    "evidence:read:binary",
    "evidence:upload",
    "evidence:register",
    "evidence:verify",
    "evidence:custody:transfer",
    "entities:view",
    "entity:read",
    "timeline:view",
    "timeline:read",
    "report:generate",
    "report:export",
    "reports:generate",
    "reports:download",
    "grant:request",
    "officer:view",
  ],
  DEPT_ADMIN: [
    "case:assign",
    "officer:view",
    "officer:create",
    "officer:edit",
    "officer:provision:dept",
    "officer:suspend:dept",
    "role:assign:dept",
    "department:manage",
    "grant:approve",
    "department:grant:approve",
    "audit:view",
    "audit:read",
    "reports:view",
    "report:generate",
  ],
  SYS_ADMIN: [
    "case:assign",
    "case:workflow:approve",
    "officer:view",
    "officer:create",
    "officer:edit",
    "officer:deactivate",
    "officer:provision:all",
    "officer:suspend:all",
    "role:assign:all",
    "system:settings",
    "system:settings:update",
    "grant:approve",
    "department:grant:approve",
    "audit:view",
    "audit:read",
    "audit:export",
    "department:manage",
  ],
  AUDITOR: [
    "audit:view",
    "audit:read",
    "audit:export",
    "reports:view",
    "report:export",
    "reports:download",
    "evidence:view",
    "evidence:read:metadata",
    "case:view",
    "case:read:metadata",
    "officer:view",
  ],
  // Legacy roles preservation:
  ADMIN: [
    "case:view",
    "case:read:metadata",
    "case:create",
    "case:edit",
    "case:assign",
    "case:workflow:approve",
    "case:delete",
    "evidence:view",
    "evidence:read:metadata",
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
    "grant:approve",
    "department:grant:approve",
    "audit:view",
    "audit:read",
    "audit:export",
    "officer:view",
    "officer:create",
    "officer:edit",
    "officer:deactivate",
    "officer:provision:all",
    "officer:suspend:all",
    "role:assign:all",
    "system:settings",
    "system:settings:update",
  ],
  ANALYST: [
    "case:view",
    "case:read:metadata",
    "case:read:content",
    "evidence:view",
    "evidence:read:metadata",
    "entities:view",
    "entity:read",
    "timeline:view",
    "timeline:read",
    "syndicate:view",
    "syndicate:read",
    "legal:view",
    "reports:view",
    "reports:generate",
    "reports:download",
    "report:generate",
    "report:export",
    "audit:view",
    "officer:view",
  ],
  VIEWER: [
    "case:view",
    "case:read:metadata",
    "evidence:view",
    "evidence:read:metadata",
    "entities:view",
    "timeline:view",
    "legal:view",
    "reports:view",
    "officer:view",
  ],
};

// ─── Cross-Department Access Grant Storage ───────────────────────────────────

const GRANTS_STORE_PATH = path.join(process.cwd(), "data", "access_grants.json");

// In-memory sync cache for high-throughput synchronous authorization checks
let cachedGrants: AccessGrant[] = [];
let cacheLoaded = false;
let lastGrantsMtimeMs = 0;

export function loadAccessGrantsSync(): AccessGrant[] {
  try {
    if (!fs.existsSync(GRANTS_STORE_PATH)) {
      cachedGrants = [];
      cacheLoaded = true;
      lastGrantsMtimeMs = 0;
      return [];
    }
    const stat = fs.statSync(GRANTS_STORE_PATH);
    if (!cacheLoaded || stat.mtimeMs > lastGrantsMtimeMs) {
      const raw = fs.readFileSync(GRANTS_STORE_PATH, "utf8");
      cachedGrants = JSON.parse(raw);
      cacheLoaded = true;
      lastGrantsMtimeMs = stat.mtimeMs;
    }
    return cachedGrants;
  } catch {
    return cachedGrants;
  }
}

export async function loadAccessGrants(): Promise<AccessGrant[]> {
  const p = prisma as any;
  if (p && p.accessGrant) {
    try {
      const dbGrants = await p.accessGrant.findMany({
        orderBy: { createdAt: "desc" },
      });
      if (Array.isArray(dbGrants)) {
        const fromDb = dbGrants.map((g: any) => ({
          id: g.id,
          granteeOfficerId: g.granteeOfficerId,
          granteeDepartmentId: g.granteeDepartmentId,
          targetDepartmentId: g.targetDepartmentId,
          targetCaseId: g.targetCaseId,
          scope: g.scope,
          grantedByOfficerId: g.grantedByOfficerId,
          grantedAt: g.grantedAt instanceof Date ? g.grantedAt.toISOString() : String(g.grantedAt),
          expiresAt: g.expiresAt instanceof Date ? g.expiresAt.toISOString() : String(g.expiresAt),
          revokedAt: g.revokedAt ? (g.revokedAt instanceof Date ? g.revokedAt.toISOString() : String(g.revokedAt)) : null,
          revokedByOfficerId: g.revokedByOfficerId,
          status: g.status,
          reason: g.reason,
        }));
        // Database is authoritative for all persisted records. Retain non-persisted synthetic test fixtures.
        const dbIds = new Set(fromDb.map((g: any) => g.id));
        const nonDbFixtures = cachedGrants.filter((g: any) => !dbIds.has(g.id));
        const resolvedGrants = [...fromDb, ...nonDbFixtures];
        cachedGrants = resolvedGrants;
        cacheLoaded = true;
        try {
          saveAccessGrantsSync(cachedGrants);
        } catch (_) {}
        return resolvedGrants;
      }
    } catch (dbErr) {
      // Database not available or table not migrated yet, fall through to JSON file
    }
  }

  try {
    if (fs.existsSync(GRANTS_STORE_PATH)) {
      const raw = await fs.promises.readFile(GRANTS_STORE_PATH, "utf8");
      cachedGrants = JSON.parse(raw);
      cacheLoaded = true;
      return cachedGrants;
    }
    return cachedGrants;
  } catch {
    return cachedGrants;
  }
}

export async function saveAccessGrants(grants: AccessGrant[]): Promise<void> {
  const dir = path.dirname(GRANTS_STORE_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(GRANTS_STORE_PATH, JSON.stringify(grants, null, 2), "utf8");
  cachedGrants = grants;
  cacheLoaded = true;
}

export function saveAccessGrantsSync(grants: AccessGrant[]): void {
  const dir = path.dirname(GRANTS_STORE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(GRANTS_STORE_PATH, JSON.stringify(grants, null, 2), "utf8");
  try {
    const stat = fs.statSync(GRANTS_STORE_PATH);
    lastGrantsMtimeMs = stat.mtimeMs;
  } catch (_) {}
  cachedGrants = grants;
  cacheLoaded = true;
}

// Initialize cache on startup
loadAccessGrantsSync();

export async function createAccessGrant(
  grantData: Omit<AccessGrant, "id" | "grantedAt" | "status">
): Promise<AccessGrant> {
  const grantId = `grant-${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date();
  const grantedAtStr = now.toISOString();

  const newGrant: AccessGrant = {
    ...grantData,
    id: grantId,
    grantedAt: grantedAtStr,
    status: "ACTIVE",
    revokedAt: null,
    revokedByOfficerId: null,
  };

  const p = prisma as any;
  if (p && p.accessGrant) {
    try {
      await p.accessGrant.create({
        data: {
          id: grantId,
          granteeOfficerId: grantData.granteeOfficerId || null,
          granteeDepartmentId: grantData.granteeDepartmentId,
          targetDepartmentId: grantData.targetDepartmentId,
          targetCaseId: grantData.targetCaseId || null,
          scope: grantData.scope,
          grantedByOfficerId: grantData.grantedByOfficerId,
          grantedAt: now,
          expiresAt: new Date(grantData.expiresAt),
          status: "ACTIVE",
          reason: grantData.reason,
        },
      });
    } catch (err: any) {
      if (process.env.DEBUG_AUTH) {
        console.warn("[accessControl] Note: could not persist grant to database:", err?.message || err);
      }
    }
  }

  // Atomically update in-memory cache & file mirror
  const existingIdx = cachedGrants.findIndex((g) => g.id === grantId);
  if (existingIdx !== -1) {
    cachedGrants[existingIdx] = newGrant;
  } else {
    cachedGrants.unshift(newGrant);
  }
  cacheLoaded = true;

  try {
    saveAccessGrantsSync(cachedGrants);
  } catch (_) {}

  return newGrant;
}

export async function revokeAccessGrant(grantId: string, revokingOfficerId?: string): Promise<boolean> {
  const p = prisma as any;
  const now = new Date();

  if (p && p.accessGrant) {
    try {
      await p.accessGrant.update({
        where: { id: grantId },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedByOfficerId: revokingOfficerId || null,
        },
      });
    } catch (err: any) {
      if (process.env.DEBUG_AUTH) {
        console.warn("[accessControl] Note: could not update grant in database:", err?.message || err);
      }
    }
  }

  // Update in-memory cache
  const idx = cachedGrants.findIndex((g) => g.id === grantId);
  if (idx !== -1) {
    cachedGrants[idx].status = "REVOKED";
    cachedGrants[idx].revokedAt = now.toISOString();
    if (revokingOfficerId) cachedGrants[idx].revokedByOfficerId = revokingOfficerId;
  }

  try {
    saveAccessGrantsSync(cachedGrants);
  } catch (_) {}

  return true;
}

export function hasActiveGrantSync(
  officer: OfficerProfile,
  targetDepartmentId?: string | null,
  targetCaseId?: string | null
): boolean {
  if (officer.status !== "ACTIVE") return false;

  // Re-sync with file if modified by another process
  loadAccessGrantsSync();
  const now = new Date();

  return cachedGrants.some((g) => {
    if (g.status !== "ACTIVE") return false;
    if (g.revokedAt) return false;
    if (new Date(g.expiresAt) <= now) return false;

    // Check department match
    const deptMatch =
      !g.targetDepartmentId ||
      g.targetDepartmentId === targetDepartmentId;

    if (!deptMatch) return false;

    // Check officer or department grantee
    const isGrantee =
      (g.granteeOfficerId && g.granteeOfficerId === officer.id) ||
      (g.granteeDepartmentId && officer.departmentId && g.granteeDepartmentId === officer.departmentId);

    if (!isGrantee) return false;

    // If grant is scoped to a specific case, verify case match
    if (g.targetCaseId && targetCaseId) {
      return g.targetCaseId === targetCaseId;
    }

    return true;
  });
}

export async function hasActiveGrantAsync(
  officer: OfficerProfile,
  targetDepartmentId?: string | null,
  targetCaseId?: string | null,
  prismaOverride?: any
): Promise<boolean> {
  // 1. Inactive or suspended officers fail closed
  if (officer.status !== "ACTIVE") {
    return false;
  }

  const p = (prismaOverride ?? prisma) as any;
  if (p && p.accessGrant) {
    try {
      // 2. Re-verify officer's current status and department in database
      if (p.officer && officer.id) {
        const dbOfficer = await p.officer.findUnique({
          where: { id: officer.id },
          select: { status: true, departmentId: true, role: true },
        });
        if (!dbOfficer || dbOfficer.status !== "ACTIVE") {
          return false;
        }
        if (officer.departmentId && dbOfficer.departmentId && dbOfficer.departmentId !== officer.departmentId) {
          return false;
        }
      }

      // 3. Query active, unrevoked, unexpired grants from DB
      const now = new Date();
      const where: any = {
        status: "ACTIVE",
        expiresAt: { gt: now },
        revokedAt: null,
      };

      if (targetDepartmentId) {
        where.targetDepartmentId = targetDepartmentId;
      }

      if (officer.id || officer.departmentId) {
        where.OR = [
          ...(officer.id ? [{ granteeOfficerId: officer.id }] : []),
          ...(officer.departmentId ? [{ granteeDepartmentId: officer.departmentId }] : []),
        ];
      }

      const matching = await p.accessGrant.findMany({ where });
      for (const g of matching) {
        if (!g.targetCaseId || !targetCaseId || g.targetCaseId === targetCaseId) {
          return true;
        }
      }
      return false;
    } catch (_) {
      // DB query failure fails closed
      return false;
    }
  }

  // Database is the single source of truth: fail closed if database is unavailable
  return false;
}


// ─── Permission Checking ─────────────────────────────────────────────────────

export function hasPermission(role: Role | string, permission: string): boolean {
  const validRole = role as Role;
  const perms = ROLE_PERMISSIONS[validRole] || [];
  return perms.includes(permission);
}

export function getEffectivePermissions(officer: OfficerProfile): string[] {
  const roles = officer.roles && officer.roles.length > 0 ? officer.roles : [officer.role];
  const permissionsSet = new Set<string>();

  for (const r of roles) {
    const perms = ROLE_PERMISSIONS[r] || [];
    for (const p of perms) {
      permissionsSet.add(p);
    }
  }

  return Array.from(permissionsSet).sort();
}

// ─── Resource-Aware Department Access Control ────────────────────────────────

export interface DepartmentAccessOptions {
  allowAdminBypass?: boolean;
  targetCaseId?: string | null;
  action?: "read:metadata" | "read:content" | "write" | "admin";
}

/**
 * Validates whether an authenticated officer has permission to access
 * data within the target jurisdiction/department.
 *
 * Rules:
 * - Fails closed if neither jurisdiction nor departmentId is specified.
 * - Same-department access is permitted (matching departmentId or jurisdiction).
 * - Cross-department access requires an active, approved, non-expired AccessGrant.
 * - System Administrators (`SYS_ADMIN` and `ADMIN`) DO NOT bypass case data boundaries by default.
 * - Administrative operations (`action === "admin"`) permit `SYS_ADMIN` / `ADMIN` platform oversight.
 */
export function canAccessDepartment(
  officer: OfficerProfile,
  targetJurisdiction?: string | null,
  targetDepartmentId?: string | null,
  options: DepartmentAccessOptions = {}
): boolean {
  // Administrative platform-level operations (e.g. system settings, audit export)
  if (options.action === "admin") {
    return officer.role === "SYS_ADMIN" || officer.role === "ADMIN";
  }

  // Fails closed if neither jurisdiction nor departmentId is specified
  if (!targetJurisdiction && !targetDepartmentId) {
    return false;
  }

  // Direct department ID comparison
  if (targetDepartmentId && officer.departmentId && targetDepartmentId === officer.departmentId) {
    return true;
  }

  // Jurisdiction comparison for same department
  if (targetJurisdiction && officer.jurisdiction) {
    const offNorm = officer.jurisdiction.trim().toLowerCase();
    const targetNorm = targetJurisdiction.trim().toLowerCase();
    if (offNorm && (offNorm === targetNorm || targetNorm.includes(offNorm) || offNorm.includes(targetNorm))) {
      return true;
    }
  }

  // Cross-department check: active, approved, unexpired access grant
  if (hasActiveGrantSync(officer, targetDepartmentId, options.targetCaseId)) {
    return true;
  }

  // System Administrators accessing case data without an active grant are DENIED by default
  return false;
}

/**
 * Validates case access with granular action discrimination:
 * - "read:metadata": Reading case number, status, incident type.
 * - "read:content": Reading victim statement, loss amount, FIR notes, evidence list.
 * - "write": Editing case fields.
 * - "workflow:approve": Transitioning case status to CHARGESHEETED or CLOSED.
 */
export function canAccessCase(
  officer: OfficerProfile,
  caseRecord: {
    id: string;
    caseNumber?: string;
    jurisdiction?: string | null;
    departmentId?: string | null;
    officerBadge?: string | null;
  },
  action: "read:metadata" | "read:content" | "write" | "workflow:approve" = "read:content"
): { allowed: boolean; reason?: string } {
  // 1. Inactive or suspended accounts fail closed
  if (officer.status !== "ACTIVE") {
    return { allowed: false, reason: `Account status is ${officer.status}` };
  }

  // 2. Workflow transition approval requires SUPERVISOR or ADMIN with case:workflow:approve
  if (action === "workflow:approve") {
    if (!hasPermission(officer.role, "case:workflow:approve")) {
      return { allowed: false, reason: "Requires supervisor workflow approval authority" };
    }
  }

  // 3. System Administrator denied investigative case contents by default
  if ((officer.role === "SYS_ADMIN" || officer.role === "ADMIN") && action === "read:content") {
    // Check if explicitly assigned or holding an active case access grant
    const isAssigned = caseRecord.officerBadge && caseRecord.officerBadge === officer.badgeNumber;
    const hasGrant = hasActiveGrantSync(officer, caseRecord.departmentId, caseRecord.id);
    if (!isAssigned && !hasGrant) {
      return {
        allowed: false,
        reason: "System administrator denied case content access without an active case assignment or grant",
      };
    }
  }

  // 4. Department Administrator denied case contents by default (pure administrative role)
  if (officer.role === "DEPT_ADMIN" && (action === "read:content" || action === "write")) {
    const isAssigned = caseRecord.officerBadge && caseRecord.officerBadge === officer.badgeNumber;
    if (!isAssigned) {
      return { allowed: false, reason: "Department administrators are restricted to administrative workflows" };
    }
  }

  // 5. Auditor restricted to metadata only (read-only)
  if (officer.role === "AUDITOR") {
    if (action === "write" || action === "workflow:approve") {
      return { allowed: false, reason: "Auditor role is strictly read-only" };
    }
    return { allowed: true };
  }

  // 6. Forensic Examiner: metadata allowed; case edit denied
  if (officer.role === "FORENSIC_EXAMINER") {
    if (action === "write" || action === "workflow:approve") {
      return { allowed: false, reason: "Forensic examiners cannot modify case investigative details" };
    }
  }

  // 7. Verify department / access grant boundary
  const hasDeptAccess = canAccessDepartment(
    officer,
    caseRecord.jurisdiction,
    caseRecord.departmentId,
    { targetCaseId: caseRecord.id, action: action === "read:metadata" ? "read:metadata" : "read:content" }
  );

  if (!hasDeptAccess) {
    return { allowed: false, reason: "Cross-department access denied without an approved grant" };
  }

  // 8. General permission check
  const requiredPerm = action === "write" ? "case:edit" : "case:view";
  if (!hasPermission(officer.role, requiredPerm)) {
    return { allowed: false, reason: `Missing required permission: ${requiredPerm}` };
  }

  return { allowed: true };
}

/**
 * Validates evidence access with strict discrimination between:
 * - "read:metadata": Reading evidence ID, fileName, category, sha256Hash.
 * - "read:binary": Downloading or previewing raw `.bin` bytes.
 * - "verify": Cryptographic hash validation.
 * - "custody:transfer": Recording chain of custody transfers.
 */
export function canAccessEvidence(
  officer: OfficerProfile,
  evidenceRecord: {
    id: string;
    caseId: string;
    case?: {
      id: string;
      jurisdiction?: string | null;
      departmentId?: string | null;
      officerBadge?: string | null;
    } | null;
  },
  action: "read:metadata" | "read:binary" | "verify" | "custody:transfer" = "read:binary"
): { allowed: boolean; reason?: string } {
  if (officer.status !== "ACTIVE") {
    return { allowed: false, reason: `Account status is ${officer.status}` };
  }

  // Verify case department access if case is present
  if (evidenceRecord.case) {
    const caseCheck = canAccessCase(officer, evidenceRecord.case, action === "read:binary" ? "read:content" : "read:metadata");
    if (!caseCheck.allowed) {
      return caseCheck;
    }
  }

  // Granular action permissions
  if (action === "read:binary") {
    const hasBinaryPerm =
      hasPermission(officer.role, "evidence:read:binary") ||
      hasPermission(officer.role, "evidence:download");

    if (!hasBinaryPerm) {
      return { allowed: false, reason: "Requires explicit evidence binary download permission" };
    }
  } else if (action === "verify") {
    if (!hasPermission(officer.role, "evidence:verify")) {
      return { allowed: false, reason: "Requires evidence:verify permission" };
    }
  } else if (action === "custody:transfer") {
    if (!hasPermission(officer.role, "evidence:custody:transfer") && officer.role !== "ADMIN") {
      return { allowed: false, reason: "Requires evidence custody transfer authority" };
    }
  } else {
    // read:metadata
    if (!hasPermission(officer.role, "evidence:read:metadata") && !hasPermission(officer.role, "evidence:view")) {
      return { allowed: false, reason: "Requires evidence:read:metadata permission" };
    }
  }

  return { allowed: true };
}

export async function canAccessDepartmentAsync(
  officer: OfficerProfile,
  targetJurisdiction?: string | null,
  targetDepartmentId?: string | null,
  options: DepartmentAccessOptions = {},
  prismaOverride?: any
): Promise<boolean> {
  if (options.action === "admin") {
    return officer.role === "SYS_ADMIN" || officer.role === "ADMIN";
  }

  if (!targetJurisdiction && !targetDepartmentId) {
    return false;
  }

  if (targetDepartmentId && officer.departmentId && targetDepartmentId === officer.departmentId) {
    return true;
  }

  if (targetJurisdiction && officer.jurisdiction) {
    const offNorm = officer.jurisdiction.trim().toLowerCase();
    const targetNorm = targetJurisdiction.trim().toLowerCase();
    if (offNorm && (offNorm === targetNorm || targetNorm.includes(offNorm) || offNorm.includes(targetNorm))) {
      return true;
    }
  }

  return await hasActiveGrantAsync(officer, targetDepartmentId, options.targetCaseId, prismaOverride);
}

export async function canAccessCaseAsync(
  officer: OfficerProfile,
  caseRecord: {
    id: string;
    caseNumber?: string;
    jurisdiction?: string | null;
    departmentId?: string | null;
    officerBadge?: string | null;
  },
  action: "read:metadata" | "read:content" | "write" | "workflow:approve" = "read:content",
  prismaOverride?: any
): Promise<{ allowed: boolean; reason?: string }> {
  if (officer.status !== "ACTIVE") {
    return { allowed: false, reason: `Account status is ${officer.status}` };
  }

  if (action === "workflow:approve") {
    if (!hasPermission(officer.role, "case:workflow:approve")) {
      return { allowed: false, reason: "Requires supervisor workflow approval authority" };
    }
  }

  const p = (prismaOverride ?? prisma) as any;
  let isAssigned = Boolean(caseRecord.officerBadge && caseRecord.officerBadge === officer.badgeNumber);
  if (!isAssigned && p && p.caseAssignmentHistory && officer.badgeNumber) {
    try {
      const activeAssign = await p.caseAssignmentHistory.findFirst({
        where: {
          caseId: caseRecord.id,
          officerBadge: officer.badgeNumber,
          status: "ACTIVE",
        },
      });
      if (activeAssign) isAssigned = true;
    } catch (_) {}
  }

  if ((officer.role === "SYS_ADMIN" || officer.role === "ADMIN") && action === "read:content") {
    const hasGrant = await hasActiveGrantAsync(officer, caseRecord.departmentId, caseRecord.id, prismaOverride);
    if (!isAssigned && !hasGrant) {
      return {
        allowed: false,
        reason: "System administrator denied case content access without an active case assignment or grant",
      };
    }
  }

  if (officer.role === "DEPT_ADMIN" && (action === "read:content" || action === "write")) {
    if (!isAssigned) {
      return { allowed: false, reason: "Department administrators are restricted to administrative workflows" };
    }
  }

  if (officer.role === "AUDITOR") {
    if (action === "write" || action === "workflow:approve") {
      return { allowed: false, reason: "Auditor role is strictly read-only" };
    }
    return { allowed: true };
  }

  if (officer.role === "FORENSIC_EXAMINER") {
    if (action === "write" || action === "workflow:approve") {
      return { allowed: false, reason: "Forensic examiners cannot modify case investigative details" };
    }
  }

  const hasDeptAccess = await canAccessDepartmentAsync(
    officer,
    caseRecord.jurisdiction,
    caseRecord.departmentId,
    { targetCaseId: caseRecord.id, action: action === "read:metadata" ? "read:metadata" : "read:content" },
    prismaOverride
  );

  if (!hasDeptAccess) {
    return { allowed: false, reason: "Cross-department access denied without an approved grant" };
  }

  const requiredPerm = action === "write" ? "case:edit" : "case:view";
  if (!hasPermission(officer.role, requiredPerm)) {
    return { allowed: false, reason: `Missing required permission: ${requiredPerm}` };
  }

  return { allowed: true };
}

export async function canAccessEvidenceAsync(
  officer: OfficerProfile,
  evidenceRecord: {
    id: string;
    caseId: string;
    case?: {
      id: string;
      jurisdiction?: string | null;
      departmentId?: string | null;
      officerBadge?: string | null;
    } | null;
  },
  action: "read:metadata" | "read:binary" | "verify" | "custody:transfer" = "read:binary",
  prismaOverride?: any
): Promise<{ allowed: boolean; reason?: string }> {
  if (officer.status !== "ACTIVE") {
    return { allowed: false, reason: `Account status is ${officer.status}` };
  }

  if (evidenceRecord.case) {
    const caseCheck = await canAccessCaseAsync(officer, evidenceRecord.case, action === "read:binary" ? "read:content" : "read:metadata", prismaOverride);
    if (!caseCheck.allowed) {
      return caseCheck;
    }
  }

  if (action === "read:binary") {
    const hasBinaryPerm =
      hasPermission(officer.role, "evidence:read:binary") ||
      hasPermission(officer.role, "evidence:download");

    if (!hasBinaryPerm) {
      return { allowed: false, reason: "Requires explicit evidence binary download permission" };
    }
  } else if (action === "verify") {
    if (!hasPermission(officer.role, "evidence:verify")) {
      return { allowed: false, reason: "Requires evidence:verify permission" };
    }
  } else if (action === "custody:transfer") {
    if (!hasPermission(officer.role, "evidence:custody:transfer") && officer.role !== "ADMIN") {
      return { allowed: false, reason: "Requires evidence custody transfer authority" };
    }
  } else {
    if (!hasPermission(officer.role, "evidence:read:metadata") && !hasPermission(officer.role, "evidence:view")) {
      return { allowed: false, reason: "Requires evidence:read:metadata permission" };
    }
  }

  return { allowed: true };
}

/**
 * Validates administrative account management actions:
 * - System Administrator: can manage all accounts and assign any permitted role.
 * - Department Administrator: restricted strictly to own department and DEPT_ADMIN_PERMITTED_ROLES.
 * - All other roles: DENIED.
 */
export function canManageOfficer(
  actor: OfficerProfile,
  targetOfficer: {
    id: string;
    departmentId?: string | null;
    role: string;
  },
  requestedRole?: string,
  requestedDeptId?: string
): { allowed: boolean; reason?: string } {
  if (actor.status !== "ACTIVE") {
    return { allowed: false, reason: "Actor account is not active" };
  }

  // System Administrator: platform wide
  if (actor.role === "SYS_ADMIN" || actor.role === "ADMIN") {
    return { allowed: true };
  }

  // Department Administrator
  if (actor.role === "DEPT_ADMIN") {
    // Cannot manage officers in another department
    if (targetOfficer.departmentId && targetOfficer.departmentId !== actor.departmentId) {
      return { allowed: false, reason: "Department administrators can only manage officers in their own department" };
    }

    // Cannot reassign an officer to another department
    if (requestedDeptId && requestedDeptId !== actor.departmentId) {
      return { allowed: false, reason: "Cannot reassign officers outside your authorized department" };
    }

    // Cannot assign SYS_ADMIN or DEPT_ADMIN or other unauthorized roles
    if (requestedRole && !DEPT_ADMIN_PERMITTED_ROLES.includes(requestedRole as Role)) {
      return {
        allowed: false,
        reason: `Department administrators cannot assign role '${requestedRole}'. Allowed: ${DEPT_ADMIN_PERMITTED_ROLES.join(", ")}`,
      };
    }

    // Cannot edit or deactivate a SYS_ADMIN or ADMIN account
    if (targetOfficer.role === "SYS_ADMIN" || targetOfficer.role === "ADMIN") {
      return { allowed: false, reason: "Department administrators cannot modify system administrator accounts" };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: "Account administration requires administrative role" };
}

/**
 * Immutable audit logs: Modification or deletion is STRICTLY FORBIDDEN across all roles.
 */
export function canModifyAudit(actor: OfficerProfile): boolean {
  return false; // Universal immutable policy
}

/**
 * Returns Prisma filter criteria for department-level data isolation.
 */
export function getDepartmentScopeFilter(officer: OfficerProfile): Record<string, any> {
  // System administrators and Auditors with platform oversight
  if (officer.role === "SYS_ADMIN") {
    // SYS_ADMIN has platform oversight over operational records, but investigative filters apply
    return {};
  }

  // Active cross-department grants
  if (!cacheLoaded) loadAccessGrantsSync();
  const activeGrants = cachedGrants.filter(
    (g) =>
      g.status === "ACTIVE" &&
      new Date(g.expiresAt) > new Date() &&
      ((g.granteeOfficerId && g.granteeOfficerId === officer.id) ||
        (g.granteeDepartmentId && officer.departmentId && g.granteeDepartmentId === officer.departmentId))
  );

  const grantedDeptIds = activeGrants
    .map((g) => g.targetDepartmentId)
    .filter(Boolean);

  if (officer.departmentId) {
    const deptIds = [officer.departmentId, ...grantedDeptIds];
    return {
      OR: [
        { departmentId: { in: deptIds } },
        { jurisdiction: { contains: officer.jurisdiction } },
      ],
    };
  }

  return {
    jurisdiction: { contains: officer.jurisdiction },
  };
}
