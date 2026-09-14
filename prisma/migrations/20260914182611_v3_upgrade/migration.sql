-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL DEFAULT 'hi',
    "originalText" TEXT NOT NULL,
    "translatedText" TEXT,
    "targetLanguage" TEXT DEFAULT 'en',
    "speakerCount" INTEGER NOT NULL DEFAULT 2,
    "segments" TEXT NOT NULL,
    "transcriptionMethod" TEXT NOT NULL DEFAULT 'WHISPER_AI',
    "confidence" REAL NOT NULL DEFAULT 0.92,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transcription_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL DEFAULT 'hinglish',
    "messages" TEXT NOT NULL,
    "translationMethod" TEXT NOT NULL DEFAULT 'INDIC_TRANS_AI',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatTranslation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "confidence" TEXT NOT NULL DEFAULT 'POTENTIAL',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClusterMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clusterId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "ClusterMembership_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "CaseCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClusterMembership_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "clientHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "evidenceCategory" TEXT NOT NULL DEFAULT 'OTHER',
    "metadata" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Evidence" ("caseId", "clientHash", "fileName", "fileSize", "fileType", "id", "mimeType", "sha256Hash", "storagePath", "uploadedAt") SELECT "caseId", "clientHash", "fileName", "fileSize", "fileType", "id", "mimeType", "sha256Hash", "storagePath", "uploadedAt" FROM "Evidence";
DROP TABLE "Evidence";
ALTER TABLE "new_Evidence" RENAME TO "Evidence";
CREATE TABLE "new_ExtractedFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
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
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedFact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExtractedFact" ("boundingBox", "caseId", "confidence", "entityType", "evidenceId", "extractedAt", "factAssertion", "id", "normalizedValue", "rawValue", "sourceHash") SELECT "boundingBox", "caseId", "confidence", "entityType", "evidenceId", "extractedAt", "factAssertion", "id", "normalizedValue", "rawValue", "sourceHash" FROM "ExtractedFact";
DROP TABLE "ExtractedFact";
ALTER TABLE "new_ExtractedFact" RENAME TO "ExtractedFact";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ClusterMembership_clusterId_caseId_key" ON "ClusterMembership"("clusterId", "caseId");
