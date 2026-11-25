// ─────────────────────────────────────────────────────────────────────────────
// scripts/apply_dev_department_schema.mjs
// Rakshak v3.0 — Phase 22 Additive Department Schema Application for dev.db
// Non-destructive: adds Department table and nullable departmentId columns.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { seedDevEnvironment } from "./seed_dev_environment.mjs";

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  console.log("================================================================");
  console.log("   PHASE 22: APPLY ADDITIVE DEPARTMENT SCHEMA TO DEV.DB         ");
  console.log("================================================================\n");

  const rawBefore = fs.readFileSync(DB_PATH);
  const hashBefore = sha256(rawBefore);
  console.log(`[1] dev.db SHA-256 before migration: ${hashBefore} (${rawBefore.length} bytes)`);

  const p = new PrismaClient();

  const [casesBefore, officersBefore, evidenceBefore] = await Promise.all([
    p.case.count(),
    p.officer.count(),
    p.evidence.count(),
  ]);
  console.log(`[2] Pre-migration record counts:`);
  console.log(`  • Cases:    ${casesBefore}`);
  console.log(`  • Officers: ${officersBefore}`);
  console.log(`  • Evidence: ${evidenceBefore}`);

  console.log(`[3] Executing additive DDL statements...`);
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
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Department_code_idx" ON "Department"("code");`);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Department_status_idx" ON "Department"("status");`);

  // Add column departmentId to Case if not exists
  await p.$executeRawUnsafe(`ALTER TABLE "Case" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL;`).catch((err) => {
    if (!err.message.includes("duplicate column")) throw err;
  });

  // Add column departmentId to Officer if not exists
  await p.$executeRawUnsafe(`ALTER TABLE "Officer" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL;`).catch((err) => {
    if (!err.message.includes("duplicate column")) throw err;
  });

  await p.$disconnect();

  console.log(`[4] Seeding development departments and linking records...`);
  await seedDevEnvironment();

  const pAfter = new PrismaClient();
  const [casesAfter, officersAfter, evidenceAfter, deptsAfter] = await Promise.all([
    pAfter.case.count(),
    pAfter.officer.count(),
    pAfter.evidence.count(),
    pAfter.department.count(),
  ]);

  console.log(`\n[5] Post-migration record counts:`);
  console.log(`  • Cases:       ${casesAfter} (delta: ${casesAfter - casesBefore})`);
  console.log(`  • Officers:    ${officersAfter} (delta: ${officersAfter - officersBefore})`);
  console.log(`  • Evidence:    ${evidenceAfter} (delta: ${evidenceAfter - evidenceBefore})`);
  console.log(`  • Departments: ${deptsAfter}`);

  if (casesAfter < casesBefore || evidenceAfter < evidenceBefore) {
    throw new Error("DATA LOSS DETECTED! Cases or evidence count decreased!");
  }

  await pAfter.$disconnect();
  console.log(`\n✔ Additive migration completed successfully without data loss.`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
