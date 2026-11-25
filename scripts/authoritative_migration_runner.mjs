// scripts/authoritative_migration_runner.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Authoritative PostgreSQL Migration Runner & Provisioner
// Centrally maintained manifest, deterministic dependency order, cryptographic
// file verification, ON_ERROR_STOP=1 fail-closed execution, and catalog validation.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateSecurityBaseline } from "./validate_security_baseline.mjs";

export const PSQL_PATH = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";

export const PROTECTED_DATABASES = Object.freeze([
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
  "rakshak_phase43_test",
  "rakshak_phase43_rehearsal_audit_test",
  "rakshak_phase44_backup_test",
  "rakshak_phase44_restore_test",
  "rakshak_phase45_test",
  "rakshak_phase46_test",
]);

export const AUTHORITATIVE_MIGRATIONS = Object.freeze([
  {
    sequence: 1,
    file: "20261011_rls_tenant_isolation.sql",
    relPath: "prisma/migrations_pg/20261011_rls_tenant_isolation.sql",
    expectedSha256: "9759095bac54b086d0431b4c36f74b5f8f85f146145cda14d9f50c548ce92068",
    description: "Foundational RLS tenant isolation on initial 10 application tables",
  },
  {
    sequence: 2,
    file: "20261024_access_grants.sql",
    relPath: "prisma/migrations_pg/20261024_access_grants.sql",
    expectedSha256: "027402f639ec2113b346c03b44470d800eb536b2d85c681846b7d906cd67da55",
    description: "Cross-department delegated access grants table and RLS policy",
  },
  {
    sequence: 3,
    file: "20261024_adversarial_rls_hardening.sql",
    relPath: "prisma/migrations_pg/20261024_adversarial_rls_hardening.sql",
    expectedSha256: "4e370399248c4db50e058db965b00c56322ab6df281b561db0e1af36d35c82c5",
    description: "Session token validation, private_auth schema, anti-spoofing session context",
  },
  {
    sequence: 4,
    file: "20261024_case_lifecycle.sql",
    relPath: "prisma/migrations_pg/20261024_case_lifecycle.sql",
    expectedSha256: "7e36e92a464e2c35525cc4acff73b85328c4b24601453d0763b77274f6707725",
    description: "Case assignment and status history audit tables and tenant RLS",
  },
  {
    sequence: 5,
    file: "20261024_phase35_1_hardening.sql",
    relPath: "prisma/migrations_pg/20261024_phase35_1_hardening.sql",
    expectedSha256: "355e1e9de024b5cfeacf9230b564321de7464e90135bfaa9288056e75110bf15",
    description: "Supervisor approval workflow and lifecycle transition RLS hardening",
  },
  {
    sequence: 6,
    file: "20261024_phase36_evidence_custody.sql",
    relPath: "prisma/migrations_pg/20261024_phase36_evidence_custody.sql",
    expectedSha256: "2f7d427ffe68abfc7b78c6df3ba5cc84ebbd9bc3d4a04f3c996162c94e783e81",
    description: "Custody event genesis, evidence lifecycle fields and append-only immutability",
  },
  {
    sequence: 7,
    file: "20261024_phase36_1_custody_concurrency.sql",
    relPath: "prisma/migrations_pg/20261024_phase36_1_custody_concurrency.sql",
    expectedSha256: "55fc11412a2fcd80fd55ba9674427c6cf0cfb0e3abd76437600e445622f7b4ed",
    description: "Advisory locks and concurrency control for chain of custody transfers",
  },
  {
    sequence: 8,
    file: "20261024_phase36_2_custody_integrity.sql",
    relPath: "prisma/migrations_pg/20261024_phase36_2_custody_integrity.sql",
    expectedSha256: "dc522fdae35ecd7b945e404a3a0897b8218d66a909987b28b7d30fe1e0c84322",
    description: "Cryptographic custody chaining hash verification and tamper-detection triggers",
  },
  {
    sequence: 9,
    file: "20261024_phase37_cross_case_intelligence.sql",
    relPath: "prisma/migrations_pg/20261024_phase37_cross_case_intelligence.sql",
    expectedSha256: "2c174afc60cbe3b9a98d03dcffe0e54a4c2f8a1077d4c34e946ce823d4ce2526",
    description: "Cross-case entity resolution, EntityLink and EntityLinkReview RLS",
  },
  {
    sequence: 10,
    file: "20261025_phase38_dossier_reporting.sql",
    relPath: "prisma/migrations_pg/20261025_phase38_dossier_reporting.sql",
    expectedSha256: "5f8989a1c80aa436a43805c1a02a9bfc2c62b7cbdf7d767e0c081b8440a13cb9",
    description: "Investigative dossiers, claim verification, review history and export RLS",
  },
  {
    sequence: 11,
    file: "20261025_phase39_ocr_fact_extraction.sql",
    relPath: "prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql",
    expectedSha256: "80439644430ea214a1d8962b7776892ec4905826bae1189bfeff49b5dec1a43f",
    description: "OCR extracted text artifacts and fact review history RLS policies",
  },
]);

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "missing";
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validates that the migration directory has no unlisted, missing, or altered files.
 */
