-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_phase37_cross_case_intelligence.sql
-- Rakshak v3.0 — Phase 37 Cross-Case Intelligence Graph & Entity Resolution
--
-- 1. Creates EntityLink and EntityLinkReview tables.
-- 2. Enforces database constraints (valid status enum, non-empty values, valid link types).
-- 3. Revokes UPDATE/DELETE/TRUNCATE on review history to ensure immutability.
-- 4. Establishes Row-Level Security scoped by verified department context & access grants.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Create EntityLink table
CREATE TABLE IF NOT EXISTS "EntityLink" (
    "id" TEXT PRIMARY KEY,
    "sourceEntityId" TEXT,
    "targetEntityId" TEXT,
    "sourceCaseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
    "targetCaseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
    "sourceEvidenceId" TEXT,
    "targetEvidenceId" TEXT,
    "entityType" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "matchRule" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL DEFAULT 'v1',
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "confidenceCategory" TEXT NOT NULL DEFAULT 'POTENTIAL_MATCH',
    "limitations" TEXT,
    "isGeneric" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdBy" TEXT NOT NULL DEFAULT 'system-entity-resolver',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewRationale" TEXT,
    "version" INT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint ensuring no duplicate link for same pair, entity, and link type
CREATE UNIQUE INDEX IF NOT EXISTS "EntityLink_unique_pair_idx"
ON "EntityLink" ("sourceCaseId", "targetCaseId", "entityType", "normalizedValue", "linkType");

CREATE INDEX IF NOT EXISTS "EntityLink_sourceCaseId_idx" ON "EntityLink" ("sourceCaseId");
CREATE INDEX IF NOT EXISTS "EntityLink_targetCaseId_idx" ON "EntityLink" ("targetCaseId");
CREATE INDEX IF NOT EXISTS "EntityLink_entity_val_idx" ON "EntityLink" ("entityType", "normalizedValue");
CREATE INDEX IF NOT EXISTS "EntityLink_status_idx" ON "EntityLink" ("status");
CREATE INDEX IF NOT EXISTS "EntityLink_norm_ver_idx" ON "EntityLink" ("normalizationVersion");

-- 2. Create EntityLinkReview table (Immutable review trail)
CREATE TABLE IF NOT EXISTS "EntityLinkReview" (
    "id" TEXT PRIMARY KEY,
    "linkId" TEXT NOT NULL REFERENCES "EntityLink"("id") ON DELETE CASCADE,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerBadge" TEXT,
    "reviewerRole" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "EntityLinkReview_linkId_idx" ON "EntityLinkReview" ("linkId");
CREATE INDEX IF NOT EXISTS "EntityLinkReview_reviewerId_idx" ON "EntityLinkReview" ("reviewerId");
CREATE INDEX IF NOT EXISTS "EntityLinkReview_reviewedAt_idx" ON "EntityLinkReview" ("reviewedAt");

-- 3. CHECK Constraints
ALTER TABLE "EntityLink" DROP CONSTRAINT IF EXISTS "EntityLink_status_check";
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_status_check"
CHECK ("status" IN ('CANDIDATE', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'REVOKED'));

ALTER TABLE "EntityLink" DROP CONSTRAINT IF EXISTS "EntityLink_linkType_check";
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_linkType_check"
CHECK ("linkType" IN ('EXACT_IDENTIFIER_MATCH', 'SHARED_HASH', 'SHARED_ACCOUNT', 'EXPLICIT_RELATIONSHIP', 'ANALYST_CONFIRMED', 'POTENTIAL_MATCH'));

ALTER TABLE "EntityLink" DROP CONSTRAINT IF EXISTS "EntityLink_norm_val_check";
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_norm_val_check"
CHECK (length(trim("normalizedValue")) > 0);

ALTER TABLE "EntityLink" DROP CONSTRAINT IF EXISTS "EntityLink_version_check";
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_version_check"
CHECK ("version" >= 1);

ALTER TABLE "EntityLinkReview" DROP CONSTRAINT IF EXISTS "EntityLinkReview_status_check";
ALTER TABLE "EntityLinkReview" ADD CONSTRAINT "EntityLinkReview_status_check"
CHECK ("fromStatus" IN ('CANDIDATE', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'REVOKED')
   AND "toStatus" IN ('CANDIDATE', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'REVOKED'));

ALTER TABLE "EntityLinkReview" DROP CONSTRAINT IF EXISTS "EntityLinkReview_rationale_check";
ALTER TABLE "EntityLinkReview" ADD CONSTRAINT "EntityLinkReview_rationale_check"
CHECK (length(trim("rationale")) >= 5);

-- 4. Permissions for runtime application role
GRANT SELECT, INSERT, UPDATE ON "EntityLink" TO rakshak_app_user, rakshak_admin_user;
REVOKE DELETE, TRUNCATE ON "EntityLink" FROM rakshak_app_user;

GRANT SELECT, INSERT ON "EntityLinkReview" TO rakshak_app_user, rakshak_admin_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "EntityLinkReview" FROM rakshak_app_user;

-- 5. Row-Level Security
ALTER TABLE "EntityLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityLink" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_link_tenant_isolation" ON "EntityLink";
CREATE POLICY "entity_link_tenant_isolation" ON "EntityLink"
FOR ALL
TO PUBLIC
USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
        SELECT 1 FROM "Case" c
        WHERE (c.id = "EntityLink"."sourceCaseId" OR c.id = "EntityLink"."targetCaseId")
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

ALTER TABLE "EntityLinkReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityLinkReview" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_link_review_tenant_isolation" ON "EntityLinkReview";
CREATE POLICY "entity_link_review_tenant_isolation" ON "EntityLinkReview"
FOR ALL
TO PUBLIC
USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
        SELECT 1 FROM "EntityLink" el
        WHERE el.id = "EntityLinkReview"."linkId"
    )
);

COMMIT;
