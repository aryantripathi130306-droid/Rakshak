// ─────────────────────────────────────────────────────────────────────────────
// scripts/apply_phase35_migration.mjs
// Rakshak v3.0 — Phase 35 Non-Destructive Migration Runner
// Safely creates CaseAssignmentHistory and CaseStatusHistory tables in SQLite
// Preserves all existing records and databases intact.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "none";
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main() {
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  console.log(`[Phase 35 Migration] Checking target database: ${dbPath}`);
  const hashBefore = sha256File(dbPath);
  console.log(`  • Initial SHA-256: ${hashBefore.slice(0, 16)}...`);

  const prisma = new PrismaClient();

  try {
    console.log("[Phase 35 Migration] Executing non-destructive DDL...");

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CaseAssignmentHistory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "caseId" TEXT NOT NULL,
        "officerId" TEXT,
        "officerName" TEXT NOT NULL,
        "officerBadge" TEXT NOT NULL,
        "departmentId" TEXT,
        "assignedById" TEXT NOT NULL,
        "assignedByName" TEXT NOT NULL,
        "assignedByBadge" TEXT,
        "assignmentType" TEXT NOT NULL DEFAULT 'PRIMARY',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "reason" TEXT,
        "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME,
        CONSTRAINT "CaseAssignmentHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_caseId_idx" ON "CaseAssignmentHistory"("caseId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_officerId_idx" ON "CaseAssignmentHistory"("officerId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_departmentId_idx" ON "CaseAssignmentHistory"("departmentId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAssignmentHistory_assignedAt_idx" ON "CaseAssignmentHistory"("assignedAt");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CaseStatusHistory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "caseId" TEXT NOT NULL,
        "fromStatus" TEXT NOT NULL,
        "toStatus" TEXT NOT NULL,
        "changedById" TEXT NOT NULL,
        "changedByName" TEXT NOT NULL,
        "changedByBadge" TEXT,
        "departmentId" TEXT,
        "reason" TEXT,
        "approvedBy" TEXT,
        "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CaseStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseStatusHistory_caseId_idx" ON "CaseStatusHistory"("caseId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseStatusHistory_departmentId_idx" ON "CaseStatusHistory"("departmentId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseStatusHistory_changedAt_idx" ON "CaseStatusHistory"("changedAt");
    `);

    console.log("[Phase 35 Migration] Successfully applied CaseAssignmentHistory and CaseStatusHistory tables.");

    const cases = await prisma.case.findMany({ select: { id: true, officerName: true, officerBadge: true, departmentId: true, status: true, createdAt: true } });
    console.log(`  • Existing cases count: ${cases.length}`);

    // Non-destructively seed initial assignment and status history records for cases that lack them
    let seededAssignments = 0;
    let seededStatuses = 0;
    for (const c of cases) {
      if (c.officerName && c.officerBadge) {
        const existingAssign = await prisma.caseAssignmentHistory.findFirst({ where: { caseId: c.id } });
        if (!existingAssign) {
          await prisma.caseAssignmentHistory.create({
            data: {
              caseId: c.id,
              officerName: c.officerName,
              officerBadge: c.officerBadge,
              departmentId: c.departmentId,
              assignedById: "system-initial",
              assignedByName: "System Provisioner",
              assignmentType: "PRIMARY",
              status: "ACTIVE",
              reason: "Initial case intake assignment",
              assignedAt: c.createdAt,
            },
          });
          seededAssignments++;
        }
      }

      const existingStatus = await prisma.caseStatusHistory.findFirst({ where: { caseId: c.id } });
      if (!existingStatus) {
        await prisma.caseStatusHistory.create({
          data: {
            caseId: c.id,
            fromStatus: "OPEN",
            toStatus: c.status || "OPEN",
            changedById: "system-initial",
            changedByName: "System Provisioner",
            departmentId: c.departmentId,
            reason: "Initial intake record",
            changedAt: c.createdAt,
          },
        });
        seededStatuses++;
      }
    }

    console.log(`  • Seeded historical baselines: ${seededAssignments} assignments, ${seededStatuses} statuses`);
    const finalCountAssign = await prisma.caseAssignmentHistory.count();
    const finalCountStatus = await prisma.caseStatusHistory.count();
    console.log(`  • Total assignment history records: ${finalCountAssign}`);
    console.log(`  • Total status history records:     ${finalCountStatus}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
