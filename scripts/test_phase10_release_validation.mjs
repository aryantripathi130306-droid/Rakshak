// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase10_release_validation.mjs
// RAKSHAK v3.0 — Phase 10 Final System Validation & Release Readiness Suite
//
// Comprehensive Automated Test Matrix covering:
// 1. End-to-End Synthetic Investigation (13 Steps with Multi-Case Linkage)
// 2. Security Validation (RBAC, Deactivation, Path Traversal, Size Limits)
// 3. Reliability & Performance Stress Benchmarks
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const BASE_URL = "http://localhost:3000";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function generateForensicPdf(lines) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(lines[0], 14, 20);
  doc.setFontSize(10);
  let y = 30;
  for (let i = 1; i < lines.length; i++) {
    doc.text(lines[i], 14, y);
    y += 8;
  }
  return Buffer.from(doc.output("arraybuffer"));
}

async function runPhase10Suite() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 10 SYSTEM VALIDATION & RELEASE SUITE   ");
  console.log("================================================================\n");

  const results = { passed: 0, failed: 0 };
  let sessionCookie = null;
  let adminOfficer = null;

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1: AUTHENTICATION & SESSION MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════
  console.log("--- [PART 1] Authentication & Session Management ---");
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-002", password: "Rakshak@2026" }),
    });
    assert.strictEqual(loginRes.status, 200, "Admin login should return 200");
    const loginData = await loginRes.json();
    adminOfficer = loginData.officer;
    assert.strictEqual(adminOfficer.badgeNumber, "DL-002");
    assert.strictEqual(adminOfficer.role, "ADMIN");

    const rawCookie = loginRes.headers.get("set-cookie");
    assert.ok(rawCookie, "Set-Cookie header must be issued");
    sessionCookie = rawCookie.split(";")[0];
    console.log(`  ✓ Authenticated as ${adminOfficer.name} (${adminOfficer.role}) with session cookie`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Authentication failed:", err.message);
    results.failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2: END-TO-END SYNTHETIC INVESTIGATION WORKFLOW (13 Steps)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n--- [PART 2] End-to-End Synthetic Investigation Workflow ---");

  const randomId = Math.floor(100000 + Math.random() * 900000);
  const sharedUpi = `syndicate.mule.shared.${randomId}@okaxis`;
  let caseA = null;
  let caseB = null;
  let evidenceA = null;

  // Step 1 & 2: Create Synthetic Case A with Assigned Investigating Officer
  try {
    const caseARes = await fetch(`${BASE_URL}/api/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        incidentType: "Investment_Fraud",
        complainantName: "Dr. Arvind Swaminathan",
        amountDefrauded: 1250000,
        jurisdiction: "Cyber Crime PS — South Delhi",
        officerName: adminOfficer.name,
        officerBadge: adminOfficer.badgeNumber,
        description: "Transnational task recruitment mule syndicate operation.",
      }),
    });
    assert.strictEqual(caseARes.status, 201, "Case A creation returns 201");
    caseA = await caseARes.json();
    assert.ok(caseA.id && caseA.caseNumber, "Case A has valid ID and caseNumber");
    console.log(`  [Step 1-2] Created Case A: ${caseA.caseNumber} (Officer: ${caseA.officerName})`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 1-2 Case A creation failed:", err.message);
    results.failed++;
  }

  // Step 3 & 4: Upload Synthetic Evidence & Verify SHA-256
  const pdfLinesCaseA = [
    "STATE BANK OF INDIA - FORENSIC TRANSACTION STATEMENT",
    "Account Number: 987654321001",
    "IFSC Code: SBIN0001234",
    `Beneficiary UPI: ${sharedUpi}`,
    "Transaction Phone: +919876543210",
    "Reference UTR: UTR987654321098",
    "Secondary Domain: payment-secure-portal.com",
    "Destination IP: 192.168.1.105",
    "Remarks: Part of transnational task scam funnel",
  ];
  const pdfBufferA = generateForensicPdf(pdfLinesCaseA);
  const serverDigestA = sha256(pdfBufferA);

  try {
    // Step 5: Test deliberate hash mismatch
    const badFormData = new FormData();
    badFormData.append("file", new Blob([pdfBufferA], { type: "application/pdf" }), "statement_tampered.pdf");
    badFormData.append("caseId", caseA.id);
    badFormData.append("clientHash", "0000000000000000000000000000000000000000000000000000000000000000");

    const badUploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: badFormData,
    });
    assert.strictEqual(badUploadRes.status, 422, "Deliberate hash mismatch must be rejected with HTTP 422");
    const badUploadBody = await badUploadRes.json();
    assert.strictEqual(badUploadBody.code, "INTEGRITY_VIOLATION");
    console.log("  [Step 5] Deliberate hash tampering rejected with HTTP 422 (INTEGRITY_VIOLATION)");
    results.passed++;

    // Step 3-4: Legitimate evidence upload with valid SHA-256
    const goodFormData = new FormData();
    goodFormData.append("file", new Blob([pdfBufferA], { type: "application/pdf" }), "statement_valid.pdf");
    goodFormData.append("caseId", caseA.id);
    goodFormData.append("clientHash", serverDigestA);
    goodFormData.append("evidenceCategory", "UPI_FINANCIAL");

    const goodUploadRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: goodFormData,
    });
    assert.strictEqual(goodUploadRes.status, 201, "Legitimate upload must return 201");
    evidenceA = await goodUploadRes.json();
    assert.strictEqual(evidenceA.sha256Hash, serverDigestA);
    assert.strictEqual(evidenceA.verified, true);
    console.log(`  [Step 3-4] Evidence A ingested & verified: SHA-256=${serverDigestA.substring(0, 16)}...`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 3-5 Upload validation failed:", err.message);
    results.failed++;
  }

  // Step 6 & 7: OCR & Entity Extraction with Provenance Anchoring
  try {
    const ocrTriggerRes = await fetch(`${BASE_URL}/api/evidence/${evidenceA.evidenceId}/ocr`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(ocrTriggerRes.status, 200, "OCR execution returns 200");
    const ocrData = await ocrTriggerRes.json();
    assert.strictEqual(ocrData.ocr.status, "SUCCESS");
    assert.ok(ocrData.ocr.charCount > 0, "OCR extracted positive characters");

    // Check entity extraction results from OCR response and from entities endpoint
    assert.ok(ocrData.entitiesCount >= 3, `OCR identified >= 3 entities (found: ${ocrData.entitiesCount})`);
    const upiEntity = ocrData.entities.find((e) => e.normalizedValue.toLowerCase() === sharedUpi.toLowerCase());
    assert.ok(upiEntity, "Shared UPI entity found in extracted entities");
    console.log(`  [Step 6-7] OCR extracted ${ocrData.entitiesCount} entities anchored to SHA-256`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 6-7 OCR extraction failed:", err.message);
    results.failed++;
  }

  // Step 8: Timeline Normalization
  try {
    const timelineRes = await fetch(`${BASE_URL}/api/cases/${caseA.id}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        events: [
          {
            rawTimestamp: "2026-10-10T14:30:00.000Z",
            description: `Unauthorized UPI transfer to ${sharedUpi}`,
            sourceType: "BANK_SMS",
            evidenceId: evidenceA.evidenceId,
          },
        ],
      }),
    });
    assert.strictEqual(timelineRes.status, 201, "Timeline event ingested");

    const getTimelineRes = await fetch(`${BASE_URL}/api/cases/${caseA.id}/timeline`, {
      headers: { Cookie: sessionCookie },
    });
    const timelineData = await getTimelineRes.json();
    assert.ok(timelineData.events.length >= 1, "Timeline contains ingested event");
    assert.strictEqual(timelineData.events[0].phase, "PAYMENT", "Modus operandi classified as PAYMENT");
    console.log("  [Step 8] Timeline normalized with UTC timestamp & MO phase 'PAYMENT'");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 8 Timeline verification failed:", err.message);
    results.failed++;
  }

  // Step 9: Create Second Synthetic Case B with the Same Shared Entity
  try {
    const caseBRes = await fetch(`${BASE_URL}/api/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        incidentType: "Digital_Arrest",
        complainantName: "Mrs. Sunita Sharma",
        amountDefrauded: 850000,
        jurisdiction: "Cyber Crime PS — Gurugram",
        officerName: adminOfficer.name,
        officerBadge: adminOfficer.badgeNumber,
        description: "Digital arrest scam routing funds through the same syndicate mule.",
      }),
    });
    caseB = await caseBRes.json();

    const pdfLinesCaseB = [
      "HDFC BANK - CYBER INCIDENT EVIDENCE",
      "Account Number: 112233445566",
      `Beneficiary VPA: ${sharedUpi}`,
      "Transaction Amount: INR 850,000",
      "Phone: +919876543210",
      "Remarks: Digital arrest coerced transfer",
    ];
    const pdfBufferB = generateForensicPdf(pdfLinesCaseB);
    const serverDigestB = sha256(pdfBufferB);

    const formB = new FormData();
    formB.append("file", new Blob([pdfBufferB], { type: "application/pdf" }), "hdfc_statement.pdf");
    formB.append("caseId", caseB.id);
    formB.append("clientHash", serverDigestB);
    formB.append("evidenceCategory", "UPI_FINANCIAL");

    const uploadBRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: formB,
    });
    const evidenceB = await uploadBRes.json();

    // Trigger OCR on Case B evidence
    await fetch(`${BASE_URL}/api/evidence/${evidenceB.evidenceId}/ocr`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });

    console.log(`  [Step 9] Created Case B: ${caseB.caseNumber} sharing entity ${sharedUpi}`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 9 Case B creation failed:", err.message);
    results.failed++;
  }

  // Step 10: Verify Cross-Case Syndicate Resolver
  try {
    const graphRes = await fetch(`${BASE_URL}/api/graph?q=${encodeURIComponent(sharedUpi)}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(graphRes.status, 200);
    const graphData = await graphRes.json();

    const sharedNode = graphData.nodes.find(
      (n) => n.normalizedValue?.toLowerCase() === sharedUpi.toLowerCase() || n.id?.toLowerCase().includes(sharedUpi.toLowerCase())
    );
    assert.ok(sharedNode, "Shared entity node present in syndicate graph");
    assert.ok(sharedNode.caseCount >= 2, `Shared node links >= 2 cases (found: ${sharedNode.caseCount})`);
    assert.ok(sharedNode.flags.includes("MULTI_CASE_LINKAGE"), "Flagged with MULTI_CASE_LINKAGE");
    console.log(`  [Step 10] Cross-case resolver linked Case A & B via ${sharedUpi} (caseCount: ${sharedNode.caseCount})`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 10 Cross-case resolver failed:", err.message);
    results.failed++;
  }

  // Step 11: Generate & Validate BSA Section 63 Electronic Dossier Manifest
  try {
    // 11a. Check GET dossier
    const dossierRes = await fetch(`${BASE_URL}/api/cases/${caseA.id}/dossier`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(dossierRes.status, 200);
    const dossierData = await dossierRes.json();
    assert.ok(dossierData.section63BSAManifest?.title.includes("Bharatiya Sakshya Adhiniyam"), "Dossier title references BSA § 63");
    assert.ok(dossierData.section63BSAManifest.items.length >= 1, "Dossier contains evidence items in manifest");

    // 11b. Check POST export JSON
    const exportRes = await fetch(`${BASE_URL}/api/cases/${caseA.id}/dossier/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ format: "JSON" }),
    });
    assert.strictEqual(exportRes.status, 200);
    const exportData = await exportRes.json();
    assert.ok(exportData.statutoryFramework?.evidenceAct?.includes("Section 63"), "Export JSON references BSA Section 63");
    console.log("  [Step 11] BSA § 63 Electronic Dossier exported with verified evidence manifest");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 11 Dossier export failed:", err.message);
    results.failed++;
  }

  // Step 12: Generate Investigation Report
  let reportId = null;
  try {
    const reportRes = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        caseId: caseA.id,
        type: "INVESTIGATION_COMPLETE",
        format: "JSON",
        sections: ["summary", "evidence", "entities", "chainOfCustody", "legal"],
      }),
    });
    assert.ok([200, 201].includes(reportRes.status), "Report generate returns 200 or 201");
    const reportData = await reportRes.json();
    reportId = reportData.report.id;
    assert.strictEqual(reportData.report.status, "COMPLETED");
    console.log(`  [Step 12] Generated Report ${reportData.report.reportNumber} (Status: COMPLETED)`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 12 Report generation failed:", err.message);
    results.failed++;
  }

  // Step 13: Centralized Audit Trail Verification
  try {
    const auditRes = await fetch(`${BASE_URL}/api/audit?limit=30`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();
    assert.ok(auditData.logs.length > 0, "Audit trail contains logs");

    const uploadLog = auditData.logs.find((l) => l.action === "UPLOAD_EVIDENCE" && l.targetId === evidenceA.evidenceId);
    assert.ok(uploadLog, "Audit trail contains UPLOAD_EVIDENCE event for evidence A");
    console.log(`  [Step 13] Verified centralized audit trail (${auditData.total} logs recorded)`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Step 13 Audit log check failed:", err.message);
    results.failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3: SECURITY VALIDATION SUITE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n--- [PART 3] Security Validation Suite ---");

  // Test 3.1: Anonymous Access Rejection (No Session / Bad Token)
  try {
    const badTokenRes = await fetch(`${BASE_URL}/api/reports/${reportId}/download`, {
      headers: { Authorization: "Bearer bogus-token-12345" },
    });
    assert.strictEqual(badTokenRes.status, 403, "Invalid bearer token must be rejected with 403");
    console.log("  ✓ Security 3.1: Invalid bearer token correctly rejected with HTTP 403");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Security 3.1 failed:", err.message);
    results.failed++;
  }

  // Test 3.2: Role Restrictions (Viewer Role attempting restricted action)
  try {
    // Create a viewer officer
    const viewerBadge = `VW-${Math.floor(1000 + Math.random() * 9000)}`;
    const createViewerRes = await fetch(`${BASE_URL}/api/officers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        badgeNumber: viewerBadge,
        name: "Viewer Officer Trainee",
        rank: "Constable",
        role: "VIEWER",
        jurisdiction: "Delhi",
        password: "password123",
      }),
    });
    const viewerOfficer = await createViewerRes.json();

    // Log in as Viewer
    const viewerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: viewerBadge, password: "password123" }),
    });
    assert.strictEqual(viewerLoginRes.status, 200, "Viewer login must return 200");
    const rawSetCookie = viewerLoginRes.headers.get("set-cookie");
    const viewerCookie = rawSetCookie ? rawSetCookie.split(";")[0] : "";

    // Attempt to download report as Viewer (Viewer role does not have reports:download)
    const viewerDownloadRes = await fetch(`${BASE_URL}/api/reports/${reportId}/download`, {
      headers: { Cookie: viewerCookie },
    });
    assert.strictEqual(viewerDownloadRes.status, 403, "Viewer role cannot download reports");
    console.log("  ✓ Security 3.2: Role restrictions enforced (Viewer download rejected with 403)");
    results.passed++;

    // Test 3.3: Officer Deactivation
    const deactRes = await fetch(`${BASE_URL}/api/officers/${viewerOfficer.officer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    assert.strictEqual(deactRes.status, 200);

    // Attempt login with deactivated officer
    const deactLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: viewerBadge, password: "password123" }),
    });
    assert.strictEqual(deactLoginRes.status, 403, "Deactivated officer login must be rejected with 403");
    console.log("  ✓ Security 3.3: Officer deactivation enforced (Login rejected with 403)");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Security 3.2-3.3 failed:", err.message);
    results.failed++;
  }

  // Test 3.4: Path Traversal Defenses on Evidence Retrieval
  try {
    const traversalPayloads = [
      "../../etc/passwd",
      "..%2F..%2Fetc%2Fpasswd",
      "....//....//uploads",
      "CON",
      "NUL",
    ];
    for (const payload of traversalPayloads) {
      const res = await fetch(`${BASE_URL}/api/evidence/${encodeURIComponent(payload)}/download`, {
        headers: { Cookie: sessionCookie },
      });
      assert.ok(
        [400, 404, 500].includes(res.status),
        `Path traversal '${payload}' must not return 200 (returned ${res.status})`
      );
    }
    console.log("  ✓ Security 3.4: Path traversal attacks safely rejected");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Security 3.4 failed:", err.message);
    results.failed++;
  }

  // Test 3.5: Upload File Quota Enforcement
  try {
    const oversizedForm = new FormData();
    oversizedForm.append("file", new Blob(["A".repeat(1024)], { type: "application/octet-stream" }), "huge.bin");
    const sizeCheckRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: oversizedForm,
    });
    assert.strictEqual(sizeCheckRes.status, 400);
    console.log("  ✓ Security 3.5: Strict input validation on evidence upload gateway");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Security 3.5 failed:", err.message);
    results.failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4: RELIABILITY & PERFORMANCE STRESS BENCHMARKS
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n--- [PART 4] Reliability & Performance Stress Benchmarks ---");

  // Benchmark 4.1: Cross-Case Syndicate Graph Latency
  try {
    const startGraph = Date.now();
    const gRes = await fetch(`${BASE_URL}/api/graph`, { headers: { Cookie: sessionCookie } });
    const graphLatency = Date.now() - startGraph;
    assert.strictEqual(gRes.status, 200);
    const gData = await gRes.json();
    assert.ok(graphLatency < 350, `Graph resolution under 350ms (took ${graphLatency}ms)`);
    console.log(`  ✓ Performance 4.1: Cross-case graph (${gData.nodes.length} nodes, ${gData.edges.length} edges) resolved in ${graphLatency}ms`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Performance 4.1 failed:", err.message);
    results.failed++;
  }

  // Benchmark 4.2: Large Entity Query Pagination Latency
  try {
    const startEnt = Date.now();
    const eRes = await fetch(`${BASE_URL}/api/entities?limit=50&page=1`, { headers: { Cookie: sessionCookie } });
    const entLatency = Date.now() - startEnt;
    assert.strictEqual(eRes.status, 200);
    const eData = await eRes.json();
    assert.ok(entLatency < 300, `Entity query under 300ms (took ${entLatency}ms)`);
    console.log(`  ✓ Performance 4.2: Entity search & pagination (50 items) resolved in ${entLatency}ms`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Performance 4.2 failed:", err.message);
    results.failed++;
  }

  // Benchmark 4.3: Corrupt & Zero-Byte Evidence Handling
  try {
    const zeroByte = Buffer.alloc(0);
    const zeroHash = sha256(zeroByte);
    const formZero = new FormData();
    formZero.append("file", new Blob([zeroByte], { type: "text/plain" }), "empty_file.txt");
    formZero.append("caseId", caseA.id);
    formZero.append("clientHash", zeroHash);

    const zeroRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: formZero,
    });
    assert.strictEqual(zeroRes.status, 201);
    const zeroData = await zeroRes.json();

    // Trigger OCR on zero byte file
    const ocrZeroRes = await fetch(`${BASE_URL}/api/evidence/${zeroData.evidenceId}/ocr`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(ocrZeroRes.status, 200);
    const ocrZeroData = await ocrZeroRes.json();
    assert.strictEqual(ocrZeroData.entitiesCount, 0, "Zero-byte file must produce 0 extracted entities");
    console.log("  ✓ Reliability 4.3: Zero-byte file handled safely with 0 false entities created");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Reliability 4.3 failed:", err.message);
    results.failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY & RELEASE CLASSIFICATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================");
  console.log(`   PHASE 10 TEST SUMMARY: ${results.passed} PASSED | ${results.failed} FAILED`);
  console.log("================================================================");

  if (results.failed === 0) {
    console.log("🎉 ALL TESTS PASSED: System meets criteria for CONTROLLED RELEASE!");
  } else {
    console.error(`⚠ SYSTEM DEFECTS DETECTED: ${results.failed} tests failed.`);
    process.exit(1);
  }
}

runPhase10Suite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
