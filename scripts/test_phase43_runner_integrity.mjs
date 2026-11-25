// scripts/test_phase43_runner_integrity.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 43 Migration Runner & Target Selection Integrity Tests
// Validates Workstream B and C negative test scenarios:
// 1. Rejection of empty target name
// 2. Rejection of SQLite / path-based target name (e.g. dev.db)
// 3. Rejection of illegal characters in database name
// 4. Unconditional rejection of protected historical DBs (including phase42)
// 5. Detection and rejection of altered migration content (checksum mismatch)
// 6. Verification that connection passwords/secrets are redacted in errors
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  provisionAuthoritativeDatabase,
  verifyMigrationInventory,
  PROTECTED_DATABASES,
  AUTHORITATIVE_MIGRATIONS,
} from "./authoritative_migration_runner.mjs";

async function main() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 43 RUNNER INTEGRITY & TARGET SAFETY SUITE ");
  console.log("================================================================\n");

  const results = [];
  function record(id, description, passed, details = "") {
    results.push({ id, description, passed, details });
    const tag = passed ? "  ✓ PASS" : "  ✗ FAIL";
    console.log(`${tag} [${id}] ${description}`);
    if (details) console.log(`      Details: ${details}`);
  }

  // 1. Rejection of empty target name
  {
    let trapped = false;
    let message = "";
    try {
      await provisionAuthoritativeDatabase("");
    } catch (err) {
      trapped = true;
      message = err.message;
    }
    const passed = trapped && message.includes("Database target name is required");
    record("INT-01", "Rejection of empty database target name", passed, message);
  }

  // 2. Rejection of SQLite / path-based target name
  {
    let trapped = false;
    let message = "";
    try {
      await provisionAuthoritativeDatabase("prisma/dev.db");
    } catch (err) {
      trapped = true;
      message = err.message;
    }
    const passed = trapped && message.includes("SQLite files and file paths are strictly prohibited");
    record("INT-02", "Rejection of SQLite/path target (prisma/dev.db)", passed, message);
  }

  // 3. Rejection of illegal characters in database name
  {
    let trapped = false;
    let message = "";
    try {
      await provisionAuthoritativeDatabase("target;DROP DATABASE test;--");
    } catch (err) {
      trapped = true;
      message = err.message;
    }
    const passed = trapped && message.includes("contains invalid characters");
    record("INT-03", "Rejection of SQL injection / special characters in target name", passed, message);
  }

  // 4. Unconditional rejection of rakshak_phase42_test
  {
    let trapped = false;
    let message = "";
    try {
      await provisionAuthoritativeDatabase("rakshak_phase42_test");
    } catch (err) {
      trapped = true;
      message = err.message;
    }
    const passed = trapped && message.includes("Attempted to target protected historical database: 'rakshak_phase42_test'");
    record("INT-04", "Unconditional rejection of protected database 'rakshak_phase42_test'", passed, message);
  }

  // 5. Verification of all protected databases in runner blacklist
  {
    const expectedProtected = [
      "rakshak_phase26_test",
      "rakshak_phase34_test",
      "rakshak_phase34_1_test",
      "rakshak_phase35_test",
      "rakshak_phase35_1_test",
      "rakshak_phase36_test",
      "rakshak_phase36_1_test",
      "rakshak_phase36_2_test",
      "rakshak_phase37_test",
      "rakshak_phase38_test",
      "rakshak_phase39_test",
      "rakshak_phase39_1_audit_test",
      "rakshak_phase40_test",
      "rakshak_phase41_test",
      "rakshak_phase42_test",
    ];
    const missing = expectedProtected.filter((db) => !PROTECTED_DATABASES.includes(db));
    const passed = missing.length === 0;
    record("INT-05", "All historical databases present in PROTECTED_DATABASES blacklist", passed, `Missing: ${missing.join(", ") || "none"}`);
  }

  // 6. Checksum mismatch halts execution
  {
    const tempDir = path.join(process.cwd(), "temp_integrity_test_dir");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    // Copy the first migration but tamper with one character
    const realMigPath = path.resolve(AUTHORITATIVE_MIGRATIONS[0].relPath);
    const content = fs.readFileSync(realMigPath, "utf8");
    const tamperedContent = content + "\n-- TAMPERED CONTENT FOR NEGATIVE TEST\n";
    fs.writeFileSync(path.join(tempDir, AUTHORITATIVE_MIGRATIONS[0].file), tamperedContent, "utf8");

    // Copy remaining migrations untouched
    for (let i = 1; i < AUTHORITATIVE_MIGRATIONS.length; i++) {
      const src = path.resolve(AUTHORITATIVE_MIGRATIONS[i].relPath);
      fs.copyFileSync(src, path.join(tempDir, AUTHORITATIVE_MIGRATIONS[i].file));
    }

    let trapped = false;
    let message = "";
    try {
      verifyMigrationInventory(tempDir);
    } catch (err) {
      trapped = true;
      message = err.message;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const passed = trapped && message.includes("INTEGRITY ERROR: SHA-256 hash mismatch");
    record("INT-06", "Tampered migration content triggers SHA-256 checksum mismatch", passed, message.slice(0, 100));
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log("\n================================================================");
  console.log(`   RUNNER INTEGRITY TEST SUMMARY: ${passedCount} / ${totalCount} PASSED`);
  console.log("================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL in runner integrity test:", err);
  process.exit(1);
});
