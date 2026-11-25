// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase34_1_adversarial_rls.mjs
// Rakshak v3.0 — Phase 34.1 Grant Source-of-Truth Reconciliation & PostgreSQL RLS Adversarial Suite
//
// Verifies:
// 1. Authoritative Database-Backed Access Grants (Zero stale cache authorization).
// 2. Multi-client database revocation parity across isolated Prisma instances.
// 3. Expiry and database failure fail-closed semantics.
// 4. PostgreSQL RLS Adversarial Context Forgery Immunity on "rakshak_phase34_1_test":
//    - Ordinary role cannot forge tenant context via set_config('app.current_department_id')
//    - Ordinary role cannot forge platform admin context via set_config('app.is_platform_admin')
//    - Direct access to private_auth.session_context is denied (permission denied)
//    - Context requires cryptographically verified session token in public."Session" table
//    - Connection pool hygiene: clear_tenant_context() purges state across reused connections
//    - Cold storage evidence binary preservation (uploads/raw/ 100% unaltered)
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  hasActiveGrantAsync,
  canAccessDepartmentAsync,
  canAccessCaseAsync,
  canAccessEvidenceAsync,
} from "../lib/accessControl.ts";

const RAW_DIR = path.join(process.cwd(), "uploads", "raw");
const ACTIVE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const TARGET_DB = process.env.TARGET_DB || "rakshak_phase34_1_test";
const OUT_FILE = path.join(process.cwd(), "PHASE34_1_TEST_RESULTS.json");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "none";
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function computeDirectoryManifest(dirPath) {
  if (!fs.existsSync(dirPath)) return { count: 0, manifestHash: "none" };
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".bin")).sort();
  const hasher = crypto.createHash("sha256");
  for (const f of files) {
    const fileBytes = fs.readFileSync(path.join(dirPath, f));
    hasher.update(`${f}:${sha256(fileBytes)}:`);
  }
  return { count: files.length, manifestHash: hasher.digest("hex") };
}

