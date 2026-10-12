// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_dev_environment.mjs
// Rakshak v3.0 — Phase 22 Development Environment Synthetic Fixture Seeder
//
// Strictly restricted to development / local sandbox environments.
// SAFETY: Refuses execution if NODE_ENV === 'production'.
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export async function seedDevEnvironment(dbUrlOverride = null) {
  // CRITICAL PRODUCTION GUARD
  if (process.env.NODE_ENV?.trim() === "production") {
    console.error("================================================================");
    console.error("   CRITICAL SAFETY GATE: DEMO SEEDING BLOCKED IN PRODUCTION     ");
    console.error("================================================================");
    console.error("Attempted to run development demo seeding against a production environment.");
    console.error("Operation aborted immediately to prevent synthetic data contamination.");
    process.exit(1);
  }

  const dbUrl = dbUrlOverride || process.env.DATABASE_URL || `file:${path.resolve("prisma/dev.db")}`;
  const p = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — DEVELOPMENT SYNTHETIC FIXTURE SEEDER          ");
  console.log(`   Target: ${dbUrl}`);
  console.log("================================================================\n");

  try {
    // 1. Seed Normalized Departments
    console.log("[1/4] Seeding development synthetic departments...");
    const depts = [
      { id: "dept-chd-01", code: "CCB-CHD-01", name: "Cyber Crime Branch, Sector 17, Chandigarh", state: "Chandigarh", jurisdiction: "Chandigarh UT" },
      { id: "dept-del-01", code: "DEL-CYBER-01", name: "Delhi Police Special Cyber Cell", state: "Delhi", jurisdiction: "Delhi NCR" },
      { id: "dept-mum-01", code: "MUM-CYBER-01", name: "Mumbai Police Cyber Crime Wing", state: "Maharashtra", jurisdiction: "Mumbai" },
      { id: "dept-blr-01", code: "BLR-CYBER-01", name: "CID Cyber Crime Division Bengaluru", state: "Karnataka", jurisdiction: "Bengaluru" },
      { id: "dept-jpr-01", code: "JPR-CYBER-01", name: "Rajasthan State Cyber Crime Agency Jaipur", state: "Rajasthan", jurisdiction: "Jaipur" },
    ];

    for (const d of depts) {
      await p.$executeRawUnsafe(`
        INSERT OR IGNORE INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt")
        VALUES ('${d.id}', '${d.code}', '${d.name}', '${d.state}', '${d.jurisdiction}', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `).catch(() => {});
    }

    // 2. Link Test Officers to Departments
    console.log("[2/4] Linking synthetic officers to departments...");
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash("Rakshak@2026", salt);

    const devOfficers = [
      { badge: "DL-002", name: "ACP Vikram Singh", email: "vikram.singh@delhipolice.gov.in", role: "ADMIN", desig: "ACP", jur: "Delhi", dept: "dept-del-01" },
      { badge: "MH-104", name: "Inspector Priya Sharma", email: "priya.sharma@mumbaipolice.gov.in", role: "INVESTIGATOR", desig: "Inspector", jur: "Mumbai", dept: "dept-mum-01" },
      { badge: "KA-042", name: "SI Amit Kumar", email: "amit.kumar@ksp.gov.in", role: "ANALYST", desig: "SI", jur: "Bengaluru", dept: "dept-blr-01" },
      { badge: "RJ-018", name: "Analyst Neha Verma", email: "neha.verma@rajasthanpolice.gov.in", role: "ANALYST", desig: "Analyst", jur: "Jaipur", dept: "dept-jpr-01" },
      { badge: "MH-088", name: "Head Constable Rahul Mehta", email: "rahul.mehta@mumbaipolice.gov.in", role: "VIEWER", desig: "Head Constable", jur: "Pune", dept: "dept-mum-01" },
    ];

    for (const o of devOfficers) {
      const existing = await p.officer.findFirst({ where: { badgeNumber: o.badge } });
      if (!existing) {
        await p.officer.create({
          data: {
            badgeNumber: o.badge,
            name: o.name,
            email: o.email,
            passwordHash: passHash,
            designation: o.desig,
            role: o.role,
            jurisdiction: o.jur,
            status: "ACTIVE",
          },
        });
      }
      // Link to department if column exists
      await p.$executeRawUnsafe(`UPDATE "Officer" SET "departmentId" = '${o.dept}' WHERE "badgeNumber" = '${o.badge}';`).catch(() => {});
    }

    // 3. Link Existing Cases to Department IDs
    console.log("[3/4] Linking existing cases to department IDs...");
    await p.$executeRawUnsafe(`UPDATE "Case" SET "departmentId" = 'dept-chd-01' WHERE "jurisdiction" LIKE '%Chandigarh%' AND "departmentId" IS NULL;`).catch(() => {});
    await p.$executeRawUnsafe(`UPDATE "Case" SET "departmentId" = 'dept-del-01' WHERE ("jurisdiction" LIKE '%Delhi%' OR "jurisdiction" LIKE '%Rohini%') AND "departmentId" IS NULL;`).catch(() => {});
    await p.$executeRawUnsafe(`UPDATE "Case" SET "departmentId" = 'dept-mum-01' WHERE "jurisdiction" LIKE '%Mumbai%' AND "departmentId" IS NULL;`).catch(() => {});
    await p.$executeRawUnsafe(`UPDATE "Case" SET "departmentId" = 'dept-blr-01' WHERE "jurisdiction" LIKE '%Bengaluru%' AND "departmentId" IS NULL;`).catch(() => {});

    // 4. Verification
    const [caseCount, officerCount] = await Promise.all([p.case.count(), p.officer.count()]);
    console.log(`[4/4] Development environment seeding complete.`);
    console.log(`  • Active Cases:    ${caseCount}`);
    console.log(`  • Active Officers: ${officerCount}`);

    await p.$disconnect();
    return { success: true, caseCount, officerCount };
  } catch (err) {
    console.error("DEV SEEDING ERROR:", err.message);
    await p.$disconnect();
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed_dev_environment.mjs")) {
  seedDevEnvironment().catch(() => process.exit(1));
}
