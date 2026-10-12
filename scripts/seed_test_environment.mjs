// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_test_environment.mjs
// Rakshak v3.0 — Phase 22 Isolated Test & CI Fixture Seeder
//
// Seeds a disposable synthetic test database with multi-department test fixtures:
// - Department A (Chandigarh) vs Department B (Mumbai)
// - Scoped officers: Investigator A, Investigator B, Viewer A, Platform Admin
// - Scoped cases & evidence metadata for boundary testing
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { initializeCleanDatabase } from "./create_clean_deployment.mjs";

const TEST_DB_PATH = path.join(process.cwd(), "prisma", "test.db");

export async function seedTestEnvironment(targetDbPath = TEST_DB_PATH) {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — ISOLATED TEST & CI FIXTURE SEEDER             ");
  console.log(`   Target: ${targetDbPath}`);
  console.log("================================================================\n");

  // Initialize clean target schema first
  await initializeCleanDatabase(targetDbPath);

  const p = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve(targetDbPath)}` } },
  });

  try {
    console.log("[1] Seeding test departments...");
    await p.$executeRawUnsafe(`
      INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "createdAt", "updatedAt")
      VALUES 
        ('dept-chd-01', 'CCB-CHD-01', 'Cyber Crime Branch Sector 17', 'Chandigarh', 'Chandigarh UT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('dept-mum-01', 'MUM-CYBER-01', 'Mumbai Police Cyber Wing', 'Maharashtra', 'Mumbai', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    console.log("[2] Seeding test officers with role & department associations...");
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash("Rakshak@2026", salt);

    const officers = [
      { badge: "DL-002", name: "ACP Vikram Singh", email: "admin@delhi.gov.in", role: "ADMIN", desig: "ACP", jur: "Delhi", dept: null },
      { badge: "INV-CHD-01", name: "Inspector R.S. Meena", email: "meena@chd.gov.in", role: "INVESTIGATOR", desig: "Inspector", jur: "Chandigarh", dept: "dept-chd-01" },
      { badge: "INV-MUM-01", name: "Inspector Priya Sharma", email: "priya@mumbai.gov.in", role: "INVESTIGATOR", desig: "Inspector", jur: "Mumbai", dept: "dept-mum-01" },
      { badge: "VW-CHD-01", name: "Constable Rahul Trainee", email: "rahul@chd.gov.in", role: "VIEWER", desig: "Constable", jur: "Chandigarh", dept: "dept-chd-01" },
    ];

    for (const o of officers) {
      await p.$executeRawUnsafe(`
        INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "unit", "status", "departmentId", "createdAt", "updatedAt")
        VALUES ('off-${o.badge.toLowerCase()}', '${o.badge}', '${o.name}', '${o.email}', '${passHash}', '${o.desig}', '${o.role}', '${o.jur}', 'Cyber Cell', 'ACTIVE', ${o.dept ? `'${o.dept}'` : 'NULL'}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `);
    }

    console.log("[3] Seeding department-scoped synthetic cases...");
    // Case 1: Department A (Chandigarh)
    await p.$executeRawUnsafe(`
      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "amountDefrauded", "officerName", "officerBadge", "departmentId", "createdAt", "updatedAt")
      VALUES ('case-chd-001', 'CASE-TEST-CHD-01', 'Task_Scam', 'Priya Nair', 'Cyber Crime Branch Sector 17', 'UNDER_INQUIRY', 45000, 'Inspector R.S. Meena', 'INV-CHD-01', 'dept-chd-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // Case 2: Department B (Mumbai)
    await p.$executeRawUnsafe(`
      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "amountDefrauded", "officerName", "officerBadge", "departmentId", "createdAt", "updatedAt")
      VALUES ('case-mum-001', 'CASE-TEST-MUM-01', 'Digital_Arrest', 'Sunita Sharma', 'Mumbai Police Cyber Wing', 'UNDER_INQUIRY', 850000, 'Inspector Priya Sharma', 'INV-MUM-01', 'dept-mum-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // Case 3: Legacy Unmapped Case (null departmentId and null jurisdiction)
    await p.$executeRawUnsafe(`
      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "jurisdiction", "status", "amountDefrauded", "departmentId", "createdAt", "updatedAt")
      VALUES ('case-legacy-001', 'CASE-TEST-LEGACY-01', 'Investment_Fraud', 'Legacy Complainant', NULL, 'OPEN', 100000, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    console.log("[4] Seeding test evidence metadata...");
    const dummyHashA = "aa".repeat(32);
    const dummyHashB = "bb".repeat(32);

    await p.$executeRawUnsafe(`
      INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "sha256Hash", "clientHash", "storagePath", "evidenceCategory", "uploadedAt")
      VALUES 
        ('ev-chd-001', 'case-chd-001', 'chd_evidence.pdf', 'PDF', 'application/pdf', 1024, '${dummyHashA}', '${dummyHashA}', '/uploads/raw/${dummyHashA}.bin', 'UPI_FINANCIAL', CURRENT_TIMESTAMP),
        ('ev-mum-001', 'case-mum-001', 'mum_evidence.pdf', 'PDF', 'application/pdf', 2048, '${dummyHashB}', '${dummyHashB}', '/uploads/raw/${dummyHashB}.bin', 'CALL_LOG', CURRENT_TIMESTAMP);
    `);

    const [cCount, oCount, eCount] = await Promise.all([p.case.count(), p.officer.count(), p.evidence.count()]);
    console.log(`\n✓ ISOLATED TEST FIXTURES READY: ${cCount} Cases, ${oCount} Officers, ${eCount} Evidence items.`);

    await p.$disconnect();
    return { path: targetDbPath, cases: cCount, officers: oCount, evidence: eCount };
  } catch (err) {
    console.error("TEST SEEDING FAILED:", err.message);
    await p.$disconnect();
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed_test_environment.mjs")) {
  seedTestEnvironment().catch(() => process.exit(1));
}
