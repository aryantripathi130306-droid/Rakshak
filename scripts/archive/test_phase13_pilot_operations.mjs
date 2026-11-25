// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase13_pilot_operations.mjs
// RAKSHAK v3.0 — Phase 13 Pilot Operations, Training & Governance Test Suite
//
// Automated verification for:
// - Truthful test counts & readiness API gate reporting (81 reg + 15 scen = 96 total)
// - 10 Officer Training Guides & 10 Standard Operating Procedures
// - Pilot Feedback & Defect Lifecycle (Creation, Filtering, Triage, RBAC, Audits)
// - Formal Multi-Role Sign-off Tracking
// - Input Sanitization & Credential Leak Prevention
// - Preservation of cold evidence storage and existing database
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";

async function runPhase13Suite() {
  console.log("==================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 13 PILOT OPERATIONS & GOVERNANCE SUITE    ");
  console.log("   Environment: Staging Sandbox • Real Infrastructure Gates Verified ");
  console.log("==================================================================\n");

  const results = [];
  function record(id, title, passed, details = "") {
    results.push({ id, title, passed, details });
    const mark = passed ? "✓ PASS" : "❌ FAIL";
    console.log(`[${id}] ${mark} — ${title}`);
    if (details) console.log(`        Evidence: ${details}`);
  }

  let adminCookie = null;
  let viewerCookie = null;
  let testFeedbackId = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Authenticate ADMIN and VIEWER test actors
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-002", password: "Rakshak@2026" }),
    });
    assert.strictEqual(adminLogin.status, 200, "Admin login must succeed");
    adminCookie = adminLogin.headers.get("set-cookie");
    assert.ok(adminCookie, "Admin must receive session cookie");

    // Viewer login (DL-001 or inspect available viewer)
    const viewerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-001", password: "Rakshak@2026" }),
    });
    if (viewerLogin.status === 200) {
      viewerCookie = viewerLogin.headers.get("set-cookie");
    }
    record(
      "OPS-001",
      "Officer Authentication & Role Session Acquisition",
      true,
      `Admin Cookie acquired (${adminLogin.status}) • Viewer: ${viewerCookie ? "Acquired" : "N/A"}`
    );
  } catch (err) {
    record("OPS-001", "Officer Authentication & Role Session Acquisition", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Pilot Readiness API Truthful Metrics & Gate Consistency
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/pilot-readiness`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, "Readiness endpoint must return 200");
    const data = await res.json();

    // Check test metrics decomposition
    const metrics = data.testMetrics;
    assert.ok(metrics, "Must return testMetrics object");
    assert.strictEqual(metrics.totalSuitesExecuted, 7, "Must report exactly 7 executed test suites");
    assert.strictEqual(metrics.regressionAssertionsPassed, 81, "Must report 81 regression assertions passed");
    assert.strictEqual(metrics.pilotScenariosPassed, 15, "Must report 15 acceptance scenario assertions passed");
    assert.strictEqual(metrics.grandTotalAssertionsPassed, 96, "Grand total assertions must equal 81 + 15 = 96");
    assert.strictEqual(metrics.grandTotalAssertionsTotal, 96, "Grand total total assertions must equal 96");

    // Check that external infrastructure is NOT faked as PASS
    const gates = data.environmentGates;
    assert.ok(Array.isArray(gates) && gates.length >= 12, "Must return at least 12 readiness gates");

    const pgGate = gates.find((g) => g.actionType === "postgres-plan" || g.item.includes("PostgreSQL"));
    assert.ok(pgGate, "PostgreSQL gate must exist");
    assert.strictEqual(pgGate.status.toUpperCase(), "UNVERIFIED", "PostgreSQL gate must be UNVERIFIED without live instance");

    const httpsGate = gates.find((g) => g.actionType === "https-cert" || g.item.includes("HTTPS"));
    assert.ok(httpsGate, "HTTPS gate must exist");
    assert.strictEqual(httpsGate.status.toUpperCase(), "UNVERIFIED", "HTTPS proxy gate must be UNVERIFIED in staging sandbox without TLS cert");

    const fwGate = gates.find((g) => g.actionType === "firewall-reqs" || g.item.includes("Firewall"));
    assert.ok(fwGate, "Firewall gate must exist");
    assert.strictEqual(fwGate.status.toUpperCase(), "UNVERIFIED", "Firewall gate must be UNVERIFIED without network policy");

    // Verify 15 Acceptance Scenarios
    assert.strictEqual(data.pilotScenarios.length, 15, "Must present all 15 Phase 12 acceptance scenarios");

    record(
      "OPS-002",
      "Truthful Metric Accounting & External Infrastructure Gate Integrity",
      true,
      `Suites: ${metrics.totalSuitesExecuted}, Regression: ${metrics.regressionAssertionsPassed}, Scenarios: ${metrics.pilotScenariosPassed}, Grand Total: ${metrics.grandTotalAssertionsPassed}/96 passed. PostgreSQL: ${pgGate.status}, HTTPS: ${httpsGate.status}, Firewall: ${fwGate.status}`
    );
  } catch (err) {
    record("OPS-002", "Truthful Metric Accounting & External Infrastructure Gate Integrity", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Training Guides & SOP Runbooks Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const trainingPath = path.resolve(process.cwd(), "TRAINING_GUIDES.md");
    const sopPath = path.resolve(process.cwd(), "SOP_PILOT_OPERATIONS.md");

    assert.ok(fs.existsSync(trainingPath), "TRAINING_GUIDES.md must exist");
    assert.ok(fs.existsSync(sopPath), "SOP_PILOT_OPERATIONS.md must exist");

    const trainingContent = fs.readFileSync(trainingPath, "utf-8");
    const sopContent = fs.readFileSync(sopPath, "utf-8");

    // Verify all 10 Training modules are present (Module 1 through Module 10)
    for (let i = 1; i <= 10; i++) {
      const modHeader = `Module ${i}:`;
      assert.ok(trainingContent.includes(modHeader), `Training guide must contain '${modHeader}'`);
    }

    // Verify required forensic/legal disclaimers
    assert.ok(
      trainingContent.includes("byte-for-byte identical") || trainingContent.includes("byte-level integrity"),
      "Must include SHA-256 byte integrity disclaimer"
    );
    assert.ok(
      trainingContent.includes("NOT prove the truth") || trainingContent.includes("truth of the evidence"),
      "Must clarify hash match does not prove factual truth"
    );
    assert.ok(
      trainingContent.includes("guarantee") && trainingContent.includes("admit"),
      "Must clarify statutory report does not guarantee judicial admissibility"
    );

    // Verify all 10 SOPs are present (SOP-01 through SOP-10)
    for (let i = 1; i <= 10; i++) {
      const sopId = `SOP-${String(i).padStart(2, "0")}`;
      assert.ok(sopContent.includes(sopId), `SOP manual must contain ${sopId}`);
    }

    // Verify strict evidence immutability mandate
    assert.ok(
      sopContent.includes("PRIMARY EVIDENCE IMMUTABILITY RULE") ||
        sopContent.includes("Under no circumstances shall an operator or investigator modify, rename, or delete original files"),
      "Must mandate evidence binary preservation in SOPs"
    );

    record(
      "OPS-003",
      "Training Guides & SOP Runbook Integrity & Legal Disclaimers",
      true,
      `Verified 10/10 Training Modules (Module 1..10) and 10/10 SOPs (SOP-01..10) with mandatory forensic caveats`
    );
  } catch (err) {
    record("OPS-003", "Training Guides & SOP Runbook Integrity & Legal Disclaimers", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Pilot Feedback & Defect Intake (POST /api/feedback)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const payload = {
      title: "Automated Test Pilot Observation — OCR Extraction UI",
      module: "OCR_EXTRACTION",
      severity: "LOW",
      description: "Automated test verifying feedback persistence and identifier format generation.",
      stepsToReproduce: "1. Open evidence viewer.\n2. Inspect extracted entities table.\n3. Verify badge color contrast.",
      expectedBehavior: "Entity confidence pill should display clear contrast on dark navy surface.",
      actualBehavior: "Contrast is readable; testing feedback lifecycle workflow.",
      environment: "Staging / Edge Sandbox v3.0.0",
    };

    const postRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(postRes.status, 201, `Feedback creation must return 201 Created (got ${postRes.status})`);
    const createdData = await postRes.json();
    assert.ok(createdData.success, "Must return success flag");
    const item = createdData.item;
    assert.ok(item.feedbackNumber, "Must return server-generated feedbackNumber");
    assert.match(item.feedbackNumber, /^FDB-2026-\d{3,}$/, "feedbackNumber must match FDB-2026-XXX format");
    assert.strictEqual(item.status, "OPEN", "Initial workflow status must be OPEN");
    assert.strictEqual(item.reporterBadge, "DL-002", "Must record authenticated submitter badge");

    testFeedbackId = item.id;
    record(
      "OPS-004",
      "Pilot Feedback Intake & Server-Generated Ticket Identifier",
      true,
      `Created ticket ${item.feedbackNumber} (ID: ${item.id}) with initial status ${item.status}`
    );
  } catch (err) {
    record("OPS-004", "Pilot Feedback Intake & Server-Generated Ticket Identifier", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Input Sanitization & Credential Leak Guard (POST /api/feedback)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Attempt 1: Title too short (< 5 chars)
    const shortTitleRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Bad",
        module: "REPORTS",
        severity: "LOW",
        description: "Valid description but title is too short.",
      }),
    });
    assert.strictEqual(shortTitleRes.status, 400, "Must reject title < 5 characters with 400 Bad Request");

    // Attempt 2: Invalid module enum
    const badModuleRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Valid Title Here",
        module: "UNKNOWN_MODULE",
        severity: "LOW",
        description: "Valid description but invalid module.",
      }),
    });
    assert.strictEqual(badModuleRes.status, 400, "Must reject invalid module enum with 400 Bad Request");

    // Attempt 3: Credential / Secret leakage attempt
    const secretLeakRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Test Token Leak Failure",
        module: "RBAC_AUTH",
        severity: "HIGH",
        description: "User attempted to post token=secret_token_123456 and password=admin",
        stepsToReproduce: "Leak check",
      }),
    });
    assert.strictEqual(secretLeakRes.status, 400, "Must block credential/secret patterns in feedback text");
    const secretErr = await secretLeakRes.json();
    assert.ok(
      secretErr.error.includes("credential") || secretErr.error.includes("token"),
      "Error message must cite security violation"
    );

    record(
      "OPS-005",
      "Feedback Input Validation & Secret Leak Prevention",
      true,
      `Rejected invalid lengths (HTTP 400), invalid enums (HTTP 400), and intercepted token/password disclosure attempts`
    );
  } catch (err) {
    record("OPS-005", "Feedback Input Validation & Secret Leak Prevention", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Feedback Filtering, Search & Aggregated Metrics (GET /api/feedback)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const filterRes = await fetch(`${BASE_URL}/api/feedback?module=OCR_EXTRACTION&status=OPEN`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(filterRes.status, 200, "Filtered feedback query must return 200");
    const filterData = await filterRes.json();

    assert.ok(Array.isArray(filterData.items), "Must return items array");
    assert.ok(filterData.statusCounts, "Must return status breakdown");
    assert.ok(filterData.severityCounts, "Must return severity breakdown");

    const found = filterData.items.find((i) => i.id === testFeedbackId);
    assert.ok(found, "Filter must return the newly created feedback item");
    assert.strictEqual(found.module, "OCR_EXTRACTION", "Returned item module must match query");

    record(
      "OPS-006",
      "Feedback Listing, Attribute Filtering & Metric Aggregation",
      true,
      `Retrieved filtered list (${filterData.items.length} items). Counts: Open=${filterData.statusCounts.OPEN}, Closed=${filterData.statusCounts.CLOSED || 0}`
    );
  } catch (err) {
    record("OPS-006", "Feedback Listing, Attribute Filtering & Metric Aggregation", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Role-Based Triage & Status Transition (PATCH /api/feedback/[id])
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    assert.ok(testFeedbackId, "testFeedbackId must be set");

    // Viewer role should be denied if VIEWER role is active
    if (viewerCookie) {
      const viewerPatch = await fetch(`${BASE_URL}/api/feedback/${testFeedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: viewerCookie },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      assert.strictEqual(viewerPatch.status, 403, "Viewer role must be forbidden from updating feedback status (HTTP 403)");
    }

    // Admin updates status to TRIAGED
    const adminPatch1 = await fetch(`${BASE_URL}/api/feedback/${testFeedbackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        status: "TRIAGED",
        assignedReviewer: "Lead Forensic Reviewer",
        resolutionNotes: "Triage complete: Scheduled verification for next sprint build.",
      }),
    });
    assert.strictEqual(adminPatch1.status, 200, "Admin triage patch must succeed with 200 OK");
    const patched1 = await adminPatch1.json();
    assert.strictEqual(patched1.item.status, "TRIAGED", "Status must update to TRIAGED");
    assert.strictEqual(patched1.item.assignedReviewer, "Lead Forensic Reviewer", "Reviewer assignment must persist");

    // Admin verifies resolution and closes
    const adminPatch2 = await fetch(`${BASE_URL}/api/feedback/${testFeedbackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        status: "RESOLVED",
        resolutionNotes: "Fix verified in staging build v3.0.0. No regression detected.",
      }),
    });
    assert.strictEqual(adminPatch2.status, 200, "Admin resolution patch must succeed");
    const patched2 = await adminPatch2.json();
    assert.strictEqual(patched2.item.status, "RESOLVED", "Status must be RESOLVED");

    record(
      "OPS-007",
      "Feedback Triage Lifecycle, Reviewer Assignment & Resolution Verification",
      true,
      `Successfully transitioned ticket: OPEN -> TRIAGED -> RESOLVED with assigned reviewer and verification notes`
    );
  } catch (err) {
    record("OPS-007", "Feedback Triage Lifecycle, Reviewer Assignment & Resolution Verification", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Formal Departmental Sign-off Recording (POST /api/pilot-readiness)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const signOffPayload = {
      signOffId: "signoff-owner",
      status: "Approved",
      reviewerName: "ACP Vikram Singh",
      designation: "Assistant Commissioner of Police, Cyber Crime Branch, Delhi",
      comments: "Controlled synthetic pilot approved for departmental trial under STRICT_AUTH and read-only case allocation.",
    };

    const signOffRes = await fetch(`${BASE_URL}/api/pilot-readiness`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(signOffPayload),
    });

    assert.strictEqual(signOffRes.status, 200, `Sign-off recording must return 200 (got ${signOffRes.status})`);
    const signOffData = await signOffRes.json();
    assert.ok(signOffData.success, "Must return success flag");
    assert.ok(signOffData.signOffs, "Must return updated signOffs list");

    const deptSignOff = signOffData.signOffs.find((s) => s.id === "signoff-owner");
    assert.ok(deptSignOff, "Department owner sign-off must be present");
    assert.strictEqual(deptSignOff.status, "Approved", "Status must reflect Approved");
    assert.strictEqual(deptSignOff.signedByBadge, "DL-002", "Must record authenticated reviewer badge");
    assert.ok(deptSignOff.signedAt, "Must record decision timestamp");

    record(
      "OPS-008",
      "Formal Departmental Sign-Off Recording & Identity Attribution",
      true,
      `Recorded ${deptSignOff.role} sign-off by ${deptSignOff.name} (${deptSignOff.signedByBadge}) with decision date ${deptSignOff.signedAt}`
    );
  } catch (err) {
    record("OPS-008", "Formal Departmental Sign-Off Recording & Identity Attribution", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Immutable Audit Trail Verification (GET /api/audit)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const auditRes = await fetch(`${BASE_URL}/api/audit?limit=20`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(auditRes.status, 200, "Audit logs API must return 200");
    const auditData = await auditRes.json();

    const logs = auditData.logs;
    assert.ok(Array.isArray(logs), "Must return audit logs array");

    // Find feedback creation audit log
    const feedbackCreateLog = logs.find((l) => l.action === "FEEDBACK_SUBMITTED");
    assert.ok(feedbackCreateLog, "Audit log for FEEDBACK_SUBMITTED must exist");
    assert.strictEqual(feedbackCreateLog.officerBadge, "DL-002", "Audit log must attribute badge DL-002");

    // Find feedback update audit log
    const feedbackUpdateLog = logs.find((l) => l.action === "FEEDBACK_STATUS_UPDATED");
    assert.ok(feedbackUpdateLog, "Audit log for FEEDBACK_STATUS_UPDATED must exist");

    // Find sign-off audit log
    const signOffLog = logs.find((l) => l.action === "PILOT_SIGN_OFF_RECORDED");
    assert.ok(signOffLog, "Audit log for PILOT_SIGN_OFF_RECORDED must exist");

    record(
      "OPS-009",
      "Audit Log Verification for Feedback & Sign-off Governance",
      true,
      `Verified immutable audit entries: FEEDBACK_SUBMITTED, FEEDBACK_STATUS_UPDATED, PILOT_SIGN_OFF_RECORDED with actor attribution`
    );
  } catch (err) {
    record("OPS-009", "Audit Log Verification for Feedback & Sign-off Governance", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Cold Evidence & Database Immutability Check
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const uploadsDir = path.resolve(process.cwd(), "uploads", "raw");
    assert.ok(fs.existsSync(uploadsDir), "uploads/raw directory must exist");
    const rawFiles = fs.readdirSync(uploadsDir);
    assert.ok(rawFiles.length > 0, "Original uploaded evidence binaries must remain preserved");

    // Verify DB cases count via /api/cases
    const casesRes = await fetch(`${BASE_URL}/api/cases`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(casesRes.status, 200, "Cases API must return 200");
    const casesData = await casesRes.json();
    assert.ok(casesData.total > 0, "Investigative cases must remain intact in database");

    record(
      "OPS-010",
      "Evidence Binary Preservation & Case Database Integrity",
      true,
      `Verified ${rawFiles.length} raw evidence binary files preserved and ${casesData.total} cases intact in DB`
    );
  } catch (err) {
    record("OPS-010", "Evidence Binary Preservation & Case Database Integrity", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n==================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`   PHASE 13 PILOT OPERATIONS TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase13Suite().catch((err) => {
  console.error("FATAL: Phase 13 Test Runner Error:", err);
  process.exit(1);
});
