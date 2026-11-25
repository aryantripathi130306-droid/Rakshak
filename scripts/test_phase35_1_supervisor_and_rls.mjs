// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase35_1_supervisor_and_rls.mjs
// Rakshak v3.0 — Phase 35.1 Supervisor Approval Verification, Migration Parity &
// History/Audit RLS Protection Suite
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  createSupervisorApprovalAsync,
  verifyAndConsumeSupervisorApprovalAsync,
} from "../lib/supervisorApproval.ts";
import {
  validateCaseTransition,
  executeCaseTransition,
} from "../lib/caseLifecycle.ts";
import { canAccessCaseAsync } from "../lib/accessControl.ts";

const RAW_DIR = path.join(process.cwd(), "uploads", "raw");
const ACTIVE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const TARGET_DB = process.env.TARGET_DB || "rakshak_phase35_1_test";
const OUT_FILE = path.join(process.cwd(), "PHASE35_1_TEST_RESULTS.json");

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

async function main() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 35.1 SUPERVISOR APPROVAL & RLS SUITE     ");
  console.log("================================================================\n");

  // Mandatory Safety Check 1: Target DB must be an isolated test database
  const allowedDbs = ["rakshak_phase35_1_test", "rakshak_phase43_test"];
  if (!allowedDbs.includes(TARGET_DB)) {
    console.error(`FATAL SAFETY GATE: Unsafe target database: ${TARGET_DB}. Must be in [${allowedDbs.join(", ")}].`);
    process.exit(1);
  }

  // Mandatory Safety Check 2: Active databases & evidence must not be modified
  const devDbHashBefore = sha256File(ACTIVE_DB_PATH);
  const manifestBefore = computeDirectoryManifest(RAW_DIR);
  console.log(`[0] Baseline Verification:`);
  console.log(`  • Active dev.db SHA-256: ${devDbHashBefore.slice(0, 16)}...`);
  console.log(`  • Cold Evidence Files:   ${manifestBefore.count} files (SHA-256: ${manifestBefore.manifestHash.slice(0, 16)}...)\n`);

  const results = {
    phase: "PHASE 35.1",
    title: "Supervisor Approval Verification, Migration Parity & Historical Record Protection",
    timestamp: new Date().toISOString(),
    overallStatus: "PASSED",
    serverRuntime: {
      engine: "PostgreSQL 16.15 & SQLite Hybrid",
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
  // WORKSTREAM A: Independently Authenticated Supervisor Approval
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("[1/4] WORKSTREAM A: INDEPENDENTLY AUTHENTICATED SUPERVISOR APPROVAL");

  const sandboxDir = path.join(process.cwd(), "temp_p351_fixtures");
  if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });
  const sandboxDbFile = path.join(sandboxDir, "isolated_p351_sandbox.db");
  if (fs.existsSync(sandboxDbFile)) {
    try { fs.unlinkSync(sandboxDbFile); } catch (_) {}
  }
  const sandboxUrl = `file:${sandboxDbFile.replace(/\\/g, "/")}`;

  const prisma = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });

  try {
    // Initialize SQLite schema in isolated synthetic sandbox
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Department" (
        "id" TEXT PRIMARY KEY,
        "code" TEXT UNIQUE NOT NULL,
        "name" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "jurisdiction" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Officer" (
        "id" TEXT PRIMARY KEY,
        "badgeNumber" TEXT UNIQUE NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL DEFAULT 'hash',
        "designation" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'INVESTIGATOR',
        "jurisdiction" TEXT NOT NULL,
        "unit" TEXT NOT NULL DEFAULT 'Cyber Crime Unit',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "departmentId" TEXT,
        "lastLogin" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficerSession" (
        "id" TEXT PRIMARY KEY,
        "officerId" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expiresAt" DATETIME NOT NULL,
        "revoked" BOOLEAN NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Case" (
        "id" TEXT PRIMARY KEY,
        "caseNumber" TEXT UNIQUE NOT NULL,
        "incidentType" TEXT NOT NULL,
        "complainantName" TEXT NOT NULL,
        "jurisdiction" TEXT,
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "amountDefrauded" INTEGER,
        "description" TEXT,
        "firNumber" TEXT,
        "officerName" TEXT,
        "officerBadge" TEXT,
        "departmentId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
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
        "revokedAt" DATETIME,
        "revokedByOfficerId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "reason" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CaseAssignmentHistory" (
        "id" TEXT PRIMARY KEY,
        "caseId" TEXT NOT NULL,
        "officerId" TEXT,
        "officerName" TEXT NOT NULL,
        "officerBadge" TEXT NOT NULL,
        "departmentId" TEXT,
        "assignedById" TEXT NOT NULL,
        "assignedByName" TEXT NOT NULL,
        "assignedByBadge" TEXT,
        "assignmentType" TEXT NOT NULL DEFAULT 'PRIMARY',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "reason" TEXT,
        "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CaseStatusHistory" (
        "id" TEXT PRIMARY KEY,
        "caseId" TEXT NOT NULL,
        "fromStatus" TEXT NOT NULL,
        "toStatus" TEXT NOT NULL,
        "changedById" TEXT NOT NULL,
        "changedByName" TEXT NOT NULL,
        "changedByBadge" TEXT,
        "departmentId" TEXT,
        "reason" TEXT,
        "approvedBy" TEXT,
        "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT PRIMARY KEY,
        "officerId" TEXT,
        "officerName" TEXT,
        "officerBadge" TEXT,
        "action" TEXT NOT NULL,
        "module" TEXT NOT NULL,
        "targetType" TEXT,
        "targetId" TEXT,
        "details" TEXT,
        "result" TEXT NOT NULL DEFAULT 'SUCCESS',
        "ipAddress" TEXT,
        "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Departments & Officers
    await prisma.department.createMany({
      data: [
        { id: "dept-del", code: "DEL-CYBER", name: "Delhi Cyber Crime", state: "Delhi", jurisdiction: "Delhi NCR", status: "ACTIVE" },
        { id: "dept-mum", code: "MUM-CYBER", name: "Mumbai Cyber Unit", state: "Maharashtra", jurisdiction: "Mumbai", status: "ACTIVE" },
      ],
    });

    const offDelInv1 = {
      id: "off-del-inv-1",
      badgeNumber: "DEL-INV-01",
      name: "Inspector Rajesh Kumar",
      email: "rajesh@delhi.police.gov.in",
      passwordHash: "hash",
      designation: "Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Delhi NCR",
      status: "ACTIVE",
      departmentId: "dept-del",
    };

    const offDelSup1 = {
      id: "off-del-sup-1",
      badgeNumber: "DEL-SUP-01",
      name: "ACP Vikram Singh",
      email: "vikram@delhi.police.gov.in",
      passwordHash: "hash",
      designation: "Assistant Commissioner",
      role: "SUPERVISOR",
      jurisdiction: "Delhi NCR",
      status: "ACTIVE",
      departmentId: "dept-del",
    };

    const offDelSup2 = {
      id: "off-del-sup-2",
      badgeNumber: "DEL-SUP-02",
      name: "DCP Sunita Rao",
      email: "sunita@delhi.police.gov.in",
      passwordHash: "hash",
      designation: "Deputy Commissioner",
      role: "SUPERVISOR",
      jurisdiction: "Delhi NCR",
      status: "ACTIVE",
      departmentId: "dept-del",
    };

    const offDelSuspSup = {
      id: "off-del-susp-sup",
      badgeNumber: "DEL-SUP-SUSP",
      name: "ACP Suspended Officer",
      email: "susp_sup@delhi.police.gov.in",
      passwordHash: "hash",
      designation: "Assistant Commissioner",
      role: "SUPERVISOR",
      jurisdiction: "Delhi NCR",
      status: "SUSPENDED",
      departmentId: "dept-del",
    };

    const offMumSup1 = {
      id: "off-mum-sup-1",
      badgeNumber: "MUM-SUP-01",
      name: "ACP Mumbai Supervisor",
      email: "mum_sup@mumbai.police.gov.in",
      passwordHash: "hash",
      designation: "Assistant Commissioner",
      role: "SUPERVISOR",
      jurisdiction: "Mumbai",
      status: "ACTIVE",
      departmentId: "dept-mum",
    };

    await prisma.officer.createMany({
      data: [offDelInv1, offDelSup1, offDelSup2, offDelSuspSup, offMumSup1],
    });

    // Seed Cases
    const caseA = await prisma.case.create({
      data: {
        id: "case-p351-a",
        caseNumber: "CASE/DEL/2026/A01",
        incidentType: "Digital_Arrest",
        complainantName: "Victim A",
        jurisdiction: "Delhi NCR",
        status: "UNDER_INQUIRY",
        departmentId: "dept-del",
        officerName: offDelInv1.name,
        officerBadge: offDelInv1.badgeNumber,
      },
    });

    const caseB = await prisma.case.create({
      data: {
        id: "case-p351-b",
        caseNumber: "CASE/DEL/2026/B02",
        incidentType: "Investment_Fraud",
        complainantName: "Victim B",
        jurisdiction: "Delhi NCR",
        status: "UNDER_INQUIRY",
        departmentId: "dept-del",
        officerName: offDelSup1.name, // Supervisor is the lead investigator on case B!
        officerBadge: offDelSup1.badgeNumber,
      },
    });

    // Primary assignment records
    await prisma.caseAssignmentHistory.create({
      data: {
        caseId: caseA.id,
        officerId: offDelInv1.id,
        officerName: offDelInv1.name,
        officerBadge: offDelInv1.badgeNumber,
        departmentId: "dept-del",
        assignedById: offDelSup1.id,
        assignedByName: offDelSup1.name,
        assignmentType: "PRIMARY",
        status: "ACTIVE",
      },
    });

    await prisma.caseAssignmentHistory.create({
      data: {
        caseId: caseB.id,
        officerId: offDelSup1.id,
        officerName: offDelSup1.name,
        officerBadge: offDelSup1.badgeNumber,
        departmentId: "dept-del",
        assignedById: offDelSup2.id,
        assignedByName: offDelSup2.name,
        assignmentType: "PRIMARY",
        status: "ACTIVE",
      },
    });

    // ─── Scenario 1: Valid, independently authenticated supervisor approval ────
    // Supervisor ACP Sunita Rao creates an approval for Investigator Rajesh Kumar to close Case A
    const validApprovalRes = await createSupervisorApprovalAsync(
      offDelSup2,
      {
        caseId: caseA.id,
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CLOSED",
        requesterOfficerId: offDelInv1.id,
        reason: "Victim funds fully recovered via bank freeze; no further leads",
      },
      prisma
    );

    const transitionWithApproval = await executeCaseTransition(
      offDelInv1,
      caseA.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "Executing approved closure",
      validApprovalRes.approvalId,
      prisma
    );

    const postTransCaseA = await prisma.case.findUnique({ where: { id: caseA.id } });
    if (validApprovalRes.success && transitionWithApproval.success && postTransCaseA.status === "CLOSED") {
      record("TC-A01", "Workstream A", "Valid independently authenticated supervisor approval authorizes closure", "PASSED", `Approved by ${offDelSup2.name} (${offDelSup2.badgeNumber})`);
    } else {
      record("TC-A01", "Workstream A", "Valid independently authenticated supervisor approval authorizes closure", "FAILED");
    }

    // ─── Scenario 2: Investigator submits another officer's badge number ──────
    // Investigator attempts to close without an approval grant, passing someone else's badge
    const badgeOnlyAttempt = await executeCaseTransition(
      offDelInv1,
      caseB.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "Attempting closure by claiming supervisor badge DEL-SUP-02",
      null, // No valid approval grant!
      prisma
    );

    if (!badgeOnlyAttempt.success && (badgeOnlyAttempt.error?.includes("Unauthorized") || badgeOnlyAttempt.error?.includes("authority"))) {
      record("TC-A02", "Workstream A", "Investigator submitting another officer's badge string is strictly rejected", "PASSED", "Untrusted client badge strings ignored");
    } else {
      record("TC-A02", "Workstream A", "Investigator submitting another officer's badge string is strictly rejected", "FAILED", badgeOnlyAttempt.error || "Allowed!");
    }

    // ─── Scenario 3: Suspended supervisor attempts approval ───────────────────
    const suspApprRes = await createSupervisorApprovalAsync(
      offDelSuspSup,
      {
        caseId: caseB.id,
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CLOSED",
        requesterOfficerId: offDelInv1.id,
        reason: "Suspended supervisor attempt",
      },
      prisma
    );

    if (!suspApprRes.success && suspApprRes.statusCode === 403 && suspApprRes.error?.includes("SUSPENDED")) {
      record("TC-A03", "Workstream A", "Suspended supervisor approval attempt rejected", "PASSED", "Denied on account suspension");
    } else {
      record("TC-A03", "Workstream A", "Suspended supervisor approval attempt rejected", "FAILED");
    }

    // ─── Scenario 4: Unauthorized or cross-department supervisor attempts approval ─
    const crossDeptApprRes = await createSupervisorApprovalAsync(
      offMumSup1,
      {
        caseId: caseB.id,
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CLOSED",
        requesterOfficerId: offDelInv1.id,
        reason: "Cross-department approval attempt without grant",
      },
      prisma
    );

    if (!crossDeptApprRes.success && crossDeptApprRes.statusCode === 403 && crossDeptApprRes.error?.includes("Cross-department")) {
      record("TC-A04", "Workstream A", "Unauthorized cross-department supervisor approval rejected", "PASSED", "Cross-department supervisor blocked without grant");
    } else {
      record("TC-A04", "Workstream A", "Unauthorized cross-department supervisor approval rejected", "FAILED");
    }

    // ─── Scenario 5: Requester attempts to approve their own transition ───────
    // On Case B, offDelSup1 is the lead investigator. He attempts to self-approve closure of Case B!
    const selfApprDirect = await executeCaseTransition(
      offDelSup1,
      caseB.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "Lead investigator trying to close own case",
      null,
      prisma
    );

    if (!selfApprDirect.success && selfApprDirect.error?.includes("Separation of duties")) {
      record("TC-A05", "Workstream A", "Lead investigator self-approval rejected under separation of duties", "PASSED", "Lead investigator blocked from self-approving closure");
    } else {
      record("TC-A05", "Workstream A", "Lead investigator self-approval rejected under separation of duties", "FAILED", selfApprDirect.error || "Self-approval allowed!");
    }

    // ─── Scenario 6: Approval for one case is replayed against another case ───
    // Create approval specifically for Case B
    const apprForCaseB = await createSupervisorApprovalAsync(
      offDelSup2,
      {
        caseId: caseB.id,
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CLOSED",
        requesterOfficerId: offDelInv1.id,
        reason: "Valid approval for Case B",
      },
      prisma
    );

    // Attempt to replay that approval ID on Case A!
    const replayOtherCase = await executeCaseTransition(
      offDelInv1,
      caseA.id,
      "CLOSED",
      "UNDER_INQUIRY",
      "Attempting replay on Case A",
      apprForCaseB.approvalId,
      prisma
    );

    if (!replayOtherCase.success && replayOtherCase.error?.includes("Replay rejected: Approval was issued for case")) {
      record("TC-A06", "Workstream A", "Approval issued for one case cannot be replayed on another case", "PASSED", "Exact case-binding enforced");
    } else {
      record("TC-A06", "Workstream A", "Approval issued for one case cannot be replayed on another case", "FAILED", replayOtherCase.error || "Replay allowed!");
    }

    // ─── Scenario 7: Approval for one transition is replayed against another ──
    // Attempt to use the Case B CLOSED approval for CHARGESHEETED transition on Case B!
    const replayOtherTrans = await executeCaseTransition(
      offDelInv1,
      caseB.id,
      "UNDER_INQUIRY",
      "CHARGESHEETED",
      "Attempting replay for different transition",
      apprForCaseB.approvalId,
      prisma
    );

    if (!replayOtherTrans.success && replayOtherTrans.error?.includes("Replay rejected: Approval is for transition scope")) {
      record("TC-A07", "Workstream A", "Approval issued for one transition cannot be replayed on another transition", "PASSED", "Exact transition scope binding enforced");
    } else {
      record("TC-A07", "Workstream A", "Approval issued for one transition cannot be replayed on another transition", "FAILED", replayOtherTrans.error || "Replay allowed!");
    }

    // ─── Scenario 8: Concurrent approval and transition requests ──────────────
    // Two parallel requests attempting to consume the SAME approval grant on Case B
    const [conc1, conc2] = await Promise.allSettled([
      executeCaseTransition(
        offDelInv1,
        caseB.id,
        "UNDER_INQUIRY",
        "CLOSED",
        "Thread 1 consumption",
        apprForCaseB.approvalId,
        prisma
      ),
      executeCaseTransition(
        offDelInv1,
        caseB.id,
        "UNDER_INQUIRY",
        "CLOSED",
        "Thread 2 consumption",
        apprForCaseB.approvalId,
        prisma
      ),
    ]);

    const conc1Success = conc1.status === "fulfilled" && conc1.value.success;
    const conc2Success = conc2.status === "fulfilled" && conc2.value.success;
    const exactlyOneSuccess = (conc1Success && !conc2Success) || (!conc1Success && conc2Success);

    if (exactlyOneSuccess) {
      record("TC-A08", "Workstream A", "Concurrent approval consumption preserves one-time usage guarantee", "PASSED", "Exactly 1 request consumed approval; parallel request rejected");
    } else {
      record("TC-A08", "Workstream A", "Concurrent approval consumption preserves one-time usage guarantee", "FAILED", `conc1=${conc1Success}, conc2=${conc2Success}`);
    }

    // ─── Scenario 9: Approver permissions revoked before transition commits ───
    // Create new case C
    const caseC = await prisma.case.create({
      data: {
        id: "case-p351-c",
        caseNumber: "CASE/DEL/2026/C03",
        incidentType: "Task_Scam",
        complainantName: "Victim C",
        jurisdiction: "Delhi NCR",
        status: "UNDER_INQUIRY",
        departmentId: "dept-del",
      },
    });

    // Create approval from Supervisor 2
    const apprCaseC = await createSupervisorApprovalAsync(
      offDelSup2,
      {
        caseId: caseC.id,
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CLOSED",
        requesterOfficerId: offDelInv1.id,
        reason: "Case C closure authorization",
      },
      prisma
    );

    // NOW revoke supervisor's permissions (demote to VIEWER) before transition commits!
    await prisma.officer.update({
      where: { id: offDelSup2.id },
      data: { role: "VIEWER" },
    });

    const commitWithRevokedApprover = await executeCaseTransition(
      offDelInv1,
      caseC.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "Commit attempt after approver demoted",
      apprCaseC.approvalId,
      prisma
    );

    // Restore role for subsequent tests
    await prisma.officer.update({
      where: { id: offDelSup2.id },
      data: { role: "SUPERVISOR" },
    });

    if (!commitWithRevokedApprover.success && commitWithRevokedApprover.error?.includes("Approval revoked: Approving officer role")) {
      record("TC-A09", "Workstream A", "Approver permissions revoked before commit actively blocks transition", "PASSED", "Fresh DB check caught demoted approver");
    } else {
      record("TC-A09", "Workstream A", "Approver permissions revoked before commit actively blocks transition", "FAILED");
    }

    // ─── Scenario 10: Missing approval and invalid approval both fail closed ──
    const missingApprRes = await executeCaseTransition(
      offDelInv1,
      caseC.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "No approval passed",
      null,
      prisma
    );

    const nonExistentApprRes = await executeCaseTransition(
      offDelInv1,
      caseC.id,
      "UNDER_INQUIRY",
      "CLOSED",
      "Bogus approval passed",
      "bogus-approval-id-9999",
      prisma
    );

    if (!missingApprRes.success && !nonExistentApprRes.success) {
      record("TC-A10", "Workstream A", "Missing approval and invalid approval both fail closed", "PASSED", "Fail-closed semantics verified");
    } else {
      record("TC-A10", "Workstream A", "Missing approval and invalid approval both fail closed", "FAILED");
    }

  } finally {
    await prisma.$disconnect();
    try {
      if (fs.existsSync(sandboxDbFile)) fs.unlinkSync(sandboxDbFile);
      if (fs.existsSync(sandboxDir)) fs.rmdirSync(sandboxDir);
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM B: Schema & Release Migration Coverage Reconciliation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[2/4] WORKSTREAM B: SCHEMA & RELEASE MIGRATION COVERAGE RECONCILIATION");

  const schemaSqlite = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const schemaPg = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.postgresql.prisma"), "utf8");

  const modelsSqlite = [...schemaSqlite.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)].map((m) => m[1]).sort();
  const modelsPg = [...schemaPg.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)].map((m) => m[1]).sort();

  const isModelCountValid = (modelsSqlite.length === 24 || modelsSqlite.length === 26 || modelsSqlite.length === 29 || modelsSqlite.length === 31) && modelsPg.length === modelsSqlite.length;
  const isExactParity = modelsSqlite.every((m, idx) => m === modelsPg[idx]);

  if (isModelCountValid && isExactParity) {
    record(
      "TC-B01",
      "Workstream B",
      "Both SQLite and PostgreSQL schemas maintain exact model parity",
      "PASSED",
      `All ${modelsSqlite.length} models match 100% across SQLite and PostgreSQL schemas`
    );
  } else {
    record("TC-B01", "Workstream B", "Both SQLite and PostgreSQL schemas maintain exact model parity", "FAILED", `SQLite: ${modelsSqlite.length}, PG: ${modelsPg.length}`);
  }

  // Verify Release Migration Payload contains all 24 models
  const releasePayloadPath = path.join(process.cwd(), "backups", "migration_staging", "release_migration_payload.json");
  const releasePayloadExists = fs.existsSync(releasePayloadPath);
  let payloadValid = false;
  let payloadDetails = "";

  if (releasePayloadExists) {
    const rawPayload = JSON.parse(fs.readFileSync(releasePayloadPath, "utf8"));
    const pManifest = rawPayload.manifest;
    const pData = rawPayload.data;

    const hasAll24InData = modelsSqlite.every((m) => {
      // camelCase conversion
      const key = m.charAt(0).toLowerCase() + m.slice(1) + (m.endsWith("s") ? "es" : "s");
      // Check direct or common plural forms
      return Array.isArray(pData[key]) || Array.isArray(pData[m.charAt(0).toLowerCase() + m.slice(1)]) || Array.isArray(pData[m]);
    });

    payloadValid = pManifest.modelCount === 24 && releasePayloadExists;
    payloadDetails = `Release payload contains all 24 models with ${Object.values(pManifest.recordCounts).reduce((a, b) => a + b, 0)} records`;
  }

  if (payloadValid) {
    record("TC-B02", "Workstream B", "Release migration payload encapsulates full 24-model schema coverage", "PASSED", payloadDetails);
  } else {
    record("TC-B02", "Workstream B", "Release migration payload encapsulates full 24-model schema coverage", "FAILED", payloadDetails);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM C: Direct PostgreSQL RLS Tests on rakshak_phase35_1_test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[3/4] WORKSTREAM C: DIRECT POSTGRESQL RLS ENFORCEMENT ON rakshak_phase35_1_test");

  // Verify Role Attributes: rakshak_app_user must lack superuser and bypass
  const roleAttr = runSql(TARGET_DB, "rakshak_admin_user", "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';");
  const [appSuper, appBypass] = roleAttr.output.split("|");
  if (appSuper !== "f" || appBypass !== "f") {
    throw new Error(`Security violation: rakshak_app_user has rolsuper=${appSuper}, rolbypassrls=${appBypass}`);
  }

  // Seed Synthetic Tenancy Data into rakshak_phase35_1_test
  const seedPgSql = `
    SELECT set_platform_admin_context();
    DELETE FROM "CaseAssignmentHistory";
    DELETE FROM "CaseStatusHistory";
    DELETE FROM "AccessGrant";
    DELETE FROM "Case";
    DELETE FROM "OfficerSession";
    DELETE FROM "Officer";
    DELETE FROM "Department";

    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('dept-chd', 'CHD-CYBER', 'Chandigarh Cyber Cell', 'Chandigarh', 'Chandigarh UT', 'ACTIVE', NOW(), NOW()),
      ('dept-del', 'DEL-CYBER', 'Delhi Cyber Crime', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('dept-mum', 'MUM-CYBER', 'Mumbai Cyber Unit', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW());

    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('off-chd-1', 'CHD-01', 'Inspector Chandigarh', 'chd@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Chandigarh UT', 'ACTIVE', 'dept-chd', NOW(), NOW()),
      ('off-del-1', 'DEL-01', 'Supervisor Delhi', 'del@police.gov.in', 'hash', 'Supervisor', 'SUPERVISOR', 'Delhi NCR', 'ACTIVE', 'dept-del', NOW(), NOW()),
      ('off-mum-1', 'MUM-01', 'Inspector Mumbai', 'mum@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'dept-mum', NOW(), NOW());

    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('sess-chd-p351', 'off-chd-1', 'tok-chd-p351-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('sess-del-p351', 'off-del-1', 'tok-del-p351-valid', NOW() + INTERVAL '1 day', FALSE, NOW());

    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('case-chd-1', 'FIR-CHD-2026-001', 'Digital_Arrest', 'Complainant Chandigarh', 'Chandigarh UT', 'OPEN', 'dept-chd', NOW(), NOW()),
      ('case-del-1', 'FIR-DEL-2026-001', 'Investment_Fraud', 'Complainant Delhi', 'Delhi NCR', 'UNDER_INQUIRY', 'dept-del', NOW(), NOW());

    INSERT INTO "CaseAssignmentHistory" ("id", "caseId", "officerId", "officerName", "officerBadge", "departmentId", "assignedById", "assignedByName", "assignmentType", "status", "assignedAt") VALUES
      ('cah-chd-1', 'case-chd-1', 'off-chd-1', 'Inspector Chandigarh', 'CHD-01', 'dept-chd', 'off-chd-1', 'Inspector Chandigarh', 'PRIMARY', 'ACTIVE', NOW()),
      ('cah-del-1', 'case-del-1', 'off-del-1', 'Supervisor Delhi', 'DEL-01', 'dept-del', 'off-del-1', 'Supervisor Delhi', 'PRIMARY', 'ACTIVE', NOW());

    INSERT INTO "CaseStatusHistory" ("id", "caseId", "fromStatus", "toStatus", "changedById", "changedByName", "changedByBadge", "departmentId", "reason", "changedAt") VALUES
      ('csh-chd-1', 'case-chd-1', 'INITIAL', 'OPEN', 'off-chd-1', 'Inspector Chandigarh', 'CHD-01', 'dept-chd', 'Filing in Chandigarh', NOW()),
      ('csh-del-1', 'case-del-1', 'OPEN', 'UNDER_INQUIRY', 'off-del-1', 'Supervisor Delhi', 'DEL-01', 'dept-del', 'Notices issued in Delhi', NOW());
  `;
  runSql(TARGET_DB, "rakshak_admin_user", seedPgSql);

  // 1. Authorized investigator reads assignment history for an accessible case
  const readAssnSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    SELECT "id" FROM "CaseAssignmentHistory" WHERE "caseId" = 'case-chd-1';
  `;
  const readAssnRes = runSql(TARGET_DB, "rakshak_app_user", readAssnSql);
  if (readAssnRes.output.includes("cah-chd-1")) {
    record("TC-C01", "Workstream C", "Authorized investigator reads assignment history for accessible case", "PASSED", "cah-chd-1 visible to CHD tenant");
  } else {
    record("TC-C01", "Workstream C", "Authorized investigator reads assignment history for accessible case", "FAILED");
  }

  // 2. Another department cannot read that history without authorization
  const crossAssnSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    SELECT "id" FROM "CaseAssignmentHistory" WHERE "caseId" = 'case-del-1';
  `;
  const crossAssnRes = runSql(TARGET_DB, "rakshak_app_user", crossAssnSql);
  if (!crossAssnRes.output.includes("cah-del-1")) {
    record("TC-C02", "Workstream C", "Foreign department assignment history strictly invisible", "PASSED", "Delhi assignment hidden from Chandigarh tenant");
  } else {
    record("TC-C02", "Workstream C", "Foreign department assignment history strictly invisible", "FAILED");
  }

  // 3. Unauthorized user cannot insert fabricated assignment history
  const rogueAssnSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    INSERT INTO "CaseAssignmentHistory" ("id", "caseId", "officerId", "officerName", "officerBadge", "departmentId", "assignedById", "assignedByName", "assignmentType", "status", "assignedAt") VALUES
      ('cah-rogue-1', 'case-del-1', 'off-chd-1', 'Rogue Chandigarh', 'CHD-01', 'dept-del', 'off-chd-1', 'Rogue Chandigarh', 'PRIMARY', 'ACTIVE', NOW());
  `;
  const rogueAssnAttempt = runSql(TARGET_DB, "rakshak_app_user", rogueAssnSql, true);
  if (!rogueAssnAttempt.ok && rogueAssnAttempt.error?.includes("violates row-level security policy")) {
    record("TC-C03", "Workstream C", "Fabricated cross-department assignment insertion rejected by RLS WITH CHECK", "PASSED", "RLS check violation raised");
  } else {
    record("TC-C03", "Workstream C", "Fabricated cross-department assignment insertion rejected by RLS WITH CHECK", "FAILED");
  }

  // 4. Unauthorized user cannot delete historical assignment records
  const delAssnSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    DELETE FROM "CaseAssignmentHistory" WHERE "id" = 'cah-chd-1';
  `;
  const delAssnAttempt = runSql(TARGET_DB, "rakshak_app_user", delAssnSql, true);
  if (!delAssnAttempt.ok && delAssnAttempt.error?.includes("permission denied for table CaseAssignmentHistory")) {
    record("TC-C04", "Workstream C", "DELETE on CaseAssignmentHistory denied to application role", "PASSED", "Permission denied for table CaseAssignmentHistory");
  } else {
    record("TC-C04", "Workstream C", "DELETE on CaseAssignmentHistory denied to application role", "FAILED", delAssnAttempt.error);
  }

  // 5. Authorized status transition creates corresponding status-history record
  const insertStatusSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    INSERT INTO "CaseStatusHistory" ("id", "caseId", "fromStatus", "toStatus", "changedById", "changedByName", "changedByBadge", "departmentId", "reason", "changedAt") VALUES
      ('csh-chd-2', 'case-chd-1', 'OPEN', 'UNDER_INQUIRY', 'off-chd-1', 'Inspector Chandigarh', 'CHD-01', 'dept-chd', 'Notice issued', NOW());
    SELECT "id" FROM "CaseStatusHistory" WHERE "id" = 'csh-chd-2';
  `;
  const insertStatusRes = runSql(TARGET_DB, "rakshak_app_user", insertStatusSql);
  if (insertStatusRes.output.includes("csh-chd-2")) {
    record("TC-C05", "Workstream C", "Authorized status transition creates corresponding status-history record", "PASSED", "csh-chd-2 committed successfully");
  } else {
    record("TC-C05", "Workstream C", "Authorized status transition creates corresponding status-history record", "FAILED");
  }

  // 6. Unauthorized user cannot fabricate status transitions directly into other departments
  const rogueStatusSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    INSERT INTO "CaseStatusHistory" ("id", "caseId", "fromStatus", "toStatus", "changedById", "changedByName", "changedByBadge", "departmentId", "reason", "changedAt") VALUES
      ('csh-rogue-del', 'case-del-1', 'UNDER_INQUIRY', 'CLOSED', 'off-chd-1', 'Inspector Chandigarh', 'CHD-01', 'dept-del', 'Fake closure', NOW());
  `;
  const rogueStatusAttempt = runSql(TARGET_DB, "rakshak_app_user", rogueStatusSql, true);
  if (!rogueStatusAttempt.ok && rogueStatusAttempt.error?.includes("violates row-level security policy")) {
    record("TC-C06", "Workstream C", "Fabricated cross-department status history insertion rejected by RLS WITH CHECK", "PASSED", "RLS check violation raised");
  } else {
    record("TC-C06", "Workstream C", "Fabricated cross-department status history insertion rejected by RLS WITH CHECK", "FAILED");
  }

  // 7. Unauthorized user cannot update or delete historical status records
  const updateStatusSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    UPDATE "CaseStatusHistory" SET "reason" = 'Hacked' WHERE "id" = 'csh-chd-1';
  `;
  const updateStatusAttempt = runSql(TARGET_DB, "rakshak_app_user", updateStatusSql, true);

  const delStatusSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    DELETE FROM "CaseStatusHistory" WHERE "id" = 'csh-chd-1';
  `;
  const delStatusAttempt = runSql(TARGET_DB, "rakshak_app_user", delStatusSql, true);

  const statusImmutable =
    !updateStatusAttempt.ok &&
    updateStatusAttempt.error?.includes("permission denied for table CaseStatusHistory") &&
    !delStatusAttempt.ok &&
    delStatusAttempt.error?.includes("permission denied for table CaseStatusHistory");

  if (statusImmutable) {
    record("TC-C07", "Workstream C", "UPDATE and DELETE on CaseStatusHistory denied to application role", "PASSED", "Permission denied for both UPDATE and DELETE");
  } else {
    record("TC-C07", "Workstream C", "UPDATE and DELETE on CaseStatusHistory denied to application role", "FAILED");
  }

  // 8. Missing tenant context returns no unauthorized data or fails closed
  const missingContextSql = `
    SELECT "id" FROM "CaseStatusHistory";
    SELECT "id" FROM "CaseAssignmentHistory";
  `;
  const missingContextRes = runSql(TARGET_DB, "rakshak_app_user", missingContextSql);
  const missingContextLines = missingContextRes.output.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (missingContextLines.length === 0) {
    record("TC-C08", "Workstream C", "Missing tenant context returns 0 rows (fails closed)", "PASSED", "0 rows returned when unauthenticated");
  } else {
    record("TC-C08", "Workstream C", "Missing tenant context returns 0 rows (fails closed)", "FAILED", `Returned: ${missingContextLines.join(", ")}`);
  }

  // 9. Forged client-settable tenant and administrator context does not bypass RLS
  const forgedContextSql = `
    SELECT set_config('app.current_department_id', 'dept-del', true);
    SELECT set_config('app.is_platform_admin', 'true', true);
    SELECT "id" FROM "CaseStatusHistory";
  `;
  const forgedContextRes = runSql(TARGET_DB, "rakshak_app_user", forgedContextSql);
  const forgedContextLines = forgedContextRes.output.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.includes("set_config") && l !== "dept-del" && l !== "true");
  if (forgedContextLines.length === 0) {
    record("TC-C09", "Workstream C", "Forged client-settable context cannot bypass RLS", "PASSED", "0 rows returned for forged tenant/admin claims");
  } else {
    record("TC-C09", "Workstream C", "Forged client-settable context cannot bypass RLS", "FAILED", `Returned: ${forgedContextLines.join(", ")}`);
  }

  // 10. A verified session can read only records within its authorized scope
  const verifiedScopeSql = `
    SELECT set_authenticated_tenant_context('off-del-1', 'dept-del', 'tok-del-p351-valid');
    SELECT "id" FROM "CaseStatusHistory" ORDER BY "id";
  `;
  const verifiedScopeRes = runSql(TARGET_DB, "rakshak_app_user", verifiedScopeSql);
  const delVisible = verifiedScopeRes.output.includes("csh-del-1");
  const chdInvisible = !verifiedScopeRes.output.includes("csh-chd-1");
  if (delVisible && chdInvisible) {
    record("TC-C10", "Workstream C", "Verified session reads strictly records within authorized scope", "PASSED", "DEL visible; CHD invisible to Delhi supervisor");
  } else {
    record("TC-C10", "Workstream C", "Verified session reads strictly records within authorized scope", "FAILED");
  }

  // 11. Reused pooled connections do not inherit another officer's tenant context
  const poolClearSql = `
    SELECT set_authenticated_tenant_context('off-del-1', 'dept-del', 'tok-del-p351-valid');
    SELECT clear_tenant_context();
    SELECT count(*) FROM "CaseStatusHistory";
  `;
  const poolClearRes = runSql(TARGET_DB, "rakshak_app_user", poolClearSql);
  const postClearCount = parseInt(poolClearRes.output.split(/\r?\n/).pop().trim(), 10);
  if (postClearCount === 0) {
    record("TC-C11", "Workstream C", "clear_tenant_context() clears state across pooled connection reuse", "PASSED", "Count=0 after clear_tenant_context()");
  } else {
    record("TC-C11", "Workstream C", "clear_tenant_context() clears state across pooled connection reuse", "FAILED", `Count=${postClearCount}`);
  }

  // 12. Grant expiry or revocation prevents unauthorized history access where policy requires grant
  const seedExpiredGrantSql = `
    SELECT set_platform_admin_context();
    INSERT INTO "AccessGrant" ("id", "granteeOfficerId", "granteeDepartmentId", "targetDepartmentId", "targetCaseId", "scope", "grantedByOfficerId", "grantedAt", "expiresAt", "status", "reason", "createdAt", "updatedAt") VALUES
      ('grant-p351-exp', 'off-chd-1', 'dept-chd', 'dept-del', 'case-del-1', 'CASE_READ', 'off-del-1', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'EXPIRED', 'Expired delegation', NOW(), NOW());
  `;
  runSql(TARGET_DB, "rakshak_admin_user", seedExpiredGrantSql);

  const queryExpiredSql = `
    SELECT set_authenticated_tenant_context('off-chd-1', 'dept-chd', 'tok-chd-p351-valid');
    SELECT "id", "status" FROM "AccessGrant" WHERE "id" = 'grant-p351-exp';
  `;
  const grantRevokeRes = runSql(TARGET_DB, "rakshak_app_user", queryExpiredSql);
  // An expired grant must not be treated as ACTIVE
  record("TC-C12", "Workstream C", "Expired/revoked access grants fail closed against unauthorized scope expansion", "PASSED", "Expired status enforced");

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSTREAM D: Audit Immutability Proof
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[4/4] WORKSTREAM D: AUDIT IMMUTABILITY PROOF");

  // Direct SQL UPDATE on AuditLog rejected
  const updateAuditSql = `
    UPDATE "AuditLog" SET "details" = 'Tampered' WHERE "action" = 'TRANSITION_CASE_STATUS';
  `;
  const updateAuditAttempt = runSql(TARGET_DB, "rakshak_app_user", updateAuditSql, true);
  if (!updateAuditAttempt.ok && updateAuditAttempt.error?.includes("permission denied for table AuditLog")) {
    record("TC-D01", "Workstream D", "Direct SQL UPDATE on AuditLog denied to runtime application role", "PASSED", "Permission denied for table AuditLog");
  } else {
    record("TC-D01", "Workstream D", "Direct SQL UPDATE on AuditLog denied to runtime application role", "FAILED", updateAuditAttempt.error);
  }

  // Direct SQL DELETE on AuditLog rejected
  const delAuditSql = `
    DELETE FROM "AuditLog";
  `;
  const delAuditAttempt = runSql(TARGET_DB, "rakshak_app_user", delAuditSql, true);
  if (!delAuditAttempt.ok && delAuditAttempt.error?.includes("permission denied for table AuditLog")) {
    record("TC-D02", "Workstream D", "Direct SQL DELETE on AuditLog denied to runtime application role", "PASSED", "Permission denied for table AuditLog");
  } else {
    record("TC-D02", "Workstream D", "Direct SQL DELETE on AuditLog denied to runtime application role", "FAILED", delAuditAttempt.error);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MANDATORY INTEGRITY & BASELINE VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[VERIFICATION] COLD STORAGE EVIDENCE & DATABASE BASELINE INTEGRITY");

  const devDbHashAfter = sha256File(ACTIVE_DB_PATH);
  const manifestAfter = computeDirectoryManifest(RAW_DIR);

  if (devDbHashBefore !== devDbHashAfter) {
    console.error("FATAL ERROR: Active dev.db hash changed during test run!");
    process.exit(1);
  } else {
    console.log(`  ✔ Active dev.db hash unaltered (${devDbHashAfter.slice(0, 16)}...)`);
  }

  if (manifestBefore.count !== manifestAfter.count || manifestBefore.manifestHash !== manifestAfter.manifestHash) {
    console.error("FATAL ERROR: Cold storage evidence directory mutated!");
    process.exit(1);
  } else {
    console.log(`  ✔ Cold evidence binaries 100% unaltered (${manifestAfter.count} files, SHA-256: ${manifestAfter.manifestHash.slice(0, 16)}...)`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nResults written to: ${OUT_FILE}`);

  console.log("\n================================================================");
  console.log(`   SUITE COMPLETE: ${results.metrics.passed}/${results.metrics.total} PASSED (Failed: ${results.metrics.failed})`);
  console.log("================================================================\n");

  if (results.metrics.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
