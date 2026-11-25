// scripts/setup_phase41_test_db.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Phase 41 Test DB Provisioning Script (LOCKED / HISTORICAL)
//
// HISTORICAL AUDIT NOTE (Phase 43):
// 'rakshak_phase41_test' is a protected historical test database containing
// verified Phase 41 evidence. Re-running provisioning against this database
// would violate historical preservation constraints.
//
// SAFETY ENFORCEMENT (Workstream A & B):
// Active provisioning via this script is PERMANENTLY DISABLED to protect historical
// database integrity.
// All new PostgreSQL test databases must be provisioned exclusively via:
//   node scripts/authoritative_migration_runner.mjs <target_database_name>
// ─────────────────────────────────────────────────────────────────────────────

console.error("\n================================================================================");
console.error("FATAL SAFETY ERROR: 'scripts/setup_phase41_test_db.mjs' IS PERMANENTLY LOCKED");
console.error("================================================================================");
console.error("Direct execution of this script is locked to prevent:");
console.error("  1. Accidental mutation/reset of preserved historical database 'rakshak_phase41_test'.");
console.error("  2. Fragmented or uncoordinated database provisioning pathways.");
console.error("\nTo provision a verified-secure PostgreSQL test database, use the authoritative runner:");
console.error("  node scripts/authoritative_migration_runner.mjs <new_target_database_name>");
console.error("================================================================================\n");

process.exit(1);
