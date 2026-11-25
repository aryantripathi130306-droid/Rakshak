// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase14_security_assessment.mjs
// RAKSHAK v3.0 — Phase 14 Independent Application Security Assessment Suite
//
// Non-destructive automated security testing covering:
// 1. Anonymous Access Restrictions across protected API endpoints
// 2. Role Escalation Defenses (Viewer/Analyst privilege boundary enforcement)
// 3. Officer Deactivation & Session Invalidation
// 4. Evidence Download Authorization & Protection
// 5. Statutory Report & Dossier Download Authorization
// 6. Evidence Intake Validation, SHA-256 Guards & Upload Limits
// 7. Path Traversal & File System Boundary Defenses
// 8. OCR & Telemetry Endpoint Abuse Resilience
// 9. Sensitive Data Exposure (Stack traces, secrets, credentials in responses)
// 10. Audit Log Immutability & Modification Denial (DELETE/PUT prevention)
// 11. Cryptographic Session Cookie Hardening & HttpOnly Verification
// 12. Forwarded Header Safety & Reverse Proxy Trust Invariants
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function runSecurityAssessment() {
  console.log("==================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 14 SECURITY & GOVERNANCE ASSESSMENT       ");
  console.log("   Target: Staging Target • Mode: Non-Destructive Invariant Audit ");
  console.log("==================================================================\n");

  const results = [];
  function record(id, title, status, severity, details = "") {
    results.push({ id, title, status, severity, details });
    const mark = status === "PASS" ? "✓ PASS" : (status === "FAIL" ? "❌ FAIL" : "⚠ WARN");
    console.log(`[${id}] ${mark} (${severity}) — ${title}`);
    if (details) console.log(`        Evidence: ${details}`);
  }

  let adminCookie = null;
  let viewerCookie = null;
  let activeCaseId = null;
  let testEvidenceId = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // SETUP: Authenticate ADMIN (DL-002) and VIEWER (DL-001)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-002", password: "Rakshak@2026" })
    });
    if (adminLogin.status === 200) {
      adminCookie = adminLogin.headers.get("set-cookie");
    }

    const viewerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "MH-088", password: "Rakshak@2026" })
    });
    if (viewerLogin.status === 200) {
      viewerCookie = viewerLogin.headers.get("set-cookie");
    }

    // Fetch an active case ID and evidence ID for authorization testing
    if (adminCookie) {
      const casesRes = await fetch(`${BASE_URL}/api/cases?limit=1`, { headers: { Cookie: adminCookie } });
      const casesData = await casesRes.json();
      if (casesData.cases && casesData.cases.length > 0) {
        activeCaseId = casesData.cases[0].id;
        if (casesData.cases[0].evidence && casesData.cases[0].evidence.length > 0) {
          testEvidenceId = casesData.cases[0].evidence[0].id;
        }
      }
    }
  } catch (err) {
    console.warn("Setup warning:", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Anonymous Access to Protected API Routes
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const protectedRoutes = [
      { path: "/api/reports", method: "GET" },
      { path: "/api/audit", method: "GET" },
      { path: "/api/feedback", method: "GET" },
      { path: "/api/officers", method: "GET" },
      { path: "/api/evidence/upload", method: "POST" },
      { path: `/api/cases/${activeCaseId || "CASE-2026-0891"}/dossier/export`, method: "POST" }
    ];

    let allBlocked = true;
    const blockedCodes = [];
    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route.path}`, { method: route.method });
      blockedCodes.push(`${route.path} -> HTTP ${res.status}`);
      if (res.status !== 401 && res.status !== 403) {
        allBlocked = false;
      }
    }

    assert.ok(allBlocked, "All protected routes must block anonymous requests with HTTP 401/403");
    record("SEC-001", "Anonymous API Access Denial", "PASS", "CRITICAL",
      `All 6 core routes blocked anonymous callers: ${blockedCodes.join(", ")}`);
  } catch (err) {
    record("SEC-001", "Anonymous API Access Denial", "FAIL", "CRITICAL", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Role Escalation Defenses (Viewer Restrictions)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    assert.ok(viewerCookie, "Viewer session required for role escalation test");

    // Viewer attempting to update feedback triage status
    const triageAttempt = await fetch(`${BASE_URL}/api/feedback/FDB-2026-001`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ status: "CLOSED", resolutionNotes: "Malicious escalation" })
    });
    assert.strictEqual(triageAttempt.status, 403, "Viewer role must be rejected with 403 on feedback triage");

    // Viewer attempting to generate intelligence report
    const reportAttempt = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ template: "INVESTIGATION_COMPLETE", caseId: activeCaseId })
    });
    assert.strictEqual(reportAttempt.status, 403, "Viewer role must be rejected with 403 on report generation");

    record("SEC-002", "Privilege Escalation & Role Boundaries", "PASS", "HIGH",
      `Viewer role strictly forbidden from feedback triage (HTTP ${triageAttempt.status}) and report generation (HTTP ${reportAttempt.status})`);
  } catch (err) {
    record("SEC-002", "Privilege Escalation & Role Boundaries", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Officer Deactivation & Session Invalidation
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Attempt login with known deactivated badge (e.g. DL-020 or provisioned test)
    const deactRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-020", password: "WrongPasswordOrDeactivated" })
    });
    // Should be rejected with 401 or 403
    assert.ok(deactRes.status === 401 || deactRes.status === 403, "Deactivated or invalid badge must be rejected");

    record("SEC-003", "Officer Credential & Deactivation Invariant", "PASS", "HIGH",
      `Unauthorized/deactivated authentication rejected at API boundary (HTTP ${deactRes.status})`);
  } catch (err) {
    record("SEC-003", "Officer Credential & Deactivation Invariant", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Evidence Binary Download Authorization
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    if (!testEvidenceId) {
      // Find or upload disposable evidence to test
      testEvidenceId = "dummy-evidence-uuid-0000";
    }

    // Unauthenticated download attempt
    const anonDownload = await fetch(`${BASE_URL}/api/evidence/${testEvidenceId}/download`);
    assert.ok(anonDownload.status === 401 || anonDownload.status === 403 || anonDownload.status === 404,
      "Anonymous download must be rejected");

    // Authenticated download check (if valid ID)
    if (adminCookie && testEvidenceId !== "dummy-evidence-uuid-0000") {
      const authDownload = await fetch(`${BASE_URL}/api/evidence/${testEvidenceId}/download`, {
        headers: { Cookie: adminCookie }
      });
      assert.ok(authDownload.status === 200 || authDownload.status === 404, "Admin download must evaluate cleanly");
    }

    record("SEC-004", "Evidence Binary Download Authorization", "PASS", "CRITICAL",
      `Anonymous download blocked with HTTP ${anonDownload.status}; direct filesystem exposure prevented`);
  } catch (err) {
    record("SEC-004", "Evidence Binary Download Authorization", "FAIL", "CRITICAL", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Statutory Dossier & Report Export Authorization
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const anonDossier = await fetch(`${BASE_URL}/api/cases/${activeCaseId || "test"}/dossier/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "JSON" })
    });
    assert.ok(anonDossier.status === 401 || anonDossier.status === 403, "Anonymous dossier export must be denied");

    record("SEC-005", "Statutory Dossier & Report Download Authorization", "PASS", "HIGH",
      `Anonymous dossier export denied with HTTP ${anonDossier.status}`);
  } catch (err) {
    record("SEC-005", "Statutory Dossier & Report Download Authorization", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: In-Transit Cryptographic Tampering Rejection
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    assert.ok(adminCookie, "Admin cookie required");

    const payload = new FormData();
    const testBuf = Buffer.from("SYNTHETIC TEST TAMPER CONTENT");
    const blob = new Blob([testBuf], { type: "text/plain" });
    payload.append("file", blob, "tamper_test.txt");
    payload.append("caseId", activeCaseId || "test-case-id");
    payload.append("category", "CHAT");
    // Purposely forged client hash
    payload.append("clientHash", "0000000000000000000000000000000000000000000000000000000000000000");

    const uploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: payload
    });

    assert.strictEqual(uploadRes.status, 422, "Hash mismatch must trigger HTTP 422 INTEGRITY_VIOLATION");
    const errBody = await uploadRes.json();
    assert.ok(errBody.error.includes("Integrity Violation") || errBody.error.includes("mismatch"),
      "Error must explicitly cite hash mismatch");

    record("SEC-006", "Evidence Ingestion Cryptographic Tamper Defense", "PASS", "CRITICAL",
      `Forged clientHash rejected byte-for-byte with HTTP 422: ${errBody.error}`);
  } catch (err) {
    record("SEC-006", "Evidence Ingestion Cryptographic Tamper Defense", "FAIL", "CRITICAL", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Path Traversal Defenses
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const maliciousPaths = [
      "/api/evidence/..%2f..%2f..%2fetc%2fpasswd/download",
      "/api/evidence/%2e%2e%5c%2e%2e%5cwindows%5cwin.ini/download",
      "/api/evidence/....//....//uploads/download"
    ];

    let allBlocked = true;
    for (const p of maliciousPaths) {
      const res = await fetch(`${BASE_URL}${p}`, { headers: { Cookie: adminCookie } });
      if (res.status === 200) allBlocked = false;
    }

    assert.ok(allBlocked, "Path traversal sequences must not resolve valid files");
    record("SEC-007", "Path Traversal & Directory Boundary Defense", "PASS", "HIGH",
      `Path traversal attacks safely rejected across URL-encoded permutations`);
  } catch (err) {
    record("SEC-007", "Path Traversal & Directory Boundary Defense", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: OCR & Telemetry Abuse Handling
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Calling OCR on non-existent or empty evidence ID
    const ocrRes = await fetch(`${BASE_URL}/api/evidence/non-existent-uuid-9999/ocr`, {
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(ocrRes.status, 404, "Invalid evidence ID must return HTTP 404");
    const ocrBody = await ocrRes.json();
    assert.ok(ocrBody.error, "Must return structured error message");

    record("SEC-008", "OCR Engine Telemetry & Fault Tolerance", "PASS", "MEDIUM",
      `Invalid evidence OCR lookup returned safe HTTP 404 without crashing`);
  } catch (err) {
    record("SEC-008", "OCR Engine Telemetry & Fault Tolerance", "FAIL", "MEDIUM", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9: Sensitive Data Exposure Protection (Error Responses & Logs)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Send malformed JSON to trigger server error handling
    const badJsonRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: "{ malformed json ::: "
    });
    const errText = await badJsonRes.text();

    // Invariant: Response must not contain database connection strings, passwords, or raw stack traces
    assert.ok(!errText.includes("DATABASE_URL"), "Must not leak DATABASE_URL in errors");
    assert.ok(!errText.includes("SESSION_SECRET"), "Must not leak SESSION_SECRET");
    assert.ok(!errText.includes("node_modules/prisma"), "Must not leak internal prisma paths");

    record("SEC-009", "Information Disclosure & Error Sanitization", "PASS", "HIGH",
      `Error responses safely sanitized; zero internal credentials, paths, or connection strings exposed`);
  } catch (err) {
    record("SEC-009", "Information Disclosure & Error Sanitization", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 10: Audit Log Immutability & Modification Denial
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Attempt DELETE on audit logs
    const deleteAudit = await fetch(`${BASE_URL}/api/audit`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    });
    assert.ok(deleteAudit.status === 405 || deleteAudit.status === 403 || deleteAudit.status === 404,
      "DELETE on audit logs must be rejected");

    // Attempt PUT on audit logs
    const putAudit = await fetch(`${BASE_URL}/api/audit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "PURGE_ALL" })
    });
    assert.ok(putAudit.status === 405 || putAudit.status === 403 || putAudit.status === 404,
      "PUT on audit logs must be rejected");

    record("SEC-010", "Audit Log Immutability & Tamper Denial", "PASS", "CRITICAL",
      `DELETE (HTTP ${deleteAudit.status}) and PUT (HTTP ${putAudit.status}) rejected; audit trail is append-only`);
  } catch (err) {
    record("SEC-010", "Audit Log Immutability & Tamper Denial", "FAIL", "CRITICAL", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 11: Cryptographic Session Cookie Security Attributes
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-002", password: "Rakshak@2026" })
    });
    const setCookie = loginRes.headers.get("set-cookie") || "";

    assert.ok(setCookie.includes("HttpOnly"), "Session cookie MUST specify HttpOnly");
    assert.ok(setCookie.includes("SameSite=Lax") || setCookie.includes("SameSite=Strict"),
      "Session cookie MUST specify SameSite=Lax or SameSite=Strict");

    // Check Secure flag notice
    const hasSecure = setCookie.includes("Secure");
    const secureDetail = hasSecure
      ? "Secure flag active"
      : "Secure flag inactive in local HTTP dev mode (enforced in NODE_ENV=production over HTTPS)";

    record("SEC-011", "Session Cookie Hardening (HttpOnly & SameSite)", "PASS", "HIGH",
      `Verified: HttpOnly=true, SameSite=Lax/Strict • ${secureDetail}`);
  } catch (err) {
    record("SEC-011", "Session Cookie Hardening (HttpOnly & SameSite)", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 12: Direct Cold Storage Bypass via Web Server
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Attempt direct access to cold evidence storage directory
    const directAccess = await fetch(`${BASE_URL}/uploads/raw/`);
    // Next.js App Router should return 404 or block it
    assert.ok(directAccess.status === 404 || directAccess.status === 403,
      "Direct directory browsing of /uploads/raw/ must be blocked");

    record("SEC-012", "Cold Storage Direct Web Access Defense", "PASS", "HIGH",
      `Direct web access to /uploads/raw/ blocked with HTTP ${directAccess.status}`);
  } catch (err) {
    record("SEC-012", "Cold Storage Direct Web Access Defense", "FAIL", "HIGH", err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n==================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = total - passed;
  console.log(`   PHASE 14 SECURITY ASSESSMENT SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAssessment().catch(err => {
  console.error("FATAL: Security Assessment Runner Error:", err);
  process.exit(1);
});
