-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261025_phase38_dossier_reporting.sql
-- Rakshak v3.0 — Phase 38 Evidence-Backed Investigative Dossiers & Controlled Export
--
-- 1. Creates InvestigativeDossier, DossierClaim, and DossierReview tables.
-- 2. Enforces database constraints (valid status enum, SHA-256 hash length, rationale length).
-- 3. Revokes UPDATE/DELETE/TRUNCATE on review history to ensure immutability.
-- 4. Establishes Row-Level Security scoped by verified department context & access grants.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Create InvestigativeDossier table
CREATE TABLE IF NOT EXISTS "InvestigativeDossier" (
    "id" TEXT PRIMARY KEY,
    "dossierNumber" TEXT UNIQUE NOT NULL,
    "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
    "version" INT NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateVersion" TEXT NOT NULL DEFAULT 'DOSSIER_TEMPLATE_V1',
    "generatorVersion" TEXT NOT NULL DEFAULT 'RAKSHAK_DOSSIER_GEN_V1',
    "summary" TEXT,
    "contentJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceManifest" TEXT NOT NULL,
    "isStale" BOOLEAN NOT NULL DEFAULT FALSE,
    "staleReason" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedByName" TEXT NOT NULL,
    "generatedByBadge" TEXT,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedByBadge" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "approvalBoundHash" TEXT,
    "finalizedAt" TIMESTAMPTZ,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvestigativeDossier_case_ver_idx"
ON "InvestigativeDossier" ("caseId", "version");

CREATE INDEX IF NOT EXISTS "InvestigativeDossier_caseId_idx" ON "InvestigativeDossier" ("caseId");
CREATE INDEX IF NOT EXISTS "InvestigativeDossier_status_idx" ON "InvestigativeDossier" ("status");
CREATE INDEX IF NOT EXISTS "InvestigativeDossier_version_idx" ON "InvestigativeDossier" ("version");
CREATE INDEX IF NOT EXISTS "InvestigativeDossier_contentHash_idx" ON "InvestigativeDossier" ("contentHash");
CREATE INDEX IF NOT EXISTS "InvestigativeDossier_generatedAt_idx" ON "InvestigativeDossier" ("generatedAt");

-- 2. Create DossierClaim table (Granular claim-to-source mapping)
CREATE TABLE IF NOT EXISTS "DossierClaim" (
    "id" TEXT PRIMARY KEY,
    "dossierId" TEXT NOT NULL REFERENCES "InvestigativeDossier"("id") ON DELETE CASCADE,
    "claimNumber" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceModel" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceCaseId" TEXT,
    "sourceEvidenceId" TEXT,
    "sourceTimestamp" TIMESTAMPTZ,
    "evidenceHash" TEXT,
    "custodyRef" TEXT,
    "method" TEXT NOT NULL DEFAULT 'DETERMINISTIC_EXTRACTION',
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "limitations" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "DossierClaim_dossierId_idx" ON "DossierClaim" ("dossierId");
CREATE INDEX IF NOT EXISTS "DossierClaim_source_record_idx" ON "DossierClaim" ("sourceModel", "sourceRecordId");
CREATE INDEX IF NOT EXISTS "DossierClaim_sourceCaseId_idx" ON "DossierClaim" ("sourceCaseId");
CREATE INDEX IF NOT EXISTS "DossierClaim_category_idx" ON "DossierClaim" ("category");
CREATE INDEX IF NOT EXISTS "DossierClaim_status_idx" ON "DossierClaim" ("status");

-- 3. Create DossierReview table (Immutable review & approval ledger)
CREATE TABLE IF NOT EXISTS "DossierReview" (
    "id" TEXT PRIMARY KEY,
    "dossierId" TEXT NOT NULL REFERENCES "InvestigativeDossier"("id") ON DELETE CASCADE,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerBadge" TEXT,
    "reviewerRole" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "contentHashBound" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "DossierReview_dossierId_idx" ON "DossierReview" ("dossierId");
CREATE INDEX IF NOT EXISTS "DossierReview_reviewerId_idx" ON "DossierReview" ("reviewerId");
CREATE INDEX IF NOT EXISTS "DossierReview_reviewedAt_idx" ON "DossierReview" ("reviewedAt");

-- 4. CHECK Constraints
ALTER TABLE "InvestigativeDossier" DROP CONSTRAINT IF EXISTS "InvestigativeDossier_status_check";
ALTER TABLE "InvestigativeDossier" ADD CONSTRAINT "InvestigativeDossier_status_check"
CHECK ("status" IN ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'FINALIZED', 'SUPERSEDED'));

ALTER TABLE "InvestigativeDossier" DROP CONSTRAINT IF EXISTS "InvestigativeDossier_version_check";
ALTER TABLE "InvestigativeDossier" ADD CONSTRAINT "InvestigativeDossier_version_check"
CHECK ("version" >= 1);

ALTER TABLE "InvestigativeDossier" DROP CONSTRAINT IF EXISTS "InvestigativeDossier_contentHash_check";
ALTER TABLE "InvestigativeDossier" ADD CONSTRAINT "InvestigativeDossier_contentHash_check"
CHECK (length("contentHash") = 64);

ALTER TABLE "DossierClaim" DROP CONSTRAINT IF EXISTS "DossierClaim_category_check";
ALTER TABLE "DossierClaim" ADD CONSTRAINT "DossierClaim_category_check"
CHECK ("category" IN ('RECORDED_FACT', 'SOURCE_DERIVED', 'CANDIDATE_LEAD', 'ANALYST_INTERPRETATION', 'REVIEWED_CONCLUSION'));

ALTER TABLE "DossierClaim" DROP CONSTRAINT IF EXISTS "DossierClaim_status_check";
ALTER TABLE "DossierClaim" ADD CONSTRAINT "DossierClaim_status_check"
CHECK ("status" IN ('PENDING_REVIEW', 'ACCEPTED', 'REVIEWED', 'DISPUTED', 'WITHDRAWN'));

ALTER TABLE "DossierReview" DROP CONSTRAINT IF EXISTS "DossierReview_status_check";
ALTER TABLE "DossierReview" ADD CONSTRAINT "DossierReview_status_check"
CHECK ("fromStatus" IN ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'FINALIZED', 'SUPERSEDED')
   AND "toStatus" IN ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'FINALIZED', 'SUPERSEDED'));