function runSql(db, user, sql, expectError = false) {
  try {
    const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
    const out = execFileSync(
      PSQL,
      ["-U", user, "-h", "127.0.0.1", "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { env, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 10000 }
    );
    return { ok: true, output: out.trim(), error: null };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    if (expectError) {
      return { ok: false, output: null, error: stderr };
    }
    throw new Error(`SQL failed as user ${user}: ${stderr}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 34.1 RLS ADVERSARIAL & GRANT SUITE       ");
  console.log("================================================================\n");

  // Mandatory Safety Check 1: Target DB must be an isolated test database
  const allowedDbs = ["rakshak_phase34_1_test", "rakshak_phase43_test"];
  if (!allowedDbs.includes(TARGET_DB)) {
    console.error(`FATAL SAFETY GATE: Unsafe target database: ${TARGET_DB}. Must be in [${allowedDbs.join(", ")}].`);
    process.exit(1);
  }

  // Mandatory Safety Check 2: Active databases must not be modified
  const devDbHashBefore = sha256File(ACTIVE_DB_PATH);
  const manifestBefore = computeDirectoryManifest(RAW_DIR);
  console.log(`[0] Baseline Verification:`);
  console.log(`  • Active dev.db SHA-256: ${devDbHashBefore.slice(0, 16)}...`);
  console.log(`  • Cold Evidence Files:   ${manifestBefore.count} files (SHA-256: ${manifestBefore.manifestHash.slice(0, 16)}...)\n`);

  const results = {
    phase: "PHASE 34.1",
    title: "Grant Source-of-Truth Reconciliation & PostgreSQL RLS Adversarial Verification",
    timestamp: new Date().toISOString(),
    overallStatus: "PASSED",
    serverRuntime: {
      engine: "PostgreSQL 16.15",
      database: TARGET_DB,
      host: "127.0.0.1:5432",
      runtimeRole: "rakshak_app_user (NOBYPASSRLS)",
      adminRole: "rakshak_admin_user (IN rakshak_admin_role)",
    },
    metrics: {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
    },
    testCases: [],
  };

  function record(id, workstream, name, status, details = "") {
    results.metrics.total++;
    if (status === "PASSED") results.metrics.passed++;
    else if (status === "BLOCKED") results.metrics.blocked++;
    else {
      results.metrics.failed++;
      results.overallStatus = "FAILED";
    }

    results.testCases.push({ id, workstream, name, status, details, timestamp: new Date().toISOString() });
    const sym = status === "PASSED" ? "✔" : status === "BLOCKED" ? "⊘" : "✖";
    console.log(`  ${sym} [${id}] [${workstream}] ${name}: ${status}${details ? ` (${details})` : ""}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM A: Database Source-of-Truth & Multi-Client Parity
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("[1/3] WORKSTREAM A: Authoritative Database Grant Store & Multi-Client Parity");

  const sandboxDir = path.join(process.cwd(), "temp_p341_fixtures");
  if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });
  const sandboxDbFile = path.join(sandboxDir, "isolated_p341_sandbox.db");
  if (fs.existsSync(sandboxDbFile)) {
    try { fs.unlinkSync(sandboxDbFile); } catch (_) {}
  }
  const sandboxUrl = `file:${sandboxDbFile.replace(/\\/g, "/")}`;

  const clientA = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
  const clientB = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });

  try {
    // Initialize schema in isolated synthetic sandbox
    await clientA.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Department" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "jurisdiction" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await clientA.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Officer" (
        "id" TEXT PRIMARY KEY,
        "badgeNumber" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL DEFAULT 'hash',
        "designation" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'INVESTIGATOR',
        "jurisdiction" TEXT NOT NULL,
        "unit" TEXT NOT NULL DEFAULT 'Cyber Cell',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "departmentId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await clientA.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AccessGrant" (
        "id" TEXT PRIMARY KEY,
        "granteeOfficerId" TEXT,
        "granteeDepartmentId" TEXT NOT NULL,
        "targetDepartmentId" TEXT NOT NULL,
        "targetCaseId" TEXT,
        "scope" TEXT NOT NULL,
        "grantedByOfficerId" TEXT NOT NULL,
        "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" DATETIME NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "revokedAt" DATETIME,
        "revokedByOfficerId" TEXT,
        "reason" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed departments into sandbox
    await clientA.department.createMany({
      data: [
        { id: "dept-chd-01", name: "Chandigarh Cyber Cell", code: "CHD-01", state: "Chandigarh", jurisdiction: "Chandigarh UT", status: "ACTIVE" },
        { id: "dept-del-01", name: "Delhi Cyber Crime", code: "DEL-01", state: "Delhi", jurisdiction: "Delhi NCR", status: "ACTIVE" },
        { id: "dept-mum-01", name: "Mumbai Cyber Unit", code: "MUM-01", state: "Maharashtra", jurisdiction: "Mumbai", status: "ACTIVE" },
      ],
    });

    const testOfficer = {
      id: "off-p341-chd-01",
      badgeNumber: "CHD-34101",
      name: "Inspector Aryan 34.1",
      email: "aryan.p341@chd.police.gov.in",
      designation: "Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Chandigarh UT",
      unit: "Cyber Cell",
      status: "ACTIVE",
      departmentId: "dept-chd-01",
    };

    // Seed officers into sandbox
    await clientA.officer.createMany({
      data: [
        { ...testOfficer, passwordHash: "hash" },
        { id: "off-del-sup-01", badgeNumber: "DEL-SUP-01", name: "Delhi Sup", email: "del.sup@police.gov.in", designation: "Supervisor", role: "SUPERVISOR", jurisdiction: "Delhi NCR", unit: "Cyber Cell", status: "ACTIVE", departmentId: "dept-del-01", passwordHash: "hash" },
        { id: "off-mum-sup-01", badgeNumber: "MUM-SUP-01", name: "Mumbai Sup", email: "mum.sup@police.gov.in", designation: "Supervisor", role: "SUPERVISOR", jurisdiction: "Mumbai", unit: "Cyber Cell", status: "ACTIVE", departmentId: "dept-mum-01", passwordHash: "hash" },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `off-thread-${i}`,
          badgeNumber: `CHD-TH-${i}`,
          name: `Thread Officer ${i}`,
          email: `thread${i}@police.gov.in`,
          designation: "Inspector",
          role: "INVESTIGATOR",
          jurisdiction: "Chandigarh UT",
          unit: "Cyber Cell",
          status: "ACTIVE",
          departmentId: "dept-chd-01",
          passwordHash: "hash",
        })),
      ],
    });

    // TC-01: Multi-Client Revocation Parity across isolated database clients
    const grantA = await clientA.accessGrant.create({
      data: {
        id: `grant-multiclient-${Date.now()}`,
        granteeOfficerId: testOfficer.id,
        granteeDepartmentId: testOfficer.departmentId,
        targetDepartmentId: "dept-del-01",
        targetCaseId: "case-del-p341-01",
        scope: "CASE_READ",
        grantedByOfficerId: "off-del-sup-01",
        expiresAt: new Date(Date.now() + 3600000),
        status: "ACTIVE",
        reason: "Multi-client DB parity test",
      },
    });

    const activeBeforeClientB = await hasActiveGrantAsync(testOfficer, "dept-del-01", "case-del-p341-01", clientB);

    // Client A revokes the grant in DB
    await clientA.accessGrant.update({
      where: { id: grantA.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByOfficerId: "off-del-sup-01",
      },
    });

    // Client B checks DB directly
    const activeAfterClientB = await hasActiveGrantAsync(testOfficer, "dept-del-01", "case-del-p341-01", clientB);

    if (activeBeforeClientB === true && activeAfterClientB === false) {
      record("TC-A01", "Workstream A", "Database grant revocation observed immediately across independent clients", "PASSED", "Client A revoked in DB -> Client B immediately denied");
    } else {
      record("TC-A01", "Workstream A", "Database grant revocation observed immediately across independent clients", "FAILED", `before=${activeBeforeClientB}, after=${activeAfterClientB}`);
    }

    // TC-02: Real-Time Database Expiry Enforcement
    const shortGrant = await clientA.accessGrant.create({
      data: {
        id: `grant-expiry-${Date.now()}`,
        granteeOfficerId: testOfficer.id,
        granteeDepartmentId: testOfficer.departmentId,
        targetDepartmentId: "dept-mum-01",
        targetCaseId: "case-mum-p341-01",
        scope: "CASE_READ",
        grantedByOfficerId: "off-mum-sup-01",
        expiresAt: new Date(Date.now() + 100), // expires in 100ms
        status: "ACTIVE",
        reason: "Real-time expiry test",
      },
    });

    const activeInitial = await hasActiveGrantAsync(testOfficer, "dept-mum-01", "case-mum-p341-01", clientB);
    await sleep(150);
    const activeExpired = await hasActiveGrantAsync(testOfficer, "dept-mum-01", "case-mum-p341-01", clientB);

    if (activeInitial === true && activeExpired === false) {
      record("TC-A02", "Workstream A", "Database grant expiring between requests denied immediately", "PASSED", "Active at t=0ms -> Denied at t=150ms");
    } else {
      record("TC-A02", "Workstream A", "Database grant expiring between requests denied immediately", "FAILED", `init=${activeInitial}, post=${activeExpired}`);
    }

    // TC-03: Stale In-Memory / File Cache Cannot Override Database Revocation
    // Write stale ACTIVE grant to JSON fixture
    const staleJsonPath = path.join(process.cwd(), "data", "access_grants.json");
    const staleGrant = {
      id: grantA.id,
      granteeOfficerId: testOfficer.id,
      granteeDepartmentId: testOfficer.departmentId,
      targetDepartmentId: "dept-del-01",
      targetCaseId: "case-del-p341-01",
      scope: "CASE_READ",
      grantedByOfficerId: "off-del-sup-01",
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE", // Stale claim in JSON
      reason: "Stale fixture",
    };
    fs.writeFileSync(staleJsonPath, JSON.stringify([staleGrant], null, 2), "utf8");

    // hasActiveGrantAsync MUST query DB and find it REVOKED in DB
    const authoritativeCheck = await hasActiveGrantAsync(testOfficer, "dept-del-01", "case-del-p341-01", clientB);
    if (authoritativeCheck === false) {
      record("TC-A03", "Workstream A", "Stale JSON cache cannot independently authorize access over database state", "PASSED", "DB REVOKED status strictly took precedence over JSON ACTIVE claim");
    } else {
      record("TC-A03", "Workstream A", "Stale JSON cache cannot independently authorize access over database state", "FAILED", "Stale cache allowed unauthorized access");
    }

    // Reset JSON mirror
    fs.writeFileSync(staleJsonPath, "[]", "utf8");

    // TC-04: Database Error / Lookup Failure Fails Closed
    const disconnectedPrisma = {
      officer: { findUnique: async () => { throw new Error("DB Connection Severed"); } },
      accessGrant: { findMany: async () => { throw new Error("DB Connection Severed"); } },
    };
    const failClosedCheck = await hasActiveGrantAsync(testOfficer, "dept-del-01", "case-del-p341-01", disconnectedPrisma);
    if (failClosedCheck === false) {
      record("TC-A04", "Workstream A", "Unresolvable grant state fails closed safely", "PASSED", "Returned false (denied)");
    } else {
      record("TC-A04", "Workstream A", "Unresolvable grant state fails closed safely", "FAILED");
    }

    // TC-05: Concurrent Async Database Operations Safety
    const concurrentOps = [];
    for (let i = 0; i < 5; i++) {
      concurrentOps.push(
        clientA.accessGrant.create({
          data: {
            id: `grant-concurrent-${i}-${Date.now()}`,
            granteeOfficerId: `off-thread-${i}`,
            granteeDepartmentId: testOfficer.departmentId,
            targetDepartmentId: "dept-del-01",
            targetCaseId: `case-thread-${i}`,
            scope: "CASE_READ",
            grantedByOfficerId: "off-del-sup-01",
            expiresAt: new Date(Date.now() + 3600000),
            status: "ACTIVE",
            reason: `Thread ${i}`,
          },
        })
      );
    }
    const created = await Promise.all(concurrentOps);
    const revokeOps = created.map((g) =>
      clientA.accessGrant.update({
        where: { id: g.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      })
    );
    await Promise.all(revokeOps);

    const postRevokeChecks = await Promise.all(
      created.map((g) =>
        hasActiveGrantAsync(
          { id: g.granteeOfficerId, departmentId: testOfficer.departmentId, status: "ACTIVE" },
          "dept-del-01",
          g.targetCaseId,
          clientB
        )
      )
    );
    const allDenied = postRevokeChecks.every((c) => c === false);
    if (allDenied) {
      record("TC-A05", "Workstream A", "Concurrent grant creation and revocation operations atomic and consistent", "PASSED", "5/5 concurrent operations committed and revoked cleanly");
    } else {
      record("TC-A05", "Workstream A", "Concurrent grant creation and revocation operations atomic and consistent", "FAILED");
    }
  } finally {
    await clientA.$disconnect();
    await clientB.$disconnect();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM B: PostgreSQL RLS Adversarial Identity Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[2/3] WORKSTREAM B: PostgreSQL RLS Adversarial Context Forgery Testing");

  // Seed Synthetic Fixtures into rakshak_phase34_1_test
  const seedSql = `
    SELECT set_platform_admin_context();
    DELETE FROM "OfficerSession";
    DELETE FROM "AccessGrant";
    DELETE FROM "Case";
    DELETE FROM "Officer";
    DELETE FROM "Department";

    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('dept-chd', 'CHD-CYBER', 'Chandigarh Cyber Cell', 'Chandigarh', 'Chandigarh UT', 'ACTIVE', NOW(), NOW()),
      ('dept-del', 'DEL-CYBER', 'Delhi Cyber Crime', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('dept-mum', 'MUM-CYBER', 'Mumbai Cyber Unit', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW());

    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('off-chd-1', 'CHD-01', 'Inspector Chandigarh', 'chd@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Chandigarh UT', 'ACTIVE', 'dept-chd', NOW(), NOW()),
      ('off-chd-susp', 'CHD-02', 'Suspended Chandigarh', 'susp@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Chandigarh UT', 'SUSPENDED', 'dept-chd', NOW(), NOW()),
      ('off-del-1', 'DEL-01', 'Supervisor Delhi', 'del@police.gov.in', 'hash', 'Supervisor', 'SUPERVISOR', 'Delhi NCR', 'ACTIVE', 'dept-del', NOW(), NOW()),
      ('off-del-admin', 'DEL-ADMIN', 'Admin Delhi', 'admin@police.gov.in', 'hash', 'Superintendent', 'SYS_ADMIN', 'Delhi NCR', 'ACTIVE', 'dept-del', NOW(), NOW()),
      ('off-mum-1', 'MUM-01', 'Inspector Mumbai', 'mum@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'dept-mum', NOW(), NOW());

    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('sess-chd-valid', 'off-chd-1', 'tok-chd-valid-12345', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('sess-chd-expired', 'off-chd-1', 'tok-chd-expired-99999', NOW() - INTERVAL '1 hour', FALSE, NOW() - INTERVAL '2 hours'),
      ('sess-del-admin', 'off-del-admin', 'tok-del-admin-secret-777', NOW() + INTERVAL '1 day', FALSE, NOW());

    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('case-del-1', 'FIR-DEL-2026-001', 'Digital_Arrest', 'Complainant Delhi', 'Delhi NCR', 'OPEN', 'dept-del', NOW(), NOW()),
      ('case-mum-1', 'FIR-MUM-2026-002', 'Task_Scam', 'Complainant Mumbai', 'Mumbai', 'OPEN', 'dept-mum', NOW(), NOW());

    INSERT INTO "AccessGrant" ("id", "granteeOfficerId", "granteeDepartmentId", "targetDepartmentId", "targetCaseId", "scope", "grantedByOfficerId", "grantedAt", "expiresAt", "status", "reason", "createdAt", "updatedAt") VALUES
      ('grant-del-to-chd-active', 'off-chd-1', 'dept-chd', 'dept-del', 'case-del-1', 'CASE_READ', 'off-del-1', NOW(), NOW() + INTERVAL '1 day', 'ACTIVE', 'Cross-state syndicate probe', NOW(), NOW()),
      ('grant-mum-internal', 'off-mum-1', 'dept-mum', 'dept-mum', 'case-mum-1', 'CASE_FULL', 'off-mum-1', NOW(), NOW() + INTERVAL '1 day', 'ACTIVE', 'Internal Mumbai delegation', NOW(), NOW());
  `;
  runSql(TARGET_DB, "rakshak_admin_user", seedSql);

  // Adversarial Case B01: Direct Access to private_auth.session_context is DENIED
  const directPrivateAccess = runSql(TARGET_DB, "rakshak_app_user", "SELECT * FROM private_auth.session_context;", true);
  if (!directPrivateAccess.ok && directPrivateAccess.error.includes("permission denied for schema private_auth")) {
    record("TC-B01", "Workstream B", "Direct access to private_auth schema strictly denied to app role", "PASSED", "Permission denied as expected");
  } else {
    record("TC-B01", "Workstream B", "Direct access to private_auth schema strictly denied to app role", "FAILED", directPrivateAccess.error || "Access allowed!");
  }

  // Adversarial Case B02: Client Attempts to Forge Tenant Context via set_config('app.current_department_id')
  const forgeTenantSql = `
    SELECT set_config('app.current_department_id', 'dept-mum', false);
    SELECT count(*) FROM "AccessGrant";
  `;
  const forgeTenantRes = runSql(TARGET_DB, "rakshak_app_user", forgeTenantSql);
  const forgeTenantCount = parseInt(forgeTenantRes.output.split(/\r?\n/).pop().trim(), 10);
  if (forgeTenantCount === 0) {
    record("TC-B02", "Workstream B", "Client set_config('app.current_department_id') forgery rejected (returns 0 rows)", "PASSED", "count=0 (unverified client setting ignored by RLS policy)");
  } else {
    record("TC-B02", "Workstream B", "Client set_config('app.current_department_id') forgery rejected", "FAILED", `count=${forgeTenantCount}`);
  }

  // Adversarial Case B03: Client Attempts to Forge Admin Context via set_config('app.is_platform_admin')
  const forgeAdminSql = `
    SELECT set_config('app.is_platform_admin', 'true', false);
    SELECT count(*) FROM "AccessGrant";
  `;
  const forgeAdminRes = runSql(TARGET_DB, "rakshak_app_user", forgeAdminSql);
  const forgeAdminCount = parseInt(forgeAdminRes.output.split(/\r?\n/).pop().trim(), 10);
  if (forgeAdminCount === 0) {
    record("TC-B03", "Workstream B", "Client set_config('app.is_platform_admin') forgery rejected (returns 0 rows)", "PASSED", "count=0 (unverified admin setting ignored by RLS policy)");
  } else {
    record("TC-B03", "Workstream B", "Client set_config('app.is_platform_admin') forgery rejected", "FAILED", `count=${forgeAdminCount}`);
  }

  // Adversarial Case B04: Attempting to Set Context with Invalid Session Token
  const invalidTokenSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'invalid-forged-token-999');
  `;
  const invalidTokenAttempt = runSql(TARGET_DB, "rakshak_app_user", invalidTokenSql, true);
  if (!invalidTokenAttempt.ok && invalidTokenAttempt.error.includes("Invalid, expired, or non-existent session token")) {
    record("TC-B04", "Workstream B", "set_authenticated_tenant_context rejects forged/invalid session tokens", "PASSED", "Exception raised: Invalid session token");
  } else {
    record("TC-B04", "Workstream B", "set_authenticated_tenant_context rejects forged/invalid session tokens", "FAILED");
  }

  // Adversarial Case B05: Attempting to Set Context with Expired Session Token
  const expiredTokenSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-expired-99999');
  `;
  const expiredTokenAttempt = runSql(TARGET_DB, "rakshak_app_user", expiredTokenSql, true);
  if (!expiredTokenAttempt.ok && expiredTokenAttempt.error.includes("Invalid, expired, or non-existent session token")) {
    record("TC-B05", "Workstream B", "set_authenticated_tenant_context rejects expired session tokens", "PASSED", "Exception raised: Expired session token");
  } else {
    record("TC-B05", "Workstream B", "set_authenticated_tenant_context rejects expired session tokens", "FAILED");
  }

  // Adversarial Case B06: Attempting to Set Context with Suspended Officer
  const suspendedOfficerSql = `
    SELECT set_authenticated_tenant_context('off-chd-susp', 'dept-chd', 'tok-chd-valid-12345');
  `;
  const suspendedOfficerAttempt = runSql(TARGET_DB, "rakshak_app_user", suspendedOfficerSql, true);
  if (!suspendedOfficerAttempt.ok && suspendedOfficerAttempt.error.includes("Officer account is inactive or suspended")) {
    record("TC-B06", "Workstream B", "set_authenticated_tenant_context rejects suspended officer accounts", "PASSED", "Exception raised: Suspended account");
  } else {
    record("TC-B06", "Workstream B", "set_authenticated_tenant_context rejects suspended officer accounts", "FAILED");
  }

  // Adversarial Case B07: Attempting to Claim Another Department with Valid Token
  const mismatchedDeptSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-mum', 'tok-chd-valid-12345');
  `;
  const mismatchedDeptAttempt = runSql(TARGET_DB, "rakshak_app_user", mismatchedDeptSql, true);
  if (!mismatchedDeptAttempt.ok && mismatchedDeptAttempt.error.includes("Officer does not belong to specified department")) {
    record("TC-B07", "Workstream B", "set_authenticated_tenant_context rejects department mismatch", "PASSED", "Exception raised: Department mismatch");
  } else {
    record("TC-B07", "Workstream B", "set_authenticated_tenant_context rejects department mismatch", "FAILED");
  }

  // Valid Context Establishment & Tenant Scoping
  const validContextSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-valid-12345');
    SELECT "id" FROM "AccessGrant" ORDER BY "id";
  `;
  const validContextRes = runSql(TARGET_DB, "rakshak_app_user", validContextSql);
  const visibleToChd = validContextRes.output.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("grant-"));

  if (visibleToChd.includes("grant-del-to-chd-active") && !visibleToChd.includes("grant-mum-internal")) {
    record("TC-B08", "Workstream B", "Verified credentials authorize legitimate tenant access", "PASSED", `Visible: ${visibleToChd.join(", ")}`);
  } else {
    record("TC-B08", "Workstream B", "Verified credentials authorize legitimate tenant access", "FAILED", `Visible: ${visibleToChd.join(", ")}`);
  }

  // Adversarial Case B09: Foreign Department Grants Strictly Invisible
  if (!visibleToChd.includes("grant-mum-internal")) {
    record("TC-B09", "Workstream B", "Foreign department grants remain strictly invisible under verified context", "PASSED", "MUM internal grant hidden from CHD officer");
  } else {
    record("TC-B09", "Workstream B", "Foreign department grants remain strictly invisible under verified context", "FAILED");
  }

  // Adversarial Case B10: Connection Pool Hygiene via clear_tenant_context()
  const poolHygieneSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-valid-12345');
    SELECT clear_tenant_context();
    SELECT count(*) FROM "AccessGrant";
  `;
  const poolHygieneRes = runSql(TARGET_DB, "rakshak_app_user", poolHygieneSql);
  const postClearCount = parseInt(poolHygieneRes.output.split(/\r?\n/).pop().trim(), 10);
  if (postClearCount === 0) {
    record("TC-B10", "Workstream B", "clear_tenant_context() purges state across pooled connection reuses", "PASSED", "Count=0 after clear_tenant_context()");
  } else {
    record("TC-B10", "Workstream B", "clear_tenant_context() purges state across pooled connection reuses", "FAILED", `Count=${postClearCount}`);
  }

  // Adversarial Case B11: Legitimate Platform Admin Context Verification
  const legitimateAdminSql = `
    SELECT set_authenticated_tenant_context('off-del-admin', 'dept-del', 'tok-del-admin-secret-777');
    SELECT count(*) FROM "AccessGrant";
  `;
  const adminRes = runSql(TARGET_DB, "rakshak_app_user", legitimateAdminSql);
  const adminVisibleCount = parseInt(adminRes.output.split(/\r?\n/).pop().trim(), 10);
  if (adminVisibleCount === 2) {
    record("TC-B11", "Workstream B", "Verified administrator session token enables full platform oversight", "PASSED", "All grants visible to verified SYS_ADMIN");
  } else {
    record("TC-B11", "Workstream B", "Verified administrator session token enables full platform oversight", "FAILED", `count=${adminVisibleCount}`);
  }

  // Adversarial Case B12: Ordinary Role Cannot Assume Superuser or BYPASSRLS
  const roleCheck = runSql(TARGET_DB, "rakshak_admin_user", "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';");
  const [, isSuper, isBypass] = roleCheck.output.split("|");
  if (isSuper === "f" && isBypass === "f") {
    record("TC-B12", "Workstream B", "Runtime role verified with NOBYPASSRLS and non-superuser in pg_roles", "PASSED", "rolsuper=false, rolbypassrls=false");
  } else {
    record("TC-B12", "Workstream B", "Runtime role verified with NOBYPASSRLS and non-superuser in pg_roles", "FAILED", `super=${isSuper}, bypass=${isBypass}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM C & D: Storage Immutability & Evidence Preservation Invariant
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[3/3] WORKSTREAM C & D: Evidence Integrity & Storage Immutability Invariant");

  const devDbHashAfter = sha256File(ACTIVE_DB_PATH);
  if (devDbHashBefore === devDbHashAfter) {
    record("TC-C01", "Workstream C/D", "Active development database (prisma/dev.db) strictly unaltered", "PASSED", `SHA-256 match: ${devDbHashAfter.slice(0, 16)}...`);
  } else {
    record("TC-C01", "Workstream C/D", "Active development database (prisma/dev.db) strictly unaltered", "FAILED", "Database mutated!");
  }

  const manifestAfter = computeDirectoryManifest(RAW_DIR);
  if (manifestBefore.count === manifestAfter.count && manifestBefore.manifestHash === manifestAfter.manifestHash) {
    record("TC-C02", "Workstream C/D", "Cold storage evidence binaries (uploads/raw/) 100% unaltered", "PASSED", `${manifestAfter.count} files, SHA-256 manifest preserved`);
  } else {
    record("TC-C02", "Workstream C/D", "Cold storage evidence binaries (uploads/raw/) 100% unaltered", "FAILED", "Cold evidence altered!");
  }

  // Write Results Deliverable
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n================================================================`);
  console.log(`   PHASE 34.1 SUITE COMPLETED: ${results.metrics.passed}/${results.metrics.total} PASSED (${((results.metrics.passed / results.metrics.total) * 100).toFixed(1)}%)`);
  console.log(`   Results written to: ${OUT_FILE}`);
  console.log(`================================================================\n`);
}

main().catch((err) => {
  console.error("FATAL ERROR in Phase 34.1 Test Suite:", err);
  process.exit(1);
});
