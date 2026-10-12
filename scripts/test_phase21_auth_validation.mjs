// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase21_auth_validation.mjs
// RAKSHAK v3.0 — Phase 21 Officer Login, Account Provisioning & Department Access Suite
//
// 20-Point Automated Empirical Security & Access Control Test Matrix:
// 1.  TC-01: Successful officer login & session issuance
// 2.  TC-02: Invalid password rejection
// 3.  TC-03: Nonexistent identifier rejection
// 4.  TC-04: Disabled / inactive account rejection
// 5.  TC-05: Successful logout & cookie clearing
// 6.  TC-06: Revoked session reuse rejection
// 7.  TC-07: Expired session rejection
// 8.  TC-08: Unauthenticated access rejection on protected APIs
// 9.  TC-09: Role-Based Access Control (RBAC) restrictions on VIEWER role
// 10. TC-10: Authorized officer provisioning by Administrator
// 11. TC-11: Rejection of unauthorized officer account creation
// 12. TC-12: Duplicate badge / email rejection guard
// 13. TC-13: Input validation on authentication and provisioning endpoints
// 14. TC-14: HTTP cookie attributes and session token entropy verification
// 15. TC-15: Department scope query enforcement
// 16. TC-16: Department ID substitution guard on case details
// 17. TC-17: Evidence download authorization check
// 18. TC-18: Centralized audit logging of authentication & account events
// 19. TC-19: Controlled department onboarding request pipeline
// 20. TC-20: Frontend login & onboarding page structure & script validity
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

