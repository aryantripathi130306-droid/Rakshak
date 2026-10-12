// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase18_migration_rehearsal.mjs
// Rakshak v3.0 — Phase 18 Migration Rehearsal & Workflow Order Self-Test Suite
//
// Regression test verifying:
// 1. Missing payload handling fails safely with diagnostic.
// 2. Malformed payload handling fails safely with diagnostic.
// 3. Isolated synthetic source export executes cleanly without active DB mutation.
// 4. Generated payload conforms to expected 21-model schema and manifest.
// 5. Complete migration rehearsal succeeds and verifies transactional rollback.
// 6. Active staging database immutability is 100% preserved.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runMigrationExport } from "./migrate_sqlite_to_postgres.mjs";
import { runMigrationRehearsal } from "./rehearse_postgres_migration_phase18.mjs";

const FIXTURE_DIR = path.join(process.cwd(), "temp_p18_regression_fixtures");
const ACTIVE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function runPhase18RegressionSuite() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 18 MIGRATION REHEARSAL REGRESSION SUITE ");
  console.log("   Timestamp: " + new Date().toISOString());
  console.log("   Mode: ISOLATED SELF-TEST (VERIFYING CI REPRODUCIBILITY)     ");
  console.log("================================================================\n");

  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  const initialActiveDbHash = sha256File(ACTIVE_DB_PATH);
  console.log(`Active Staging DB Initial SHA-256: ${initialActiveDbHash.substring(0, 16)}...\n`);

  const results = [];
  function record(name, passed, details = "") {
    results.push({ name, passed: Boolean(passed), details });
    const tag = passed ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${tag}: ${name}${details ? ` — ${details}` : ""}`);
  }

  // ─── Test 1: Missing Payload Diagnostic Check ──────────────────────────────
  try {
    const nonExistentPayload = path.join(FIXTURE_DIR, "non_existent_payload_abc123.json");
    let caughtError = null;
    try {
      await runMigrationRehearsal({
        payloadPath: nonExistentPayload,
        sourceDbPath: ACTIVE_DB_PATH,
      });
    } catch (err) {
      caughtError = err;
    }

    const passed =
      caughtError !== null &&
      caughtError.message.includes("Migration payload missing") &&
      caughtError.message.includes("migrate_sqlite_to_postgres.mjs");

    record(
      "1. Missing migration payload fails safely with clear diagnostic",
      passed,
      passed ? "Trapped missing file and guided to generator script" : caughtError?.message
    );
  } catch (e) {
    record("1. Missing migration payload fails safely with clear diagnostic", false, e.message);
  }

  // ─── Test 2: Malformed Payload Diagnostic Check ────────────────────────────
  try {
    const malformedPayloadPath = path.join(FIXTURE_DIR, "malformed_payload.json");
    fs.writeFileSync(malformedPayloadPath, "{ \"invalidJson\": true "); // Corrupted JSON

    let caughtError = null;
    try {
      await runMigrationRehearsal({
        payloadPath: malformedPayloadPath,
        sourceDbPath: ACTIVE_DB_PATH,
      });
    } catch (err) {
      caughtError = err;
    }

    const passed = caughtError !== null && caughtError.message.includes("Failed to parse migration payload");
    record(
      "2. Malformed/corrupt JSON payload fails safely with clear diagnostic",
      passed,
      passed ? "Trapped JSON parse error before rehearsal" : caughtError?.message
    );
  } catch (e) {
    record("2. Malformed/corrupt JSON payload fails safely with clear diagnostic", false, e.message);
  }

  // ─── Test 3: Incomplete Payload (Missing Manifest) Check ───────────────────
  try {
    const incompletePayloadPath = path.join(FIXTURE_DIR, "incomplete_payload.json");
    fs.writeFileSync(incompletePayloadPath, JSON.stringify({ data: { cases: [] } }));

    let caughtError = null;
    try {
      await runMigrationRehearsal({
        payloadPath: incompletePayloadPath,
        sourceDbPath: ACTIVE_DB_PATH,
      });
    } catch (err) {
      caughtError = err;
    }

    const passed = caughtError !== null && caughtError.message.includes("missing required manifest");
    record(
      "3. Incomplete payload missing manifest fails safely with clear diagnostic",
      passed,
      passed ? "Trapped missing manifest object" : caughtError?.message
    );
  } catch (e) {
    record("3. Incomplete payload missing manifest fails safely with clear diagnostic", false, e.message);
  }

  // ─── Test 4: Payload Generation from Isolated Synthetic Source ─────────────
  const isolatedSourceDb = path.join(FIXTURE_DIR, "isolated_test_source.db");
  const testGeneratedPayload = path.join(FIXTURE_DIR, "test_generated_payload.json");

  try {
    // Create dedicated isolated copy of database
    fs.copyFileSync(ACTIVE_DB_PATH, isolatedSourceDb);

    const exportRes = await runMigrationExport({
      sourceDbPath: isolatedSourceDb,
      outputPath: testGeneratedPayload,
      silent: true,
    });

    const fileExists = fs.existsSync(testGeneratedPayload);
    const fileSize = fileExists ? fs.statSync(testGeneratedPayload).size : 0;
    const passed = exportRes.success && fileExists && fileSize > 1000;

    record(
      "4. Payload generator successfully exports from isolated synthetic source",
      passed,
      passed ? `Generated ${fileSize} bytes payload from ${path.basename(isolatedSourceDb)}` : "Export failed"
    );
  } catch (e) {
    record("4. Payload generator successfully exports from isolated synthetic source", false, e.message);
  }

  // ─── Test 5: Payload Conforms to 21-Model Schema & Manifest ────────────────
  try {
    const rawPayload = JSON.parse(fs.readFileSync(testGeneratedPayload, "utf8"));
    const manifest = rawPayload.manifest;
    const data = rawPayload.data;

    const expectedModels = [
      "departments",
      "officers",
      "officerSessions",
      "cases",
      "evidence",
      "extractedFacts",
      "timelineEvents",
      "caseEntities",
      "clusters",
      "clusterMemberships",
      "custodyEvents",
      "legalProvisions",
      "caseLegalMappings",
      "evidenceLegalMappings",
      "dossierAudits",
      "transcriptions",
      "chatTranslations",
      "auditLogs",
      "reports",
      "scheduledReports",
      "pilotFeedback",
    ];

    const allModelsInCounts = expectedModels.every((m) => typeof manifest.recordCounts[m] === "number");
    const allModelsInData = expectedModels.every((m) => Array.isArray(data[m]));
    const hasSourceMetadata =
      manifest.sourceDatabase === "SQLite" &&
      typeof manifest.sourceDatabaseHash === "string" &&
      manifest.modelCount === 21;

    const passed = allModelsInCounts && allModelsInData && hasSourceMetadata;

    record(
      "5. Generated payload conforms to 21-model relational schema & manifest",
      passed,
      passed
        ? "Manifest and data contain all 21 models (17 investigative + 4 operational)"
        : `Counts: ${allModelsInCounts}, Data: ${allModelsInData}, Metadata: ${hasSourceMetadata}`
    );
  } catch (e) {
    record("5. Generated payload conforms to 21-model relational schema & manifest", false, e.message);
  }

  // ─── Test 6: Migration Rehearsal Execution & Parity Verification ───────────
  try {
    const isolatedRehearsalCopy = path.join(FIXTURE_DIR, "rehearsal_copy.db");
    const rehearsalPass = await runMigrationRehearsal({
      sourceDbPath: ACTIVE_DB_PATH,
      isolatedCopyPath: isolatedRehearsalCopy,
      payloadPath: testGeneratedPayload,
    });

    record(
      "6. Migration rehearsal passes with zero errors and traps intentional failure",
      rehearsalPass,
      rehearsalPass ? "Schema parity, FK resolution, and rollback verified" : "Rehearsal reported FAIL"
    );
  } catch (e) {
    record("6. Migration rehearsal passes with zero errors and traps intentional failure", false, e.message);
  }

  // ─── Test 7: Active Database Immutability ───────────────────────────────────
  const finalActiveDbHash = sha256File(ACTIVE_DB_PATH);
  const activeDbUntouched = finalActiveDbHash === initialActiveDbHash;

  record(
    "7. Active staging database immutability strictly preserved",
    activeDbUntouched,
    activeDbUntouched
      ? `Active DB SHA-256 untouched: ${finalActiveDbHash.substring(0, 16)}...`
      : "Active database mutated!"
  );

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percentage = ((passedCount / totalCount) * 100).toFixed(1);

  console.log("\n================================================================");
  console.log("   PHASE 18 MIGRATION REHEARSAL TEST RESULTS:");
  console.log(`   Total Assertions Executed: ${totalCount}`);
  console.log(`   Passed:                    ${passedCount} / ${totalCount} (${percentage}%)`);
  console.log("================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase18RegressionSuite().catch((err) => {
  console.error("FATAL ERROR in regression test runner:", err);
  process.exit(1);
});
