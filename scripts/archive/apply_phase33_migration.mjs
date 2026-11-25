// ─────────────────────────────────────────────────────────────────────────────
// scripts/apply_phase33_migration.mjs
// Rakshak v3.0 — Phase 33 Non-Destructive AccessGrant DDL & Data Reconciliation
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "none";
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function runMigration() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 33 SAFE DDL MIGRATION & RECONCILIATION   ");
  console.log("================================================================\n");

  const devDbPath = path.join(process.cwd(), "prisma", "dev.db");
  const grantsJsonPath = path.join(process.cwd(), "data", "access_grants.json");

  const beforeHash = sha256File(devDbPath);
  console.log(`Pre-migration dev.db SHA-256: ${beforeHash.substring(0, 16)}...`);

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${devDbPath}` } },
  });

  try {
    // 1. Create table if not exists
    console.log("1. Applying DDL for AccessGrant table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AccessGrant" (
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
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AccessGrant_granteeOfficerId_fkey" FOREIGN KEY ("granteeOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "AccessGrant_granteeDepartmentId_fkey" FOREIGN KEY ("granteeDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AccessGrant_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AccessGrant_targetCaseId_fkey" FOREIGN KEY ("targetCaseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AccessGrant_grantedByOfficerId_fkey" FOREIGN KEY ("grantedByOfficerId") REFERENCES "Officer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AccessGrant_revokedByOfficerId_fkey" FOREIGN KEY ("revokedByOfficerId") REFERENCES "Officer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);

    // 2. Create indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_granteeOfficerId_idx" ON "AccessGrant"("granteeOfficerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_granteeDepartmentId_idx" ON "AccessGrant"("granteeDepartmentId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_targetDepartmentId_idx" ON "AccessGrant"("targetDepartmentId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_targetCaseId_idx" ON "AccessGrant"("targetCaseId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_status_idx" ON "AccessGrant"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");`);

    console.log("  ✓ DDL and indexes applied successfully.");

    // 3. Reconcile existing JSON grants if any
    console.log("2. Reconciling JSON access grants into database...");
    let migratedCount = 0;
    if (fs.existsSync(grantsJsonPath)) {
      try {
        const rawJson = fs.readFileSync(grantsJsonPath, "utf8");
        const jsonGrants = JSON.parse(rawJson);
        if (Array.isArray(jsonGrants) && jsonGrants.length > 0) {
          for (const g of jsonGrants) {
            const existing = await prisma.accessGrant.findUnique({ where: { id: g.id } });
            if (!existing) {
              await prisma.accessGrant.create({
                data: {
                  id: g.id,
                  granteeOfficerId: g.granteeOfficerId || null,
                  granteeDepartmentId: g.granteeDepartmentId,
                  targetDepartmentId: g.targetDepartmentId,
                  targetCaseId: g.targetCaseId || null,
                  scope: g.scope,
                  grantedByOfficerId: g.grantedByOfficerId,
                  grantedAt: new Date(g.grantedAt || g.createdAt || Date.now()),
                  expiresAt: new Date(g.expiresAt),
                  revokedAt: g.revokedAt ? new Date(g.revokedAt) : null,
                  revokedByOfficerId: g.revokedByOfficerId || null,
                  status: g.status || "ACTIVE",
                  reason: g.reason || "Migrated grant",
                },
              });
              migratedCount++;
            }
          }
        }
      } catch (err) {
        console.warn("  ⚠ Non-fatal warning reading JSON grants:", err.message);
      }
    }
    console.log(`  ✓ Reconciled ${migratedCount} grant records from JSON to database.`);

    const totalInDb = await prisma.accessGrant.count();
    console.log(`  • Total AccessGrant records in database: ${totalInDb}`);

  } finally {
    await prisma.$disconnect();
  }

  const afterHash = sha256File(devDbPath);
  console.log(`\nPost-migration dev.db SHA-256: ${afterHash.substring(0, 16)}...`);
  console.log("================================================================\n");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