ALTER TABLE "DossierReview" DROP CONSTRAINT IF EXISTS "DossierReview_rationale_check";
ALTER TABLE "DossierReview" ADD CONSTRAINT "DossierReview_rationale_check"
CHECK (length(trim("rationale")) >= 5);

ALTER TABLE "DossierReview" DROP CONSTRAINT IF EXISTS "DossierReview_contentHashBound_check";
ALTER TABLE "DossierReview" ADD CONSTRAINT "DossierReview_contentHashBound_check"
CHECK (length("contentHashBound") = 64);

-- 5. Permissions for runtime application role
GRANT SELECT, INSERT, UPDATE ON "InvestigativeDossier" TO rakshak_app_user, rakshak_admin_user;
REVOKE DELETE, TRUNCATE ON "InvestigativeDossier" FROM rakshak_app_user;

GRANT SELECT, INSERT, UPDATE ON "DossierClaim" TO rakshak_app_user, rakshak_admin_user;
REVOKE DELETE, TRUNCATE ON "DossierClaim" FROM rakshak_app_user;

GRANT SELECT, INSERT ON "DossierReview" TO rakshak_app_user, rakshak_admin_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "DossierReview" FROM rakshak_app_user;

-- 6. Row-Level Security
ALTER TABLE "InvestigativeDossier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvestigativeDossier" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investigative_dossier_tenant_isolation" ON "InvestigativeDossier";
CREATE POLICY "investigative_dossier_tenant_isolation" ON "InvestigativeDossier"
FOR ALL
TO PUBLIC
USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
        SELECT 1 FROM "Case" c
        WHERE c.id = "InvestigativeDossier"."caseId"
          AND (
              (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
              OR
              EXISTS (
                  SELECT 1 FROM "AccessGrant" ag
                  WHERE ag.status = 'ACTIVE'
                    AND ag."expiresAt" > NOW()
                    AND ag."revokedAt" IS NULL
                    AND (ag."targetDepartmentId" = c."departmentId" OR ag."targetCaseId" = c.id)
                    AND (ag."granteeDepartmentId" = get_verified_department_id())
              )
          )
    )
);

ALTER TABLE "DossierClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DossierClaim" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_claim_tenant_isolation" ON "DossierClaim";
CREATE POLICY "dossier_claim_tenant_isolation" ON "DossierClaim"
FOR ALL
TO PUBLIC
USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
        SELECT 1 FROM "InvestigativeDossier" d
        WHERE d.id = "DossierClaim"."dossierId"
    )
);

ALTER TABLE "DossierReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DossierReview" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_review_tenant_isolation" ON "DossierReview";
CREATE POLICY "dossier_review_tenant_isolation" ON "DossierReview"
FOR ALL
TO PUBLIC
USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
        SELECT 1 FROM "InvestigativeDossier" d
        WHERE d.id = "DossierReview"."dossierId"
    )
);

COMMIT;
