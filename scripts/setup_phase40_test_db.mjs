// scripts/setup_phase40_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 40 Legacy Test DB Provisioning Script (LOCKED / DEPRECATED)
// 
// HISTORICAL AUDIT NOTE (Phase 42 & Phase 43):
// This script historically contained critical provisioning defects:
// 1. Missing foundational migration '20261011_rls_tenant_isolation.sql' (omitted 6 tables from RLS, 8 policies missing).
// 2. Used 'ON_ERROR_STOP=0' (fail-open SQL execution).
// 3. Omitted mandatory catalog-based security baseline validation (only checked tableCount).
// 4. Targeted 'rakshak_phase40_test' directly, risking mutation of historical test data.
//
// SAFETY ENFORCEMENT (Workstream A):
// Active provisioning via this script is PERMANENTLY DISABLED to protect historical
// database integrity and prevent insecure test database creation.
// All new PostgreSQL test databases must be provisioned exclusively via:
//   node scripts/authoritative_migration_runner.mjs <target_database_name>
// ─────────────────────────────────────────────────────────────────────────────

console.error("\n================================================================================");
console.error("FATAL SAFETY ERROR: 'scripts/setup_phase40_test_db.mjs' IS PERMANENTLY DEPRECATED");
console.error("================================================================================");
console.error("Direct execution of this legacy script is locked to prevent:");
console.error("  1. Accidental mutation/reset of preserved historical database 'rakshak_phase40_test'.");
console.error("  2. Insecure test database provisioning (missing foundational RLS tenant isolation).");
console.error("\nTo provision a verified-secure PostgreSQL test database, use the authoritative runner:");
console.error("  node scripts/authoritative_migration_runner.mjs <new_target_database_name>");
console.error("================================================================================\n");

process.exit(1);