async function runPhase21TestSuite() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 21 AUTHENTICATION & ACCESS TEST SUITE   ");
  console.log("   Target: " + BASE_URL);
  console.log("   Timestamp: " + new Date().toISOString());
  console.log("================================================================\n");

  const results = {
    total: 20,
    passed: 0,
    failed: 0,
    tests: [],
  };

  function record(id, title, passed, details = "") {
    if (passed) {
      results.passed++;
      console.log(`[PASS] ${id}: ${title}`);
    } else {
      results.failed++;
      console.error(`[FAIL] ${id}: ${title} — ${details}`);
    }
    results.tests.push({ id, title, passed, details, timestamp: new Date().toISOString() });
  }

  let adminCookie = null;
  let adminToken = null;
  let viewerCookie = null;
  let testOfficerBadge = null;

  // ─── TC-01: Successful Officer Login ─────────────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-002", password: "Rakshak@2026" }),
    });
    assert.strictEqual(res.status, 200, "Login must return 200");
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.officer.badgeNumber, "DL-002");
    assert.strictEqual(data.officer.role, "ADMIN");
    assert.ok(data.token && data.token.length >= 64, "Token entropy >= 256 bits");
    assert.ok(Array.isArray(data.permissions) && data.permissions.includes("officer:create"));

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes("rakshak_session="), "Must set rakshak_session cookie");
    assert.ok(setCookie.includes("HttpOnly"), "Cookie must have HttpOnly");
    assert.ok(setCookie.includes("SameSite=Lax"), "Cookie must have SameSite=Lax");

    adminCookie = setCookie.split(";")[0];
    adminToken = data.token;
    record("TC-01", "Successful officer login & session issuance", true);
  } catch (err) {
    record("TC-01", "Successful officer login & session issuance", false, err.message);
  }

  // ─── TC-02: Invalid Password Rejection ───────────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-002", password: "WrongPassphrase999!" }),
    });
    assert.strictEqual(res.status, 401, "Invalid password must return 401");
    const data = await res.json();
    assert.strictEqual(data.error, "Invalid badge number, email, or password.");
    assert.strictEqual(data.token, undefined);
    record("TC-02", "Invalid password rejection", true);
  } catch (err) {
    record("TC-02", "Invalid password rejection", false, err.message);
  }

  // ─── TC-03: Nonexistent Identifier Rejection ─────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "BADGE-NONEXISTENT-9999", password: "AnyPassword123" }),
    });
    assert.strictEqual(res.status, 401, "Nonexistent user must return 401");
    const data = await res.json();
    // Must return generic message to prevent account enumeration
    assert.strictEqual(data.error, "Invalid badge number, email, or password.");
    record("TC-03", "Nonexistent identifier rejection without account enumeration", true);
  } catch (err) {
    record("TC-03", "Nonexistent identifier rejection without account enumeration", false, err.message);
  }

  // ─── TC-04: Inactive Account Rejection ───────────────────────────────────────
  try {
    // Find an inactive officer from dev.db
    const p = prisma;
    const inactive = await p.officer.findFirst({ where: { status: "INACTIVE" } });
    assert.ok(inactive, "Must find inactive test officer");

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: inactive.badgeNumber, password: "Rakshak@2026" }),
    });
    assert.strictEqual(res.status, 403, "Inactive officer must return 403");
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes("inactive"), "Error explains inactive status");
    record("TC-04", "Disabled / inactive account authentication rejection", true);
  } catch (err) {
    record("TC-04", "Disabled / inactive account authentication rejection", false, err.message);
  }

  // ─── TC-05: Logout & Cookie Clearing ─────────────────────────────────────────
  let tempToken = null;
  try {
    // Perform temporary login to obtain disposable session
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-002", password: "Rakshak@2026" }),
    });
    const loginData = await loginRes.json();
    tempToken = loginData.token;
    const tempCookie = loginRes.headers.get("set-cookie").split(";")[0];

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: tempCookie },
    });
    assert.strictEqual(logoutRes.status, 200, "Logout must return 200");
    const setCookie = logoutRes.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes("Max-Age=0"), "Logout must clear cookie with Max-Age=0");

    // Check DB session status
    const p = prisma;
    const sess = await p.officerSession.findUnique({ where: { token: tempToken } });
    assert.ok(sess && sess.revoked === true, "Session must be marked revoked in database");
    record("TC-05", "Successful logout & session revocation", true);
  } catch (err) {
    record("TC-05", "Successful logout & session revocation", false, err.message);
  }

  // ─── TC-06: Revoked Session Reuse Rejection ──────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert.strictEqual(res.status, 401, "Revoked session must be rejected with 401");
    record("TC-06", "Revoked session reuse rejection", true);
  } catch (err) {
    record("TC-06", "Revoked session reuse rejection", false, err.message);
  }

  // ─── TC-07: Expired Session Rejection ────────────────────────────────────────
  try {
    const p = prisma;
    const expiredToken = "expired-token-phase21-" + Date.now();
    const admin = await p.officer.findFirst({ where: { badgeNumber: "DL-002" } });
    await p.officerSession.create({
      data: {
        token: expiredToken,
        officerId: admin.id,
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour in the past
        revoked: false,
      },
    });

    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401, "Expired session must return 401");
    record("TC-07", "Expired session rejection", true);
  } catch (err) {
    record("TC-07", "Expired session rejection", false, err.message);
  }

  // ─── TC-08: Unauthenticated Access Rejection on Protected APIs ──────────────
  try {
    const casesRes = await fetch(`${BASE_URL}/api/cases`);
    assert.strictEqual(casesRes.status, 401, "GET /api/cases without session must return 401");

    const evidenceRes = await fetch(`${BASE_URL}/api/evidence`);
    assert.strictEqual(evidenceRes.status, 401, "GET /api/evidence without session must return 401");

    const officersRes = await fetch(`${BASE_URL}/api/officers`);
    assert.strictEqual(officersRes.status, 401, "GET /api/officers without session must return 401");

    record("TC-08", "Unauthenticated access rejection on protected APIs", true);
  } catch (err) {
    record("TC-08", "Unauthenticated access rejection on protected APIs", false, err.message);
  }

  // ─── TC-09: RBAC Enforcement for Restricted Roles ────────────────────────────
  try {
    // Log in as Head Constable Rahul Mehta (VIEWER, Pune)
    const viewerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "MH-088", password: "Rakshak@2026" }),
    });
    assert.strictEqual(viewerLoginRes.status, 200);
    const viewerData = await viewerLoginRes.json();
    assert.strictEqual(viewerData.officer.role, "VIEWER");
    viewerCookie = viewerLoginRes.headers.get("set-cookie").split(";")[0];

    // Viewer attempts case creation (restricted to case:create)
    const createCaseRes = await fetch(`${BASE_URL}/api/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({
        incidentType: "Task_Scam",
        complainantName: "Unauthorized Viewer Attempt",
      }),
    });
    assert.strictEqual(createCaseRes.status, 403, "Viewer case creation must return 403");

    // Viewer attempts officer provisioning
    const createOffRes = await fetch(`${BASE_URL}/api/officers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({
        name: "Rogue Account",
        badgeNumber: "RG-001",
        role: "ADMIN",
        jurisdiction: "Pune",
      }),
    });
    assert.strictEqual(createOffRes.status, 403, "Viewer officer creation must return 403");

    record("TC-09", "Role-Based Access Control (RBAC) restrictions on VIEWER role", true);
  } catch (err) {
    record("TC-09", "Role-Based Access Control (RBAC) restrictions on VIEWER role", false, err.message);
  }

  // ─── TC-10: Authorized Officer Provisioning by Administrator ─────────────────
  try {
    testOfficerBadge = `SI-${Math.floor(1000 + Math.random() * 9000)}`;
    const createRes = await fetch(`${BASE_URL}/api/officers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: "Test Sub-Inspector Verma",
        badgeNumber: testOfficerBadge,
        designation: "Sub-Inspector",
        role: "INVESTIGATOR",
        jurisdiction: "Chandigarh",
        unit: "Cyber Crime Cell",
        email: `${testOfficerBadge.toLowerCase()}@chandigarhpolice.gov.in`,
        password: "Passphrase@2026",
      }),
    });
    assert.strictEqual(createRes.status, 201, "Admin officer creation must return 201");
    const createData = await createRes.json();
    assert.strictEqual(createData.success, true);
    assert.strictEqual(createData.officer.badgeNumber, testOfficerBadge);
    assert.strictEqual(createData.officer.role, "INVESTIGATOR");
    assert.strictEqual(createData.officer.passwordHash, undefined, "Password hash must never be returned");
    record("TC-10", "Authorized officer provisioning by Administrator", true);
  } catch (err) {
    record("TC-10", "Authorized officer provisioning by Administrator", false, err.message);
  }

  // ─── TC-11: Rejection of Unauthorized Officer Account Creation ───────────────
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/officers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Public Registrant",
        badgeNumber: "PUB-001",
        role: "INVESTIGATOR",
        jurisdiction: "Delhi",
      }),
    });
    assert.strictEqual(unauthRes.status, 401, "Unauthenticated officer creation must return 401");
    record("TC-11", "Rejection of unauthorized account creation without active admin session", true);
  } catch (err) {
    record("TC-11", "Rejection of unauthorized account creation without active admin session", false, err.message);
  }

  // ─── TC-12: Duplicate Badge Number Rejection Guard ───────────────────────────
  try {
    const dupRes = await fetch(`${BASE_URL}/api/officers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: "Duplicate Badge Officer",
        badgeNumber: "DL-002", // Already exists (ACP Vikram Singh)
        role: "INVESTIGATOR",
        jurisdiction: "Delhi",
      }),
    });
    assert.strictEqual(dupRes.status, 409, "Duplicate badge must return 409 Conflict");
    record("TC-12", "Duplicate badge number rejection guard", true);
  } catch (err) {
    record("TC-12", "Duplicate badge number rejection guard", false, err.message);
  }

  // ─── TC-13: Strict Input Validation ──────────────────────────────────────────
  try {
    // Missing identifier
    const badLogin1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Pass" }),
    });
    assert.strictEqual(badLogin1.status, 400);

    // Missing password
    const badLogin2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-002" }),
    });
    assert.strictEqual(badLogin2.status, 400);

    // Malformed JSON body
    const badLogin3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json-data",
    });
    assert.strictEqual(badLogin3.status, 400);

    record("TC-13", "Strict input validation on authentication endpoints", true);
  } catch (err) {
    record("TC-13", "Strict input validation on authentication endpoints", false, err.message);
  }

  // ─── TC-14: HTTP Cookie Attributes & Token Entropy ───────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "DL-002", password: "Rakshak@2026" }),
    });
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie.includes("HttpOnly"), "Must be HttpOnly");
    assert.ok(setCookie.includes("SameSite=Lax"), "Must be SameSite=Lax");
    assert.ok(setCookie.includes("Path=/"), "Must be Path=/");
    assert.ok(setCookie.includes("Max-Age=86400"), "Must set Max-Age=86400");
    record("TC-14", "HTTP cookie security attributes & session token entropy verified", true);
  } catch (err) {
    record("TC-14", "HTTP cookie security attributes & session token entropy verified", false, err.message);
  }

  // ─── TC-15: Department Scope Query Enforcement ───────────────────────────────
  try {
    // Log in as Inspector Priya Sharma (INVESTIGATOR, Mumbai)
    const priyaRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "MH-104", password: "Rakshak@2026" }),
    });
    assert.strictEqual(priyaRes.status, 200);
    const priyaCookie = priyaRes.headers.get("set-cookie").split(";")[0];

    // Attempt cross-department query for Delhi cases
    const crossJurRes = await fetch(`${BASE_URL}/api/cases?jurisdiction=Delhi`, {
      headers: { Cookie: priyaCookie },
    });
    assert.strictEqual(crossJurRes.status, 403, "Cross-department query by non-admin must return 403");
    const data = await crossJurRes.json();
    assert.ok(data.error.includes("Unauthorized cross-department query"));

    // Authorized query within Mumbai jurisdiction succeeds
    const myJurRes = await fetch(`${BASE_URL}/api/cases?jurisdiction=Mumbai`, {
      headers: { Cookie: priyaCookie },
    });
    assert.strictEqual(myJurRes.status, 200, "In-department query must return 200");

    record("TC-15", "Department scope query enforcement & cross-department rejection", true);
  } catch (err) {
    record("TC-15", "Department scope query enforcement & cross-department rejection", false, err.message);
  }

  // ─── TC-16: Department ID Substitution Guard on Case Details ─────────────────
  try {
    // Find a Delhi case
    const p = prisma;
    const delhiCase = await p.case.findFirst({ where: { jurisdiction: { contains: "Delhi" } } });
    assert.ok(delhiCase, "Must find a Delhi case");

    // Mumbai investigator attempts direct fetch of Delhi case by ID
    const priyaLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "MH-104", password: "Rakshak@2026" }),
    });
    const priyaCookie = priyaLogin.headers.get("set-cookie").split(";")[0];

    const getDetailRes = await fetch(`${BASE_URL}/api/cases/${delhiCase.id}`, {
      headers: { Cookie: priyaCookie },
    });
    assert.strictEqual(getDetailRes.status, 403, "Direct access to other department case must return 403");

    // Admin can access the case
    const adminDetailRes = await fetch(`${BASE_URL}/api/cases/${delhiCase.id}`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(adminDetailRes.status, 200, "Admin can view case across departments");

    record("TC-16", "Department ID substitution guard on case details", true);
  } catch (err) {
    record("TC-16", "Department ID substitution guard on case details", false, err.message);
  }

  // ─── TC-17: Evidence Download Authorization Check ────────────────────────────
  try {
    const p = prisma;
    const allEvidence = await p.evidence.findMany({ take: 50 });
    let evidence = null;
    for (const ev of allEvidence) {
      try {
        await fs.access(path.join(process.cwd(), "uploads", "raw", `${ev.sha256Hash}.bin`));
        evidence = ev;
        break;
      } catch (_) {}
    }
    assert.ok(evidence, "Must find an evidence item with stored cold binary");

    // Viewer role does not have evidence:download permission
    const downloadRes = await fetch(`${BASE_URL}/api/evidence/${evidence.id}/download`, {
      headers: { Cookie: viewerCookie },
    });
    assert.strictEqual(downloadRes.status, 403, "Viewer download attempt must return 403");

    // Admin role has evidence:download permission
    const adminDownRes = await fetch(`${BASE_URL}/api/evidence/${evidence.id}/download`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(adminDownRes.status, 200, "Admin download attempt must return 200");

    record("TC-17", "Evidence download permission enforcement", true);
  } catch (err) {
    record("TC-17", "Evidence download permission enforcement", false, err.message);
  }

  // ─── TC-18: Centralized Audit Logging of Auth Events ─────────────────────────
  try {
    const p = prisma;
    const recentLogs = await p.auditLog.findMany({
      where: { module: "Auth" },
      orderBy: { timestamp: "desc" },
      take: 10,
    });
    assert.ok(recentLogs.length > 0, "Must have recorded Auth audit events");

    const actions = recentLogs.map((l) => l.action);
    assert.ok(actions.includes("LOGIN_SUCCESS"), "Must contain LOGIN_SUCCESS");
    assert.ok(actions.includes("LOGIN_FAILED"), "Must contain LOGIN_FAILED");
    assert.ok(actions.includes("LOGOUT"), "Must contain LOGOUT");

    record("TC-18", "Centralized audit logging of authentication & account events", true);
  } catch (err) {
    record("TC-18", "Centralized audit logging of authentication & account events", false, err.message);
  }

  // ─── TC-19: Controlled Department Onboarding Request Pipeline ────────────────
  try {
    // 1. Submit public department onboarding application
    const onboardRes = await fetch(`${BASE_URL}/api/auth/onboard-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentName: "Karnataka State Cyber Command",
        jurisdiction: "Bengaluru City",
        nodalOfficerName: "SP Vinay Kumar, IPS",
        nodalOfficerBadge: "IPS-KA-2016",
        nodalEmail: "cybercmd@ksp.gov.in",
        contactPhone: "+91 80 22942222",
        authorizationRef: "GO-HOME-DEPT-2026-CCB-88",
      }),
    });
    assert.strictEqual(onboardRes.status, 201, "Onboarding submission must return 201");
    const onboardData = await onboardRes.json();
    assert.strictEqual(onboardData.success, true);
    assert.strictEqual(onboardData.status, "PENDING");
    assert.ok(onboardData.requestId.startsWith("REQ-"));

    // 2. Unauthenticated attempt to view requests must be rejected
    const unauthGetRes = await fetch(`${BASE_URL}/api/auth/onboard-requests`);
    assert.strictEqual(unauthGetRes.status, 401, "Viewing requests without login must return 401");

    // 3. Non-admin attempt must be rejected with 403
    const viewerGetRes = await fetch(`${BASE_URL}/api/auth/onboard-requests`, {
      headers: { Cookie: viewerCookie },
    });
    assert.strictEqual(viewerGetRes.status, 403, "Viewing requests by non-admin must return 403");

    // 4. Admin review succeeds
    const adminGetRes = await fetch(`${BASE_URL}/api/auth/onboard-requests`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(adminGetRes.status, 200, "Admin can list requests");
    const adminListData = await adminGetRes.json();
    assert.ok(adminListData.requests.some((r) => r.requestId === onboardData.requestId));

    record("TC-19", "Controlled department onboarding request pipeline (no open signup)", true);
  } catch (err) {
    record("TC-19", "Controlled department onboarding request pipeline (no open signup)", false, err.message);
  }

  // ─── TC-20: Frontend Login & Onboarding Page Structure ───────────────────────
  try {
    const loginPageRes = await fetch(`${BASE_URL}/frontend/pages/login.html`);
    assert.strictEqual(loginPageRes.status, 200, "login.html must return 200");
    const loginHtml = await loginPageRes.text();
    assert.ok(loginHtml.includes("officer-login-form"), "Contains login form");
    assert.ok(loginHtml.includes("officer-identifier"), "Contains identifier field");
    assert.ok(loginHtml.includes("officer-password"), "Contains password field");
    assert.ok(loginHtml.includes("toggle-password-btn"), "Contains show/hide toggle");
    assert.ok(loginHtml.includes("login.js"), "Links to login.js controller");

    const onboardPageRes = await fetch(`${BASE_URL}/frontend/pages/onboard-request.html`);
    assert.strictEqual(onboardPageRes.status, 200, "onboard-request.html must return 200");
    const onboardHtml = await onboardPageRes.text();
    assert.ok(onboardHtml.includes("dept-onboard-form"), "Contains onboard form");
    assert.ok(onboardHtml.includes("onboard-request.js"), "Links to onboard-request.js controller");

    const loginJsRes = await fetch(`${BASE_URL}/frontend/js/login.js`);
    assert.strictEqual(loginJsRes.status, 200, "login.js must be accessible");

    const onboardJsRes = await fetch(`${BASE_URL}/frontend/js/onboard-request.js`);
    assert.strictEqual(onboardJsRes.status, 200, "onboard-request.js must be accessible");

    record("TC-20", "Frontend login & onboarding page structure & script validity", true);
  } catch (err) {
    record("TC-20", "Frontend login & onboarding page structure & script validity", false, err.message);
  }

  // ─── Summary Output ──────────────────────────────────────────────────────────
  console.log("\n================================================================");
  console.log(`   PHASE 21 TEST RESULTS: ${results.passed}/${results.total} PASSED (${results.failed} Failed)`);
  console.log("================================================================\n");

  // Save results artifact
  const backupDir = path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const resultPath = path.join(backupDir, "phase21_auth_validation.json");
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`Results saved to: ${resultPath}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runPhase21TestSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
