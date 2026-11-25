// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase11_staging_smoke.mjs
// Rakshak v3.0 — Phase 11 Staging Smoke & Operational Readiness Verification
//
// Validates live deployment operational health:
// 1. Production Health Check & Cold Storage Readiness
// 2. Strict Authentication & Role Permissions
// 3. Dual SHA-256 Intake & Tamper Invalidation
// 4. OCR & Deterministic Entity Anchoring
// 5. Cross-Case Syndicate Linkage & BSA § 63 Dossier Export
// 6. Automated Backup Snapshot & Isolated Restore Integrity
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { createBackupSnapshot } from "./backup_evidence_db.mjs";
import { runRestoreVerification } from "./restore_evidence_db.mjs";

const BASE_URL = "http://localhost:3000";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function generateSmokePdf(lines) {
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

async function runStagingSmokeSuite() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 11 STAGING DEPLOYMENT SMOKE SUITE       ");
  console.log("================================================================\n");

  const results = { passed: 0, failed: 0 };
  let sessionCookie = null;
  let officer = null;

  // 1. Health Endpoint & Telemetry Check
  console.log("[STAGE 1] Testing /api/health Operational Monitor...");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200, "Health check must return 200");
    const health = await healthRes.json();
    assert.strictEqual(health.status, "HEALTHY", "Health status must be HEALTHY");
    assert.strictEqual(health.checks.database.status, "UP", "Database must be UP");
    assert.strictEqual(health.checks.evidenceStorage.status, "UP", "Evidence storage must be UP");
    console.log(`  ✓ System Health: ${health.status} (Latency: ${health.latencyMs}ms, DB Cases: ${health.checks.database.details.totalCases})`);
    console.log(`  ✓ Evidence Cold Storage: ${health.checks.evidenceStorage.details.immutableBinaries} binaries confirmed writable`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 1 failed:", err.message);
    results.failed++;
  }

  // 2. Strict Authentication & Session Issuance
  console.log("\n[STAGE 2] Testing Strict Authentication & Session Cookies...");
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeNumber: "DL-002", password: "Rakshak@2026" }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    officer = loginData.officer;

    const setCookie = loginRes.headers.get("set-cookie");
    assert.ok(setCookie, "Set-Cookie header must be returned");
    assert.ok(setCookie.includes("HttpOnly"), "Session cookie must be HttpOnly");
    assert.ok(setCookie.includes("SameSite=Lax"), "Session cookie must specify SameSite=Lax");
    sessionCookie = setCookie.split(";")[0];
    console.log(`  ✓ Authenticated as ${officer.name} (${officer.role}) with secure cookie: ${sessionCookie.substring(0, 30)}...`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 2 failed:", err.message);
    results.failed++;
  }

  // 3. Protected API Rejection (Anonymous & Tampered Session)
  console.log("\n[STAGE 3] Testing Server-Side RBAC & Anonymous Rejection...");
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/reports/RPT-INVALID/download`, {
      headers: { Authorization: "Bearer malformed-token-xyz" },
    });
    assert.strictEqual(unauthRes.status, 403, "Unauthenticated report download must return 403");
    console.log("  ✓ Anonymous/Unauthorized request successfully blocked with HTTP 403");
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 3 failed:", err.message);
    results.failed++;
  }

  // 4. Case Creation & Staging Record Persistence
  let stagingCase = null;
  console.log("\n[STAGE 4] Testing Case Creation & Investigating Officer Assignment...");
  try {
    const caseRes = await fetch(`${BASE_URL}/api/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        incidentType: "Task_Scam",
        complainantName: "Staging Test Complainant",
        amountDefrauded: 450000,
        jurisdiction: "Cyber Crime PS — Staging Pilot",
        officerName: officer.name,
        officerBadge: officer.badgeNumber,
        description: "Staging deployment operational readiness test case.",
      }),
    });
    assert.strictEqual(caseRes.status, 201);
    stagingCase = await caseRes.json();
    console.log(`  ✓ Case created: ID=${stagingCase.id}, CaseNumber=${stagingCase.caseNumber}`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 4 failed:", err.message);
    results.failed++;
  }

  // 5. Dual SHA-256 Upload & Tamper Invalidation
  let stagingEvidence = null;
  const uniqueMuleUpi = `staging.pilot.mule.${Date.now()}@oksbi`;
  const pdfLines = [
    "CYBER CRIME BRANCH - FORENSIC EVIDENCE RECORD",
    "Evidence Type: Digital Transaction Receipt",
    `Beneficiary UPI: ${uniqueMuleUpi}`,
    "Contact Phone: +919876543210",
    "Reference UTR: UTR987654321098",
    "Source Domain: staging-secure-payment.gov",
    "Transaction Amount: INR 450,000",
  ];
  const pdfBuf = generateSmokePdf(pdfLines);
  const correctHash = sha256(pdfBuf);

  console.log("\n[STAGE 5] Testing Client/Server Dual SHA-256 Verification & Tamper Invalidation...");
  try {
    // 5a. Tamper test
    const tamperedForm = new FormData();
    tamperedForm.append("file", new Blob([pdfBuf], { type: "application/pdf" }), "tampered.pdf");
    tamperedForm.append("caseId", stagingCase.id);
    tamperedForm.append("clientHash", "0000000000000000000000000000000000000000000000000000000000000000");

    const badRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: tamperedForm,
    });
    assert.strictEqual(badRes.status, 422, "Tampered upload must be rejected with 422");
    const badData = await badRes.json();
    assert.strictEqual(badData.code, "INTEGRITY_VIOLATION");
    console.log("  ✓ In-transit hash mismatch rejected with HTTP 422 (INTEGRITY_VIOLATION)");

    // 5b. Legitimate upload
    const validForm = new FormData();
    validForm.append("file", new Blob([pdfBuf], { type: "application/pdf" }), "staging_statement.pdf");
    validForm.append("caseId", stagingCase.id);
    validForm.append("clientHash", correctHash);
    validForm.append("evidenceCategory", "UPI_FINANCIAL");

    const goodRes = await fetch(`${BASE_URL}/api/evidence/upload`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: validForm,
    });
    assert.strictEqual(goodRes.status, 201);
    stagingEvidence = await goodRes.json();
    assert.strictEqual(stagingEvidence.sha256Hash, correctHash);
    console.log(`  ✓ Legitimate evidence ingested: SHA-256=${correctHash.substring(0, 16)}...`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 5 failed:", err.message);
    results.failed++;
  }

  // 6. Document OCR & Deterministic Entity Provenance
  console.log("\n[STAGE 6] Testing On-Premises OCR & Deterministic Provenance Anchoring...");
  try {
    const ocrRes = await fetch(`${BASE_URL}/api/evidence/${stagingEvidence.evidenceId}/ocr`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(ocrRes.status, 200);
    const ocrData = await ocrRes.json();
    assert.strictEqual(ocrData.ocr.status, "SUCCESS");
    assert.ok(ocrData.entitiesCount >= 3, `Expected >= 3 entities, found ${ocrData.entitiesCount}`);

    const upiEntity = ocrData.entities.find((e) => e.normalizedValue.toLowerCase() === uniqueMuleUpi.toLowerCase());
    assert.ok(upiEntity, "UPI entity discovered by OCR pipeline");
    console.log(`  ✓ OCR extracted ${ocrData.entitiesCount} entities anchored to SHA-256 (${ocrData.ocr.processingTimeMs}ms)`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 6 failed:", err.message);
    results.failed++;
  }

  // 7. BSA § 63 Electronic Dossier Export
  console.log("\n[STAGE 7] Testing BSA Section 63 Electronic Dossier Export...");
  try {
    const dossierRes = await fetch(`${BASE_URL}/api/cases/${stagingCase.id}/dossier/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ format: "JSON" }),
    });
    assert.strictEqual(dossierRes.status, 200);
    const dossierData = await dossierRes.json();
    assert.ok(dossierData.statutoryFramework.evidenceAct.includes("Section 63"));
    assert.ok(dossierData.evidenceManifest.some((m) => m.sha256Hash === correctHash));
    console.log(`  ✓ BSA § 63 Manifest exported (Evidence SHA-256 verified)`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 7 failed:", err.message);
    results.failed++;
  }

  // 8. Automated Backup & Isolated Restore Verification Test
  console.log("\n[STAGE 8] Testing Operational Backup Snapshot & Isolated Restore Test...");
  try {
    const backupResult = await createBackupSnapshot();
    assert.ok(backupResult.backupDir, "Backup snapshot directory created");
    assert.ok(backupResult.manifest.evidence.totalFiles > 0, "Backup includes evidence files");

    const restoreResult = await runRestoreVerification(backupResult.backupDir);
    assert.strictEqual(restoreResult.success, true, "Restore verification test must pass");
    assert.ok(restoreResult.caseCount >= 1, "Restored database contains cases");
    console.log(`  ✓ Backup and isolated restore verified with 100% hash reconciliation`);
    results.passed++;
  } catch (err) {
    console.error("  ❌ Stage 8 failed:", err.message);
    results.failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================");
  console.log(`   PHASE 11 STAGING SMOKE SUMMARY: ${results.passed} PASSED | ${results.failed} FAILED`);
  console.log("================================================================");

  if (results.failed === 0) {
    console.log("🎉 ALL STAGING SMOKE TESTS PASSED: READY FOR PILOT STAGING!");
  } else {
    console.error(`⚠ STAGING DEFECTS DETECTED: ${results.failed} tests failed.`);
    process.exit(1);
  }
}

runStagingSmokeSuite().catch((err) => {
  console.error("FATAL SMOKE ERROR:", err);
  process.exit(1);
});
