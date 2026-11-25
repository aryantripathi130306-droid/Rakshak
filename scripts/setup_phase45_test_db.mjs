// scripts/setup_phase45_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 45 Isolated Test Database Provisioning Script
// Uses the authoritative migration runner, cryptographic file verification,
// strict name validation, ON_ERROR_STOP=1, and mandatory baseline validation.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { provisionAuthoritativeDatabase, PSQL_PATH } from "./authoritative_migration_runner.mjs";
import { validateSecurityBaseline } from "./validate_security_baseline.mjs";

export const TARGET_DB = "rakshak_phase45_test";

export async function setupPhase45TestDb() {
  console.log("================================================================");
  console.log(`   RAKSHAK v3.0 — PROVISIONING PHASE 45 ISOLATED TEST DATABASE  `);
  console.log(`   Target: ${TARGET_DB}`);
  console.log("================================================================\n");

  const provisionResult = await provisionAuthoritativeDatabase(TARGET_DB);
  console.log(`\nAuthoritative provisioning complete. Applied ${provisionResult.migrationsApplied} migrations.`);

  console.log(`\nValidating security baseline on '${TARGET_DB}'...`);
  const baseline = await validateSecurityBaseline(TARGET_DB);
  if (!baseline.passed) {
    throw new Error(`Security baseline validation failed: ${baseline.errors.join("; ")}`);
  }

  console.log("\nSeeding synthetic Phase 45 baseline fixtures...");
  const psqlEnv = {
    ...process.env,
    PGPASSWORD: "change_me_in_vault",
  };

  const seedSql = `
    -- Phase 45 Synthetic Baseline Seed
    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('p45-dept-del', 'DL-CYBER-P45', 'Delhi Cyber Crime Special Cell', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('p45-dept-mum', 'MH-CYBER-P45', 'Mumbai Cyber Crime Branch', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW());

    -- Test password hash corresponds to 'Rakshak@Test45!'
    -- $2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2
    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p45-off-del-inv', 'DL-INV-45', 'Inspector Rajesh Kumar', 'rajesh.del45@gov.in', '$2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2', 'Inspector', 'INVESTIGATOR', 'Delhi NCR', 'ACTIVE', 'p45-dept-del', NOW(), NOW()),
      ('p45-off-del-sup', 'DL-SUP-45', 'ACP Vikram Singh', 'vikram.del45@gov.in', '$2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2', 'Assistant Commissioner', 'SUPERVISOR', 'Delhi NCR', 'ACTIVE', 'p45-dept-del', NOW(), NOW()),
      ('p45-off-del-susp', 'DL-SUSP-45', 'Sub-Inspector Ankit Verma', 'ankit.susp45@gov.in', '$2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2', 'Sub-Inspector', 'INVESTIGATOR', 'Delhi NCR', 'SUSPENDED', 'p45-dept-del', NOW(), NOW()),
      ('p45-off-mum-inv', 'MH-INV-45', 'Inspector Sunita Rao', 'sunita.mum45@gov.in', '$2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'p45-dept-mum', NOW(), NOW()),
      ('p45-off-admin', 'DL-ADM-45', 'Admin Officer Sharma', 'admin.del45@gov.in', '$2b$10$/jC/Z7Ng.cvY5dA.gXb02.vO0y9qZFZljHR4BrahMU.WO4uCQ2sq2', 'Administrator', 'SYS_ADMIN', 'Delhi NCR', 'ACTIVE', 'p45-dept-del', NOW(), NOW());

    -- Initial sessions
    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('p45-sess-del-inv', 'p45-off-del-inv', 'tok-del-inv-45-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p45-sess-del-sup', 'p45-off-del-sup', 'tok-del-sup-45-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p45-sess-del-susp', 'p45-off-del-susp', 'tok-del-susp-45-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p45-sess-mum-inv', 'p45-off-mum-inv', 'tok-mum-inv-45-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p45-sess-admin', 'p45-off-admin', 'tok-admin-45-valid', NOW() + INTERVAL '1 day', FALSE, NOW());

    -- Pre-seed baseline test cases
    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "officerName", "officerBadge", "createdAt", "updatedAt") VALUES
      ('p45-case-del-01', 'CASE-2026-9001', 'Investment_Fraud', 'Suresh Gupta', 'Delhi NCR', 'OPEN', 'p45-dept-del', 'Inspector Rajesh Kumar', 'DL-INV-45', NOW(), NOW()),
      ('p45-case-mum-01', 'CASE-2026-9002', 'Task_Scam', 'Meera Deshmukh', 'Mumbai', 'OPEN', 'p45-dept-mum', 'Inspector Sunita Rao', 'MH-INV-45', NOW(), NOW());

    -- Pre-seed baseline evidence exhibit in Delhi case
    INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "sha256Hash", "clientHash", "storagePath", "evidenceCategory", "status", "currentCustodianId", "uploadedAt") VALUES
      ('p45-evi-del-01', 'p45-case-del-01', 'delhi_syndicate_memo.txt', 'TXT', 'text/plain', 512, '1111111111111111111111111111111111111111111111111111111111111111', '1111111111111111111111111111111111111111111111111111111111111111', 'uploads/synthetic_test_p45/delhi_syndicate_memo.txt', 'DOCUMENT', 'ACCEPTED', 'p45-off-del-inv', NOW());

    -- Genesis custody event for pre-seeded exhibit
    INSERT INTO "CustodyEvent" ("id", "evidenceId", "sequenceNumber", "eventType", "actor", "action", "result", "prevEventHash", "eventHash", "timestamp") VALUES
      ('p45-cust-del-01', 'p45-evi-del-01', 1, 'GENESIS', 'DL-INV-45', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NOW());

    -- Pre-seed initial extracted fact (pending review)
    INSERT INTO "ExtractedFact" ("id", "evidenceId", "caseId", "factAssertion", "entityType", "rawValue", "normalizedValue", "confidence", "sourceHash", "reviewStatus") VALUES
      ('p45-fact-del-01', 'p45-evi-del-01', 'p45-case-del-01', 'Suspect phone identified in memo', 'PHONE', '9876543210', '+919876543210', 0.95, '1111111111111111111111111111111111111111111111111111111111111111', 'PENDING_REVIEW');
  `;

  execFileSync(PSQL_PATH, ["-h", "127.0.0.1", "-U", "postgres", "-d", TARGET_DB, "-c", seedSql], {
    env: psqlEnv,
    encoding: "utf8",
  });
  console.log("  ✓ Synthetic fixtures seeded successfully.");

  console.log("\n================================================================");
  console.log(`   PROVISIONING SUCCESS: '${TARGET_DB}' IS READY FOR TESTING    `);
  console.log("================================================================\n");
  return { provisionResult, baseline };
}

if (process.argv[1] && process.argv[1].endsWith("setup_phase45_test_db.mjs")) {
  setupPhase45TestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`FATAL: Phase 45 database setup failed: ${err.message}`);
      process.exit(1);
    });
}
