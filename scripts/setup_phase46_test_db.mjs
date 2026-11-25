// scripts/setup_phase46_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 46 Isolated Test Database Provisioning Script
// Uses the authoritative migration runner, cryptographic file verification,
// strict name validation, ON_ERROR_STOP=1, and mandatory baseline validation.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { provisionAuthoritativeDatabase, PSQL_PATH } from "./authoritative_migration_runner.mjs";
import { validateSecurityBaseline } from "./validate_security_baseline.mjs";

export const TARGET_DB = "rakshak_phase46_test";

export async function setupPhase46TestDb() {
  console.log("================================================================");
  console.log(`   RAKSHAK v3.0 — PROVISIONING PHASE 46 ISOLATED TEST DATABASE  `);
  console.log(`   Target: ${TARGET_DB}`);
  console.log("================================================================\n");

  const provisionResult = await provisionAuthoritativeDatabase(TARGET_DB);
  console.log(`\nAuthoritative provisioning complete. Applied ${provisionResult.migrationsApplied} migrations.`);

  console.log(`\nValidating security baseline on '${TARGET_DB}'...`);
  const baseline = await validateSecurityBaseline(TARGET_DB);
  if (!baseline.passed) {
    throw new Error(`Security baseline validation failed: ${baseline.errors.join("; ")}`);
  }

  console.log("\nSeeding synthetic Phase 46 baseline fixtures...");
  const psqlEnv = {
    ...process.env,
    PGPASSWORD: "change_me_in_vault",
  };

  const seedSql = `
    -- Phase 46 Synthetic Baseline Seed
    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('p46-dept-del', 'DL-CYBER-P46', 'Delhi Cyber Crime Special Cell', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('p46-dept-mum', 'MH-CYBER-P46', 'Mumbai Cyber Crime Branch', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW());

    -- Test password hash corresponds to 'Rakshak@Test46!'
    -- $2b$10$w3UeQ81ZlB4/79bO.tW6E.eJ3VkWq7U9eN3z6U4Y1c2v5w6x7y8z.
    -- Using verified bcrypt hash for 'Rakshak@Test46!'
    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p46-off-del-inv', 'DL-INV-46', 'Inspector Amit Roy', 'amit.del46@gov.in', '$2b$10$1Xev9/0xs5sbkgxzNJpW0eWtAcYakpVEIL4Mr9JeYZ.K8pIaXW59q', 'Inspector', 'INVESTIGATOR', 'Delhi NCR', 'ACTIVE', 'p46-dept-del', NOW(), NOW()),
      ('p46-off-del-sup', 'DL-SUP-46', 'ACP Meenakshi Sundaram', 'meenakshi.del46@gov.in', '$2b$10$1Xev9/0xs5sbkgxzNJpW0eWtAcYakpVEIL4Mr9JeYZ.K8pIaXW59q', 'Assistant Commissioner', 'SUPERVISOR', 'Delhi NCR', 'ACTIVE', 'p46-dept-del', NOW(), NOW()),
      ('p46-off-del-susp', 'DL-SUSP-46', 'SI Devendra Nath', 'devendra.susp46@gov.in', '$2b$10$1Xev9/0xs5sbkgxzNJpW0eWtAcYakpVEIL4Mr9JeYZ.K8pIaXW59q', 'Sub-Inspector', 'INVESTIGATOR', 'Delhi NCR', 'SUSPENDED', 'p46-dept-del', NOW(), NOW()),
      ('p46-off-mum-inv', 'MH-INV-46', 'Inspector Pradeep Shinde', 'pradeep.mum46@gov.in', '$2b$10$1Xev9/0xs5sbkgxzNJpW0eWtAcYakpVEIL4Mr9JeYZ.K8pIaXW59q', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'p46-dept-mum', NOW(), NOW()),
      ('p46-off-admin', 'DL-ADM-46', 'Admin Officer Kapoor', 'admin.del46@gov.in', '$2b$10$1Xev9/0xs5sbkgxzNJpW0eWtAcYakpVEIL4Mr9JeYZ.K8pIaXW59q', 'Administrator', 'SYS_ADMIN', 'Delhi NCR', 'ACTIVE', 'p46-dept-del', NOW(), NOW());

    -- Initial sessions
    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('p46-sess-del-inv', 'p46-off-del-inv', 'tok-del-inv-46-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p46-sess-del-sup', 'p46-off-del-sup', 'tok-del-sup-46-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p46-sess-del-susp', 'p46-off-del-susp', 'tok-del-susp-46-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p46-sess-mum-inv', 'p46-off-mum-inv', 'tok-mum-inv-46-valid', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p46-sess-admin', 'p46-off-admin', 'tok-admin-46-valid', NOW() + INTERVAL '1 day', FALSE, NOW());

    -- Pre-seed baseline test cases
    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "officerName", "officerBadge", "createdAt", "updatedAt") VALUES
      ('p46-case-del-01', 'CASE-2026-9601', 'Investment_Fraud', 'Alok Verma', 'Delhi NCR', 'OPEN', 'p46-dept-del', 'Inspector Amit Roy', 'DL-INV-46', NOW(), NOW()),
      ('p46-case-mum-01', 'CASE-2026-9602', 'Task_Scam', 'Pooja Kulkarni', 'Mumbai', 'OPEN', 'p46-dept-mum', 'Inspector Pradeep Shinde', 'MH-INV-46', NOW(), NOW());

    -- Pre-seed baseline evidence exhibit in Delhi case
    INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "sha256Hash", "clientHash", "storagePath", "evidenceCategory", "status", "currentCustodianId", "uploadedAt") VALUES
      ('p46-evi-del-01', 'p46-case-del-01', 'delhi_crypto_ledger.txt', 'TXT', 'text/plain', 512, '2222222222222222222222222222222222222222222222222222222222222222', '2222222222222222222222222222222222222222222222222222222222222222', 'uploads/synthetic_test_p46/delhi_crypto_ledger.txt', 'DOCUMENT', 'ACCEPTED', 'p46-off-del-inv', NOW());

    -- Genesis custody event for pre-seeded exhibit
    INSERT INTO "CustodyEvent" ("id", "evidenceId", "sequenceNumber", "eventType", "actor", "action", "result", "prevEventHash", "eventHash", "timestamp") VALUES
      ('p46-cust-del-01', 'p46-evi-del-01', 1, 'GENESIS', 'DL-INV-46', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NOW());

    -- Pre-seed initial extracted fact (pending review)
    INSERT INTO "ExtractedFact" ("id", "evidenceId", "caseId", "factAssertion", "entityType", "rawValue", "normalizedValue", "confidence", "sourceHash", "reviewStatus") VALUES
      ('p46-fact-del-01', 'p46-evi-del-01', 'p46-case-del-01', 'Crypto wallet address identified in transaction ledger', 'CRYPTO_WALLET', '0x71C8366437CD71e1CC298c567b360D6560B9b777', '0x71c8366437cd71e1cc298c567b360d6560b9b777', 0.98, '2222222222222222222222222222222222222222222222222222222222222222', 'PENDING_REVIEW');
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

if (process.argv[1] && process.argv[1].endsWith("setup_phase46_test_db.mjs")) {
  setupPhase46TestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`FATAL: Phase 46 database setup failed: ${err.message}`);
      process.exit(1);
    });
}
