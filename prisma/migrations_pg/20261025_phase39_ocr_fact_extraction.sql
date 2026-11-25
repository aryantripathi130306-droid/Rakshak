-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261025_phase39_ocr_fact_extraction.sql
-- RAKSHAK v3.0 — Phase 39: OCR Processing, Structured Fact Extraction & Provenance
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create ExtractedTextArtifact Table
CREATE TABLE IF NOT EXISTS "ExtractedTextArtifact" (
  "id" VARCHAR(36) PRIMARY KEY,
  "evidenceId" VARCHAR(36) NOT NULL REFERENCES "Evidence"("id") ON DELETE CASCADE,
  "caseId" VARCHAR(36) NOT NULL,
  "sourceHash" VARCHAR(64) NOT NULL,
  "mimeType" VARCHAR(128) NOT NULL,
  "fileName" VARCHAR(255),
  "engine" VARCHAR(64) NOT NULL,
  "engineVersion" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "charCount" INTEGER NOT NULL DEFAULT 0,
  "lineCount" INTEGER NOT NULL DEFAULT 0,
  "pageCount" INTEGER NOT NULL DEFAULT 1,
  "rawText" TEXT NOT NULL,
  "boundingBoxes" TEXT,
  "processingTimeMs" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "isIntegrityVerified" BOOLEAN NOT NULL DEFAULT TRUE,
  "integrityAlert" TEXT,
  "departmentId" VARCHAR(64),
  "extractedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "ExtractedTextArtifact_status_check" CHECK ("status" IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED')),
  CONSTRAINT "ExtractedTextArtifact_confidence_check" CHECK ("confidence" >= 0.0 AND "confidence" <= 100.0)
);

CREATE INDEX IF NOT EXISTS "ExtractedTextArtifact_evidenceId_idx" ON "ExtractedTextArtifact"("evidenceId");
CREATE INDEX IF NOT EXISTS "ExtractedTextArtifact_caseId_idx" ON "ExtractedTextArtifact"("caseId");
CREATE INDEX IF NOT EXISTS "ExtractedTextArtifact_sourceHash_idx" ON "ExtractedTextArtifact"("sourceHash");
CREATE INDEX IF NOT EXISTS "ExtractedTextArtifact_status_idx" ON "ExtractedTextArtifact"("status");
CREATE INDEX IF NOT EXISTS "ExtractedTextArtifact_departmentId_idx" ON "ExtractedTextArtifact"("departmentId");

