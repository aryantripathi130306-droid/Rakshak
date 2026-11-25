// scripts/test_phase42_direct_rls_coverage.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 42 Direct PostgreSQL RLS Table-by-Table Coverage Suite
// Directly tests ALL 20 RLS-protected tables connecting as unprivileged
// runtime role 'rakshak_app_user' with authenticated tenant context.
// Validates:
// 1. Home tenant access
// 2. Unrelated foreign tenant isolation (Kolkata strictly invisible)
// 3. Delegated tenant access via AccessGrant (Mumbai case permitted under grant)
// 4. Immutability & append-only protection on audit tables
// 5. Anti-spoofing and session context clearing
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PSQL_PATH } from "./authoritative_migration_runner.mjs";

const TARGET_DB = process.env.TARGET_DB || "rakshak_phase42_test";
const OUT_FILE = path.join(process.cwd(), "PHASE42_RLS_ENFORCEMENT_RESULTS.json");

function runSql(db, user, sql, expectError = false) {
  try {
    const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
    const out = execFileSync(
      PSQL_PATH,
      ["-U", user, "-h", "127.0.0.1", "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
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
  console.log("   RAKSHAK v3.0 — PHASE 42 FULL DIRECT RLS COVERAGE MATRIX     ");
  console.log(`   Database: ${TARGET_DB} | Target Role: rakshak_app_user        `);
  console.log("================================================================\n");

  const results = [];
  function record(id, table, name, status, details = "") {
    results.push({ id, table, name, status, details });
    const tag = status === "PASSED" ? "  ✓ PASS" : "  ✗ FAIL";
    console.log(`${tag} [${id}] [${table}] ${name} ${details ? `— ${details}` : ""}`);
  }

  const auditId = `p42-aud-${Date.now()}`;

  // 1. Seed comprehensive multi-tenant fixtures
  // Delhi (Home), Mumbai (Delegated via AccessGrant), Kolkata (Isolated Foreign Tenant)
  console.log("[1/3] Seeding comprehensive multi-tenant synthetic fixtures...");
  const seedSql = `
    SELECT set_platform_admin_context();

    -- Clean previous fixtures if any
    DELETE FROM "OfficerSession" WHERE "id" LIKE 'p42-%';
    DELETE FROM "AccessGrant" WHERE "id" LIKE 'p42-%';
    DELETE FROM "FactReviewHistory" WHERE "id" LIKE 'p42-%';
    DELETE FROM "ExtractedTextArtifact" WHERE "id" LIKE 'p42-%';
    DELETE FROM "EntityLinkReview" WHERE "id" LIKE 'p42-%';
    DELETE FROM "EntityLink" WHERE "id" LIKE 'p42-%';
    DELETE FROM "DossierClaim" WHERE "id" LIKE 'p42-%';
    DELETE FROM "DossierReview" WHERE "id" LIKE 'p42-%';
    DELETE FROM "DossierExportAudit" WHERE "id" LIKE 'p42-%';
    DELETE FROM "InvestigativeDossier" WHERE "id" LIKE 'p42-%';
    DELETE FROM "GeneratedReport" WHERE "id" LIKE 'p42-%';
    DELETE FROM "TimelineEvent" WHERE "id" LIKE 'p42-%';
    DELETE FROM "CaseLegalMapping" WHERE "id" LIKE 'p42-%';
    DELETE FROM "CaseEntity" WHERE "id" LIKE 'p42-%';
    DELETE FROM "ExtractedFact" WHERE "id" LIKE 'p42-%';
    DELETE FROM "CustodyEvent" WHERE "id" LIKE 'p42-%';
    DELETE FROM "Evidence" WHERE "id" LIKE 'p42-%';
    DELETE FROM "CaseAssignmentHistory" WHERE "id" LIKE 'p42-%';
    DELETE FROM "CaseStatusHistory" WHERE "id" LIKE 'p42-%';
    DELETE FROM "Case" WHERE "id" LIKE 'p42-%';
    DELETE FROM "Officer" WHERE "id" LIKE 'p42-%';
    DELETE FROM "Department" WHERE "id" LIKE 'p42-%';

    -- Departments
    INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt") VALUES
      ('p42-dept-del', 'DEL-CYBER-P42', 'Delhi Cyber Crime', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW(), NOW()),
      ('p42-dept-mum', 'MUM-CYBER-P42', 'Mumbai Cyber Unit', 'Maharashtra', 'Mumbai', 'ACTIVE', NOW(), NOW()),
      ('p42-dept-kol', 'KOL-CYBER-P42', 'Kolkata Cyber Cell', 'West Bengal', 'Kolkata', 'ACTIVE', NOW(), NOW());

    -- Officers
    INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p42-off-del-1', 'DEL-P42-01', 'Inspector Delhi', 'del.p42@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Delhi NCR', 'ACTIVE', 'p42-dept-del', NOW(), NOW()),
      ('p42-off-del-susp', 'DEL-P42-SUSP', 'Suspended Delhi', 'del.susp42@police.gov.in', 'hash', 'Sub-Inspector', 'INVESTIGATOR', 'Delhi NCR', 'SUSPENDED', 'p42-dept-del', NOW(), NOW()),
      ('p42-off-mum-1', 'MUM-P42-01', 'Inspector Mumbai', 'mum.p42@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Mumbai', 'ACTIVE', 'p42-dept-mum', NOW(), NOW()),
      ('p42-off-kol-1', 'KOL-P42-01', 'Inspector Kolkata', 'kol.p42@police.gov.in', 'hash', 'Inspector', 'INVESTIGATOR', 'Kolkata', 'ACTIVE', 'p42-dept-kol', NOW(), NOW()),
      ('p42-off-admin', 'ADMIN-P42-01', 'Superintendent Admin', 'admin.p42@police.gov.in', 'hash', 'Superintendent', 'SYS_ADMIN', 'Delhi NCR', 'ACTIVE', 'p42-dept-del', NOW(), NOW());

    -- Officer Sessions
    INSERT INTO "OfficerSession" ("id", "officerId", "token", "expiresAt", "revoked", "createdAt") VALUES
      ('p42-sess-del-valid', 'p42-off-del-1', 'tok-del-valid-42', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p42-sess-del-expired', 'p42-off-del-1', 'tok-del-expired-42', NOW() - INTERVAL '1 hour', FALSE, NOW() - INTERVAL '2 hours'),
      ('p42-sess-del-susp', 'p42-off-del-susp', 'tok-del-susp-42', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p42-sess-mum-valid', 'p42-off-mum-1', 'tok-mum-valid-42', NOW() + INTERVAL '1 day', FALSE, NOW()),
      ('p42-sess-kol-valid', 'p42-off-kol-1', 'tok-kol-valid-42', NOW() + INTERVAL '1 day', FALSE, NOW());

    -- Cases
    INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt") VALUES
      ('p42-case-del-1', 'CASE-P42-DEL-001', 'Cyber_Fraud', 'Complainant Delhi', 'Delhi NCR', 'OPEN', 'p42-dept-del', NOW(), NOW()),
      ('p42-case-mum-1', 'CASE-P42-MUM-001', 'Identity_Theft', 'Complainant Mumbai', 'Mumbai', 'OPEN', 'p42-dept-mum', NOW(), NOW()),
      ('p42-case-kol-1', 'CASE-P42-KOL-001', 'Crypto_Scam', 'Complainant Kolkata', 'Kolkata', 'OPEN', 'p42-dept-kol', NOW(), NOW());

    -- Evidence
    INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "sha256Hash", "clientHash", "storagePath", "evidenceCategory", "status", "uploadedAt") VALUES
      ('p42-evi-del-1', 'p42-case-del-1', 'delhi_exhibit.bin', 'BIN', 'application/octet-stream', 1024, '1111111111111111111111111111111111111111111111111111111111111111', '1111111111111111111111111111111111111111111111111111111111111111', '/uploads/raw/delhi42.bin', 'DIGITAL', 'IN_CUSTODY', NOW()),
      ('p42-evi-mum-1', 'p42-case-mum-1', 'mumbai_exhibit.bin', 'BIN', 'application/octet-stream', 2048, '2222222222222222222222222222222222222222222222222222222222222222', '2222222222222222222222222222222222222222222222222222222222222222', '/uploads/raw/mumbai42.bin', 'DIGITAL', 'IN_CUSTODY', NOW()),
      ('p42-evi-kol-1', 'p42-case-kol-1', 'kolkata_exhibit.bin', 'BIN', 'application/octet-stream', 4096, '3333333333333333333333333333333333333333333333333333333333333333', '3333333333333333333333333333333333333333333333333333333333333333', '/uploads/raw/kolkata42.bin', 'DIGITAL', 'IN_CUSTODY', NOW());

    -- Custody Events
    INSERT INTO "CustodyEvent" ("id", "evidenceId", "sequenceNumber", "eventType", "actor", "action", "result", "prevEventHash", "eventHash", "timestamp") VALUES
      ('p42-cust-del-1', 'p42-evi-del-1', 1, 'GENESIS', 'DEL-P42-01', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NOW()),
      ('p42-cust-mum-1', 'p42-evi-mum-1', 1, 'GENESIS', 'MUM-P42-01', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NOW()),
      ('p42-cust-kol-1', 'p42-evi-kol-1', 1, 'GENESIS', 'KOL-P42-01', 'Initial Intake', 'SUCCESS', '0000000000000000000000000000000000000000000000000000000000000000', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', NOW());

    -- Extracted Facts
    INSERT INTO "ExtractedFact" ("id", "evidenceId", "caseId", "factAssertion", "entityType", "rawValue", "normalizedValue", "confidence", "sourceHash", "reviewStatus") VALUES
      ('p42-fact-del-1', 'p42-evi-del-1', 'p42-case-del-1', 'Found Delhi Phone', 'PHONE', '9876543210', '+919876543210', 0.95, '1111111111111111111111111111111111111111111111111111111111111111', 'ACCEPTED'),
      ('p42-fact-mum-1', 'p42-evi-mum-1', 'p42-case-mum-1', 'Found Mumbai Email', 'EMAIL', 'suspect@gmail.com', 'suspect@gmail.com', 0.99, '2222222222222222222222222222222222222222222222222222222222222222', 'PENDING_REVIEW'),
      ('p42-fact-kol-1', 'p42-evi-kol-1', 'p42-case-kol-1', 'Found Kolkata UPI', 'UPI', 'suspect@okhdfcbank', 'suspect@okhdfcbank', 0.92, '3333333333333333333333333333333333333333333333333333333333333333', 'PENDING_REVIEW');

    -- Case Entities
    INSERT INTO "CaseEntity" ("id", "caseId", "entityType", "rawValue", "normalizedValue", "firstSeenAt") VALUES
      ('p42-cent-del-1', 'p42-case-del-1', 'PHONE', '9876543210', '+919876543210', NOW()),
      ('p42-cent-mum-1', 'p42-case-mum-1', 'EMAIL', 'suspect@gmail.com', 'suspect@gmail.com', NOW()),
      ('p42-cent-kol-1', 'p42-case-kol-1', 'UPI', 'suspect@okhdfcbank', 'suspect@okhdfcbank', NOW());

    -- Investigative Dossier
    INSERT INTO "InvestigativeDossier" ("id", "dossierNumber", "caseId", "version", "title", "contentJson", "contentHash", "sourceManifest", "generatedById", "generatedByName", "status", "createdAt", "updatedAt") VALUES
      ('p42-doss-del-1', 'DOS-P42-DEL-01', 'p42-case-del-1', 1, 'Delhi Dossier', '{}', '3333333333333333333333333333333333333333333333333333333333333333', '[]', 'p42-off-del-1', 'Inspector Delhi', 'DRAFT', NOW(), NOW()),
      ('p42-doss-mum-1', 'DOS-P42-MUM-01', 'p42-case-mum-1', 1, 'Mumbai Dossier', '{}', '4444444444444444444444444444444444444444444444444444444444444444', '[]', 'p42-off-mum-1', 'Inspector Mumbai', 'DRAFT', NOW(), NOW()),
      ('p42-doss-kol-1', 'DOS-P42-KOL-01', 'p42-case-kol-1', 1, 'Kolkata Dossier', '{}', '5555555555555555555555555555555555555555555555555555555555555555', '[]', 'p42-off-kol-1', 'Inspector Kolkata', 'DRAFT', NOW(), NOW());

    -- Dossier Claims
    INSERT INTO "DossierClaim" ("id", "dossierId", "claimNumber", "statement", "category", "sourceModel", "sourceRecordId", "isVerified") VALUES
      ('p42-clm-del-1', 'p42-doss-del-1', 'CLM-01', 'Delhi suspect phone recovered', 'RECORDED_FACT', 'Evidence', 'p42-evi-del-1', TRUE),
      ('p42-clm-mum-1', 'p42-doss-mum-1', 'CLM-02', 'Mumbai suspect email identified', 'RECORDED_FACT', 'Evidence', 'p42-evi-mum-1', FALSE),
      ('p42-clm-kol-1', 'p42-doss-kol-1', 'CLM-03', 'Kolkata crypto account seized', 'RECORDED_FACT', 'Evidence', 'p42-evi-kol-1', FALSE);

    -- Dossier Review
    INSERT INTO "DossierReview" ("id", "dossierId", "fromStatus", "toStatus", "reviewerId", "reviewerName", "reviewerRole", "decision", "rationale", "contentHashBound", "reviewedAt") VALUES
      ('p42-drev-del-1', 'p42-doss-del-1', 'DRAFT', 'UNDER_REVIEW', 'p42-off-del-1', 'Inspector Delhi', 'INVESTIGATOR', 'APPROVE', 'Valid Delhi dossier review', '3333333333333333333333333333333333333333333333333333333333333333', NOW()),
      ('p42-drev-mum-1', 'p42-doss-mum-1', 'DRAFT', 'UNDER_REVIEW', 'p42-off-mum-1', 'Inspector Mumbai', 'INVESTIGATOR', 'APPROVE', 'Valid Mumbai dossier review', '4444444444444444444444444444444444444444444444444444444444444444', NOW()),
      ('p42-drev-kol-1', 'p42-doss-kol-1', 'DRAFT', 'UNDER_REVIEW', 'p42-off-kol-1', 'Inspector Kolkata', 'INVESTIGATOR', 'APPROVE', 'Valid Kolkata dossier review', '5555555555555555555555555555555555555555555555555555555555555555', NOW());

    -- Dossier Export Audit
    INSERT INTO "DossierExportAudit" ("id", "dossierNumber", "caseId", "exportFormat", "officerName", "templateVersion", "validationStatus", "evidenceCount", "manifestHash", "generatedAt") VALUES
      ('p42-dexp-del-1', 'DOS-EXP-DEL-01', 'p42-case-del-1', 'PDF', 'Inspector Delhi', 'BSA_SEC63_V3', 'VALID', 1, '5555555555555555555555555555555555555555555555555555555555555555', NOW()),
      ('p42-dexp-mum-1', 'DOS-EXP-MUM-01', 'p42-case-mum-1', 'PDF', 'Inspector Mumbai', 'BSA_SEC63_V3', 'VALID', 1, '6666666666666666666666666666666666666666666666666666666666666666', NOW()),
      ('p42-dexp-kol-1', 'DOS-EXP-KOL-01', 'p42-case-kol-1', 'PDF', 'Inspector Kolkata', 'BSA_SEC63_V3', 'VALID', 1, '7777777777777777777777777777777777777777777777777777777777777777', NOW());

    -- Audit Log
    INSERT INTO "AuditLog" ("id", "officerId", "officerName", "action", "module", "details", "timestamp") VALUES
      ('${auditId}', 'p42-off-del-1', 'Inspector Delhi', 'CASE_VIEW', 'CASES', 'Delhi officer inspected Delhi case', NOW());

    -- Case Assignment & Status History
    INSERT INTO "CaseAssignmentHistory" ("id", "caseId", "officerId", "officerName", "officerBadge", "departmentId", "assignedById", "assignedByName", "assignmentType", "status", "assignedAt") VALUES
      ('p42-cah-del-1', 'p42-case-del-1', 'p42-off-del-1', 'Inspector Delhi', 'DEL-P42-01', 'p42-dept-del', 'p42-off-del-1', 'Inspector Delhi', 'PRIMARY', 'ACTIVE', NOW()),
      ('p42-cah-kol-1', 'p42-case-kol-1', 'p42-off-kol-1', 'Inspector Kolkata', 'KOL-P42-01', 'p42-dept-kol', 'p42-off-kol-1', 'Inspector Kolkata', 'PRIMARY', 'ACTIVE', NOW());

    INSERT INTO "CaseStatusHistory" ("id", "caseId", "fromStatus", "toStatus", "changedById", "changedByName", "departmentId", "reason", "changedAt") VALUES
      ('p42-csh-del-1', 'p42-case-del-1', 'OPEN', 'UNDER_INQUIRY', 'p42-off-del-1', 'Inspector Delhi', 'p42-dept-del', 'Initiated inquiry', NOW()),
      ('p42-csh-kol-1', 'p42-case-kol-1', 'OPEN', 'UNDER_INQUIRY', 'p42-off-kol-1', 'Inspector Kolkata', 'p42-dept-kol', 'Initiated inquiry', NOW());

    -- Access Grant: Mumbai delegates read access for p42-case-mum-1 to Delhi!
    -- NOTE: Kolkata NEVER grants any access to Delhi!
    -- Kolkata & Mumbai have a mutual grant between themselves, invisible to Delhi.
    INSERT INTO "AccessGrant" ("id", "granteeOfficerId", "granteeDepartmentId", "targetDepartmentId", "targetCaseId", "scope", "grantedByOfficerId", "grantedAt", "expiresAt", "status", "reason", "createdAt", "updatedAt") VALUES
      ('p42-ag-del-1', 'p42-off-del-1', 'p42-dept-del', 'p42-dept-mum', 'p42-case-mum-1', 'CASE_READ', 'p42-off-mum-1', NOW(), NOW() + INTERVAL '1 day', 'ACTIVE', 'Inter-state joint investigation', NOW(), NOW()),
      ('p42-ag-mum-kol', 'p42-off-mum-1', 'p42-dept-mum', 'p42-dept-kol', 'p42-case-kol-1', 'CASE_READ', 'p42-off-kol-1', NOW(), NOW() + INTERVAL '1 day', 'ACTIVE', 'Mumbai-Kolkata liaison', NOW(), NOW());

    -- Case Legal Mapping
    INSERT INTO "CaseLegalMapping" ("id", "caseId", "sectionCode", "act", "section", "description", "relevance", "status", "createdAt", "updatedAt") VALUES
      ('p42-clm-map-del-1', 'p42-case-del-1', 'IT-66D-DEL', 'IT_ACT', '66D', 'Cheating by personation', 'PRIMARY', 'CONFIRMED', NOW(), NOW()),
      ('p42-clm-map-kol-1', 'p42-case-kol-1', 'IT-66D-KOL', 'IT_ACT', '66D', 'Cheating by personation', 'PRIMARY', 'CONFIRMED', NOW(), NOW());

    -- Entity Link & Entity Link Review
    INSERT INTO "EntityLink" ("id", "sourceEntityId", "targetEntityId", "sourceCaseId", "targetCaseId", "entityType", "normalizedValue", "linkType", "matchRule", "explanation", "status", "createdAt", "updatedAt") VALUES
      ('p42-elink-del-1', 'p42-cent-del-1', 'p42-cent-del-1', 'p42-case-del-1', 'p42-case-del-1', 'PHONE', '+919876543210', 'EXACT_IDENTIFIER_MATCH', 'RULE_EXACT_NORM_IDENTIFIER', 'Identical phone number', 'CONFIRMED', NOW(), NOW()),
      ('p42-elink-kol-1', 'p42-cent-kol-1', 'p42-cent-kol-1', 'p42-case-kol-1', 'p42-case-kol-1', 'UPI', 'suspect@okhdfcbank', 'EXACT_IDENTIFIER_MATCH', 'RULE_EXACT_NORM_IDENTIFIER', 'Identical UPI address', 'CONFIRMED', NOW(), NOW());

    INSERT INTO "EntityLinkReview" ("id", "linkId", "fromStatus", "toStatus", "reviewerId", "reviewerName", "reviewerRole", "rationale", "reviewedAt") VALUES
      ('p42-elr-del-1', 'p42-elink-del-1', 'CANDIDATE', 'CONFIRMED', 'p42-off-del-1', 'Inspector Delhi', 'INVESTIGATOR', 'Confirmed link match', NOW()),
      ('p42-elr-kol-1', 'p42-elink-kol-1', 'CANDIDATE', 'CONFIRMED', 'p42-off-kol-1', 'Inspector Kolkata', 'INVESTIGATOR', 'Confirmed link match', NOW());

    -- ExtractedTextArtifact & FactReviewHistory
    INSERT INTO "ExtractedTextArtifact" ("id", "evidenceId", "caseId", "sourceHash", "mimeType", "engine", "engineVersion", "status", "confidence", "charCount", "lineCount", "pageCount", "rawText", "isIntegrityVerified", "extractedAt") VALUES
      ('p42-eta-del-1', 'p42-evi-del-1', 'p42-case-del-1', '1111111111111111111111111111111111111111111111111111111111111111', 'application/octet-stream', 'TESSERACT_OCR_V5', '7.0', 'COMPLETED', 0.98, 26, 1, 1, 'Sample Delhi Extracted Text', TRUE, NOW()),
      ('p42-eta-kol-1', 'p42-evi-kol-1', 'p42-case-kol-1', '3333333333333333333333333333333333333333333333333333333333333333', 'application/octet-stream', 'TESSERACT_OCR_V5', '7.0', 'COMPLETED', 0.96, 28, 1, 1, 'Sample Kolkata Extracted Text', TRUE, NOW());

    INSERT INTO "FactReviewHistory" ("id", "factId", "caseId", "evidenceId", "reviewerId", "reviewerName", "reviewerRole", "departmentId", "decision", "previousStatus", "newStatus", "rationale", "timestamp") VALUES
      ('p42-frh-del-1', 'p42-fact-del-1', 'p42-case-del-1', 'p42-evi-del-1', 'p42-off-del-1', 'Inspector Delhi', 'INVESTIGATOR', 'p42-dept-del', 'ACCEPTED', 'PENDING_REVIEW', 'ACCEPTED', 'Verified Delhi fact', NOW()),
      ('p42-frh-kol-1', 'p42-fact-kol-1', 'p42-case-kol-1', 'p42-evi-kol-1', 'p42-off-kol-1', 'Inspector Kolkata', 'INVESTIGATOR', 'p42-dept-kol', 'ACCEPTED', 'PENDING_REVIEW', 'ACCEPTED', 'Verified Kolkata fact', NOW());

    -- Generated Report & Timeline Event
    INSERT INTO "GeneratedReport" ("id", "reportNumber", "caseId", "title", "reportType", "outputFormat", "sectionsIncluded", "filePath", "fileSizeBytes", "generatedBy", "status", "createdAt") VALUES
      ('p42-grep-del-1', 'REP-P42-DEL-01', 'p42-case-del-1', 'Delhi Interim Report', 'CASE_SUMMARY', 'PDF', 'ALL', '/reports/del1.pdf', 4096, 'Inspector Delhi', 'FINAL', NOW()),
      ('p42-grep-kol-1', 'REP-P42-KOL-01', 'p42-case-kol-1', 'Kolkata Interim Report', 'CASE_SUMMARY', 'PDF', 'ALL', '/reports/kol1.pdf', 4096, 'Inspector Kolkata', 'FINAL', NOW());

    INSERT INTO "TimelineEvent" ("id", "caseId", "evidenceId", "timestamp", "phase", "description", "sourceType", "createdAt") VALUES
      ('p42-tle-del-1', 'p42-case-del-1', 'p42-evi-del-1', NOW(), 'INVESTIGATION', 'Intake recorded Delhi', 'OFFICER_LOG', NOW()),
      ('p42-tle-kol-1', 'p42-case-kol-1', 'p42-evi-kol-1', NOW(), 'INVESTIGATION', 'Intake recorded Kolkata', 'OFFICER_LOG', NOW());
  `;

  runSql(TARGET_DB, "postgres", seedSql);
  console.log("  ✓ Multi-tenant fixtures seeded across all 20 RLS tables.\n");

  console.log("[2/3] Executing direct RLS tests connecting as rakshak_app_user...");

  // Setup helper query function with Delhi session context
  const setDelhiContext = `SELECT set_authenticated_tenant_context('p42-off-del-1', 'p42-dept-del', 'tok-del-valid-42');`;

  // ─── 1. Case (Home visible, Delegated Mumbai visible, Isolated Kolkata INVISIBLE)
  {
    const sql = `${setDelhiContext} SELECT id FROM "Case" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed =
      visible.includes("p42-case-del-1") &&
      visible.includes("p42-case-mum-1") &&
      !visible.includes("p42-case-kol-1");
    record(
      "RLS-T01",
      "Case",
      "Home case & delegated case visible, foreign Kolkata case strictly invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}], Kolkata invisible: ${!visible.includes("p42-case-kol-1")}`
    );
  }

  // ─── 2. Evidence (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "Evidence" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-evi-del-1") && !visible.includes("p42-evi-kol-1");
    record(
      "RLS-T02",
      "Evidence",
      "Evidence exhibits scoped by case department; foreign Kolkata exhibits invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 3. CustodyEvent (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "CustodyEvent" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-cust-del-1") && !visible.includes("p42-cust-kol-1");
    record(
      "RLS-T03",
      "CustodyEvent",
      "Custody events scoped by parent evidence case department; Kolkata invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 4. ExtractedFact (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "ExtractedFact" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-fact-del-1") && !visible.includes("p42-fact-kol-1");
    record(
      "RLS-T04",
      "ExtractedFact",
      "Candidate extracted facts filtered by case department; Kolkata facts invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 5. CaseEntity (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "CaseEntity" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-cent-del-1") && !visible.includes("p42-cent-kol-1");
    record(
      "RLS-T05",
      "CaseEntity",
      "Case entities strictly filtered by case department; Kolkata entities invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 6. InvestigativeDossier (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "InvestigativeDossier" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-doss-del-1") && !visible.includes("p42-doss-kol-1");
    record(
      "RLS-T06",
      "InvestigativeDossier",
      "Investigative dossiers filtered by case department; Kolkata dossiers invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 7. DossierClaim (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "DossierClaim" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-clm-del-1") && !visible.includes("p42-clm-kol-1");
    record(
      "RLS-T07",
      "DossierClaim",
      "Dossier claims scoped by case department; foreign Kolkata claims invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 8. DossierReview (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "DossierReview" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-drev-del-1") && !visible.includes("p42-drev-kol-1");
    record(
      "RLS-T08",
      "DossierReview",
      "Dossier reviews scoped by case department; foreign Kolkata reviews invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 9. DossierExportAudit (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "DossierExportAudit" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-dexp-del-1") && !visible.includes("p42-dexp-kol-1");
    record(
      "RLS-T09",
      "DossierExportAudit",
      "Dossier export audits scoped by case department; Kolkata audits invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 10. AuditLog (Unprivileged runtime role strictly denied SELECT, UPDATE, DELETE)
  {
    const selectRes = runSql(TARGET_DB, "rakshak_app_user", `${setDelhiContext} SELECT count(*) FROM "AuditLog";`);
    const passedSelectDenied = parseInt(selectRes.output.split(/\r?\n/).pop().trim(), 10) === 0;

    const updateRes = runSql(TARGET_DB, "rakshak_app_user", `UPDATE "AuditLog" SET "action" = 'TAMPERED' WHERE id = '${auditId}';`, true);
    const passedUpdateDenied = !updateRes.ok && updateRes.error.includes("permission denied for table AuditLog");

    const deleteRes = runSql(TARGET_DB, "rakshak_app_user", `DELETE FROM "AuditLog" WHERE id = '${auditId}';`, true);
    const passedDeleteDenied = !deleteRes.ok && deleteRes.error.includes("permission denied for table AuditLog");

    const passed = passedSelectDenied && passedUpdateDenied && passedDeleteDenied;
    record(
      "RLS-T10",
      "AuditLog",
      "AuditLog append-only: SELECT returns 0 for non-admin, UPDATE/DELETE strictly denied",
      passed ? "PASSED" : "FAILED",
      "Read denied (0 rows), Update/Delete blocked with permission denied"
    );
  }

  // ─── 11. CaseAssignmentHistory (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "CaseAssignmentHistory" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-cah-del-1") && !visible.includes("p42-cah-kol-1");
    record(
      "RLS-T11",
      "CaseAssignmentHistory",
      "Case assignment history scoped by department; Kolkata history invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 12. CaseStatusHistory (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "CaseStatusHistory" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-csh-del-1") && !visible.includes("p42-csh-kol-1");
    record(
      "RLS-T12",
      "CaseStatusHistory",
      "Case status transition history scoped by department; Kolkata history invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 13. AccessGrant (Delhi grant visible, foreign Mumbai-Kolkata grant invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "AccessGrant" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-ag-del-1") && !visible.includes("p42-ag-mum-kol");
    record(
      "RLS-T13",
      "AccessGrant",
      "Access grants visible only to involved departments; foreign inter-agency grants invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}], Foreign grant invisible: ${!visible.includes("p42-ag-mum-kol")}`
    );
  }

  // ─── 14. CaseLegalMapping (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "CaseLegalMapping" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-clm-map-del-1") && !visible.includes("p42-clm-map-kol-1");
    record(
      "RLS-T14",
      "CaseLegalMapping",
      "Statutory legal mappings scoped by case department; Kolkata mappings invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 15. EntityLink (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "EntityLink" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-elink-del-1") && !visible.includes("p42-elink-kol-1");
    record(
      "RLS-T15",
      "EntityLink",
      "Entity links scoped by case department; unrelated foreign links invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 16. EntityLinkReview (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "EntityLinkReview" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-elr-del-1") && !visible.includes("p42-elr-kol-1");
    record(
      "RLS-T16",
      "EntityLinkReview",
      "Entity link reviews scoped by case department; foreign reviews invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 17. ExtractedTextArtifact (OCR) (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "ExtractedTextArtifact" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-eta-del-1") && !visible.includes("p42-eta-kol-1");
    record(
      "RLS-T17",
      "ExtractedTextArtifact",
      "Extracted OCR text artifacts scoped by case department; Kolkata artifacts invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 18. FactReviewHistory (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "FactReviewHistory" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-frh-del-1") && !visible.includes("p42-frh-kol-1");
    record(
      "RLS-T18",
      "FactReviewHistory",
      "Fact review audit history scoped by case department; Kolkata history invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 19. GeneratedReport (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "GeneratedReport" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-grep-del-1") && !visible.includes("p42-grep-kol-1");
    record(
      "RLS-T19",
      "GeneratedReport",
      "Generated investigative reports scoped by case department; Kolkata reports invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 20. TimelineEvent (Delhi visible, Kolkata strictly invisible)
  {
    const sql = `${setDelhiContext} SELECT id FROM "TimelineEvent" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const visible = res.output.split(/\r?\n/).filter((l) => l.startsWith("p42-"));
    const passed = visible.includes("p42-tle-del-1") && !visible.includes("p42-tle-kol-1");
    record(
      "RLS-T20",
      "TimelineEvent",
      "Investigative timeline events scoped by case department; Kolkata timeline invisible",
      passed ? "PASSED" : "FAILED",
      `Visible: [${visible.join(", ")}]`
    );
  }

  // ─── 21. Cross-Department Unauthorized Write Rejection (WITH CHECK Enforcement)
  {
    const sql = `
      ${setDelhiContext}
      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "departmentId", "createdAt", "updatedAt")
      VALUES ('p42-forged-case', 'CASE-FORGED-02', 'Fraud', 'Victim', 'Kolkata', 'OPEN', 'p42-dept-kol', NOW(), NOW());
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok && res.error.includes("violates row-level security policy");
    record(
      "RLS-T21",
      "Case",
      "Cross-department INSERT rejected by RLS WITH CHECK policy",
      passed ? "PASSED" : "FAILED",
      res.error ? "RLS WITH CHECK violation trapped" : "Insertion permitted!"
    );
  }

  // ─── 22. Missing Tenant Context Fails Closed
  {
    const sql = `SELECT count(*) FROM "Case" WHERE id LIKE 'p42-%';`;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-T22",
      "SecurityContext",
      "Missing session tenant context fails closed (0 rows returned)",
      passed ? "PASSED" : "FAILED",
      `Returned count: ${count}`
    );
  }

  // ─── 23. Direct Client Spoofing via set_config Fails Closed
  {
    const sql = `
      SELECT set_config('app.current_department_id', 'p42-dept-kol', false);
      SELECT count(*) FROM "Case" WHERE id = 'p42-case-kol-1';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-T23",
      "SecurityContext",
      "Unverified client set_config('app.current_department_id') fails closed",
      passed ? "PASSED" : "FAILED",
      `Returned count: ${count}`
    );
  }

  // ─── 24. Suspended Officer Context Fails Closed
  {
    const sql = `
      SELECT set_authenticated_tenant_context('p42-off-del-susp', 'p42-dept-del', 'tok-del-susp-42');
      SELECT count(*) FROM "Case" WHERE id LIKE 'p42-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql, true);
    const passed = !res.ok || parseInt(res.output.split(/\r?\n/).pop().trim(), 10) === 0;
    record(
      "RLS-T24",
      "SecurityContext",
      "Suspended officer session token fails closed",
      passed ? "PASSED" : "FAILED",
      res.error || "0 rows returned"
    );
  }

  // ─── 25. clear_tenant_context() Resets Session Across Connection Pools
  {
    const sql = `
      ${setDelhiContext}
      SELECT clear_tenant_context();
      SELECT count(*) FROM "Case" WHERE id LIKE 'p42-%';
    `;
    const res = runSql(TARGET_DB, "rakshak_app_user", sql);
    const count = parseInt(res.output.split(/\r?\n/).pop().trim(), 10);
    const passed = count === 0;
    record(
      "RLS-T25",
      "SecurityContext",
      "clear_tenant_context() resets all tenant variables in connection pool",
      passed ? "PASSED" : "FAILED",
      `Returned count: ${count}`
    );
  }

  // ─── 26. Runtime Role Unprivileged Invariants
  {
    const sql = `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';`;
    const res = runSql(TARGET_DB, "postgres", sql);
    const line = res.output.split(/\r?\n/).filter((l) => l.includes("rakshak_app_user")).pop();
    const passed = line === "rakshak_app_user|f|f";
    record(
      "RLS-T26",
      "RoleInvariants",
      "rakshak_app_user verified unprivileged (rolsuper=f, rolbypassrls=f)",
      passed ? "PASSED" : "FAILED",
      line
    );
  }

  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1) + "%";

  console.log("\n================================================================");
  console.log(`   PHASE 42 DIRECT RLS ENFORCEMENT SUMMARY:`);
  console.log(`   Total Scenarios Executed: ${totalCount}`);
  console.log(`   Passed:                   ${passedCount} / ${totalCount} (${passRate})`);
  console.log(`   Failed:                   ${totalCount - passedCount}`);
  console.log("================================================================\n");

  const summary = {
    suite: "PHASE42_DIRECT_RLS_ENFORCEMENT",
    database: TARGET_DB,
    role: "rakshak_app_user",
    timestamp: new Date().toISOString(),
    totalScenarios: totalCount,
    passedCount,
    allPassed: passedCount === totalCount,
    coveredTablesCount: 20,
    coveredTables: [
      "AccessGrant",
      "AuditLog",
      "Case",
      "CaseAssignmentHistory",
      "CaseEntity",
      "CaseLegalMapping",
      "CaseStatusHistory",
      "CustodyEvent",
      "DossierClaim",
      "DossierExportAudit",
      "DossierReview",
      "EntityLink",
      "EntityLinkReview",
      "Evidence",
      "ExtractedFact",
      "ExtractedTextArtifact",
      "FactReviewHistory",
      "GeneratedReport",
      "InvestigativeDossier",
      "TimelineEvent",
    ],
    scenarios: results,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(summary, null, 2), "utf8");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in direct RLS suite:", err);
  process.exit(1);
});
