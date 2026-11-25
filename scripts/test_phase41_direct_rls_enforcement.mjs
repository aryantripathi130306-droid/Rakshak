// scripts/test_phase41_direct_rls_enforcement.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TARGET_DB = process.env.TARGET_DB || "rakshak_phase41_test";
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const OUT_FILE = path.join(process.cwd(), "PHASE41_RLS_ENFORCEMENT_RESULTS.json");

function runSql(db, user, sql, expectError = false) {
  try {
    const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
    const out = execFileSync(
      PSQL,
      ["-U", user, "-h", "127.0.0.1", "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { env, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    return { ok: true, output: out.trim(), error: null };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    if (expectError) {
      return { ok: false, output: null, error: stderr };
    }
    throw new Error(`SQL execution failed as user '${user}': ${stderr}`);
  }
}

async function main() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 41 DIRECT POSTGRESQL RLS ENFORCEMENT   ");
  console.log(`   Database: ${TARGET_DB} | Target Role: rakshak_app_user        `);
  console.log("================================================================\n");

  const results = [];
  function record(id, workstream, name, status, details = "") {
    results.push({ id, workstream, name, status, details });
    const tag = status === "PASSED" ? "  ✓ PASS" : "  ✗ FAIL";
    console.log(`${tag} [${id}] ${name} ${details ? `— ${details}` : ""}`);
  }

  const auditId = `p41-aud-${Date.now()}`;

  // 1. Seed deterministic synthetic fixtures as admin/owner
  console.log("[1/3] Seeding synthetic fixtures for multi-tenant RLS testing...");
  const seedSql = `
    SELECT set_platform_admin_context();
    
    -- Clean previous fixtures if any
    DELETE FROM "OfficerSession" WHERE "id" LIKE 'p41-%';
    DELETE FROM "AccessGrant" WHERE "id" LIKE 'p41-%';
    DELETE FROM "CustodyEvent" WHERE "id" LIKE 'p41-%';
    DELETE FROM "Evidence" WHERE "id" LIKE 'p41-%';
    DELETE FROM "CaseEntity" WHERE "id" LIKE 'p41-%';
    DELETE FROM "ExtractedFact" WHERE "id" LIKE 'p41-%';
    DELETE FROM "DossierClaim" WHERE "id" LIKE 'p41-%';
    DELETE FROM "DossierReview" WHERE "id" LIKE 'p41-%';
    DELETE FROM "InvestigativeDossier" WHERE "id" LIKE 'p41-%';
    DELETE FROM "ExtractedTextArtifact" WHERE "id" LIKE 'p41-%';
    DELETE FROM "FactReviewHistory" WHERE "id" LIKE 'p41-%';
    DELETE FROM "CaseAssignmentHistory" WHERE "id" LIKE 'p41-%';
    DELETE FROM "CaseStatusHistory" WHERE "id" LIKE 'p41-%';
    DELETE FROM "Case" WHERE "id" LIKE 'p41-%';
    DELETE FROM "Officer" WHERE "id" LIKE 'p41-%';
    DELETE FROM "Department" WHERE "id" LIKE 'p41-%';

    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('p41-dept-del', 'DEL-CYBER-P41', 'Delhi Cyber Crime', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('p41-dept-mum', 'MUM-CYBER-P41', 'Mumbai Cyber Unit', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW());

    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p41-off-del-1', 'DEL-P41-01', 'Inspector Delhi', 'del.p41@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Delhi NCR', 'ACTIVE', 'p41-dept-del', NOW(), NOW()),
      ('p41-off-del-susp', 'DEL-P41-SUSP', 'Suspended Delhi', 'del.susp@police.gov.in', 'hash', 'Sub-Inspector', 'INVESTIGATOR', 'Delhi NCR', 'SUSPENDED', 'p41-dept-del', NOW(), NOW()),
      ('p41-off-mum-1', 'MUM-P41-01', 'Inspector Mumbai', 'mum.p41@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'p41-dept-mum', NOW(), NOW()),
      ('p41-off-admin', 'ADMIN-P41-01', 'Superintendent Admin', 'admin.p41@police.gov.in', 'hash', 'Superintendent', 'SYS_ADMIN', 'Delhi NCR', 'ACTIVE', 'p41-dept-del', NOW(), NOW());

    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('p41-sess-del-valid', 'p41-off-del-1', 'tok-del-valid-41', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p41-sess-del-expired', 'p41-off-del-1', 'tok-del-expired-41', NOW() - INTERVAL '1 hour', FALSE, NOW() - INTERVAL '2 hours'),
      ('p41-sess-del-susp', 'p41-off-del-susp', 'tok-del-susp-41', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p41-sess-mum-valid', 'p41-off-mum-1', 'tok-mum-valid-41', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p41-sess-admin-valid', 'p41-off-admin', 'tok-admin-valid-41', NOW() + INTERVAL '1 day', FALSE, NOW());

    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p41-case-del-1', 'CASE-P41-DEL-001', 'Cyber_Fraud', 'Complainant Delhi', 'Delhi NCR', 'OPEN', 'p41-dept-del', NOW(), NOW()),
      ('p41-case-mum-1', 'CASE-P41-MUM-001', 'Identity_Theft', 'Complainant Mumbai', 'Mumbai', 'OPEN', 'p41-dept-mum', NOW(), NOW());

    INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "sha256Hash", "clientHash", "storagePath", "evidenceCategory", "status", "uploadedAt") VALUES
      ('p41-evi-del-1', 'p41-case-del-1', 'delhi_exhibit.bin', 'BIN', 'application/octet-stream', 1024, '1111111111111111111111111111111111111111111111111111111111111111', '1111111111111111111111111111111111111111111111111111111111111111', '/uploads/raw/delhi.bin', 'DIGITAL', 'IN_CUSTODY', NOW()),
      ('p41-evi-mum-1', 'p41-case-mum-1', 'mumbai_exhibit.bin', 'BIN', 'application/octet-stream', 2048, '2222222222222222222222222222222222222222222222222222222222222222', '2222222222222222222222222222222222222222222222222222222222222222', '/uploads/raw/mumbai.bin', 'DIGITAL', 'IN_CUSTODY', NOW());

    INSERT INTO "CustodyEvent" ("id", "evidenceId", "sequenceNumber", "eventType", "actor", "action", "result", "prevEventHash", "eventHash", "timestamp") VALUES
      ('p41-cust-del-1', 'p41-evi-del-1', 1, 'GENESIS', 'DEL-P41-01', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NOW()),
      ('p41-cust-mum-1', 'p41-evi-mum-1', 1, 'GENESIS', 'MUM-P41-01', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NOW());

    INSERT INTO "ExtractedFact" ("id", "evidenceId", "caseId", "factAssertion", "entityType", "rawValue", "normalizedValue", "confidence", "sourceHash", "reviewStatus") VALUES
      ('p41-fact-del-1', 'p41-evi-del-1', 'p41-case-del-1', 'Found Delhi Phone', 'PHONE', '9876543210', '+919876543210', 0.95, '1111111111111111111111111111111111111111111111111111111111111111', 'ACCEPTED'),
      ('p41-fact-mum-1', 'p41-evi-mum-1', 'p41-case-mum-1', 'Found Mumbai Email', 'EMAIL', 'suspect@gmail.com', 'suspect@gmail.com', 0.99, '2222222222222222222222222222222222222222222222222222222222222222', 'PENDING_REVIEW');

    INSERT INTO "CaseEntity" ("id", "caseId", "entityType", "rawValue", "normalizedValue", "firstSeenAt") VALUES
      ('p41-cent-del-1', 'p41-case-del-1', 'PHONE', '9876543210', '+919876543210', NOW()),
      ('p41-cent-mum-1', 'p41-case-mum-1', 'EMAIL', 'suspect@gmail.com', 'suspect@gmail.com', NOW());

    INSERT INTO "InvestigativeDossier" ("id", "dossierNumber", "caseId", "version", "title", "contentJson", "contentHash", "sourceManifest", "generatedById", "generatedByName", "status", "createdAt", "updatedAt") VALUES
      ('p41-doss-del-1', 'DOS-P41-DEL-01', 'p41-case-del-1', 1, 'Delhi Dossier', '{}', '3333333333333333333333333333333333333333333333333333333333333333', '[]', 'p41-off-del-1', 'Inspector Delhi', 'DRAFT', NOW(), NOW()),
      ('p41-doss-mum-1', 'DOS-P41-MUM-01', 'p41-case-mum-1', 1, 'Mumbai Dossier', '{}', '4444444444444444444444444444444444444444444444444444444444444444', '[]', 'p41-off-mum-1', 'Inspector Mumbai', 'DRAFT', NOW(), NOW());

    INSERT INTO "DossierClaim" ("id", "dossierId", "claimNumber", "statement", "category", "sourceModel", "sourceRecordId", "isVerified") VALUES
      ('p41-clm-del-1', 'p41-doss-del-1', 'CLM-01', 'Delhi suspect phone recovered', 'RECORDED_FACT', 'Evidence', 'p41-evi-del-1', TRUE),
      ('p41-clm-mum-1', 'p41-doss-mum-1', 'CLM-02', 'Mumbai suspect email identified', 'RECORDED_FACT', 'Evidence', 'p41-evi-mum-1', FALSE);

    INSERT INTO "AuditLog" ("id", "officerId", "officerName", "action", "module", "details", "timestamp") VALUES
      ('${auditId}', 'p41-off-del-1', 'Inspector Delhi', 'CASE_VIEW', 'CASES', 'Delhi officer inspected Delhi case', NOW());

    INSERT INTO "CaseAssignmentHistory" ("id", "caseId", "officerId", "officerName", "officerBadge", "departmentId", "assignedById", "assignedByName", "assignmentType", "status", "assignedAt") VALUES
      ('p41-cah-del-1', 'p41-case-del-1', 'p41-off-del-1', 'Inspector Delhi', 'DEL-P41-01', 'p41-dept-del', 'p41-off-del-1', 'Inspector Delhi', 'PRIMARY', 'ACTIVE', NOW());

    INSERT INTO "CaseStatusHistory" ("id", "caseId", "fromStatus", "toStatus", "changedById", "changedByName", "departmentId", "reason", "changedAt") VALUES
      ('p41-csh-del-1', 'p41-case-del-1', 'OPEN', 'UNDER_INQUIRY', 'p41-off-del-1', 'Inspector Delhi', 'p41-dept-del', 'Initiated inquiry', NOW());
  `;
  runSql(TARGET_DB, "rakshak_admin_user", seedSql);
  console.log("  ✓ Synthetic fixtures seeded cleanly.\n");

  console.log("[2/3] Executing direct PostgreSQL RLS enforcement test matrix (as rakshak_app_user)...");

  // ─── Scenario 1: Permitted Department Case Read
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "Case" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-case-del-1";
    record(
      "RLS-01",
      "Workstream C",
      "Authorized investigator reads case within permitted department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 2: Cross-Department Case Read Denied
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT count(*) FROM "Case" WHERE id = 'p41-case-mum-1';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-02",
      "Workstream C",
      "Foreign department case is strictly invisible (returns 0 rows)",
      passed ? "PASSED" : "FAILED",
      `Foreign cases returned: ${count}`
    );
  }

  // ─── Scenario 3: Unauthorized Cross-Department Case Insertion Rejected
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt")
      VALUES ('p41-case-forged', 'CASE-FORGED-01', 'Fraud', 'Victim', 'Mumbai', 'OPEN', 'p41-dept-mum', NOW(), NOW());
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("violates row-level security policy");
    record(
      "RLS-03",
      "Workstream C",
      "Cross-department case insertion rejected by RLS WITH CHECK",
      passed ? "PASSED" : "FAILED",
      res.error ? "RLS WITH CHECK violation trapped" : "Insertion permitted!"
    );
  }

  // ─── Scenario 4: Evidence Read Scoped by Department
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "Evidence" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-evi-del-1";
    record(
      "RLS-04",
      "Workstream C",
      "Evidence exhibits strictly filtered by parent case department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 5: Custody Event Read Scoped by Department
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "CustodyEvent" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-cust-del-1";
    record(
      "RLS-05",
      "Workstream C",
      "Custody events strictly filtered by parent case department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 6: ExtractedFact Read Scoped by Department
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "ExtractedFact" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-fact-del-1";
    record(
      "RLS-06",
      "Workstream C",
      "Extracted candidate facts strictly filtered by case department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 7: CaseEntity Read Scoped by Department
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "CaseEntity" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-cent-del-1";
    record(
      "RLS-07",
      "Workstream C",
      "Case entities strictly filtered by case department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 8: Investigative Dossiers and Claims Scoped by Department
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT id FROM "InvestigativeDossier" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p41-"));
    const passed = visible.length === 1 && visible[0] === "p41-doss-del-1";
    record(
      "RLS-08",
      "Workstream C",
      "Investigative dossiers strictly filtered by case department",
      passed ? "PASSED" : "FAILED",
      `Visible: ${visible.join(", ")}`
    );
  }

  // ─── Scenario 9: Append-Only Immutability: Direct UPDATE on AuditLog Denied
  {
    const sql = `
      UPDATE "AuditLog" SET "action" = 'TAMPERED' WHERE id = '${auditId}';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("permission denied for table AuditLog");
    record(
      "RLS-09",
      "Workstream C",
      "Direct SQL UPDATE on AuditLog denied to runtime role",
      passed ? "PASSED" : "FAILED",
      res.error ? "Permission denied as expected" : "UPDATE succeeded!"
    );
  }

  // ─── Scenario 10: Append-Only Immutability: Direct DELETE on AuditLog Denied
  {
    const sql = `
      DELETE FROM "AuditLog" WHERE id = '${auditId}';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("permission denied for table AuditLog");
    record(
      "RLS-10",
      "Workstream C",
      "Direct SQL DELETE on AuditLog denied to runtime role",
      passed ? "PASSED" : "FAILED",
      res.error ? "Permission denied as expected" : "DELETE succeeded!"
    );
  }

  // ─── Scenario 11: CaseStatusHistory Immutability: Direct UPDATE Denied
  {
    const sql = `
      UPDATE "CaseStatusHistory" SET "reason" = 'Forged' WHERE id = 'p41-csh-del-1';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("permission denied for table CaseStatusHistory");
    record(
      "RLS-11",
      "Workstream C",
      "Direct SQL UPDATE on CaseStatusHistory denied to runtime role",
      passed ? "PASSED" : "FAILED",
      res.error ? "Permission denied as expected" : "UPDATE succeeded!"
    );
  }

  // ─── Scenario 12: CaseAssignmentHistory Immutability: Direct DELETE Denied
  {
    const sql = `
      DELETE FROM "CaseAssignmentHistory" WHERE id = 'p41-cah-del-1';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("permission denied for table CaseAssignmentHistory");
    record(
      "RLS-12",
      "Workstream C",
      "Direct SQL DELETE on CaseAssignmentHistory denied to runtime role",
      passed ? "PASSED" : "FAILED",
      res.error ? "Permission denied as expected" : "DELETE succeeded!"
    );
  }

  // ─── Scenario 13: Client Forgery of Department Context via set_config Fails Closed
  {
    const sql = `
      SELECT clear_tenant_context();
      SELECT set_config('app.current_department_id', 'p41-dept-mum', false);
      SELECT count(*) FROM "Case" WHERE id = 'p41-case-mum-1';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-13",
      "Workstream C",
      "Unverified client set_config('app.current_department_id') fails closed (0 rows)",
      passed ? "PASSED" : "FAILED",
      `Count returned: ${count}`
    );
  }

  // ─── Scenario 14: Client Forgery of Admin Context via set_config Fails Closed
  {
    const sql = `
      SELECT set_config('app.is_platform_admin', 'true', false);
      SELECT count(*) FROM "Case" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-14",
      "Workstream C",
      "Unverified client set_config('app.is_platform_admin') fails closed (0 rows)",
      passed ? "PASSED" : "FAILED",
      `Count returned: ${count}`
    );
  }

  // ─── Scenario 15: Missing Tenant Context Fails Closed
  {
    const sql = `
      SELECT count(*) FROM "Case" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-15",
      "Workstream C",
      "Missing tenant authorization context fails closed (0 rows visible)",
      passed ? "PASSED" : "FAILED",
      `Count returned: ${count}`
    );
  }

  // ─── Scenario 16: Suspended Officer Context Fails Closed
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-susp', 'p41-dept-del', 'tok-del-susp-41');
      SELECT count(*) FROM "Case" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok || parseInt(res.output.split(/\r?\n/).pop().trim(), 10) === 0;
    record(
      "RLS-16",
      "Workstream C",
      "Suspended officer context fails closed (exception or 0 rows)",
      passed ? "PASSED" : "FAILED",
      res.error || "0 rows returned"
    );
  }

  // ─── Scenario 17: Pooled Connection Teardown via clear_tenant_context()
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p41-off-del-1', 'p41-dept-del', 'tok-del-valid-41');
      SELECT clear_tenant_context();
      SELECT count(*) FROM "Case" WHERE id LIKE 'p41-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-17",
      "Workstream C",
      "clear_tenant_context() cleanses session authorization variables across pooled connections",
      passed ? "PASSED" : "FAILED",
      `Post-clear count: ${count}`
    );
  }

  // ─── Scenario 18: Application Role Security Invariants
  {
    const sql = `
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';
    `;
    const res = runSql(TARGET_DB, "postgres", sql);
    const line = res.output.split(/\r?\n/).filter((l) => l.includes("rakshak_app_user")).pop();
    const passed = line === "rakshak_app_user|f|f";
    record(
      "RLS-18",
      "Workstream C",
      "Runtime role verified unprivileged: rolsuper=f, rolbypassrls=f",
      passed ? "PASSED" : "FAILED",
      line
    );
  }

  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1) + "%";

  console.log("\n================================================================");
  console.log(`   PHASE 41 RLS ENFORCEMENT SUMMARY:`);
  console.log(`   Total Scenarios Executed: ${totalCount}`);
  console.log(`   Passed:                   ${passedCount} / ${totalCount} (${passRate})`);
  console.log(`   Failed:                   ${totalCount - passedCount}`);
  console.log("================================================================\n");

  const summary = {
    suite: "PHASE_41_DIRECT_RLS_ENFORCEMENT",
    database: TARGET_DB,
    timestamp: new Date().toISOString(),
    total: totalCount,
    passed: passedCount,
    failed: totalCount - passedCount,
    results,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Results written to: ${OUT_FILE}\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in direct RLS test suite:", err);
  process.exit(1);
});
