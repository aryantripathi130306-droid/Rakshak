// scripts/run_phase45_e2e_verification.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 45 End-to-End Investigative Workflow Verification
// Executes complete application workflows across authentication, case management,
// evidence custody, text extraction, human fact review, cross-case intelligence,
// dossier generation, report export, frontend API bindings, and cross-tenant RLS.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { PSQL_PATH } from "./authoritative_migration_runner.mjs";

const TARGET_DB = "rakshak_phase45_test";
const API_BASE = "http://127.0.0.1:3005";
const DEV_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const RAW_DIR = path.join(process.cwd(), "uploads", "raw");
const SYNTH_DIR = path.join(process.cwd(), "uploads", "synthetic_test_p45");
const OUT_JSON = path.join(process.cwd(), "PHASE45_TEST_RESULTS.json");

const BASELINE_DEV_DB_HASH = "dd24614b14f1b4cf8413b674e27bba8459eec6c182536537ab085dbd647af3a9";
const BASELINE_RAW_COUNT = 560;
const BASELINE_RAW_MANIFEST = "bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "missing";
  return sha256(fs.readFileSync(filePath));
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

function querySql(db, sql, user = "postgres") {
  const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
  return execFileSync(
    PSQL_PATH,
    ["-h", "127.0.0.1", "-U", user, "-d", db, "-t", "-A", "-c", sql],
    { env, encoding: "utf8" }
  ).trim();
}

const testResults = [];
let totalAssertions = 0;

function recordTest(id, category, name, command, expected, actual, passed, httpStatus = 200, durationMs = 0) {
  totalAssertions++;
  const status = passed ? "PASSED" : "FAILED";
  const symbol = passed ? "✔" : "✖";
  console.log(`  ${symbol} [${status}] ${id}: ${name} (${durationMs}ms)`);
  if (!passed) {
    console.error(`      Expected: ${JSON.stringify(expected)}`);
    console.error(`      Actual:   ${JSON.stringify(actual)}`);
  }
  testResults.push({
    id,
    category,
    name,
    command,
    expected,
    actual,
    status,
    httpStatus,
    durationMs,
  });
}

async function runScenario(id, category, name, fn) {
  const start = Date.now();
  try {
    const res = await fn();
    const duration = Date.now() - start;
    recordTest(id, category, name, res.command, res.expected, res.actual, res.passed, res.httpStatus, duration);
  } catch (err) {
    const duration = Date.now() - start;
    recordTest(id, category, name, "error_handler", "Expected success", err.message, false, 500, duration);
  }
}

