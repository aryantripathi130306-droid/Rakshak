// scripts/validate_security_baseline.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Comprehensive Security Baseline Catalog Validator
// Inspects PostgreSQL catalogs for tables, RLS enablement, FORCE RLS,
// exact policies, unprivileged application roles, immutability, and security functions.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PSQL_PATH = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";

export const EXPECTED_BASE_TABLES = Object.freeze([
  "AccessGrant",
  "AuditLog",
  "Case",
  "CaseAssignmentHistory",
  "CaseCluster",
  "CaseEntity",
  "CaseLegalMapping",
  "CaseStatusHistory",
  "ChatTranslation",
  "ClusterMembership",
  "CustodyEvent",
  "Department",
  "DossierClaim",
  "DossierExportAudit",
  "DossierReview",
  "EntityLink",
  "EntityLinkReview",
  "Evidence",
  "EvidenceLegalMapping",
  "ExtractedFact",
  "ExtractedTextArtifact",
  "FactReviewHistory",
  "GeneratedReport",
  "InvestigativeDossier",
  "LegalProvision",
  "Officer",
  "OfficerSession",
  "PilotFeedback",
  "ScheduledReport",
  "TimelineEvent",
  "Transcription",
]);

export const EXPECTED_RLS_TABLES = Object.freeze([
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
]);

export const EXPECTED_POLICIES = Object.freeze([
  { table: "AccessGrant", name: "access_grant_department_isolation" },
  { table: "AuditLog", name: "p_auditlog_insert" },
  { table: "AuditLog", name: "p_auditlog_select" },
  { table: "Case", name: "p_case_tenant_isolation" },
  { table: "CaseAssignmentHistory", name: "case_assignment_history_tenant_isolation" },
  { table: "CaseEntity", name: "p_caseentity_tenant_isolation" },
  { table: "CaseLegalMapping", name: "p_legal_tenant_isolation" },
  { table: "CaseStatusHistory", name: "case_status_history_tenant_isolation" },
  { table: "CustodyEvent", name: "p_custody_tenant_isolation" },
  { table: "DossierClaim", name: "dossier_claim_tenant_isolation" },
  { table: "DossierExportAudit", name: "p_dossier_tenant_isolation" },
  { table: "DossierReview", name: "dossier_review_tenant_isolation" },
  { table: "EntityLink", name: "entity_link_tenant_isolation" },
  { table: "EntityLinkReview", name: "entity_link_review_tenant_isolation" },
  { table: "Evidence", name: "p_evidence_tenant_isolation" },
  { table: "ExtractedFact", name: "p_fact_tenant_isolation" },
  { table: "ExtractedTextArtifact", name: "ExtractedTextArtifact_tenant_isolation" },
  { table: "FactReviewHistory", name: "FactReviewHistory_tenant_isolation" },
  { table: "GeneratedReport", name: "p_report_tenant_isolation" },
  { table: "InvestigativeDossier", name: "investigative_dossier_tenant_isolation" },
  { table: "TimelineEvent", name: "p_timeline_tenant_isolation" },
]);

export const EXPECTED_SECURITY_FUNCTIONS = Object.freeze([
  "set_authenticated_tenant_context",
  "clear_tenant_context",
  "set_platform_admin_context",
  "is_verified_platform_admin",
  "get_verified_department_id",
  "get_verified_officer_id",
]);

