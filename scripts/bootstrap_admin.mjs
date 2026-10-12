// ─────────────────────────────────────────────────────────────────────────────
// scripts/bootstrap_admin.mjs
// Rakshak v3.0 — One-Time Platform Administrator Bootstrap Procedure
//
// Safe, auditable provisioning of the initial platform administrator.
// RULES:
// 1. Fails safely if an active administrator already exists.
// 2. Never outputs plaintext passwords or credentials to stdout.
// 3. Records tamper-evident audit log event.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export async function bootstrapAdmin(dbUrlOverride = null) {
  const dbUrl = dbUrlOverride || process.env.DATABASE_URL || "file:./prisma/dev.db";
  const p = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — INITIAL ADMINISTRATOR BOOTSTRAP GATE          ");
  console.log("================================================================\n");

  try {
    // 1. Guard check: check if an active ADMIN already exists
    const existingAdmin = await p.officer.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
    });

    if (existingAdmin) {
      console.log(`[BOOTSTRAP GUARD] Active Platform Administrator already provisioned.`);
      console.log(`  Existing Administrator: ${existingAdmin.name} (${existingAdmin.badgeNumber})`);
      console.log(`  Bootstrap procedure aborted safely to prevent duplicate superuser creation.`);
      await p.$disconnect();
      return { success: false, reason: "ADMIN_ALREADY_EXISTS", badge: existingAdmin.badgeNumber };
    }

    // 2. Extract configuration from environment
    const badge = (process.env.INITIAL_ADMIN_BADGE || "ADM-001").trim();
    const name = (process.env.INITIAL_ADMIN_NAME || "Platform Super Administrator").trim();
    const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@cybercrime.gov.in").trim().toLowerCase();
    const jurisdiction = (process.env.INITIAL_ADMIN_JURISDICTION || "Central Cyber Command").trim();
    const rawPass = process.env.INITIAL_ADMIN_PASSWORD || `Rakshak@${crypto.randomBytes(4).toString("hex")}!`;

    // 3. Compute timing-safe bcrypt hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPass, salt);

    // 4. Create single administrative record
    const admin = await p.officer.create({
      data: {
        badgeNumber: badge,
        name,
        email,
        passwordHash,
        designation: "Chief Forensic Administrator",
        role: "ADMIN",
        jurisdiction,
        unit: "State Cyber Command Headquarters",
        status: "ACTIVE",
      },
    });

    // 5. Log audit event
    await p.auditLog.create({
      data: {
        officerId: admin.id,
        officerName: admin.name,
        officerBadge: admin.badgeNumber,
        action: "INITIAL_ADMIN_BOOTSTRAPPED",
        module: "Auth",
        targetType: "Officer",
        targetId: admin.id,
        details: `Initial Platform Administrator account provisioned for ${admin.name} (${admin.badgeNumber})`,
        result: "SUCCESS",
        ipAddress: "127.0.0.1",
      },
    });

    console.log(`✓ Initial Platform Administrator provisioned successfully.`);
    console.log(`  Name:         ${admin.name}`);
    console.log(`  Badge Number: ${admin.badgeNumber}`);
    console.log(`  Email:        ${admin.email}`);
    console.log(`  Jurisdiction: ${admin.jurisdiction}`);
    console.log(`  Role:         ${admin.role}`);
    console.log(`  Audit Event:  INITIAL_ADMIN_BOOTSTRAPPED recorded.`);

    await p.$disconnect();
    return { success: true, badge: admin.badgeNumber, email: admin.email };
  } catch (err) {
    console.error("FATAL BOOTSTRAP ERROR:", err.message);
    await p.$disconnect();
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith("bootstrap_admin.mjs")) {
  bootstrapAdmin().catch(() => process.exit(1));
}
