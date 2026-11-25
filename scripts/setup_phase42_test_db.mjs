// scripts/setup_phase42_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 42 Test DB Provisioning Script (LOCKED / HISTORICAL)
//
// HISTORICAL AUDIT NOTE (Phase 43):
// 'rakshak_phase42_test' is a protected historical test database containing
// verified Phase 42 evidence. Re-running provisioning against this database
// would violate historical preservation constraints.
//
// SAFETY ENFORCEMENT (Workstream A & B):
// Active provisioning via this script is PERMANENTLY DISABLED to protect historical
// database integrity.
// All new PostgreSQL test databases must be provisioned exclusively via:
//   node scripts/authoritative_migration_runner.mjs <target_database_name>
// ─────────────────────────────────────────────────────────────────────────────

console.error("\n================================================================================");
console.error("FATAL SAFETY ERROR: 'scripts/setup_phase42_test_db.mjs' IS PERMANENTLY LOCKED");
console.error("================================================================================");
console.error("Direct execution of this script is locked to prevent accidental mutation of 'rakshak_phase42_test'.");
console.error("\nTo provision a verified-secure PostgreSQL test database, use the authoritative runner:");
console.error("  node scripts/authoritative_migration_runner.mjs <new_target_database_name>");
console.error("================================================================================\n");

process.exit(1);