export function verifyMigrationInventory(migrationsDir = "prisma/migrations_pg") {
  const absoluteDir = path.resolve(migrationsDir);
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Migration directory not found: ${absoluteDir}`);
  }

  const filesOnDisk = fs.readdirSync(absoluteDir).filter((f) => f.endsWith(".sql"));
  const manifestFiles = AUTHORITATIVE_MIGRATIONS.map((m) => m.file);

  // Check for unlisted files on disk
  const unlisted = filesOnDisk.filter((f) => !manifestFiles.includes(f));
  if (unlisted.length > 0) {
    throw new Error(
      `SECURITY INVARIANT VIOLATION: Unapproved migration files detected in ${migrationsDir}: ${unlisted.join(", ")}`
    );
  }

  // Check for missing or altered files
  const inventoryResults = [];
  for (const item of AUTHORITATIVE_MIGRATIONS) {
    const fullPath = path.resolve(migrationsDir, item.file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`CRITICAL: Required migration file missing: ${path.join(migrationsDir, item.file)}`);
    }
    const actualHash = sha256File(fullPath);
    if (actualHash !== item.expectedSha256) {
      throw new Error(
        `INTEGRITY ERROR: SHA-256 hash mismatch for ${item.file}.\nExpected: ${item.expectedSha256}\nActual:   ${actualHash}`
      );
    }
    inventoryResults.push({
      sequence: item.sequence,
      file: item.file,
      sha256: actualHash,
      status: "VERIFIED",
    });
  }

  return inventoryResults;
}

/**
 * Provisions a fresh isolated PostgreSQL test database cleanly using the authoritative sequence.
 */
export async function provisionAuthoritativeDatabase(targetDb, options = {}) {
  const {
    host = "127.0.0.1",
    user = "postgres",
    password = "change_me_in_vault",
    skipBaselineValidation = false,
  } = options;

  // Workstream B: Strict database target validation
  if (!targetDb || typeof targetDb !== "string" || targetDb.trim() === "") {
    throw new Error(
      "FATAL SAFETY VIOLATION: Database target name is required and cannot be empty. Fallback to default or SQLite dev.db is prohibited."
    );
  }

  const sanitizedTarget = targetDb.trim();
  if (sanitizedTarget.includes(".db") || sanitizedTarget.includes("/") || sanitizedTarget.includes("\\")) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Invalid database target '${sanitizedTarget}'. SQLite files and file paths are strictly prohibited in PostgreSQL runner.`
    );
  }

  if (!/^[a-zA-Z0-9_]+$/.test(sanitizedTarget)) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Database name '${sanitizedTarget}' contains invalid characters. Must strictly match [a-zA-Z0-9_]+.`
    );
  }

  console.log(`\n================================================================`);
  console.log(`   RAKSHAK v3.0 — AUTHORITATIVE DATABASE PROVISIONING PIPELINE   `);
  console.log(`   Target: ${sanitizedTarget}`);
  console.log(`================================================================\n`);

  // Gate 1: Check against protected database blacklist
  if (PROTECTED_DATABASES.includes(sanitizedTarget)) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Attempted to target protected historical database: '${sanitizedTarget}'. Operation aborted.`
    );
  }

  const env = {
    ...process.env,
    PGPASSWORD: password,
    DATABASE_URL: `postgresql://${user}:${password}@${host}:5432/${sanitizedTarget}`,
  };

  // Gate 2: Verify migration files and directory inventory
  console.log("[1/6] Verifying authoritative migration manifest and file digests...");
  const inventory = verifyMigrationInventory();
  console.log(`  ✓ All ${inventory.length} migrations cryptographically verified.`);

  // Gate 3: Check that target database does not already exist
  console.log(`[2/6] Verifying database isolation for '${sanitizedTarget}'...`);
  const checkRaw = execFileSync(
    PSQL_PATH,
    ["-h", host, "-U", user, "-t", "-A", "-c", `SELECT count(*) FROM pg_database WHERE datname = '${sanitizedTarget}';`],
    { env, encoding: "utf8" }
  ).trim();

  const preExists = parseInt(checkRaw, 10) > 0;
  if (preExists) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Database '${sanitizedTarget}' already exists. Refusing to overwrite or reuse an existing database.`
    );
  }
  console.log(`  ✓ Confirmed '${sanitizedTarget}' does not exist.`);

  // Gate 4: Create fresh database
  console.log(`[3/6] Creating fresh database '${sanitizedTarget}'...`);
  execFileSync(PSQL_PATH, ["-h", host, "-U", user, "-c", `CREATE DATABASE "${sanitizedTarget}";`], {
    env,
    encoding: "utf8",
  });
  console.log(`  ✓ Database created successfully.`);

  // Gate 5: Deploy baseline Prisma schema cleanly
  console.log(`[4/6] Deploying Prisma PostgreSQL schema (zero data-loss mode)...`);
  execSync(`npx.cmd prisma db push --schema=prisma/schema.postgresql.prisma`, {
    env,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  console.log(`  ✓ Base schema deployed cleanly.`);

  // Gate 6: Apply all migrations in exact sequence with ON_ERROR_STOP=1
  console.log(`[5/6] Applying authoritative migrations with ON_ERROR_STOP=1...`);
  const appliedMigrations = [];

  for (const item of AUTHORITATIVE_MIGRATIONS) {
    const fullPath = path.resolve(item.relPath);
    try {
      execFileSync(
        PSQL_PATH,
        ["-h", host, "-U", user, "-d", sanitizedTarget, "-v", "ON_ERROR_STOP=1", "-f", fullPath],
        { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      );
      appliedMigrations.push({
        sequence: item.sequence,
        file: item.file,
        status: "APPLIED",
      });
      console.log(`  ✓ [${item.sequence}/11] Applied ${item.file}`);
    } catch (err) {
      const rawStderr = err.stderr ? err.stderr.toString().trim() : err.message;
      // Sanitize any password leakage
      const sanitizedStderr = rawStderr.replace(new RegExp(password, "g"), "[REDACTED_PASSWORD]");
      throw new Error(
        `MIGRATION FAILURE: Failed applying migration [${item.sequence}] ${item.file}: ${sanitizedStderr}`
      );
    }
  }

  // Gate 7: Mandatory Security Baseline Validation
  if (!skipBaselineValidation) {
    console.log(`[6/6] Executing mandatory security baseline catalog validation...`);
    const baselineResult = await validateSecurityBaseline(sanitizedTarget, { host, user, password });
    if (!baselineResult.passed) {
      throw new Error(
        `SECURITY BASELINE VALIDATION FAILED on '${sanitizedTarget}': ${baselineResult.errors.join("; ")}`
      );
    }
    console.log(`  ✓ Security baseline verified: 31 tables, 20 RLS, 20 FORCE RLS, 21 policies.`);
  }

  return {
    targetDb: sanitizedTarget,
    status: "PROVISIONED",
    migrationsApplied: appliedMigrations.length,
    inventory,
  };
}

// CLI Execution support
if (process.argv[1] && process.argv[1].endsWith("authoritative_migration_runner.mjs")) {
  const targetDb = process.argv[2];
  if (!targetDb) {
    console.error("Usage: node scripts/authoritative_migration_runner.mjs <target_database_name>");
    process.exit(1);
  }

  provisionAuthoritativeDatabase(targetDb)
    .then((result) => {
      console.log(`\n✓ Authoritative database provisioning completed successfully for '${result.targetDb}'.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ Provisioning failed: ${err.message}`);
      process.exit(1);
    });
}

