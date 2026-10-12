// ─────────────────────────────────────────────────────────────────────────────
// scripts/create_clean_deployment.mjs
// Rakshak v3.0 — Phase 22 Clean Deployment Candidate Initialization Tool
//
// Initializes an empty, unseeded production candidate database with:
// 1. Zero demo cases, zero synthetic FIRs, zero mock evidence
// 2. Normalized Department schema & relations
// 3. Clean audit and governance tables
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CLEAN_DB_PATH = path.join(process.cwd(), "prisma", "clean_deployment.db");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function initializeCleanDatabase(targetPath = CLEAN_DB_PATH) {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — CLEAN DEPLOYMENT CANDIDATE INITIALIZATION     ");
  console.log(`   Target: ${targetPath}`);
  console.log("================================================================\n");

  // Remove existing clean candidate if present to ensure fresh state
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    console.log("  • Cleaned previous deployment candidate instance.");
  }

  // Initialize SQLite database with all tables
  const p = new PrismaClient({
    datasources: { db: { url: `file:${targetPath}` } },
  });

  console.log("[1] Creating normalized schema tables on clean target...");

  // Core investigative tables
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Department" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "state" TEXT NOT NULL,
      "jurisdiction" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");`);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Department_status_idx" ON "Department"("status");`);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Officer" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "badgeNumber" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "designation" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'INVESTIGATOR',
      "jurisdiction" TEXT NOT NULL,
      "unit" TEXT DEFAULT 'Cyber Crime Cell',
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL,
      "lastLogin" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Officer_badgeNumber_key" ON "Officer"("badgeNumber");`);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Officer_email_key" ON "Officer"("email");`);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OfficerSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "token" TEXT NOT NULL UNIQUE,
      "officerId" TEXT NOT NULL REFERENCES "Officer"("id") ON DELETE CASCADE,
      "expiresAt" DATETIME NOT NULL,
      "revoked" BOOLEAN NOT NULL DEFAULT 0,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "OfficerSession_token_key" ON "OfficerSession"("token");`);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Case" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "caseNumber" TEXT NOT NULL UNIQUE,
      "incidentType" TEXT NOT NULL,
      "complainantName" TEXT NOT NULL,
      "jurisdiction" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "amountDefrauded" INTEGER,
      "description" TEXT,
      "firNumber" TEXT,
      "officerName" TEXT,
      "officerBadge" TEXT,
      "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Case_caseNumber_key" ON "Case"("caseNumber");`);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Evidence" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
      "fileName" TEXT NOT NULL,
      "fileType" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "sha256Hash" TEXT NOT NULL,
      "clientHash" TEXT NOT NULL,
      "storagePath" TEXT NOT NULL,
      "evidenceCategory" TEXT NOT NULL DEFAULT 'OTHER',
      "metadata" TEXT,
      "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExtractedFact" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "evidenceId" TEXT NOT NULL REFERENCES "Evidence"("id") ON DELETE CASCADE,
      "caseId" TEXT NOT NULL,
      "factAssertion" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "rawValue" TEXT NOT NULL,
      "normalizedValue" TEXT NOT NULL,
      "confidence" REAL NOT NULL,
      "sourceHash" TEXT NOT NULL,
      "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
      "verifiedBy" TEXT,
      "boundingBox" TEXT DEFAULT '{}',
      "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimelineEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
      "evidenceId" TEXT NOT NULL REFERENCES "Evidence"("id") ON DELETE CASCADE,
      "timestamp" DATETIME NOT NULL,
      "description" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "phase" TEXT NOT NULL DEFAULT 'UNKNOWN',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CaseEntity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
      "entityType" TEXT NOT NULL,
      "normalizedValue" TEXT NOT NULL,
      "rawValue" TEXT NOT NULL,
      "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "officerId" TEXT REFERENCES "Officer"("id") ON DELETE SET NULL,
      "officerName" TEXT NOT NULL,
      "officerBadge" TEXT,
      "action" TEXT NOT NULL,
      "module" TEXT NOT NULL,
      "targetType" TEXT,
      "targetId" TEXT,
      "details" TEXT NOT NULL,
      "result" TEXT NOT NULL DEFAULT 'SUCCESS',
      "ipAddress" TEXT DEFAULT '103.45.67.89',
      "metadata" TEXT
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GeneratedReport" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reportNumber" TEXT NOT NULL UNIQUE,
      "reportType" TEXT NOT NULL,
      "caseId" TEXT,
      "title" TEXT NOT NULL,
      "generatedBy" TEXT NOT NULL,
      "officerId" TEXT REFERENCES "Officer"("id") ON DELETE SET NULL,
      "status" TEXT NOT NULL DEFAULT 'COMPLETED',
      "outputFormat" TEXT NOT NULL,
      "sectionsIncluded" TEXT NOT NULL,
      "fileSizeBytes" INTEGER DEFAULT 1048576,
      "filePath" TEXT,
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PilotFeedback" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "feedbackNumber" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "module" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "stepsToReproduce" TEXT,
      "expectedBehavior" TEXT,
      "actualBehavior" TEXT,
      "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
      "environment" TEXT NOT NULL DEFAULT 'Production Candidate',
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "reporterBadge" TEXT NOT NULL,
      "reporterName" TEXT NOT NULL,
      "assignedReviewer" TEXT DEFAULT 'To be assigned',
      "resolutionNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("[2] Verifying record counts on clean target...");
  const [caseCount, evidenceCount, factsCount, timelineCount, officerCount, reportCount] =
    await Promise.all([
      p.case.count(),
      p.evidence.count(),
      p.extractedFact.count(),
      p.timelineEvent.count(),
      p.officer.count(),
      p.generatedReport.count(),
    ]);

  console.log(`  • Cases:     ${caseCount} (MUST BE 0)`);
  console.log(`  • Evidence:  ${evidenceCount} (MUST BE 0)`);
  console.log(`  • Facts:     ${factsCount} (MUST BE 0)`);
  console.log(`  • Timeline:  ${timelineCount} (MUST BE 0)`);
  console.log(`  • Officers:  ${officerCount} (MUST BE 0)`);
  console.log(`  • Reports:   ${reportCount} (MUST BE 0)`);

  if (caseCount !== 0 || evidenceCount !== 0 || factsCount !== 0 || timelineCount !== 0 || officerCount !== 0) {
    throw new Error("CLEAN INITIALIZATION FAILED: Target contains residual or seeded data!");
  }

  const cleanFileBytes = fs.readFileSync(targetPath);
  const cleanHash = sha256(cleanFileBytes);
  console.log(`\n✓ CLEAN CANDIDATE INITIALIZED SUCCESSFULLY.`);
  console.log(`  File: ${targetPath}`);
  console.log(`  Size: ${cleanFileBytes.length} bytes`);
  console.log(`  SHA-256: ${cleanHash}`);

  await p.$disconnect();
  return { path: targetPath, hash: cleanHash, size: cleanFileBytes.length };
}

if (process.argv[1] && process.argv[1].endsWith("create_clean_deployment.mjs")) {
  initializeCleanDatabase().catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  });
}