function runQuery(db, sql, options = {}) {
  const { host = "127.0.0.1", user = "postgres", password = "change_me_in_vault" } = options;
  const env = { ...process.env, PGPASSWORD: password };
  const raw = execFileSync(
    PSQL_PATH,
    ["-h", host, "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return raw.trim();
}

/**
 * Validates the full PostgreSQL catalog security baseline on targetDb.
 */
export async function validateSecurityBaseline(targetDb, options = {}) {
  const errors = [];
  const findings = {};

  try {
    // 1. Validate Base Tables
    const tablesRaw = runQuery(
      targetDb,
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;",
      options
    );
    const actualTables = tablesRaw ? tablesRaw.split(/\r?\n/).filter(Boolean) : [];
    findings.tableCount = actualTables.length;
    findings.tables = actualTables;

    const missingTables = EXPECTED_BASE_TABLES.filter((t) => !actualTables.includes(t));
    const unexpectedTables = actualTables.filter((t) => !EXPECTED_BASE_TABLES.includes(t));

    if (missingTables.length > 0) {
      errors.push(`Missing expected base tables: ${missingTables.join(", ")}`);
    }
    if (unexpectedTables.length > 0) {
      errors.push(`Unexpected base tables in public schema: ${unexpectedTables.join(", ")}`);
    }

    // 2. Validate Row-Level Security Enabled
    const rlsRaw = runQuery(
      targetDb,
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true ORDER BY c.relname;`,
      options
    );
    const actualRlsTables = rlsRaw ? rlsRaw.split(/\r?\n/).filter(Boolean) : [];
    findings.rlsTableCount = actualRlsTables.length;
    findings.rlsTables = actualRlsTables;

    const missingRls = EXPECTED_RLS_TABLES.filter((t) => !actualRlsTables.includes(t));
    if (missingRls.length > 0) {
      errors.push(`Tables missing required Row-Level Security (relrowsecurity=true): ${missingRls.join(", ")}`);
    }

    // 3. Validate FORCE ROW LEVEL SECURITY
    const forceRlsRaw = runQuery(
      targetDb,
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity = true ORDER BY c.relname;`,
      options
    );
    const actualForceRlsTables = forceRlsRaw ? forceRlsRaw.split(/\r?\n/).filter(Boolean) : [];
    findings.forceRlsTableCount = actualForceRlsTables.length;
    findings.forceRlsTables = actualForceRlsTables;

    const missingForceRls = EXPECTED_RLS_TABLES.filter((t) => !actualForceRlsTables.includes(t));
    if (missingForceRls.length > 0) {
      errors.push(`Tables missing FORCE ROW LEVEL SECURITY (relforcerowsecurity=true): ${missingForceRls.join(", ")}`);
    }

    // 4. Validate Policies
    const policiesRaw = runQuery(
      targetDb,
      "SELECT tablename || '|' || policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;",
      options
    );
    const actualPolicies = policiesRaw ? policiesRaw.split(/\r?\n/).filter(Boolean) : [];
    findings.policyCount = actualPolicies.length;
    findings.policies = actualPolicies;

    const expectedPolicyPairs = EXPECTED_POLICIES.map((p) => `${p.table}|${p.name}`);
    const missingPolicies = expectedPolicyPairs.filter((p) => !actualPolicies.includes(p));
    const unexpectedPolicies = actualPolicies.filter((p) => !expectedPolicyPairs.includes(p));

    if (missingPolicies.length > 0) {
      errors.push(`Missing required RLS policies: ${missingPolicies.join(", ")}`);
    }
    if (unexpectedPolicies.length > 0) {
      errors.push(`Unexpected RLS policies detected: ${unexpectedPolicies.join(", ")}`);
    }

    // 5. Validate Application Runtime Role Privileges
    const roleCheck = runQuery(
      targetDb,
      "SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';",
      options
    );
    if (!roleCheck) {
      errors.push("Application role 'rakshak_app_user' does not exist in PostgreSQL cluster!");
    } else {
      const [rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls] = roleCheck.split("|");
      findings.appUserRole = { rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls };
      if (rolsuper !== "f") errors.push("CRITICAL: 'rakshak_app_user' has rolsuper=true!");
      if (rolbypassrls !== "f") errors.push("CRITICAL: 'rakshak_app_user' has rolbypassrls=true!");
    }

    // 6. Validate Immutability Privileges on AuditLog
    const auditPerms = runQuery(
      targetDb,
      `SELECT privilege_type FROM information_schema.table_privileges
       WHERE table_name = 'AuditLog' AND grantee = 'rakshak_app_user' AND privilege_type IN ('UPDATE', 'DELETE');`,
      options
    );
    const illegalPerms = auditPerms ? auditPerms.split(/\r?\n/).filter(Boolean) : [];
    if (illegalPerms.length > 0) {
      errors.push(`SECURITY VIOLATION: 'rakshak_app_user' has unauthorized permissions on AuditLog: ${illegalPerms.join(", ")}`);
    }

    // 7. Validate Security Functions
    const functionsRaw = runQuery(
      targetDb,
      "SELECT proname FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public' ORDER BY proname;",
      options
    );
    const actualFunctions = functionsRaw ? functionsRaw.split(/\r?\n/).filter(Boolean) : [];
    findings.functions = actualFunctions;

    const missingFunctions = EXPECTED_SECURITY_FUNCTIONS.filter((fn) => !actualFunctions.includes(fn));
    if (missingFunctions.length > 0) {
      errors.push(`Missing security context functions in public schema: ${missingFunctions.join(", ")}`);
    }

    // 8. Validate private_auth schema and session_context
    const privateAuthTable = runQuery(
      targetDb,
      "SELECT table_name FROM information_schema.tables WHERE table_schema='private_auth' AND table_name='session_context';",
      options
    );
    if (privateAuthTable !== "session_context") {
      errors.push("Missing required table 'private_auth.session_context' for tamper-proof session tracking!");
    }
  } catch (err) {
    errors.push(`Database inspection query failed: ${err.message}`);
  }

  const passed = errors.length === 0;
  return {
    targetDb,
    passed,
    errors,
    findings,
  };
}

// CLI Execution support
if (process.argv[1] && process.argv[1].endsWith("validate_security_baseline.mjs")) {
  const targetDb = process.argv[2];
  if (!targetDb) {
    console.error("Usage: node scripts/validate_security_baseline.mjs <target_database_name>");
    process.exit(1);
  }

  validateSecurityBaseline(targetDb)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.passed) {
        console.error("\n❌ Security baseline validation failed!");
        process.exit(1);
      } else {
        console.log("\n✓ Security baseline validation PASSED!");
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
