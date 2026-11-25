// scripts/setup_phase43_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 43 Isolated Test Database Provisioning Script
// Uses the centralized authoritative migration runner, cryptographic file
// verification, strict name validation, ON_ERROR_STOP=1, and mandatory baseline validation.
// ─────────────────────────────────────────────────────────────────────────────
import { provisionAuthoritativeDatabase } from "./authoritative_migration_runner.mjs";
import { validateSecurityBaseline } from "./validate_security_baseline.mjs";

export const TARGET_DB = "rakshak_phase43_test";

export async function setupPhase43TestDb() {
  console.log("================================================================");
  console.log(`   RAKSHAK v3.0 — PROVISIONING PHASE 43 ISOLATED TEST DATABASE  `);
  console.log(`   Target: ${TARGET_DB}`);
  console.log("================================================================\n");

  const provisionResult = await provisionAuthoritativeDatabase(TARGET_DB);
  console.log(`\nAuthoritative provisioning complete. Applied ${provisionResult.migrationsApplied} migrations.`);

  console.log(`\nValidating security baseline on '${TARGET_DB}'...`);
  const baseline = await validateSecurityBaseline(TARGET_DB);
  if (!baseline.passed) {
    throw new Error(`Security baseline validation failed: ${baseline.errors.join("; ")}`);
  }

  console.log("\n================================================================");
  console.log(`   PROVISIONING SUCCESS: '${TARGET_DB}' IS READY FOR TESTING    `);
  console.log("================================================================\n");
  return { provisionResult, baseline };
}

if (process.argv[1] && process.argv[1].endsWith("setup_phase43_test_db.mjs")) {
  setupPhase43TestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`FATAL: Phase 43 database setup failed: ${err.message}`);
      process.exit(1);
    });
}
