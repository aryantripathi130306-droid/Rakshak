# RAKSHAK v3.0 — ERD Schema Validation Report

**Extraction Date:** 2026-11-25  
**Primary Source:** `prisma/schema.postgresql.prisma`  
**Comparison Source:** `prisma/schema.prisma`  
**Migration Verification:** `prisma/migrations_pg/` (11 SQL migration files)

---

## 1. Authoritative Schema Counts (PostgreSQL)

| Metric | Count | Details |
|---|---|---|
| **Prisma Models** | **31** | All 31 models match 1:1 with SQLite |
| **Non-Prisma DB Tables** | **1** | `private_auth.session_context` (created in `20261024_adversarial_rls_hardening.sql`) |
| **Prisma Enums** | **0** | Status/type columns use `String` in Prisma; enforced via PostgreSQL `CHECK` constraints |
| **Physical Foreign Keys** | **34** | Defined via `@relation(fields: [...], references: [...])` |
| **Physical Relationships** | **34** | All 34 are `MANY_TO_ONE` (child → parent) / `ONE_TO_MANY` (parent → children); 0 implicit M2M, 0 `ONE_TO_ONE` |
| **Application-Level Logical Relationships** | **28** | Scalar ID columns without Prisma `@relation` (including 1 `SELF_REFERENCING` and 1 polymorphic) |
| **Unique Constraints** | **16** | 10 single-field `@unique` + 6 compound `@@unique` |
| **Secondary Indexes (`@@index`)** | **74** | Explicit Prisma `@@index` definitions |

---

## 2. Functional Domain Coverage (All 31 Models)

1. **Tenancy & Auth (4):** `Department`, `Officer`, `OfficerSession`, `AccessGrant`
2. **Case Management & Lifecycle (3):** `Case`, `CaseAssignmentHistory`, `CaseStatusHistory`
3. **Evidence & Chain of Custody (2):** `Evidence`, `CustodyEvent`
4. **OCR, NLP & Fact Review (5):** `ExtractedTextArtifact`, `ExtractedFact`, `FactReviewHistory`, `Transcription`, `ChatTranslation`
5. **Cross-Case Intelligence & Graph (5):** `TimelineEvent`, `CaseEntity`, `CaseCluster`, `ClusterMembership`, `EntityLink`, `EntityLinkReview` *(6 models across Timeline + Intelligence)*
6. **Investigative Dossiers & Legal (6):** `InvestigativeDossier`, `DossierClaim`, `DossierReview`, `DossierExportAudit`, `LegalProvision`, `CaseLegalMapping`, `EvidenceLegalMapping` *(7 models)*
7. **Reporting, Audit & Pilot Governance (4):** `GeneratedReport`, `ScheduledReport`, `AuditLog`, `PilotFeedback`

*(Total: 4 + 3 + 2 + 5 + 6 + 7 + 4 = 31 models)*

---

## 3. SQLite vs PostgreSQL Comparison

- **Model & Field Parity:** **100% parity** across all 31 models, all scalar fields, types, nullability, defaults, unique constraints, and `@@index` definitions.
- **Confirmed Differences:**
  1. `datasource db.provider`: `"postgresql"` vs `"sqlite"`.
  2. `generator client.output`: `"../node_modules/@prisma/client-pg"` (PostgreSQL) vs default `@prisma/client` (SQLite).
  3. `CustodyEvent`: PostgreSQL explicitly names the compound unique constraint `map: "CustodyEvent_evidence_seq_unique_idx"` on `@@unique([evidenceId, sequenceNumber])`.
  4. **PostgreSQL-Only Runtime Enforcement (in `prisma/migrations_pg/`):** Row-Level Security (`ENABLE` + `FORCE ROW LEVEL SECURITY` on 20+ tables), `CHECK` constraints, `REVOKE UPDATE/DELETE/TRUNCATE` immutability rules, and `private_auth.session_context`.

---

## 4. Migration-Defined Constraints Not Represented in Prisma

1. **Row-Level Security (RLS) & `FORCE ROW LEVEL SECURITY`:** Enforced in PostgreSQL on `Case`, `Evidence`, `ExtractedFact`, `CaseEntity`, `CustodyEvent`, `TimelineEvent`, `GeneratedReport`, `CaseLegalMapping`, `DossierExportAudit`, `AuditLog`, `AccessGrant`, `CaseAssignmentHistory`, `CaseStatusHistory`, `EntityLink`, `EntityLinkReview`, `InvestigativeDossier`, `DossierClaim`, `DossierReview`, `ExtractedTextArtifact`, `FactReviewHistory`.
2. **Append-Only / Immutability Grants (`REVOKE` from `rakshak_app_user`):**
   - `AuditLog`: append-only
   - `CustodyEvent`: `REVOKE UPDATE, DELETE, TRUNCATE`
   - `DossierReview`: `REVOKE UPDATE, DELETE, TRUNCATE`
   - `FactReviewHistory`: `REVOKE UPDATE, DELETE, TRUNCATE`
   - `InvestigativeDossier`, `DossierClaim`, `ExtractedTextArtifact`: `REVOKE DELETE, TRUNCATE`
3. **PostgreSQL `CHECK` Constraints:**
   - `ExtractedTextArtifact_status_check`, `ExtractedTextArtifact_confidence_check`
   - `ExtractedFact_reviewStatus_check`
   - `FactReviewHistory_decision_check`, `FactReviewHistory_rationale_check`
   - `DossierReview` `contentHashBound` length = 64 (`CHECK (length("contentHashBound") = 64)`)
   - `CustodyEvent` `eventHash` / `prevEventHash` / `sequenceNumber >= 1` checks

---

## 5. Logical Relationships & Unresolved / Polymorphic Items

- **Explicit Many-to-Many Join Tables:**
  - `ClusterMembership` (`CaseCluster` ↔ `Case`)
  - `EntityLink` (`Case` ↔ `Case` via `sourceCaseId` and `targetCaseId`, with `EntityLinkReview` child audit trail)
- **Self-Referencing Relationship (Logical Only):**
  - `InvestigativeDossier.previousVersionId` → `InvestigativeDossier.id` (nullable scalar string; no Prisma `@relation` declared).
- **Polymorphic Reference (Cannot Be Enforced by Physical FK):**
  - `DossierClaim.sourceModel` + `DossierClaim.sourceRecordId` references any of `"Case"`, `"Evidence"`, `"ExtractedFact"`, `"CustodyEvent"`, `"TimelineEvent"`, `"EntityLink"`, `"CaseLegalMapping"`, or `"Other"`. This cannot be represented as a single physical SQL foreign key.
- **Unlinked Scalar IDs (Application-Enforced):**
  - `EvidenceLegalMapping` (`caseId`, `evidenceId`), `ExtractedFact.caseId`, `GeneratedReport.caseId`, `Evidence.currentCustodianId` / `examinerId`, `CaseAssignmentHistory` (`officerId`, `departmentId`, `assignedById`), `CaseStatusHistory` (`changedById`, `departmentId`), `FactReviewHistory` (`caseId`, `evidenceId`, `reviewerId`, `departmentId`), `EntityLink` (`sourceEntityId`, `targetEntityId`, `sourceEvidenceId`, `targetEvidenceId`), and `ExtractedTextArtifact` (`caseId`, `departmentId`) are stored as scalar strings without physical FKs in Prisma.