-- 2. Extend ExtractedFact Table with Phase 39 Provenance & Review Fields
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "artifactId" VARCHAR(36) REFERENCES "ExtractedTextArtifact"("id") ON DELETE SET NULL;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER DEFAULT 1;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "charOffset" INTEGER DEFAULT 0;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "extractionRule" VARCHAR(64) DEFAULT 'REGEX_V1';
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "ruleVersion" VARCHAR(32) DEFAULT '1.0.0';
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "reviewStatus" VARCHAR(32) DEFAULT 'PENDING_REVIEW';
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "acceptedValue" TEXT;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "originalValue" TEXT;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "limitations" TEXT;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "reviewedById" VARCHAR(64);
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "reviewRationale" TEXT;
ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExtractedFact_reviewStatus_check'
  ) THEN
    ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_reviewStatus_check"
      CHECK ("reviewStatus" IN ('PENDING_REVIEW', 'ACCEPTED', 'CORRECTED', 'REJECTED', 'SUPERSEDED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ExtractedFact_artifactId_idx" ON "ExtractedFact"("artifactId");
CREATE INDEX IF NOT EXISTS "ExtractedFact_reviewStatus_idx" ON "ExtractedFact"("reviewStatus");

-- 3. Create FactReviewHistory Table
CREATE TABLE IF NOT EXISTS "FactReviewHistory" (
  "id" VARCHAR(36) PRIMARY KEY,
  "factId" VARCHAR(36) NOT NULL REFERENCES "ExtractedFact"("id") ON DELETE CASCADE,
  "caseId" VARCHAR(36) NOT NULL,
  "evidenceId" VARCHAR(36) NOT NULL,
  "reviewerId" VARCHAR(64) NOT NULL,
  "reviewerName" VARCHAR(128) NOT NULL,
  "reviewerBadge" VARCHAR(64),
  "reviewerRole" VARCHAR(32) NOT NULL,
  "departmentId" VARCHAR(64) NOT NULL,
  "decision" VARCHAR(32) NOT NULL,
  "previousStatus" VARCHAR(32) NOT NULL,
  "newStatus" VARCHAR(32) NOT NULL,
  "previousValue" TEXT,
  "correctedValue" TEXT,
  "rationale" TEXT NOT NULL,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FactReviewHistory_decision_check" CHECK ("decision" IN ('ACCEPTED', 'CORRECTED', 'REJECTED', 'SUPERSEDED', 'PENDING_REVIEW')),
  CONSTRAINT "FactReviewHistory_rationale_check" CHECK (LENGTH("rationale") >= 5)
);

CREATE INDEX IF NOT EXISTS "FactReviewHistory_factId_idx" ON "FactReviewHistory"("factId");
CREATE INDEX IF NOT EXISTS "FactReviewHistory_caseId_idx" ON "FactReviewHistory"("caseId");
CREATE INDEX IF NOT EXISTS "FactReviewHistory_reviewerId_idx" ON "FactReviewHistory"("reviewerId");
CREATE INDEX IF NOT EXISTS "FactReviewHistory_departmentId_idx" ON "FactReviewHistory"("departmentId");

-- 4. Grants & Immutability Revocations for Application Role
GRANT SELECT, INSERT, UPDATE ON "ExtractedTextArtifact" TO rakshak_app_user;
GRANT SELECT, INSERT, UPDATE ON "ExtractedFact" TO rakshak_app_user;
GRANT SELECT, INSERT ON "FactReviewHistory" TO rakshak_app_user;

-- Revoke destructive permissions to enforce audit immutability
REVOKE DELETE, TRUNCATE ON "ExtractedTextArtifact" FROM rakshak_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON "FactReviewHistory" FROM rakshak_app_user;

-- 5. Enable and Force PostgreSQL Row-Level Security
ALTER TABLE "ExtractedTextArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedTextArtifact" FORCE ROW LEVEL SECURITY;

ALTER TABLE "FactReviewHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FactReviewHistory" FORCE ROW LEVEL SECURITY;

-- 6. Tenancy & Cross-Department Isolation Policies

DROP POLICY IF EXISTS "ExtractedTextArtifact_tenant_isolation" ON "ExtractedTextArtifact";
CREATE POLICY "ExtractedTextArtifact_tenant_isolation" ON "ExtractedTextArtifact"
  FOR ALL TO rakshak_app_user
  USING (
    "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    OR EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "ExtractedTextArtifact"."caseId"
        AND c."departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    )
    OR EXISTS (
      SELECT 1 FROM "AccessGrant" ag
      WHERE ag."targetCaseId" = "ExtractedTextArtifact"."caseId"
        AND ag."granteeDepartmentId" = NULLIF(current_setting('app.current_department_id', true), '')
        AND ag."status" = 'ACTIVE'
        AND (ag."expiresAt" IS NULL OR ag."expiresAt" > NOW())
    )
  )
  WITH CHECK (
    "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    OR EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "ExtractedTextArtifact"."caseId"
        AND c."departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    )
  );

DROP POLICY IF EXISTS "FactReviewHistory_tenant_isolation" ON "FactReviewHistory";
CREATE POLICY "FactReviewHistory_tenant_isolation" ON "FactReviewHistory"
  FOR ALL TO rakshak_app_user
  USING (
    "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    OR EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "FactReviewHistory"."caseId"
        AND c."departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
    )
    OR EXISTS (
      SELECT 1 FROM "AccessGrant" ag
      WHERE ag."targetCaseId" = "FactReviewHistory"."caseId"
        AND ag."granteeDepartmentId" = NULLIF(current_setting('app.current_department_id', true), '')
        AND ag."status" = 'ACTIVE'
        AND (ag."expiresAt" IS NULL OR ag."expiresAt" > NOW())
    )
  )
  WITH CHECK (
    "departmentId" = NULLIF(current_setting('app.current_department_id', true), '')
  );
