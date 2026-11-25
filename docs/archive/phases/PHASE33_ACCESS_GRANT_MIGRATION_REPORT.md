# RAKSHAK v3.0 — PHASE 33: ACCESS GRANT MIGRATION REPORT
**Date:** 2026-10-24  
**Classification:** Restricted / Technical Migration & Database Architecture  
**Author:** Lead PostgreSQL Migration Engineer & Application Security Specialist  
**Status:** Executed & Verified with Zero Data Loss  

---

## 1. Context & Motivation

During Phase 32, cross-department access grants were prototyped and recorded to `data/access_grants.json`. In a multi-user, multi-department law enforcement deployment, relying on a mutable JSON file for authorization state presents unacceptable security and operational risks:
1. **Concurrency hazards:** Simultaneous approvals or revocations could cause silent write overwrites and lost grant state.
2. **Lack of ACID guarantees:** Transactions spanning case actions and grant creation cannot be rolled back atomically.
3. **Absence of relational integrity:** Foreign keys to `Officer` and `Department` records cannot be enforced by the filesystem.
4. **Bypass of database-level security:** PostgreSQL Row Level Security (RLS) policies cannot query flat JSON files to enforce tenant isolation.

Phase 33 migrated access grants into the relational database architecture across both SQLite (`prisma/schema.prisma`) and PostgreSQL (`prisma/schema.postgresql.prisma`), while preserving `data/access_grants.json` as a synthetic testing mirror.

---

## 2. Relational Schema & Migration DDL

### 2.1 SQLite DDL (`prisma/migrations/20261024120000_phase33_access_grants/migration.sql`)
```sql
-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officerId" TEXT NOT NULL,
    "sourceDeptId" TEXT NOT NULL,
    "targetDeptId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "operations" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedByOfficerId" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" DATETIME,
    "revokedByOfficerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessGrant_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_approvedByOfficerId_fkey" FOREIGN KEY ("approvedByOfficerId") REFERENCES "Officer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_revokedByOfficerId_fkey" FOREIGN KEY ("revokedByOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_sourceDeptId_fkey" FOREIGN KEY ("sourceDeptId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetDeptId_fkey" FOREIGN KEY ("targetDeptId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessGrant_officerId_idx" ON "AccessGrant"("officerId");
CREATE INDEX IF NOT EXISTS "AccessGrant_targetDeptId_idx" ON "AccessGrant"("targetDeptId");
CREATE INDEX IF NOT EXISTS "AccessGrant_status_idx" ON "AccessGrant"("status");
CREATE INDEX IF NOT EXISTS "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");
```

### 2.2 PostgreSQL DDL & RLS Policy (`prisma/migrations_pg/20261024_access_grants.sql`)
```sql
-- Table Definition
CREATE TABLE IF NOT EXISTS "AccessGrant" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "sourceDeptId" TEXT NOT NULL,
    "targetDeptId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "operations" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedByOfficerId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedByOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccessGrant_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_approvedByOfficerId_fkey" FOREIGN KEY ("approvedByOfficerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_revokedByOfficerId_fkey" FOREIGN KEY ("revokedByOfficerId") REFERENCES "Officer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_sourceDeptId_fkey" FOREIGN KEY ("sourceDeptId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetDeptId_fkey" FOREIGN KEY ("targetDeptId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Row-Level Security
ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_grant_dept_isolation ON "AccessGrant"
    FOR ALL
    USING (
        current_setting('app.current_department_id', true) = sourceDeptId OR
        current_setting('app.current_department_id', true) = targetDeptId OR
        current_setting('app.is_super_admin', true) = 'true'
    );
```

---

## 3. Migration Rehearsal & Model Parity

### 3.1 22-Model Parity Verification
The project schema validation script `scripts/rehearse_postgres_migration_phase18.mjs` was executed:
- Both `prisma/schema.prisma` and `prisma/schema.postgresql.prisma` were statically parsed and validated across all 22 database models:
  `Department`, `Officer`, `Case`, `Evidence`, `AuditLog`, `Session`, `LegalProvision`, `CaseLegalMapping`, `Entity`, `EntityMention`, `CommunicationRecord`, `TimelineEvent`, `Cluster`, `ClusterMember`, `Feedback`, `Report`, `EvidenceMetadata`, `ExtractionArtifact`, `OcrArtifact`, `TextArtifact`, `EvidenceVerificationRecord`, `AccessGrant`.
- **Result:** Exact 100% field, index, and relationship parity across both schemas (0 discrepancies).

### 3.2 Non-Destructive Application to Active Database (`dev.db`)
Migration script `scripts/apply_phase33_migration.mjs` applied the DDL to `prisma/dev.db` using conditional `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- **Pre-migration SHA-256:** `eaabaeea39a12c7cb244f7dbbe48ca17a0279e9a4f40f3161c586e927cfa024e`
- **Post-migration Verification:** `dev.db` contains table `AccessGrant` and 4 indices. Existing officer, department, case, and evidence records were untouched.

---

## 4. Rollback and Recovery Procedures

In the event of an operational need to roll back:
1. **SQLite Rollback:**
   ```bash
   sqlite3 prisma/dev.db "DROP TABLE IF EXISTS AccessGrant;"
   ```
2. **PostgreSQL Rollback:**
   ```sql
   DROP POLICY IF EXISTS access_grant_dept_isolation ON "AccessGrant";
   DROP TABLE IF EXISTS "AccessGrant";
   ```
3. **Code Fallback:**
   `lib/accessControl.ts` maintains an in-memory/JSON fallback that activates if database tables cannot be queried, ensuring zero platform crashes even during transient database maintenance.