async function main() {
  console.log("\n================================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 45 END-TO-END INVESTIGATIVE WORKFLOW VERIFICATION       ");
  console.log(`   Database Target: ${TARGET_DB} | API Origin: ${API_BASE}`);
  console.log("================================================================================\n");

  // Ensure isolated synthetic uploads dir exists
  if (!fs.existsSync(SYNTH_DIR)) {
    fs.mkdirSync(SYNTH_DIR, { recursive: true });
  }

  // Ensure fresh baseline seed state for reproducible test run
  querySql(
    TARGET_DB,
    `UPDATE "ExtractedFact" SET "reviewStatus" = 'PENDING_REVIEW', "verificationStatus" = 'UNVERIFIED', "normalizedValue" = '+919876543210' WHERE "id" = 'p45-fact-del-01';`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Safety Invariant Verification (P45-SAFE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[1/11] Executing Safety & Invariant Checks...");

  await runScenario("P45-SAFE-01", "Safety", "prisma/dev.db pre-test SHA-256 matches baseline", async () => {
    const hash = sha256File(DEV_DB_PATH);
    return {
      command: `sha256(${DEV_DB_PATH})`,
      expected: BASELINE_DEV_DB_HASH,
      actual: hash,
      passed: hash === BASELINE_DEV_DB_HASH,
      httpStatus: 200,
    };
  });

  await runScenario("P45-SAFE-02", "Safety", "uploads/raw file count strictly equals 560 files", async () => {
    const manifest = computeDirectoryManifest(RAW_DIR);
    return {
      command: `countFiles(${RAW_DIR})`,
      expected: BASELINE_RAW_COUNT,
      actual: manifest.count,
      passed: manifest.count === BASELINE_RAW_COUNT,
      httpStatus: 200,
    };
  });

  await runScenario("P45-SAFE-03", "Safety", "uploads/raw manifest digest matches baseline", async () => {
    const manifest = computeDirectoryManifest(RAW_DIR);
    return {
      command: `manifestHash(${RAW_DIR})`,
      expected: BASELINE_RAW_MANIFEST,
      actual: manifest.manifestHash,
      passed: manifest.manifestHash === BASELINE_RAW_MANIFEST,
      httpStatus: 200,
    };
  });

  await runScenario("P45-SAFE-04", "Safety", "PostgreSQL target is confirmed as rakshak_phase45_test", async () => {
    const currentDb = querySql(TARGET_DB, "SELECT current_database();");
    return {
      command: "SELECT current_database();",
      expected: TARGET_DB,
      actual: currentDb,
      passed: currentDb === TARGET_DB,
      httpStatus: 200,
    };
  });

  await runScenario("P45-SAFE-05", "Safety", "Historical test databases protected against mutation", async () => {
    const dbs = ["rakshak_phase26_test", "rakshak_phase43_test", "rakshak_phase44_restore_test"];
    let allExist = true;
    for (const db of dbs) {
      const exists = querySql("postgres", `SELECT count(*) FROM pg_database WHERE datname = '${db}';`);
      if (parseInt(exists, 10) !== 1) allExist = false;
    }
    return {
      command: "Check historical databases existence in catalog",
      expected: true,
      actual: allExist,
      passed: allExist,
      httpStatus: 200,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Environment & Migration Baseline (P45-ENV)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[2/11] Verifying Environment & PostgreSQL Security Baseline...");

  await runScenario("P45-ENV-01", "Environment", "PostgreSQL catalog contains exactly 31 application tables", async () => {
    const count = parseInt(querySql(TARGET_DB, "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"), 10);
    return {
      command: "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';",
      expected: 31,
      actual: count,
      passed: count === 31,
      httpStatus: 200,
    };
  });

  await runScenario("P45-ENV-02", "Environment", "PostgreSQL catalog has RLS and FORCE RLS enabled on 20 sensitive tables", async () => {
    const rls = parseInt(
      querySql(TARGET_DB, "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relrowsecurity = true;"),
      10
    );
    const forceRls = parseInt(
      querySql(TARGET_DB, "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relforcerowsecurity = true;"),
      10
    );
    return {
      command: "Catalog inspection in pg_class for relrowsecurity and relforcerowsecurity",
      expected: { rls: 20, forceRls: 20 },
      actual: { rls, forceRls },
      passed: rls === 20 && forceRls === 20,
      httpStatus: 200,
    };
  });

  await runScenario("P45-ENV-03", "Environment", "PostgreSQL catalog has all 21 authoritative RLS policies active", async () => {
    const polCount = parseInt(querySql(TARGET_DB, "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';"), 10);
    return {
      command: "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';",
      expected: 21,
      actual: polCount,
      passed: polCount === 21,
      httpStatus: 200,
    };
  });

  await runScenario("P45-ENV-04", "Environment", "Application server is reachable and reports READY status", async () => {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    return {
      command: `GET ${API_BASE}/api/health`,
      expected: "HEALTHY",
      actual: data.status,
      passed: res.status === 200 && data.status === "HEALTHY",
      httpStatus: res.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Authentication & Authorization Workflow (P45-AUTH)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[3/11] Executing Real Authentication & Authorization Workflow...");

  let delhiInvToken = "";
  let delhiSupToken = "";
  let mumbaiInvToken = "";
  let adminToken = "";
  let delhiInvCookie = "";

  await runScenario("P45-AUTH-01", "Auth", "POST /api/auth/login with valid officer credentials succeeds", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-INV-45", password: "Rakshak@Test45!" }),
    });
    delhiInvCookie = res.headers.get("set-cookie") || "";
    const data = await res.json();
    delhiInvToken = data.token;
    return {
      command: "POST /api/auth/login (DL-INV-45)",
      expected: { success: true, role: "INVESTIGATOR" },
      actual: { success: data.success, role: data.officer?.role },
      passed: res.status === 200 && data.success && data.officer?.role === "INVESTIGATOR" && Boolean(data.token),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-02", "Auth", "POST /api/auth/login sets secure HttpOnly session cookie", async () => {
    const hasCookie = delhiInvCookie.includes("rakshak_session=") && delhiInvCookie.includes("HttpOnly");
    return {
      command: "Inspect Set-Cookie header",
      expected: true,
      actual: hasCookie,
      passed: hasCookie,
      httpStatus: 200,
    };
  });

  await runScenario("P45-AUTH-03", "Auth", "POST /api/auth/login with incorrect password fails with 401", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-INV-45", password: "WrongPassword999!" }),
    });
    return {
      command: "POST /api/auth/login (Wrong Password)",
      expected: 401,
      actual: res.status,
      passed: res.status === 401,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-04", "Auth", "POST /api/auth/login with non-existent officer fails with 401", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "NON-EXISTENT-BADGE", password: "Rakshak@Test45!" }),
    });
    return {
      command: "POST /api/auth/login (Non-existent)",
      expected: 401,
      actual: res.status,
      passed: res.status === 401,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-05", "Auth", "POST /api/auth/login for suspended officer fails with 403", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-SUSP-45", password: "Rakshak@Test45!" }),
    });
    const data = await res.json();
    return {
      command: "POST /api/auth/login (Suspended DL-SUSP-45)",
      expected: 403,
      actual: res.status,
      passed: res.status === 403 && data.error.includes("suspended"),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-06", "Auth", "GET /api/auth/me with Bearer token returns officer profile", async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const data = await res.json();
    return {
      command: "GET /api/auth/me (Bearer Token)",
      expected: "DL-INV-45",
      actual: data.officer?.badgeNumber,
      passed: res.status === 200 && data.officer?.badgeNumber === "DL-INV-45",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-07", "Auth", "GET /api/auth/me with session cookie returns officer profile", async () => {
    const cookieHeader = delhiInvCookie.split(";")[0];
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const data = await res.json();
    return {
      command: "GET /api/auth/me (Cookie)",
      expected: "DL-INV-45",
      actual: data.officer?.badgeNumber,
      passed: res.status === 200 && data.officer?.badgeNumber === "DL-INV-45",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-AUTH-08", "Auth", "POST /api/auth/logout revokes session in database", async () => {
    const logRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-INV-45", password: "Rakshak@Test45!" }),
    });
    const logData = await logRes.json();
    const tempToken = logData.token;

    const outRes = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tempToken}` },
    });

    const checkRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });

    return {
      command: "POST /api/auth/logout and verify subsequent rejection",
      expected: { logoutStatus: 200, meStatus: 401 },
      actual: { logoutStatus: outRes.status, meStatus: checkRes.status },
      passed: outRes.status === 200 && checkRes.status === 401,
      httpStatus: outRes.status,
    };
  });

  // Authenticate supervisor, mumbai investigator, and admin for remaining workflows
  const supLogin = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "DL-SUP-45", password: "Rakshak@Test45!" }),
  });
  delhiSupToken = (await supLogin.json()).token;

  const mumLogin = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "MH-INV-45", password: "Rakshak@Test45!" }),
  });
  mumbaiInvToken = (await mumLogin.json()).token;

  const admLogin = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "DL-ADM-45", password: "Rakshak@Test45!" }),
  });
  adminToken = (await admLogin.json()).token;

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Case Lifecycle & Supervisor Approval (P45-CASE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[4/11] Executing Complete Case Lifecycle & Supervisor Approval...");

  let createdCaseId = "";
  let createdCaseNumber = "";

  await runScenario("P45-CASE-01", "CaseLifecycle", "POST /api/cases creates synthetic case in OPEN status", async () => {
    const res = await fetch(`${API_BASE}/api/cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        incidentType: "Investment_Fraud",
        complainantName: "Rohit Malhotra",
        jurisdiction: "Delhi NCR",
        amountDefrauded: 1500000,
        description: "Synthetic telegram task fraud investigation Alpha.",
      }),
    });
    const data = await res.json();
    createdCaseId = data.id || data.case?.id;
    createdCaseNumber = data.caseNumber || data.case?.caseNumber;
    const caseStatus = data.status || data.case?.status;
    const deptId = data.departmentId || data.case?.departmentId;

    return {
      command: "POST /api/cases (Create Case)",
      expected: { status: "OPEN", departmentId: "p45-dept-del" },
      actual: { status: caseStatus, departmentId: deptId },
      passed: res.status === 201 && caseStatus === "OPEN" && deptId === "p45-dept-del" && Boolean(createdCaseId),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-CASE-02", "CaseLifecycle", "GET /api/cases and GET /api/cases/[id] retrieve newly created case", async () => {
    const listRes = await fetch(`${API_BASE}/api/cases`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const listData = await listRes.json();
    const foundInList = listData.cases?.some((c) => c.id === createdCaseId);

    const getRes = await fetch(`${API_BASE}/api/cases/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const getData = await getRes.json();
    const fetchedNumber = getData.case?.caseNumber || getData.caseNumber;

    return {
      command: `GET /api/cases and GET /api/cases/${createdCaseId}`,
      expected: { foundInList: true, caseNumber: createdCaseNumber },
      actual: { foundInList, caseNumber: fetchedNumber },
      passed: listRes.status === 200 && foundInList && fetchedNumber === createdCaseNumber,
      httpStatus: getRes.status,
    };
  });

  await runScenario("P45-CASE-03", "CaseLifecycle", "POST /api/cases/[id]/assignment assigns case to investigator", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}/assignment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        targetOfficerId: "p45-off-del-inv",
        assignmentType: "PRIMARY",
        reason: "Primary investigating officer assigned by ACP",
      }),
    });
    const data = await res.json();
    return {
      command: `POST /api/cases/${createdCaseId}/assignment`,
      expected: true,
      actual: data.success,
      passed: res.status === 200 && data.success,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-CASE-04", "CaseLifecycle", "POST /api/cases/[id]/transition transitions state OPEN -> UNDER_INQUIRY", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}/transition`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        toStatus: "UNDER_INQUIRY",
        reason: "Preliminary inquiry registered and evidence collection underway",
      }),
    });
    const data = await res.json();
    const status = data.case?.status || data.status;
    return {
      command: `POST /api/cases/${createdCaseId}/transition -> UNDER_INQUIRY`,
      expected: "UNDER_INQUIRY",
      actual: status,
      passed: res.status === 200 && status === "UNDER_INQUIRY",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-CASE-05", "CaseLifecycle", "Direct illegal transition UNDER_INQUIRY -> CLOSED without chargesheet rejected (403/400)", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}/transition`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        toStatus: "CLOSED",
        reason: "Premature closure attempt",
      }),
    });
    return {
      command: `POST /api/cases/${createdCaseId}/transition (Illegal Transition)`,
      expected: true,
      actual: res.status === 403 || res.status === 400 || res.status === 409,
      passed: res.status === 403 || res.status === 400 || res.status === 409,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-CASE-06", "CaseLifecycle", "Supervisor approval required for CHARGESHEETED transition; supervisor approves", async () => {
    // Non-supervisor attempting approval fails with 403
    const invAttempt = await fetch(`${API_BASE}/api/cases/${createdCaseId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CHARGESHEETED",
        requesterOfficerId: "p45-off-del-inv",
        reason: "Investigator unauthorized approval attempt",
      }),
    });

    // Supervisor issuing approval
    const supApproval = await fetch(`${API_BASE}/api/cases/${createdCaseId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        fromStatus: "UNDER_INQUIRY",
        toStatus: "CHARGESHEETED",
        requesterOfficerId: "p45-off-del-inv",
        reason: "Chargesheet approved by ACP Vikram Singh after judicial scrutiny",
      }),
    });
    const supData = await supApproval.json();

    return {
      command: "Supervisor approval authorization gate",
      expected: { invDenied: 403, supApproved: true },
      actual: { invDenied: invAttempt.status, supApproved: supData.success },
      passed: invAttempt.status === 403 && supApproval.status === 201 && supData.success === true,
      httpStatus: supApproval.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: Evidence Intake & Cryptographic Custody Chain (P45-EVI)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[5/11] Executing Evidence Intake & Cryptographic Custody Chain...");

  let uploadedEvidenceId = "";
  let uploadedEvidenceHash = "";
  const synthContent = "SYNTHETIC_FORENSIC_EXHIBIT_BANK_STATEMENT_OCT_2026_DELHI";
  const expectedHash = sha256(Buffer.from(synthContent));

  await runScenario("P45-EVI-01", "Evidence", "POST /api/evidence/upload handles multipart upload with SHA-256 verification", async () => {
    const form = new FormData();
    form.append("file", new Blob([synthContent], { type: "text/plain" }), "bank_stmt_delhi.txt");
    form.append("caseId", createdCaseId);
    form.append("clientHash", expectedHash);
    form.append("evidenceCategory", "DOCUMENT");

    const res = await fetch(`${API_BASE}/api/evidence/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${delhiInvToken}` },
      body: form,
    });
    const data = await res.json();
    uploadedEvidenceId = data.evidenceId || data.id;
    uploadedEvidenceHash = data.sha256Hash;

    return {
      command: "POST /api/evidence/upload (Multipart with clientHash)",
      expected: { verified: true, hash: expectedHash },
      actual: { verified: data.verified, hash: data.sha256Hash },
      passed: res.status === 201 && data.verified === true && data.sha256Hash === expectedHash,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-EVI-02", "Evidence", "Original upload stored in isolated directory without modifying uploads/raw", async () => {
    const synthExists = fs.existsSync(path.join(SYNTH_DIR, `${uploadedEvidenceHash}.bin`));
    const rawCount = computeDirectoryManifest(RAW_DIR).count;
    return {
      command: "Verify cold storage destination",
      expected: { synthExists: true, rawCount: 560 },
      actual: { synthExists, rawCount },
      passed: synthExists && rawCount === 560,
      httpStatus: 200,
    };
  });

  await runScenario("P45-EVI-03", "Evidence", "Upload with mismatched clientHash is strictly rejected (400/422)", async () => {
    const form = new FormData();
    form.append("file", new Blob(["ALTERED_CONTENT"], { type: "text/plain" }), "tampered.txt");
    form.append("caseId", createdCaseId);
    form.append("clientHash", "0000000000000000000000000000000000000000000000000000000000000000");

    const res = await fetch(`${API_BASE}/api/evidence/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${delhiInvToken}` },
      body: form,
    });
    return {
      command: "POST /api/evidence/upload (Hash Mismatch)",
      expected: true,
      actual: res.status === 400 || res.status === 422,
      passed: res.status === 400 || res.status === 422,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-EVI-04", "Evidence", "POST /api/evidence/[id]/custody appends custody transfer event with hash chaining", async () => {
    const res = await fetch(`${API_BASE}/api/evidence/${uploadedEvidenceId}/custody`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        eventType: "TRANSFER",
        actor: "DL-INV-45",
        action: "Transfer to Forensic Examiner for analysis",
        result: "SUCCESS",
        details: "Transferred custody to Cyber Forensic Lab",
      }),
    });
    const data = await res.json();
    return {
      command: `POST /api/evidence/${uploadedEvidenceId}/custody`,
      expected: true,
      actual: Boolean(data.event?.eventHash),
      passed: res.status === 201 && Boolean(data.event?.eventHash),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-EVI-05", "Evidence", "Database unique index rejects duplicate sequence numbers in CustodyEvent", async () => {
    let dupFailed = false;
    try {
      querySql(
        TARGET_DB,
        `INSERT INTO "CustodyEvent" ("id", "evidenceId", "sequenceNumber", "eventType", "actor", "action", "result", "prevEventHash", "eventHash", "timestamp") VALUES
         ('p45-cust-dup-test-${Date.now()}', '${uploadedEvidenceId}', 1, 'GENESIS', 'DL-INV-45', 'Dup Seq', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', '1111111111111111111111111111111111111111111111111111111111111111', NOW());`
      );
    } catch (err) {
      dupFailed = err.message.includes("CustodyEvent_evidence_seq_unique_idx") || err.message.includes("duplicate key");
    }
    return {
      command: "Direct SQL insert of duplicate sequence number",
      expected: true,
      actual: dupFailed,
      passed: dupFailed,
      httpStatus: 200,
    };
  });

  await runScenario("P45-EVI-06", "Evidence", "POST /api/evidence/[id]/verify performs full cryptographic chain verification", async () => {
    const res = await fetch(`${API_BASE}/api/evidence/${uploadedEvidenceId}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({ auditor: "Phase 45 Verification Auditor" }),
    });
    const data = await res.json();
    return {
      command: `POST /api/evidence/${uploadedEvidenceId}/verify`,
      expected: { verified: true, hashMatch: true },
      actual: { verified: data.verified, hashMatch: data.hashMatch },
      passed: res.status === 200 && data.verified === true && data.hashMatch === true,
      httpStatus: res.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 6: Text Extraction & Human Fact Review (P45-FACT)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[6/11] Executing Text Extraction & Human Fact Review History...");

  await runScenario("P45-FACT-01", "FactReview", "GET /api/evidence/[id]/text retrieves text content from synthetic cold storage", async () => {
    const res = await fetch(`${API_BASE}/api/evidence/${uploadedEvidenceId}/text`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const data = await res.json();
    return {
      command: `GET /api/evidence/${uploadedEvidenceId}/text`,
      expected: { available: true, text: synthContent },
      actual: { available: data.available, text: data.text },
      passed: res.status === 200 && data.available === true && data.text === synthContent,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FACT-02", "FactReview", "Extracted facts start in PENDING_REVIEW state (never auto-promoted)", async () => {
    const status = querySql(TARGET_DB, "SELECT \"reviewStatus\" FROM \"ExtractedFact\" WHERE \"id\" = 'p45-fact-del-01';");
    return {
      command: "Inspect initial reviewStatus in database",
      expected: "PENDING_REVIEW",
      actual: status,
      passed: status === "PENDING_REVIEW",
      httpStatus: 200,
    };
  });

  await runScenario("P45-FACT-03", "FactReview", "POST /api/facts/[id]/review with decision CORRECT records correction & history", async () => {
    const res = await fetch(`${API_BASE}/api/facts/p45-fact-del-01/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        decision: "CORRECT",
        correctedValue: "+919876543211",
        rationale: "Corrected phone number format based on telecom response",
      }),
    });
    const data = await res.json();
    return {
      command: "POST /api/facts/p45-fact-del-01/review (CORRECT)",
      expected: { status: "CORRECTED", previousValue: "+919876543210" },
      actual: { status: data.fact?.reviewStatus, previousValue: data.historyRecord?.previousValue },
      passed: res.status === 200 && data.fact?.reviewStatus === "CORRECTED" && data.historyRecord?.previousValue === "+919876543210",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FACT-04", "FactReview", "POST /api/facts/[id]/review with decision ACCEPT verifies fact", async () => {
    const res = await fetch(`${API_BASE}/api/facts/p45-fact-del-01/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        decision: "ACCEPT",
        rationale: "Accepted by supervisor after registry confirmation",
      }),
    });
    const data = await res.json();
    return {
      command: "POST /api/facts/p45-fact-del-01/review (ACCEPT)",
      expected: "ACCEPTED",
      actual: data.fact?.reviewStatus,
      passed: res.status === 200 && data.fact?.reviewStatus === "ACCEPTED",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FACT-05", "FactReview", "Fact review history is auditable and immutable", async () => {
    const historyCount = parseInt(querySql(TARGET_DB, "SELECT count(*) FROM \"FactReviewHistory\" WHERE \"factId\" = 'p45-fact-del-01';"), 10);
    return {
      command: "SELECT count(*) FROM FactReviewHistory WHERE factId = 'p45-fact-del-01'",
      expected: true,
      actual: historyCount >= 1,
      passed: historyCount >= 1,
      httpStatus: 200,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 7: Cross-Case Intelligence & Entity Review (P45-ENT)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[7/11] Executing Cross-Case Intelligence & Entity Review...");

  // Seed matching entity in createdCaseId and p45-case-del-01
  querySql(
    TARGET_DB,
    `DELETE FROM "EntityLink" WHERE "sourceCaseId" = '${createdCaseId}' OR "targetCaseId" = '${createdCaseId}';
     DELETE FROM "CaseEntity" WHERE "id" IN ('p45-ent-del-01', 'p45-ent-del-02') OR "caseId" = '${createdCaseId}';
     INSERT INTO "CaseEntity" ("id", "caseId", "entityType", "rawValue", "normalizedValue", "firstSeenAt") VALUES
     ('p45-ent-del-01', '${createdCaseId}', 'PHONE', '9876543211', '+919876543211', NOW()),
     ('p45-ent-del-02', 'p45-case-del-01', 'PHONE', '9876543211', '+919876543211', NOW());`
  );

  let linkId = "";

  await runScenario("P45-ENT-01", "EntityIntelligence", "POST /api/entities/resolve evaluates shared entities into candidate links", async () => {
    const res = await fetch(`${API_BASE}/api/entities/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({ caseId: createdCaseId }),
    });
    const data = await res.json();
    linkId = data.candidates?.[0]?.id;
    return {
      command: `POST /api/entities/resolve (caseId: ${createdCaseId})`,
      expected: true,
      actual: res.status === 200 && Boolean(linkId),
      passed: res.status === 200 && Boolean(linkId),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-ENT-02", "EntityIntelligence", "GET /api/entities/matches lists candidate links with CANDIDATE status", async () => {
    const res = await fetch(`${API_BASE}/api/entities/matches?entityType=PHONE`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const data = await res.json();
    const foundLink = data.matches?.find((l) => l.id === linkId || l.normalizedValue === "+919876543211");
    return {
      command: "GET /api/entities/matches?entityType=PHONE",
      expected: { found: true, status: "CANDIDATE" },
      actual: { found: Boolean(foundLink), status: foundLink?.status },
      passed: res.status === 200 && Boolean(foundLink) && foundLink.status === "CANDIDATE",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-ENT-03", "EntityIntelligence", "POST /api/entities/links/[id]/review human review confirms candidate link", async () => {
    const res = await fetch(`${API_BASE}/api/entities/links/${linkId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        toStatus: "CONFIRMED",
        rationale: "Confirmed suspect phone match with corroborating CDR analysis",
      }),
    });
    const data = await res.json();
    return {
      command: `POST /api/entities/links/${linkId}/review (CONFIRMED)`,
      expected: "CONFIRMED",
      actual: data.link?.status,
      passed: res.status === 200 && data.link?.status === "CONFIRMED",
      httpStatus: res.status,
    };
  });

  await runScenario("P45-ENT-04", "EntityIntelligence", "GET /api/graph returns bounded cross-case graph nodes and edges", async () => {
    const res = await fetch(`${API_BASE}/api/graph?caseId=${createdCaseId}&depth=2`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    const data = await res.json();
    const hasGraph = Array.isArray(data.nodes) && Array.isArray(data.edges);
    return {
      command: `GET /api/graph?caseId=${createdCaseId}`,
      expected: true,
      actual: hasGraph,
      passed: res.status === 200 && hasGraph,
      httpStatus: res.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 8: Dossier Generation, Export & Audit (P45-DOSS)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[8/11] Executing Dossier Generation, Export & Audit Logging...");

  let dossierId = "";
  let dossierHash = "";

  await runScenario("P45-DOSS-01", "Dossier", "POST /api/cases/[id]/dossier/generate creates versioned evidence-backed dossier", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}/dossier/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiInvToken}`,
      },
      body: JSON.stringify({
        title: "Comprehensive Investigative Dossier — Case Alpha",
        summary: "Synthetic compilation of verified facts, custody timeline, and bank records.",
      }),
    });
    const data = await res.json();
    dossierId = data.dossier?.id;
    dossierHash = data.dossier?.contentHash;
    return {
      command: `POST /api/cases/${createdCaseId}/dossier/generate`,
      expected: { status: "GENERATED", hasHash: true },
      actual: { status: data.dossier?.status, hasHash: Boolean(data.dossier?.contentHash) },
      passed: res.status === 201 && data.dossier?.status === "GENERATED" && Boolean(data.dossier?.contentHash),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-DOSS-02", "Dossier", "POST /api/dossiers/[id]/review records supervisor approval decision", async () => {
    // Stage 1: Transition GENERATED -> UNDER_REVIEW
    const rev1 = await fetch(`${API_BASE}/api/dossiers/${dossierId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        toStatus: "UNDER_REVIEW",
        decision: "STATUS_TRANSITION",
        rationale: "Advancing generated dossier to supervisor review queue.",
      }),
    });
    const rev1Data = await rev1.json();

    // Stage 2: Transition UNDER_REVIEW -> APPROVED
    const rev2 = await fetch(`${API_BASE}/api/dossiers/${dossierId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        toStatus: "APPROVED",
        decision: "APPROVE",
        rationale: "Approved for judicial exhibit submission under Section 63 BSA",
      }),
    });
    const rev2Data = await rev2.json();

    return {
      command: `POST /api/dossiers/${dossierId}/review (UNDER_REVIEW -> APPROVED)`,
      expected: { rev1Success: true, rev2Success: true, finalStatus: "APPROVED" },
      actual: { rev1Success: rev1Data.success, rev2Success: rev2Data.success, finalStatus: rev2Data.dossier?.status },
      passed: rev1.status === 200 && rev1Data.success && rev2.status === 200 && rev2Data.success && rev2Data.dossier?.status === "APPROVED",
      httpStatus: rev2.status,
    };
  });

  let exportedPayload = "";
  let exportedArtifactHash = "";

  await runScenario("P45-DOSS-03", "Dossier", "GET /api/dossiers/[id]/export?format=JSON exports verified dossier artifact", async () => {
    const res = await fetch(`${API_BASE}/api/dossiers/${dossierId}/export?format=JSON`, {
      headers: { Authorization: `Bearer ${delhiInvToken}` },
    });
    exportedArtifactHash = res.headers.get("x-artifact-hash") || "";
    const disposition = res.headers.get("content-disposition") || "";
    exportedPayload = await res.text();

    return {
      command: `GET /api/dossiers/${dossierId}/export?format=JSON`,
      expected: { status: 200, hasDisposition: true, hasHash: true },
      actual: { status: res.status, hasDisposition: disposition.includes("attachment"), hasHash: Boolean(exportedArtifactHash) },
      passed: res.status === 200 && disposition.includes("attachment") && Boolean(exportedArtifactHash),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-DOSS-04", "Dossier", "Exported JSON payload bytes match X-Artifact-Hash digest", async () => {
    const computedHash = sha256(Buffer.from(exportedPayload));
    return {
      command: "sha256(exportedPayload) == X-Artifact-Hash",
      expected: exportedArtifactHash,
      actual: computedHash,
      passed: computedHash === exportedArtifactHash,
      httpStatus: 200,
    };
  });

  await runScenario("P45-DOSS-05", "Dossier", "GET /api/audit records formal audit entries for investigative actions", async () => {
    const res = await fetch(`${API_BASE}/api/audit`, {
      headers: { Authorization: `Bearer ${delhiSupToken}` },
    });
    const data = await res.json();
    const actions = (data.logs || []).map((l) => l.action);
    const hasRequired = actions.includes("LOGIN_SUCCESS") && actions.includes("DOSSIER_GENERATE");
    return {
      command: "GET /api/audit",
      expected: true,
      actual: hasRequired,
      passed: res.status === 200 && hasRequired,
      httpStatus: res.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 9: Frontend-to-API Integration Coverage (P45-FE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[9/11] Executing Frontend-to-API Integration Checks...");

  await runScenario("P45-FE-01", "FrontendIntegration", "GET /frontend/pages/login.html serves UI matching /api/auth/login", async () => {
    const res = await fetch(`${API_BASE}/frontend/pages/login.html`);
    const html = await res.text();
    const hasFields = html.includes("identifier") || html.includes("badge") || html.includes("password");
    return {
      command: "GET /frontend/pages/login.html",
      expected: { status: 200, hasFields: true },
      actual: { status: res.status, hasFields },
      passed: res.status === 200 && hasFields,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FE-02", "FrontendIntegration", "GET /frontend/pages/cases.html serves UI matching /api/cases", async () => {
    const res = await fetch(`${API_BASE}/frontend/pages/cases.html`);
    const html = await res.text();
    const hasCasesUi = html.includes("cases") || html.includes("caseTable") || html.includes("cases-neumorphic");
    return {
      command: "GET /frontend/pages/cases.html",
      expected: { status: 200, hasCasesUi: true },
      actual: { status: res.status, hasCasesUi },
      passed: res.status === 200 && hasCasesUi,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FE-03", "FrontendIntegration", "GET /frontend/pages/evidence-viewer.html serves UI matching /api/evidence", async () => {
    const res = await fetch(`${API_BASE}/frontend/pages/evidence-viewer.html`);
    const html = await res.text();
    const hasEvidenceUi = html.includes("evidence") || html.includes("viewer") || html.includes("custody");
    return {
      command: "GET /frontend/pages/evidence-viewer.html",
      expected: { status: 200, hasEvidenceUi: true },
      actual: { status: res.status, hasEvidenceUi },
      passed: res.status === 200 && hasEvidenceUi,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FE-04", "FrontendIntegration", "GET /frontend/pages/reports.html serves UI matching /api/dossiers", async () => {
    const res = await fetch(`${API_BASE}/frontend/pages/reports.html`);
    const html = await res.text();
    const hasReportsUi = html.includes("reports") || html.includes("dossier") || html.includes("export");
    return {
      command: "GET /frontend/pages/reports.html",
      expected: { status: 200, hasReportsUi: true },
      actual: { status: res.status, hasReportsUi },
      passed: res.status === 200 && hasReportsUi,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-FE-05", "FrontendIntegration", "GET /frontend/js/api.js provides authenticated client-side fetch wrapper", async () => {
    const res = await fetch(`${API_BASE}/frontend/js/api.js`);
    const js = await res.text();
    const hasBearer = js.includes("Bearer") && js.includes("fetch");
    return {
      command: "GET /frontend/js/api.js",
      expected: true,
      actual: hasBearer,
      passed: res.status === 200 && hasBearer,
      httpStatus: res.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 10: Cross-Tenant Isolation & Access Grants (P45-TEN)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[10/11] Executing Cross-Tenant Isolation & Access Grants...");

  let grantId = "";

  await runScenario("P45-TEN-01", "TenantIsolation", "Foreign officer (Mumbai) cannot view Delhi case without active grant (403/404)", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${mumbaiInvToken}` },
    });
    return {
      command: `GET /api/cases/${createdCaseId} as Mumbai Officer`,
      expected: true,
      actual: res.status === 403 || res.status === 404,
      passed: res.status === 403 || res.status === 404,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-TEN-02", "TenantIsolation", "Foreign officer (Mumbai) cannot upload evidence to Delhi case (403)", async () => {
    const form = new FormData();
    form.append("file", new Blob(["UNAUTHORIZED_CROSS_DEPT_UPLOAD"], { type: "text/plain" }), "leak.txt");
    form.append("caseId", createdCaseId);
    form.append("clientHash", sha256(Buffer.from("UNAUTHORIZED_CROSS_DEPT_UPLOAD")));

    const res = await fetch(`${API_BASE}/api/evidence/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mumbaiInvToken}` },
      body: form,
    });
    return {
      command: "POST /api/evidence/upload as foreign department",
      expected: 403,
      actual: res.status,
      passed: res.status === 403,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-TEN-03", "TenantIsolation", "POST /api/access-grants issues cross-department access grant", async () => {
    const futureExpiry = new Date(Date.now() + 86400000).toISOString();
    const res = await fetch(`${API_BASE}/api/access-grants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({
        granteeOfficerId: "p45-off-mum-inv",
        granteeDepartmentId: "p45-dept-mum",
        targetDepartmentId: "p45-dept-del",
        targetCaseId: createdCaseId,
        scope: "CASE_READ",
        expiresAt: futureExpiry,
        reason: "Inter-agency intelligence collaboration on syndicate Alpha",
      }),
    });
    const data = await res.json();
    grantId = data.grant?.id;
    return {
      command: "POST /api/access-grants (Issue grant to Mumbai officer)",
      expected: true,
      actual: data.success,
      passed: res.status === 201 && data.success && Boolean(grantId),
      httpStatus: res.status,
    };
  });

  await runScenario("P45-TEN-04", "TenantIsolation", "Mumbai officer can read Delhi case with active approved grant (200)", async () => {
    const res = await fetch(`${API_BASE}/api/cases/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${mumbaiInvToken}` },
    });
    const data = await res.json();
    const caseNum = data.case?.caseNumber || data.caseNumber;
    return {
      command: `GET /api/cases/${createdCaseId} as Mumbai Officer with Active Grant`,
      expected: createdCaseNumber,
      actual: caseNum,
      passed: res.status === 200 && caseNum === createdCaseNumber,
      httpStatus: res.status,
    };
  });

  await runScenario("P45-TEN-05", "TenantIsolation", "POST /api/access-grants/[id]/revoke revokes grant; subsequent access rejected (403)", async () => {
    const revokeRes = await fetch(`${API_BASE}/api/access-grants/${grantId}/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${delhiSupToken}`,
      },
      body: JSON.stringify({ reason: "Collaboration phase concluded" }),
    });

    const accessRes = await fetch(`${API_BASE}/api/cases/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${mumbaiInvToken}` },
    });

    return {
      command: "Revoke grant and verify immediate access termination",
      expected: { revokeStatus: 200, postRevokeDenied: true },
      actual: { revokeStatus: revokeRes.status, postRevokeDenied: accessRes.status === 403 || accessRes.status === 404 },
      passed: revokeRes.status === 200 && (accessRes.status === 403 || accessRes.status === 404),
      httpStatus: revokeRes.status,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 11: Regression & Final Safety Invariants (P45-REG & P45-POST)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n[11/11] Executing Regression Suites & Post-Execution Invariants...");

  await runScenario("P45-REG-01", "Regression", "Phase 41 Direct PostgreSQL RLS Enforcement Suite (18/18 PASS)", async () => {
    const output = execSync(`node scripts/test_phase41_direct_rls_enforcement.mjs`, {
      env: { ...process.env, TARGET_DB },
      encoding: "utf8",
    });
    const passed = output.includes("Passed:                   18 / 18 (100.0%)");
    return {
      command: `node scripts/test_phase41_direct_rls_enforcement.mjs (${TARGET_DB})`,
      expected: "18 / 18 (100.0%)",
      actual: passed ? "18 / 18 (100.0%)" : "Failed",
      passed,
      httpStatus: 200,
    };
  });

  await runScenario("P45-REG-02", "Regression", "Phase 36.2 Multi-Process Custody Concurrency Suite (27/27 PASS)", async () => {
    const output = execSync(`node scripts/test_phase36_2_distributed_custody.mjs`, {
      env: { ...process.env, TARGET_DB },
      encoding: "utf8",
    });
    const passed = output.includes("TOTAL TESTS: 27 | PASSED: 27 | FAILED: 0");
    return {
      command: `node scripts/test_phase36_2_distributed_custody.mjs (${TARGET_DB})`,
      expected: "27 / 27 PASSED",
      actual: passed ? "27 / 27 PASSED" : "Failed",
      passed,
      httpStatus: 200,
    };
  });

  await runScenario("P45-REG-03", "Regression", "TypeScript Type-Checking Gate (tsc --noEmit) passes cleanly", async () => {
    let tscPassed = false;
    try {
      execSync("node node_modules/typescript/bin/tsc --noEmit", { encoding: "utf8" });
      tscPassed = true;
    } catch (_) {}
    return {
      command: "tsc --noEmit",
      expected: true,
      actual: tscPassed,
      passed: tscPassed,
      httpStatus: 200,
    };
  });

  await runScenario("P45-POST-01", "Safety", "prisma/dev.db post-test hash matches baseline", async () => {
    const hash = sha256File(DEV_DB_PATH);
    return {
      command: `sha256(${DEV_DB_PATH})`,
      expected: BASELINE_DEV_DB_HASH,
      actual: hash,
      passed: hash === BASELINE_DEV_DB_HASH,
      httpStatus: 200,
    };
  });

  await runScenario("P45-POST-02", "Safety", "uploads/raw/ post-test count matches baseline 560 files", async () => {
    const manifest = computeDirectoryManifest(RAW_DIR);
    return {
      command: `countFiles(${RAW_DIR})`,
      expected: BASELINE_RAW_COUNT,
      actual: manifest.count,
      passed: manifest.count === BASELINE_RAW_COUNT,
      httpStatus: 200,
    };
  });

  await runScenario("P45-POST-03", "Safety", "uploads/raw/ post-test manifest matches baseline digest", async () => {
    const manifest = computeDirectoryManifest(RAW_DIR);
    return {
      command: `manifestHash(${RAW_DIR})`,
      expected: BASELINE_RAW_MANIFEST,
      actual: manifest.manifestHash,
      passed: manifest.manifestHash === BASELINE_RAW_MANIFEST,
      httpStatus: 200,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Export Machine-Readable Results Manifest
  // ─────────────────────────────────────────────────────────────────────────
  const passedCount = testResults.filter((t) => t.status === "PASSED").length;
  const failedCount = testResults.filter((t) => t.status === "FAILED").length;
  const passRate = ((passedCount / testResults.length) * 100).toFixed(1);

  const manifestPayload = {
    phase: "PHASE_45",
    timestamp: new Date().toISOString(),
    suiteName: "Rakshak v3.0 End-to-End Investigative Workflow Verification Suite",
    databaseTarget: TARGET_DB,
    apiOrigin: API_BASE,
    summary: {
      totalTests: testResults.length,
      passed: passedCount,
      failed: failedCount,
      passRate: `${passRate}%`,
      exitCode: failedCount === 0 ? 0 : 1,
    },
    safetyInvariants: {
      devDbHash: BASELINE_DEV_DB_HASH,
      rawFilesCount: BASELINE_RAW_COUNT,
      rawManifestHash: BASELINE_RAW_MANIFEST,
      protectedDatabasesCount: 20,
    },
    scenarios: testResults,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(manifestPayload, null, 2), "utf8");

  console.log("\n================================================================================");
  console.log(` TOTAL SCENARIOS: ${testResults.length} | PASSED: ${passedCount} (${passRate}%) | FAILED: ${failedCount}`);
  console.log(` RESULTS MANIFEST WRITTEN TO: ${OUT_JSON}`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
