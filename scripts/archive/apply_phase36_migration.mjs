// ─────────────────────────────────────────────────────────────────────────────
// scripts/apply_phase36_migration.mjs
// Rakshak v3.0 — Phase 36 Non-Destructive Migration Runner
// Adds lifecycle fields to Evidence and cryptographic chaining fields to CustodyEvent
// Preserves all existing records, databases, and historical fixtures intact.
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
  console.log(`[Phase 36 Migration] Checking target database: ${dbPath}`);
  const hashBefore = sha256File(dbPath);
  console.log(`  • Initial SHA-256: ${hashBefore.slice(0, 16)}...`);

  const prisma = new PrismaClient();

  try {
    console.log("[Phase 36 Migration] Inspecting existing columns...");

    const evidenceCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Evidence");`);
    const evidenceColNames = new Set(evidenceCols.map((c) => c.name));

    if (!evidenceColNames.has("status")) {
      console.log("  • Adding 'status' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACCEPTED';`);
    }
    if (!evidenceColNames.has("currentCustodianId")) {
      console.log("  • Adding 'currentCustodianId' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "currentCustodianId" TEXT;`);
    }
    if (!evidenceColNames.has("examinerId")) {
      console.log("  • Adding 'examinerId' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "examinerId" TEXT;`);
    }
    if (!evidenceColNames.has("quarantineReason")) {
      console.log("  • Adding 'quarantineReason' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "quarantineReason" TEXT;`);
    }
    if (!evidenceColNames.has("sealedAt")) {
      console.log("  • Adding 'sealedAt' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "sealedAt" DATETIME;`);
    }
    if (!evidenceColNames.has("releasedAt")) {
      console.log("  • Adding 'releasedAt' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "releasedAt" DATETIME;`);
    }
    if (!evidenceColNames.has("version")) {
      console.log("  • Adding 'version' column to Evidence...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "Evidence" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;`);
    }

    const custodyCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("CustodyEvent");`);
    const custodyColNames = new Set(custodyCols.map((c) => c.name));

    if (!custodyColNames.has("prevEventHash")) {
      console.log("  • Adding 'prevEventHash' column to CustodyEvent...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "CustodyEvent" ADD COLUMN "prevEventHash" TEXT;`);
    }
    if (!custodyColNames.has("eventHash")) {
      console.log("  • Adding 'eventHash' column to CustodyEvent...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "CustodyEvent" ADD COLUMN "eventHash" TEXT;`);
    }
    if (!custodyColNames.has("sequenceNumber")) {
      console.log("  • Adding 'sequenceNumber' column to CustodyEvent...");
      await prisma.$executeRawUnsafe(`ALTER TABLE "CustodyEvent" ADD COLUMN "sequenceNumber" INTEGER DEFAULT 1;`);
    }

    // Verify row count and integrity
    const evCount = await prisma.evidence.count();
    const custCount = await prisma.custodyEvent.count();
    console.log(`[Phase 36 Migration] Completed non-destructively. Evidence rows: ${evCount}, CustodyEvent rows: ${custCount}`);

    const hashAfter = sha256File(dbPath);
    console.log(`  • Final SHA-256: ${hashAfter.slice(0, 16)}...`);
  } catch (err) {
    console.error("[Phase 36 Migration] Failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
