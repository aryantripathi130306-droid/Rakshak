# RAKSHAK v3.0 — PHASE 35.1
# Schema & Release Migration Coverage Reconciliation Report

**Status:** COMPLETE  
**Phase:** 35.1 — Supervisor Approval Verification, Migration Parity & Historical Record Protection  
**Date:** October 2026  
**Execution Environment:** Windows Server / Node.js 24 / Next.js 16.4.3 / PostgreSQL 16.15 & SQLite Hybrid  

---

## 1. Executive Summary

Phase 35.1 establishes complete schema and release migration coverage reconciliation across both SQLite and PostgreSQL database engines.

Key findings & accomplishments:
1. **Schema Model Parity:** Both `prisma/schema.prisma` (SQLite) and `prisma/schema.postgresql.prisma` (PostgreSQL) maintain exact 24-model parity across all investigative, operational, access control, and lifecycle entities.
2. **Phase 18 vs. Current Release Reconciliation:** Investigation revealed why historical regression tests continued to report 21 models: `backups/migration_staging/sqlite_migration_payload.json` is a frozen historical test fixture established during Phase 18 (before `AccessGrant`, `CaseAssignmentHistory`, and `CaseStatusHistory` were introduced in Phases 33 and 35). Rewriting this historical fixture would compromise regression testing.
3. **Dedicated Release Migration Pipeline:** Developed `scripts/export_release_migration_payload.mjs`, which generates `backups/migration_staging/release_migration_payload.json` containing all 24 models (497 records) with full foreign-key constraints and manifest classifications.
4. **Non-Destructive Database Integrity:** Active development database `prisma/dev.db` hash was preserved without destructive data resets, and cold storage evidence binaries (560 files) remain 100% unaltered.

---

## 2. Complete 24-Model Catalog & Classification

Both Prisma schemas contain the following 24 models:

| Category | Model Name | Description & Relationships |
| :--- | :--- | :--- |
| **Core Investigative** (17 Models) | `Case` | Central investigation entity; roots timeline, evidence, clusters |
| | `Evidence` | Physical evidence metadata with SHA-256 binary references |
| | `ExtractedFact` | Entities extracted via OCR and automated analysis |
| | `TimelineEvent` | Chronological forensic events tied to cases and evidence |
| | `CaseEntity` | Unified entity graph nodes (UPI, phone, account, IP) |
| | `CaseCluster` | Cross-case syndicate clusters |
| | `ClusterMembership` | Relational bridge between clusters, cases, and confidence |
| | `CustodyEvent` | Immutable chain-of-custody transfer records |
| | `LegalProvision` | Statutory provision library (BNS, BSA, IT Act) |
| | `CaseLegalMapping` | Case-level legal charge mappings |
| | `EvidenceLegalMapping` | Evidence-to-statute admissibility mappings |
| | `DossierExportAudit` | Audit trail of exported court-ready Section 63 BSA dossiers |
| | `Officer` | Multi-user identities, roles, badges, departments |
| | `OfficerSession` | Session tokens, expirations, and revocation flags |
| | `AuditLog` | Append-only system-wide security and operations log |
| | `GeneratedReport` | Exported investigative PDF and JSON reports |
| | `ScheduledReport` | Recurring automated analytical report definitions |
| **Operational & Multimodal** (4 Models) | `PilotFeedback` | Field officer pilot defect and feedback submissions |
| | `Department` | Departmental boundaries and jurisdiction definitions |
| | `Transcription` | Audio exhibit speech-to-text transcriptions |
| | `ChatTranslation` | WhatsApp/Telegram multilingual translations |
| **Access Control & Lifecycle** (3 Models) | `AccessGrant` | Database-backed cross-department access delegations & approvals |
| | `CaseAssignmentHistory` | Primary and collaborating officer assignment timelines |
| | `CaseStatusHistory` | Immutable case state transitions and supervisory approvers |

---

## 3. Discrepancy Investigation: Phase 18 21-Model Baseline

### Root Cause
During Phase 18, `migrate_sqlite_to_postgres.mjs` was created to export the 21 models that existed at that time into `backups/migration_staging/sqlite_migration_payload.json`. In later phases:
- Phase 33 added `AccessGrant` (+1 = 22 models)
- Phase 35 added `CaseAssignmentHistory` and `CaseStatusHistory` (+2 = 24 models)

The test `test_phase18_migration_rehearsal.mjs` was intentionally written to validate the Phase 18 baseline and assert `manifest.modelCount === 21` against the historical fixture.

### Architectural Solution
To preserve historical test reproducibility while ensuring the current release migration path covers all current models:
1. **Preserve Frozen Fixture:** `backups/migration_staging/sqlite_migration_payload.json` remains frozen as the historical 21-model baseline, ensuring `test_phase18_migration_rehearsal.mjs` and `validate_migration_payload.mjs` pass.
2. **Current Release Pipeline:** Created `scripts/export_release_migration_payload.mjs` and `backups/migration_staging/release_migration_payload.json`, exporting all 24 models (497 records) with full relational integrity, foreign keys, and cryptographic evidence hashes.

---

## 4. Migration Execution & Parity Verification

### 4.1 Schema Parity
- **Prisma Client Generation:**
  - `npm run prisma:generate` executed cleanly with exit code 0.
  - Generated `@prisma/client` (SQLite) in 267ms.
  - Generated `@prisma/client-pg` (PostgreSQL) in 248ms.
- **Model Discrepancies:** 0 field discrepancies and 0 index discrepancies across all 24 models.

### 4.2 SQLite Migration Path
- Applied non-destructively to `prisma/dev.db` via `scripts/apply_phase35_migration.mjs` using `CREATE TABLE IF NOT EXISTS` and index creation.
- Preserved all 19 historical cases and active evidence records.

### 4.3 PostgreSQL Migration Path
- Database `rakshak_phase35_1_test` created from template.
- Applied `prisma/migrations_pg/20261024_phase35_1_hardening.sql` with full RLS, FORCE RLS, and privilege revocations for destructive actions.

---

## 5. Verification Test Results

From `scripts/test_phase35_1_supervisor_and_rls.mjs`:
- **TC-B01:** Both SQLite and PostgreSQL schemas maintain exact 24-model parity — **PASSED**
- **TC-B02:** Release migration payload encapsulates full 24-model schema coverage (497 records) — **PASSED**

From historical regression tests:
- `validate_migration_payload.mjs`: **PASSED** (21 models, 475 entities)
- `test_phase18_migration_rehearsal.mjs`: **PASSED** (7/7 assertions passed)
