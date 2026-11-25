-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "granteeOfficerId" TEXT,
    "granteeDepartmentId" TEXT NOT NULL,
    "targetDepartmentId" TEXT NOT NULL,
    "targetCaseId" TEXT,
    "scope" TEXT NOT NULL,
    "grantedByOfficerId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokedByOfficerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessGrant_granteeOfficerId_fkey" FOREIGN KEY ("granteeOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_granteeDepartmentId_fkey" FOREIGN KEY ("granteeDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_targetCaseId_fkey" FOREIGN KEY ("targetCaseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_grantedByOfficerId_fkey" FOREIGN KEY ("grantedByOfficerId") REFERENCES "Officer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_revokedByOfficerId_fkey" FOREIGN KEY ("revokedByOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccessGrant_granteeOfficerId_idx" ON "AccessGrant"("granteeOfficerId");

-- CreateIndex
CREATE INDEX "AccessGrant_granteeDepartmentId_idx" ON "AccessGrant"("granteeDepartmentId");

-- CreateIndex
CREATE INDEX "AccessGrant_targetDepartmentId_idx" ON "AccessGrant"("targetDepartmentId");

-- CreateIndex
CREATE INDEX "AccessGrant_targetCaseId_idx" ON "AccessGrant"("targetCaseId");

-- CreateIndex
CREATE INDEX "AccessGrant_status_idx" ON "AccessGrant"("status");

-- CreateIndex
CREATE INDEX "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");
