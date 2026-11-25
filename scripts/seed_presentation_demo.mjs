// scripts/seed_presentation_demo.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Rakshak v3.0 — Isolated Presentation Demo Environment Seeder (Idempotent)
// Target DB: rakshak_demo (PostgreSQL)
// Target Storage: uploads/synthetic_demo_presentation/
//
// Creates realistic, clearly synthetic demonstration records across all modules
// using the actual backend services (custodyChain, factReview, entityResolution,
// entityReview, dossierGeneration, dossierReview, dossierExport).
// Never modifies prisma/dev.db, historical test databases, or uploads/raw/.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient as PrismaClientPg } from "@prisma/client-pg";

const TARGET_DB = "rakshak_demo";
const PSQL_PATH = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const DEMO_DB_URL =
  process.env.DEMO_DATABASE_URL ||
  `postgresql://postgres:change_me_in_vault@127.0.0.1:5432/${TARGET_DB}`;
const DEMO_STORAGE_DIR = path.resolve("uploads", "synthetic_demo_presentation");

// Ensure lib/* modules that import ./prisma.ts bind directly to rakshak_demo and demo storage
process.env.DATABASE_URL = DEMO_DB_URL;
process.env.PG_DATABASE_URL = DEMO_DB_URL;
process.env.EVIDENCE_STORAGE_PATH = DEMO_STORAGE_DIR;

function assertSafeTarget() {
  if (!DEMO_DB_URL.includes(`/${TARGET_DB}`)) {
    throw new Error(`SAFETY ABORT: seed_presentation_demo.mjs may only target '${TARGET_DB}'.`);
  }
  if (DEMO_DB_URL.includes("dev.db") || DEMO_DB_URL.startsWith("file:")) {
    throw new Error("SAFETY ABORT: SQLite targets are strictly prohibited.");
  }
  if (DEMO_STORAGE_DIR.includes(`${path.sep}raw`)) {
    throw new Error("SAFETY ABORT: uploads/raw/ is strictly protected.");
  }
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function daysAgo(days, hoursOffset = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hoursOffset, 15, 0, 0);
  return d;
}

// Minimal valid 1x1 PNG buffer with synthetic comment chunk for image exhibits
function buildSyntheticPng(label) {
  const basePng = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de" +
      "0000000c4944415408d763f8ffff3f0005fe02fea73581840000000049454e44ae426082",
    "hex"
  );
  return Buffer.concat([basePng, Buffer.from(`\n/* DEMO_PNG_SYNTHETIC:${label} */`, "utf8")]);
}

// Minimal valid RIFF/WAV header + silent PCM frame for audio exhibits
function buildSyntheticWav(label) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + 64, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(64, 40);
  const pcm = Buffer.alloc(64, 0x80);
  const tag = Buffer.from(label.slice(0, 32), "utf8");
  tag.copy(pcm, 0);
  return Buffer.concat([header, pcm]);
}

// Minimal PDF-like synthetic buffer
function buildSyntheticPdf(title, bodyText) {
  const content = `%PDF-1.4\n% DEMO SYNTHETIC EXHIBIT - ${title}\n1 0 obj<<>>endobj\nstream\n${bodyText}\nendstream\n%%EOF\n`;
  return Buffer.from(content, "utf8");
}

// Minimal MP4 stub buffer
function buildSyntheticMp4(label) {
  const ftyp = Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex");
  const meta = Buffer.from(`DEMO_SYNTHETIC_VIDEO_CLIP:${label}`, "utf8");
  return Buffer.concat([ftyp, meta]);
}

function truncateDemoDatabase() {
  const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
  const currentDb = execFileSync(
    PSQL_PATH,
    ["-h", "127.0.0.1", "-U", "postgres", "-d", TARGET_DB, "-t", "-A", "-c", "SELECT current_database();"],
    { env, encoding: "utf8" }
  ).trim();
  if (currentDb !== TARGET_DB) {
    throw new Error(`Refusing truncate: connected to '${currentDb}' instead of '${TARGET_DB}'.`);
  }

  const sql = `
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE public."' || r.tablename || '" CASCADE;';
      END LOOP;
      EXECUTE 'TRUNCATE TABLE private_auth.session_context;';
    END $$;
  `;
  execFileSync(
    PSQL_PATH,
    ["-h", "127.0.0.1", "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env, encoding: "utf8" }
  );
}

async function main() {
  assertSafeTarget();

  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — SEEDING ISOLATED PRESENTATION DEMO (rakshak_demo)");
  console.log("================================================================\n");

  fs.mkdirSync(DEMO_STORAGE_DIR, { recursive: true });

  // Dynamic imports after setting DATABASE_URL and EVIDENCE_STORAGE_PATH
  const { LocalFilesystemStorageAdapter } = await import("../services/storageAdapter.ts");
  const { appendCustodyEventAsync } = await import("../lib/custodyChain.ts");
  const { submitFactReviewAsync } = await import("../lib/factReview.ts");
  const { evaluateCandidateLink } = await import("../lib/entityResolution.ts");
  const { submitEntityLinkReview } = await import("../lib/entityReview.ts");
  const { assembleInvestigativeDossier } = await import("../lib/dossierGeneration.ts");
  const { submitDossierReview } = await import("../lib/dossierReview.ts");
  const { exportInvestigativeDossier } = await import("../lib/dossierExport.ts");

  const prisma = new PrismaClientPg({ datasources: { db: { url: DEMO_DB_URL } } });
  const storage = new LocalFilesystemStorageAdapter(DEMO_STORAGE_DIR);

  try {
    console.log("[1/9] Resetting rakshak_demo tables for idempotent seeding...");
    truncateDemoDatabase();

    // ── 1. Departments ────────────────────────────────────────────────────────
    console.log("[2/9] Seeding synthetic departments & 8 officers...");
    const deptDelhi = await prisma.department.create({
      data: {
        id: "demo-dept-delhi",
        code: "DEMO-DL-CYBER",
        name: "Delhi Cyber Crime Unit",
        state: "Delhi",
        jurisdiction: "Delhi NCR",
        status: "ACTIVE",
      },
    });
    const deptMumbai = await prisma.department.create({
      data: {
        id: "demo-dept-mumbai",
        code: "DEMO-MH-CYBER",
        name: "Mumbai Cyber Crime Unit",
        state: "Maharashtra",
        jurisdiction: "Mumbai",
        status: "ACTIVE",
      },
    });

    // ── 2. Officers (1 SysAdmin, 2 Supervisors, 4 Investigators, 1 Suspended) ─
    const demoPasswordHash = await bcrypt.hash("Rakshak@2026!", 10);

    const officersSpec = [
      {
        id: "demo-off-sysadmin",
        badgeNumber: "SYS-ADM-001",
        name: "Vikramaditya Rao",
        email: "sysadmin.demo@rakshak.local",
        designation: "Platform System Administrator",
        role: "SYS_ADMIN",
        jurisdiction: "Delhi NCR",
        unit: "Central Cyber Infrastructure",
        status: "ACTIVE",
        departmentId: deptDelhi.id,
      },
      {
        id: "demo-off-del-sup",
        badgeNumber: "DL-SUP-001",
        name: "ACP Meera Deshpande",
        email: "meera.sup.demo@rakshak.local",
        designation: "Assistant Commissioner of Police",
        role: "SUPERVISOR",
        jurisdiction: "Delhi NCR",
        unit: "Delhi Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptDelhi.id,
      },
      {
        id: "demo-off-mum-sup",
        badgeNumber: "MH-SUP-001",
        name: "ACP Rohan Kulkarni",
        email: "rohan.sup.demo@rakshak.local",
        designation: "Assistant Commissioner of Police",
        role: "SUPERVISOR",
        jurisdiction: "Mumbai",
        unit: "Mumbai Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptMumbai.id,
      },
      {
        id: "demo-off-del-inv1",
        badgeNumber: "DL-CYBER-001",
        name: "Inspector Aarav Sharma",
        email: "aarav.inv.demo@rakshak.local",
        designation: "Chief Investigating Officer",
        role: "INVESTIGATOR",
        jurisdiction: "Delhi NCR",
        unit: "Delhi Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptDelhi.id,
      },
      {
        id: "demo-off-del-inv2",
        badgeNumber: "DL-INV-002",
        name: "SI Priya Nair",
        email: "priya.inv.demo@rakshak.local",
        designation: "Sub-Inspector (Cyber Forensics)",
        role: "INVESTIGATOR",
        jurisdiction: "Delhi NCR",
        unit: "Delhi Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptDelhi.id,
      },
      {
        id: "demo-off-mum-inv1",
        badgeNumber: "MH-INV-001",
        name: "Inspector Siddharth Joshi",
        email: "siddharth.inv.demo@rakshak.local",
        designation: "Senior Investigating Officer",
        role: "INVESTIGATOR",
        jurisdiction: "Mumbai",
        unit: "Mumbai Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptMumbai.id,
      },
      {
        id: "demo-off-mum-inv2",
        badgeNumber: "MH-INV-002",
        name: "SI Kavita Patil",
        email: "kavita.inv.demo@rakshak.local",
        designation: "Sub-Inspector (Financial Cell)",
        role: "INVESTIGATOR",
        jurisdiction: "Mumbai",
        unit: "Mumbai Cyber Crime Unit",
        status: "ACTIVE",
        departmentId: deptMumbai.id,
      },
      {
        id: "demo-off-del-susp",
        badgeNumber: "DL-SUSP-001",
        name: "SI Devansh Verma",
        email: "devansh.susp.demo@rakshak.local",
        designation: "Sub-Inspector",
        role: "INVESTIGATOR",
        jurisdiction: "Delhi NCR",
        unit: "Delhi Cyber Crime Unit",
        status: "SUSPENDED",
        departmentId: deptDelhi.id,
      },
    ];

    const officers = {};
    for (const o of officersSpec) {
      officers[o.badgeNumber] = await prisma.officer.create({
        data: { ...o, passwordHash: demoPasswordHash },
      });
    }

    const delInv1 = officers["DL-CYBER-001"];
    const delInv2 = officers["DL-INV-002"];
    const delSup = officers["DL-SUP-001"];
    const mumInv1 = officers["MH-INV-001"];
    const mumInv2 = officers["MH-INV-002"];
    const mumSup = officers["MH-SUP-001"];
    const sysAdmin = officers["SYS-ADM-001"];

    // ── 3. Cases (9 connected synthetic cases across Delhi & Mumbai) ──────────
    console.log("[3/9] Seeding 9 synthetic cases, assignments & status histories...");
    const casesSpec = [
      {
        id: "demo-case-dl-01",
        caseNumber: "DEMO-DL-2026-001",
        incidentType: "Task_Scam",
        complainantName: "Ananya Chatterjee (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "OPEN",
        amountDefrauded: 485000,
        firNumber: "DEMO-FIR-DL-101/2026",
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        officerObj: delInv1,
        supervisorObj: delSup,
        description: "Synthetic demo case: Prepaid hotel-rating task fraud operated via Telegram channels and mule UPI handles.",
        createdAt: daysAgo(1, 11),
      },
      {
        id: "demo-case-dl-02",
        caseNumber: "DEMO-DL-2026-002",
        incidentType: "Investment_Fraud",
        complainantName: "Rajeshwar Bansal (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "UNDER_INQUIRY",
        amountDefrauded: 1850000,
        firNumber: "DEMO-FIR-DL-102/2026",
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        officerObj: delInv1,
        supervisorObj: delSup,
        description: "Synthetic demo case: Fraudulent institutional IPO trading app directing funds to layered shell bank accounts.",
        createdAt: daysAgo(4, 14),
      },
      {
        id: "demo-case-dl-03",
        caseNumber: "DEMO-DL-2026-003",
        incidentType: "Digital_Arrest",
        complainantName: "Dr. Nirmala Iyer (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "UNDER_INQUIRY",
        amountDefrauded: 1240000,
        firNumber: "DEMO-FIR-DL-103/2026",
        officerName: delInv2.name,
        officerBadge: delInv2.badgeNumber,
        officerObj: delInv2,
        supervisorObj: delSup,
        description: "Synthetic demo case: VoIP impersonation claiming seized courier parcel and coercing RTGS escrow transfer.",
        createdAt: daysAgo(8, 9),
      },
      {
        id: "demo-case-dl-04",
        caseNumber: "DEMO-DL-2026-004",
        incidentType: "KYC_Freeze",
        complainantName: "Sandeep Khurana (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "CHARGESHEETED",
        amountDefrauded: 310000,
        firNumber: "DEMO-FIR-DL-104/2026",
        officerName: delInv2.name,
        officerBadge: delInv2.badgeNumber,
        officerObj: delInv2,
        supervisorObj: delSup,
        description: "Synthetic demo case: SMS phishing link simulating bank KYC suspension to harvest netbanking credentials.",
        createdAt: daysAgo(13, 16),
      },
      {
        id: "demo-case-dl-05",
        caseNumber: "DEMO-DL-2026-005",
        incidentType: "Romance_Scam",
        complainantName: "Neha Kapoor (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "OPEN",
        amountDefrauded: 620000,
        firNumber: "DEMO-FIR-DL-105/2026",
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        officerObj: delInv1,
        supervisorObj: delSup,
        description: "Synthetic demo case: Social-engineering customs fee extortion sharing UPI payout infrastructure.",
        createdAt: daysAgo(19, 12),
      },
      {
        id: "demo-case-dl-06",
        caseNumber: "DEMO-DL-2026-006",
        incidentType: "Task_Scam",
        complainantName: "Harshvardhan Malhotra (Demo)",
        jurisdiction: "Delhi NCR",
        departmentId: deptDelhi.id,
        status: "CLOSED",
        amountDefrauded: 195000,
        firNumber: "DEMO-FIR-DL-106/2026",
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        officerObj: delInv1,
        supervisorObj: delSup,
        description: "Synthetic demo case: Concluded e-commerce review rebate fraud with frozen mule account recovery.",
        createdAt: daysAgo(25, 10),
      },
      {
        id: "demo-case-mh-01",
        caseNumber: "DEMO-MH-2026-001",
        incidentType: "Investment_Fraud",
        complainantName: "Prakash Sawant (Demo)",
        jurisdiction: "Mumbai",
        departmentId: deptMumbai.id,
        status: "OPEN",
        amountDefrauded: 2400000,
        firNumber: "DEMO-FIR-MH-201/2026",
        officerName: mumInv1.name,
        officerBadge: mumInv1.badgeNumber,
        officerObj: mumInv1,
        supervisorObj: mumSup,
        description: "Synthetic demo case: High-value forex syndicate sharing recruiter phone numbers with Delhi-NCR ring.",
        createdAt: daysAgo(2, 15),
      },
      {
        id: "demo-case-mh-02",
        caseNumber: "DEMO-MH-2026-002",
        incidentType: "Digital_Arrest",
        complainantName: "Shalini Gokhale (Demo)",
        jurisdiction: "Mumbai",
        departmentId: deptMumbai.id,
        status: "UNDER_INQUIRY",
        amountDefrauded: 950000,
        firNumber: "DEMO-FIR-MH-202/2026",
        officerName: mumInv2.name,
        officerBadge: mumInv2.badgeNumber,
        officerObj: mumInv2,
        supervisorObj: mumSup,
        description: "Synthetic demo case: Video-call extortion ring routing victim transfers through shared mule UPI handles.",
        createdAt: daysAgo(10, 11),
      },
      {
        id: "demo-case-mh-03",
        caseNumber: "DEMO-MH-2026-003",
        incidentType: "KYC_Freeze",
        complainantName: "Nikhil Tendulkar (Demo)",
        jurisdiction: "Mumbai",
        departmentId: deptMumbai.id,
        status: "CHARGESHEETED",
        amountDefrauded: 420000,
        firNumber: "DEMO-FIR-MH-203/2026",
        officerName: mumInv1.name,
        officerBadge: mumInv1.badgeNumber,
        officerObj: mumInv1,
        supervisorObj: mumSup,
        description: "Synthetic demo case: SIM-swap & corporate KYC hijacking case ready for judicial filing.",
        createdAt: daysAgo(17, 13),
      },
    ];

    const casesByNumber = {};
    for (const c of casesSpec) {
      const createdCase = await prisma.case.create({
        data: {
          id: c.id,
          caseNumber: c.caseNumber,
          incidentType: c.incidentType,
          complainantName: c.complainantName,
          jurisdiction: c.jurisdiction,
          departmentId: c.departmentId,
          status: c.status,
          amountDefrauded: c.amountDefrauded,
          firNumber: c.firNumber,
          officerName: c.officerName,
          officerBadge: c.officerBadge,
          description: c.description,
          createdAt: c.createdAt,
          updatedAt: c.createdAt,
        },
      });
      casesByNumber[c.caseNumber] = createdCase;

      await prisma.caseAssignmentHistory.create({
        data: {
          caseId: createdCase.id,
          officerId: c.officerObj.id,
          officerName: c.officerObj.name,
          officerBadge: c.officerObj.badgeNumber,
          departmentId: c.departmentId,
          assignedById: c.supervisorObj.id,
          assignedByName: c.supervisorObj.name,
          assignedByBadge: c.supervisorObj.badgeNumber,
          assignmentType: "PRIMARY",
          status: "ACTIVE",
          reason: "Initial case allocation to investigating officer",
          assignedAt: c.createdAt,
        },
      });

      await prisma.caseStatusHistory.create({
        data: {
          caseId: createdCase.id,
          fromStatus: "OPEN",
          toStatus: "OPEN",
          changedById: c.officerObj.id,
          changedByName: c.officerObj.name,
          changedByBadge: c.officerObj.badgeNumber,
          departmentId: c.departmentId,
          reason: "Case registered in Rakshak demo console",
          changedAt: c.createdAt,
        },
      });

      if (c.status !== "OPEN") {
        await prisma.caseStatusHistory.create({
          data: {
            caseId: createdCase.id,
            fromStatus: "OPEN",
            toStatus: "UNDER_INQUIRY",
            changedById: c.officerObj.id,
            changedByName: c.officerObj.name,
            changedByBadge: c.officerObj.badgeNumber,
            departmentId: c.departmentId,
            reason: "Forensic investigation initiated",
            changedAt: new Date(c.createdAt.getTime() + 3600 * 1000),
          },
        });
      }

      if (c.status === "CHARGESHEETED" || c.status === "CLOSED") {
        await prisma.caseStatusHistory.create({
          data: {
            caseId: createdCase.id,
            fromStatus: "UNDER_INQUIRY",
            toStatus: c.status,
            changedById: c.officerObj.id,
            changedByName: c.officerObj.name,
            changedByBadge: c.officerObj.badgeNumber,
            departmentId: c.departmentId,
            reason:
              c.status === "CHARGESHEETED"
                ? "Supervisor approved chargesheet readiness"
                : "Supervisor approved case closure after asset freeze",
            approvedBy: `${c.supervisorObj.name} (${c.supervisorObj.badgeNumber})`,
            changedAt: new Date(c.createdAt.getTime() + 7200 * 1000),
          },
        });
      }
    }

    // Active Cross-Department Access Grant (Mumbai -> Delhi Investigator on DEMO-MH-2026-001)
    await prisma.accessGrant.create({
      data: {
        id: "demo-grant-cross-01",
        granteeOfficerId: delInv1.id,
        granteeDepartmentId: deptDelhi.id,
        targetDepartmentId: deptMumbai.id,
        targetCaseId: casesByNumber["DEMO-MH-2026-001"].id,
        scope: "CASE_READ",
        grantedByOfficerId: mumSup.id,
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        status: "ACTIVE",
        reason: "Joint Delhi-Mumbai taskforce access for shared syndicate phone trace",
      },
    });

    // ── 4. Evidence (18 synthetic items written to uploads/synthetic_demo_presentation) ──
    console.log("[4/9] Writing 18 synthetic evidence exhibits & custody chains...");
    const evidenceSpecs = [
      // Delhi (12 exhibits across Document, Image, Video, Audio, Chat/Financial/Email)
      {
        id: "demo-evi-01",
        caseNumber: "DEMO-DL-2026-001",
        fileName: "demo_telegram_task_chat.txt",
        fileType: "TXT",
        mimeType: "text/plain",
        category: "CHAT",
        custodian: delInv1,
        uploadedAt: daysAgo(1, 12),
        buffer: Buffer.from(
          "SYNTHETIC DEMO TELEGRAM EXPORT [DEMO-DL-2026-001]\n" +
            "[2026-11-20T09:14:00Z] Handler Vikrant Solanki (+919811000901): Welcome to Apex Digital Rewards Pvt Ltd.\n" +
            "[2026-11-20T09:22:00Z] Handler (+919820000902): Transfer INR 485000 to UPI apex.rewards.demo@ybl\n" +
            "[2026-11-20T09:30:00Z] Portal: https://demo-task-bonus-portal.example/checkin\n",
          "utf8"
        ),
        ocrText:
          "Handler Vikrant Solanki +919811000901 Apex Digital Rewards Pvt Ltd UPI apex.rewards.demo@ybl backup +919820000902",
      },
      {
        id: "demo-evi-02",
        caseNumber: "DEMO-DL-2026-001",
        fileName: "demo_upi_payment_receipt.png",
        fileType: "PNG",
        mimeType: "image/png",
        category: "CRIME_SCENE_PHOTO",
        custodian: delInv1,
        uploadedAt: daysAgo(1, 13),
        buffer: buildSyntheticPng("DEMO-DL-2026-001-UPI-RECEIPT"),
        ocrText: "UPI Ref 631984720112 Paid to apex.rewards.demo@ybl Amount INR 485000",
      },
      {
        id: "demo-evi-03",
        caseNumber: "DEMO-DL-2026-002",
        fileName: "demo_ipo_ledger_statement.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "DOCUMENT",
        custodian: delInv1,
        uploadedAt: daysAgo(4, 15),
        buffer: buildSyntheticPdf(
          "DEMO-DL-2026-002-LEDGER",
          "Meridian FinServe Gateway Account 99887766554401 IFSC DEMO0001421 Beneficiary Karanveer Gill +919811000901"
        ),
        ocrText:
          "Meridian FinServe Gateway Account 99887766554401 IFSC DEMO0001421 Karanveer Gill +919811000901",
      },
      {
        id: "demo-evi-04",
        caseNumber: "DEMO-DL-2026-002",
        fileName: "demo_atm_cashout_cctv.mp4",
        fileType: "MP4",
        mimeType: "video/mp4",
        category: "VIDEO",
        custodian: delInv1,
        uploadedAt: daysAgo(3, 11),
        buffer: buildSyntheticMp4("DEMO-DL-2026-002-ATM-CCTV"),
        ocrText: "CCTV Frame Timestamp 2026-11-18T16:40:00Z ATM Kiosk Connaught Place Demo",
      },
      {
        id: "demo-evi-05",
        caseNumber: "DEMO-DL-2026-002",
        fileName: "demo_mule_settlement_trail.csv",
        fileType: "CSV",
        mimeType: "text/csv",
        category: "UPI_FINANCIAL",
        custodian: delInv1,
        uploadedAt: daysAgo(3, 15),
        buffer: Buffer.from(
          "tx_id,account,ifsc,phone,amount_inr\nDEMO-TX-901,99887766554401,DEMO0001421,+919811000901,1850000\n",
          "utf8"
        ),
        ocrText: "DEMO-TX-901 Account 99887766554401 IFSC DEMO0001421 +919811000901 INR 1850000",
      },
      {
        id: "demo-evi-06",
        caseNumber: "DEMO-DL-2026-003",
        fileName: "demo_vishing_extortion_call.wav",
        fileType: "WAV",
        mimeType: "audio/wav",
        category: "CALL_LOG",
        custodian: delInv2,
        uploadedAt: daysAgo(7, 10),
        buffer: buildSyntheticWav("DEMO-DL-2026-003-CALL"),
        ocrText: "Transcript: Caller Raghavendra Rao demanded escrow transfer to account 99887766554401",
      },
      {
        id: "demo-evi-07",
        caseNumber: "DEMO-DL-2026-003",
        fileName: "demo_skype_warrant_screen.png",
        fileType: "PNG",
        mimeType: "image/png",
        category: "CRIME_SCENE_PHOTO",
        custodian: delInv2,
        uploadedAt: daysAgo(7, 14),
        buffer: buildSyntheticPng("DEMO-DL-2026-003-WARRANT"),
        ocrText: "Synthetic forged warrant notice from demo-task-bonus-portal.example",
      },
      {
        id: "demo-evi-08",
        caseNumber: "DEMO-DL-2026-003",
        fileName: "demo_rtgs_escrow_memo.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "DOCUMENT",
        custodian: delInv2,
        uploadedAt: daysAgo(6, 16),
        buffer: buildSyntheticPdf(
          "DEMO-DL-2026-003-RTGS",
          "RTGS Transfer INR 1240000 to Account 99887766554401 Meridian FinServe Gateway"
        ),
        ocrText: "RTGS Transfer Account 99887766554401 Meridian FinServe Gateway INR 1240000",
      },
      {
        id: "demo-evi-09",
        caseNumber: "DEMO-DL-2026-004",
        fileName: "demo_kyc_phishing_notice.eml",
        fileType: "EML",
        mimeType: "message/rfc822",
        category: "EMAIL",
        custodian: delInv2,
        uploadedAt: daysAgo(12, 11),
        buffer: Buffer.from(
          "From: alerts@demo-task-bonus-portal.example\nSubject: Demo KYC Verification Required\n\nVisit https://demo-task-bonus-portal.example/kyc\n",
          "utf8"
        ),
        ocrText: "From alerts@demo-task-bonus-portal.example Domain demo-task-bonus-portal.example",
      },
      {
        id: "demo-evi-10",
        caseNumber: "DEMO-DL-2026-004",
        fileName: "demo_isp_session_report.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "DOCUMENT",
        custodian: delInv2,
        uploadedAt: daysAgo(11, 15),
        buffer: buildSyntheticPdf(
          "DEMO-DL-2026-004-ISP",
          "DNS query log resolving demo-task-bonus-portal.example from IP 198.51.100.44"
        ),
        ocrText: "Domain demo-task-bonus-portal.example IP 198.51.100.44",
      },
      {
        id: "demo-evi-11",
        caseNumber: "DEMO-DL-2026-005",
        fileName: "demo_romance_chat_extract.txt",
        fileType: "TXT",
        mimeType: "text/plain",
        category: "CHAT",
        custodian: delInv1,
        uploadedAt: daysAgo(18, 10),
        buffer: Buffer.from(
          "SYNTHETIC DEMO CHAT [DEMO-DL-2026-005]\nPay customs clearance INR 620000 to apex.rewards.demo@ybl\n",
          "utf8"
        ),
        ocrText: "Customs clearance INR 620000 to UPI apex.rewards.demo@ybl",
      },
      {
        id: "demo-evi-12",
        caseNumber: "DEMO-DL-2026-006",
        fileName: "demo_closure_bank_freeze_order.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "DOCUMENT",
        custodian: delInv1,
        uploadedAt: daysAgo(24, 14),
        buffer: buildSyntheticPdf(
          "DEMO-DL-2026-006-FREEZE",
          "Lien order confirmed on synthetic mule wallet demo.rebate@ybl for INR 195000"
        ),
        ocrText: "Lien order confirmed demo.rebate@ybl INR 195000",
      },
      // Mumbai (6 exhibits)
      {
        id: "demo-evi-13",
        caseNumber: "DEMO-MH-2026-001",
        fileName: "demo_forex_onboarding_deck.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "DOCUMENT",
        custodian: mumInv1,
        uploadedAt: daysAgo(2, 16),
        buffer: buildSyntheticPdf(
          "DEMO-MH-2026-001-FOREX",
          "Forex desk recruiter +919820000902 UPI k.gill.mule@okaxis Karanveer Gill"
        ),
        ocrText: "Recruiter +919820000902 UPI k.gill.mule@okaxis Karanveer Gill",
      },
      {
        id: "demo-evi-14",
        caseNumber: "DEMO-MH-2026-001",
        fileName: "demo_qr_deposit_screenshot.png",
        fileType: "PNG",
        mimeType: "image/png",
        category: "CRIME_SCENE_PHOTO",
        custodian: mumInv1,
        uploadedAt: daysAgo(2, 17),
        buffer: buildSyntheticPng("DEMO-MH-2026-001-QR"),
        ocrText: "QR Merchant k.gill.mule@okaxis INR 2400000",
      },
      {
        id: "demo-evi-15",
        caseNumber: "DEMO-MH-2026-002",
        fileName: "demo_threat_voip_recording.wav",
        fileType: "WAV",
        mimeType: "audio/wav",
        category: "AUDIO",
        custodian: mumInv2,
        uploadedAt: daysAgo(9, 12),
        buffer: buildSyntheticWav("DEMO-MH-2026-002-VOIP"),
        ocrText: "VoIP recording instructing transfer to k.gill.mule@okaxis",
      },
      {
        id: "demo-evi-16",
        caseNumber: "DEMO-MH-2026-002",
        fileName: "demo_skype_extortion_clip.mp4",
        fileType: "MP4",
        mimeType: "video/mp4",
        category: "VIDEO",
        custodian: mumInv2,
        uploadedAt: daysAgo(9, 15),
        buffer: buildSyntheticMp4("DEMO-MH-2026-002-SKYPE"),
        ocrText: "Screen capture of fake studio police backdrop",
      },
      {
        id: "demo-evi-17",
        caseNumber: "DEMO-MH-2026-003",
        fileName: "demo_sim_swap_kyc_form.pdf",
        fileType: "PDF",
        mimeType: "application/pdf",
        category: "IDENTITY_DATA",
        custodian: mumInv1,
        uploadedAt: daysAgo(16, 11),
        buffer: buildSyntheticPdf(
          "DEMO-MH-2026-003-SIM",
          "Forged synthetic KYC dossier linked to telecom dealer SIM-9910"
        ),
        ocrText: "Forged synthetic KYC dossier telecom dealer SIM-9910",
      },
      {
        id: "demo-evi-18",
        caseNumber: "DEMO-MH-2026-003",
        fileName: "demo_branch_cctv_grab.png",
        fileType: "PNG",
        mimeType: "image/png",
        category: "CRIME_SCENE_PHOTO",
        custodian: mumInv1,
        uploadedAt: daysAgo(16, 14),
        buffer: buildSyntheticPng("DEMO-MH-2026-003-CCTV"),
        ocrText: "Bank branch lobby capture timestamp 2026-11-08",
      },
    ];

    const evidenceById = {};
    const artifactByEvidenceId = {};

    for (const ev of evidenceSpecs) {
      const targetCase = casesByNumber[ev.caseNumber];
      const digest = sha256(ev.buffer);
      const writeRes = await storage.storeEvidence(ev.buffer, digest);

      const createdEv = await prisma.evidence.create({
        data: {
          id: ev.id,
          caseId: targetCase.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          mimeType: ev.mimeType,
          fileSize: ev.buffer.length,
          sha256Hash: digest,
          clientHash: digest,
          storagePath: writeRes.storagePath,
          evidenceCategory: ev.category,
          status: "ACCEPTED",
          currentCustodianId: ev.custodian.id,
          uploadedAt: ev.uploadedAt,
          version: 1,
        },
      });
      evidenceById[ev.id] = createdEv;

      // Chained custody events via actual custodyChain service
      await appendCustodyEventAsync(
        {
          evidenceId: createdEv.id,
          eventType: "INTAKE_UPLOAD",
          actor: `${ev.custodian.name} (${ev.custodian.badgeNumber})`,
          action: `Synthetic exhibit ingested: ${ev.fileName}`,
          result: "SUCCESS",
          timestamp: ev.uploadedAt,
          details: { caseNumber: ev.caseNumber, storagePath: writeRes.storagePath },
        },
        prisma
      );

      await appendCustodyEventAsync(
        {
          evidenceId: createdEv.id,
          eventType: "HASH_VERIFIED",
          actor: "Cryptographic Verification Subsystem",
          action: `Dual SHA-256 verification passed (${digest.slice(0, 12)}...)`,
          result: "VERIFIED",
          timestamp: new Date(ev.uploadedAt.getTime() + 5000),
          details: { algorithm: "SHA-256", sha256Hash: digest },
        },
        prisma
      );

      // ExtractedTextArtifact
      const artifact = await prisma.extractedTextArtifact.create({
        data: {
          id: `art-${ev.id}`,
          evidenceId: createdEv.id,
          caseId: targetCase.id,
          sourceHash: digest,
          mimeType: ev.mimeType,
          fileName: ev.fileName,
          engine: ev.fileType === "PNG" ? "TESSERACT_OCR_V5" : ev.fileType === "PDF" ? "PDF_PARSE_V1" : "TEXT_PARSER",
          engineVersion: "3.0.0-demo",
          status: "COMPLETED",
          confidence: 94.5,
          charCount: ev.ocrText.length,
          lineCount: 1,
          pageCount: 1,
          rawText: ev.ocrText,
          processingTimeMs: 42,
          isIntegrityVerified: true,
          departmentId: targetCase.departmentId,
          extractedAt: new Date(ev.uploadedAt.getTime() + 10000),
        },
      });
      artifactByEvidenceId[ev.id] = artifact;
    }

    // ── 5. Extracted Facts & Human Review History ─────────────────────────────
    console.log("[5/9] Seeding extracted facts with PENDING, ACCEPTED, and CORRECTED reviews...");
    const factsSpec = [
      {
        id: "demo-fact-01",
        evidenceId: "demo-evi-01",
        factAssertion: "Suspect handler phone number extracted from Telegram export",
        entityType: "PHONE",
        rawValue: "9811000901",
        normalizedValue: "+919811000901",
        confidence: 0.96,
        reviewDecision: "ACCEPT",
        reviewer: delInv1,
        rationale: "Corroborated with telecom subscriber sheet in DEMO-DL-2026-001",
      },
      {
        id: "demo-fact-02",
        evidenceId: "demo-evi-01",
        factAssertion: "Mule UPI handle collected from task portal payment chat",
        entityType: "UPI",
        rawValue: "apex.rewards.demo@ybl",
        normalizedValue: "apex.rewards.demo@ybl",
        confidence: 0.98,
        reviewDecision: "ACCEPT",
        reviewer: delSup,
        rationale: "Verified against bank UPI settlement logs",
      },
      {
        id: "demo-fact-03",
        evidenceId: "demo-evi-01",
        factAssertion: "Person of interest alias identified in chat header",
        entityType: "NAME",
        rawValue: "Vikrant Solanki",
        normalizedValue: "Vikrant Solanki (Demo Handler)",
        confidence: 0.89,
        reviewDecision: null, // PENDING_REVIEW
      },
      {
        id: "demo-fact-04",
        evidenceId: "demo-evi-03",
        factAssertion: "Mule bank account number parsed from PDF statement",
        entityType: "ACCOUNT",
        rawValue: "9988776655440l",
        normalizedValue: "9988776655440l",
        confidence: 0.84,
        reviewDecision: "CORRECT",
        correctedValue: "99887766554401",
        reviewer: delInv1,
        rationale: "Corrected trailing OCR glyph 'l' to digit '1' from PDF table scan",
      },
      {
        id: "demo-fact-05",
        evidenceId: "demo-evi-03",
        factAssertion: "Beneficiary person of interest identified on shell account",
        entityType: "NAME",
        rawValue: "Karanveer Gill",
        normalizedValue: "Karanveer Gill (Demo Mule Operator)",
        confidence: 0.94,
        reviewDecision: "ACCEPT",
        reviewer: delSup,
        rationale: "Confirmed account holder name in KYC annexure",
      },
      {
        id: "demo-fact-06",
        evidenceId: "demo-evi-03",
        factAssertion: "Shell gateway organization referenced in settlement memo",
        entityType: "ORGANIZATION",
        rawValue: "Meridian FinServe Gateway",
        normalizedValue: "Meridian FinServe Gateway (Demo Org)",
        confidence: 0.91,
        reviewDecision: null, // PENDING_REVIEW
      },
      {
        id: "demo-fact-07",
        evidenceId: "demo-evi-06",
        factAssertion: "Impersonator caller persona noted in vishing transcript",
        entityType: "NAME",
        rawValue: "Raghavendra Rao",
        normalizedValue: "Raghavendra Rao (Demo Caller)",
        confidence: 0.87,
        reviewDecision: null, // PENDING_REVIEW
      },
      {
        id: "demo-fact-08",
        evidenceId: "demo-evi-09",
        factAssertion: "Phishing and task-portal domain extracted from email headers",
        entityType: "DOMAIN",
        rawValue: "demo-task-bonus-portal.example",
        normalizedValue: "demo-task-bonus-portal.example",
        confidence: 0.97,
        reviewDecision: "ACCEPT",
        reviewer: delInv2,
        rationale: "Domain matches DNS resolution logs in DEMO-DL-2026-004",
      },
      {
        id: "demo-fact-09",
        evidenceId: "demo-evi-13",
        factAssertion: "Cross-jurisdiction recruiter phone number in forex pitch",
        entityType: "PHONE",
        rawValue: "9820000902",
        normalizedValue: "+919820000902",
        confidence: 0.93,
        reviewDecision: "ACCEPT",
        reviewer: mumInv1,
        rationale: "Verified in Mumbai forex onboarding brochure",
      },
      {
        id: "demo-fact-10",
        evidenceId: "demo-evi-14",
        factAssertion: "Mumbai mule UPI handle captured from QR payment receipt",
        entityType: "UPI",
        rawValue: "k.gill.mule@okaxis",
        normalizedValue: "k.gill.mule@okaxis",
        confidence: 0.95,
        reviewDecision: "CORRECT",
        correctedValue: "k.gill.mule@okaxis",
        reviewer: mumSup,
        rationale: "Confirmed exact PSP suffix @okaxis after QR verification",
      },
    ];

    for (const f of factsSpec) {
      const ev = evidenceById[f.evidenceId];
      const art = artifactByEvidenceId[f.evidenceId];
      await prisma.extractedFact.create({
        data: {
          id: f.id,
          evidenceId: ev.id,
          caseId: ev.caseId,
          artifactId: art.id,
          factAssertion: f.factAssertion,
          entityType: f.entityType,
          rawValue: f.rawValue,
          normalizedValue: f.normalizedValue,
          confidence: f.confidence,
          sourceHash: ev.sha256Hash,
          verificationStatus: f.reviewDecision ? "VERIFIED" : "UNVERIFIED",
          reviewStatus: "PENDING_REVIEW",
          extractedAt: new Date(ev.uploadedAt.getTime() + 15000),
        },
      });

      if (f.reviewDecision) {
        await submitFactReviewAsync(
          f.id,
          {
            reviewerId: f.reviewer.id,
            reviewerName: f.reviewer.name,
            reviewerBadge: f.reviewer.badgeNumber,
            reviewerRole: f.reviewer.role,
            reviewerDeptId: f.reviewer.departmentId,
            decision: f.reviewDecision,
            correctedValue: f.correctedValue,
            rationale: f.rationale,
          },
          prisma
        );
      }
    }

    // ── 6. Entities & Cross-Case Intelligence (via entityResolution + entityReview) ──
    console.log("[6/9] Seeding synthetic entities, entity resolution & confirmed links...");
    const caseEntitiesSpec = [
      // Persons & Organizations of Interest
      { id: "demo-ce-01", caseNumber: "DEMO-DL-2026-001", entityType: "NAME", rawValue: "Vikrant Solanki", normalizedValue: "Vikrant Solanki (Demo Handler)" },
      { id: "demo-ce-02", caseNumber: "DEMO-DL-2026-001", entityType: "ORGANIZATION", rawValue: "Apex Digital Rewards Pvt Ltd", normalizedValue: "Apex Digital Rewards Pvt Ltd (Demo Shell)" },
      { id: "demo-ce-03", caseNumber: "DEMO-DL-2026-002", entityType: "NAME", rawValue: "Karanveer Gill", normalizedValue: "Karanveer Gill (Demo Mule Operator)" },
      { id: "demo-ce-04", caseNumber: "DEMO-DL-2026-002", entityType: "ORGANIZATION", rawValue: "Meridian FinServe Gateway", normalizedValue: "Meridian FinServe Gateway (Demo Org)" },
      { id: "demo-ce-05", caseNumber: "DEMO-DL-2026-003", entityType: "NAME", rawValue: "Raghavendra Rao", normalizedValue: "Raghavendra Rao (Demo Caller)" },
      { id: "demo-ce-06", caseNumber: "DEMO-MH-2026-001", entityType: "NAME", rawValue: "Karanveer Gill", normalizedValue: "Karanveer Gill (Demo Mule Operator)" },
      // Shared Syndicate Identifiers
      { id: "demo-ce-07", caseNumber: "DEMO-DL-2026-001", entityType: "PHONE", rawValue: "9811000901", normalizedValue: "+919811000901" },
      { id: "demo-ce-08", caseNumber: "DEMO-DL-2026-002", entityType: "PHONE", rawValue: "9811000901", normalizedValue: "+919811000901" },
      { id: "demo-ce-09", caseNumber: "DEMO-DL-2026-001", entityType: "UPI", rawValue: "apex.rewards.demo@ybl", normalizedValue: "apex.rewards.demo@ybl" },
      { id: "demo-ce-10", caseNumber: "DEMO-DL-2026-005", entityType: "UPI", rawValue: "apex.rewards.demo@ybl", normalizedValue: "apex.rewards.demo@ybl" },
      { id: "demo-ce-11", caseNumber: "DEMO-DL-2026-002", entityType: "ACCOUNT", rawValue: "99887766554401", normalizedValue: "99887766554401" },
      { id: "demo-ce-12", caseNumber: "DEMO-DL-2026-003", entityType: "ACCOUNT", rawValue: "99887766554401", normalizedValue: "99887766554401" },
      { id: "demo-ce-13", caseNumber: "DEMO-DL-2026-003", entityType: "DOMAIN", rawValue: "demo-task-bonus-portal.example", normalizedValue: "demo-task-bonus-portal.example" },
      { id: "demo-ce-14", caseNumber: "DEMO-DL-2026-004", entityType: "DOMAIN", rawValue: "demo-task-bonus-portal.example", normalizedValue: "demo-task-bonus-portal.example" },
      { id: "demo-ce-15", caseNumber: "DEMO-DL-2026-001", entityType: "PHONE", rawValue: "9820000902", normalizedValue: "+919820000902" },
      { id: "demo-ce-16", caseNumber: "DEMO-MH-2026-001", entityType: "PHONE", rawValue: "9820000902", normalizedValue: "+919820000902" },
      { id: "demo-ce-17", caseNumber: "DEMO-MH-2026-001", entityType: "UPI", rawValue: "k.gill.mule@okaxis", normalizedValue: "k.gill.mule@okaxis" },
      { id: "demo-ce-18", caseNumber: "DEMO-MH-2026-002", entityType: "UPI", rawValue: "k.gill.mule@okaxis", normalizedValue: "k.gill.mule@okaxis" },
    ];

    const ceById = {};
    for (const ce of caseEntitiesSpec) {
      const targetCase = casesByNumber[ce.caseNumber];
      ceById[ce.id] = await prisma.caseEntity.create({
        data: {
          id: ce.id,
          caseId: targetCase.id,
          entityType: ce.entityType,
          rawValue: ce.rawValue,
          normalizedValue: ce.normalizedValue,
          firstSeenAt: targetCase.createdAt,
        },
      });
    }

    // Create candidate links through the actual entityResolution service
    const linkPairs = [
      {
        src: ceById["demo-ce-07"],
        tgt: ceById["demo-ce-08"],
        srcCase: casesByNumber["DEMO-DL-2026-001"],
        tgtCase: casesByNumber["DEMO-DL-2026-002"],
        srcEvId: "demo-evi-01",
        tgtEvId: "demo-evi-03",
        review: { officer: delInv1, toStatus: "CONFIRMED", rationale: "Confirmed shared handler phone +919811000901 across Telegram export and IPO ledger" },
      },
      {
        src: ceById["demo-ce-09"],
        tgt: ceById["demo-ce-10"],
        srcCase: casesByNumber["DEMO-DL-2026-001"],
        tgtCase: casesByNumber["DEMO-DL-2026-005"],
        srcEvId: "demo-evi-01",
        tgtEvId: "demo-evi-11",
        review: { officer: delSup, toStatus: "CONFIRMED", rationale: "Supervisor confirmed identical mule UPI VPA apex.rewards.demo@ybl across two scams" },
      },
      {
        src: ceById["demo-ce-11"],
        tgt: ceById["demo-ce-12"],
        srcCase: casesByNumber["DEMO-DL-2026-002"],
        tgtCase: casesByNumber["DEMO-DL-2026-003"],
        srcEvId: "demo-evi-03",
        tgtEvId: "demo-evi-08",
        review: null, // Remains CANDIDATE for live review demonstration
      },
      {
        src: ceById["demo-ce-13"],
        tgt: ceById["demo-ce-14"],
        srcCase: casesByNumber["DEMO-DL-2026-003"],
        tgtCase: casesByNumber["DEMO-DL-2026-004"],
        srcEvId: "demo-evi-07",
        tgtEvId: "demo-evi-09",
        review: { officer: delInv2, toStatus: "UNDER_REVIEW", rationale: "DNS WHOIS correlation in progress between extortion portal and phishing notice" },
      },
      {
        src: ceById["demo-ce-15"],
        tgt: ceById["demo-ce-16"],
        srcCase: casesByNumber["DEMO-DL-2026-001"],
        tgtCase: casesByNumber["DEMO-MH-2026-001"],
        srcEvId: "demo-evi-01",
        tgtEvId: "demo-evi-13",
        review: null, // Cross-department CANDIDATE
      },
      {
        src: ceById["demo-ce-17"],
        tgt: ceById["demo-ce-18"],
        srcCase: casesByNumber["DEMO-MH-2026-001"],
        tgtCase: casesByNumber["DEMO-MH-2026-002"],
        srcEvId: "demo-evi-13",
        tgtEvId: "demo-evi-15",
        review: { officer: mumInv1, toStatus: "CONFIRMED", rationale: "Confirmed shared Mumbai mule UPI VPA k.gill.mule@okaxis across forex & VoIP cases" },
      },
    ];

    for (const pair of linkPairs) {
      const evalRes = evaluateCandidateLink({
        sourceCaseId: pair.srcCase.id,
        sourceCaseNumber: pair.srcCase.caseNumber,
        targetCaseId: pair.tgtCase.id,
        targetCaseNumber: pair.tgtCase.caseNumber,
        sourceEntityId: pair.src.id,
        targetEntityId: pair.tgt.id,
        entityType: pair.src.entityType,
        rawValueA: pair.src.rawValue,
        rawValueB: pair.tgt.rawValue,
      });
      if (!evalRes.isMatch) {
        throw new Error(`Entity resolution failed to match ${pair.src.normalizedValue}: ${evalRes.explanation}`);
      }

      const createdLink = await prisma.entityLink.create({
        data: {
          sourceEntityId: pair.src.id,
          targetEntityId: pair.tgt.id,
          sourceCaseId: evalRes.sourceCaseId,
          targetCaseId: evalRes.targetCaseId,
          sourceEvidenceId: pair.srcEvId,
          targetEvidenceId: pair.tgtEvId,
          entityType: evalRes.entityType,
          normalizedValue: evalRes.normalizedValue,
          linkType: evalRes.linkType,
          matchRule: evalRes.matchRule,
          normalizationVersion: evalRes.normalizationVersion,
          explanation: evalRes.explanation,
          status: "CANDIDATE",
          confidenceCategory: evalRes.confidenceCategory,
          limitations: evalRes.limitations || null,
          isGeneric: evalRes.isGeneric,
          createdBy: "resolver::demo-seeder",
          version: 1,
        },
      });

      if (pair.review) {
        const revRes = await submitEntityLinkReview(prisma, {
          linkId: createdLink.id,
          toStatus: pair.review.toStatus,
          rationale: pair.review.rationale,
          expectedVersion: 1,
          officer: pair.review.officer,
        });
        if (!revRes.success) {
          throw new Error(`EntityLink review failed: ${revRes.error}`);
        }
      }
    }

    // Seed CaseClusters for Graph & Cluster views
    await prisma.caseCluster.create({
      data: {
        id: "demo-cluster-01",
        name: "NCR-Mumbai Apex Mule Syndicate (Demo)",
        theme: "Task_Scam",
        status: "ACTIVE",
        confidence: "CONFIRMED",
        notes: "Synthetic cluster sharing handler phone +919811000901 and UPI apex.rewards.demo@ybl.",
        memberships: {
          create: [
            { caseId: casesByNumber["DEMO-DL-2026-001"].id, reason: "Shared handler phone & UPI VPA" },
            { caseId: casesByNumber["DEMO-DL-2026-002"].id, reason: "Shared handler phone +919811000901" },
            { caseId: casesByNumber["DEMO-DL-2026-005"].id, reason: "Shared mule UPI apex.rewards.demo@ybl" },
          ],
        },
      },
    });
    await prisma.caseCluster.create({
      data: {
        id: "demo-cluster-02",
        name: "Western Financial VoIP Ring (Demo)",
        theme: "Digital_Arrest",
        status: "ACTIVE",
        confidence: "CONFIRMED",
        notes: "Synthetic Mumbai cluster sharing mule UPI k.gill.mule@okaxis.",
        memberships: {
          create: [
            { caseId: casesByNumber["DEMO-MH-2026-001"].id, reason: "Shared UPI k.gill.mule@okaxis" },
            { caseId: casesByNumber["DEMO-MH-2026-002"].id, reason: "Shared UPI k.gill.mule@okaxis" },
          ],
        },
      },
    });

    // ── 7. Timeline Events (Spread over last 26 days for Case Activity Trend) ─
    console.log("[7/9] Seeding forensic timeline events & legal provisions...");
    const timelineSpecs = [
      { id: "demo-tl-01", caseNumber: "DEMO-DL-2026-001", evidenceId: "demo-evi-01", ts: daysAgo(1, 9), sourceType: "WHATSAPP", phase: "CONTACT", desc: "Initial Telegram recruitment pitch received from +919811000901" },
      { id: "demo-tl-02", caseNumber: "DEMO-DL-2026-001", evidenceId: "demo-evi-01", ts: daysAgo(1, 14), sourceType: "WHATSAPP", phase: "TRUST", desc: "Small rebate credited to establish fake task credibility" },
      { id: "demo-tl-03", caseNumber: "DEMO-DL-2026-001", evidenceId: "demo-evi-02", ts: daysAgo(0, 10), sourceType: "RECEIPT", phase: "PAYMENT", desc: "Victim transferred INR 4,85,000 via UPI to apex.rewards.demo@ybl" },
      { id: "demo-tl-04", caseNumber: "DEMO-DL-2026-002", evidenceId: "demo-evi-03", ts: daysAgo(4, 11), sourceType: "SCREENSHOT", phase: "CONTACT", desc: "Synthetic IPO syndicate onboarding invitation captured" },
      { id: "demo-tl-05", caseNumber: "DEMO-DL-2026-002", evidenceId: "demo-evi-05", ts: daysAgo(3, 13), sourceType: "BANK_SMS", phase: "PAYMENT", desc: "RTGS outflow of INR 18,50,000 settled to account 99887766554401" },
      { id: "demo-tl-06", caseNumber: "DEMO-DL-2026-002", evidenceId: "demo-evi-04", ts: daysAgo(2, 16), sourceType: "SCREENSHOT", phase: "SEVERED", desc: "ATM cash withdrawal recorded in CCTV frame post-settlement" },
      { id: "demo-tl-07", caseNumber: "DEMO-DL-2026-003", evidenceId: "demo-evi-06", ts: daysAgo(8, 10), sourceType: "CALL_LOG", phase: "CONTACT", desc: "Vishing call impersonating law enforcement courier desk" },
      { id: "demo-tl-08", caseNumber: "DEMO-DL-2026-003", evidenceId: "demo-evi-07", ts: daysAgo(7, 15), sourceType: "SCREENSHOT", phase: "TRUST", desc: "Forged digital arrest notice displayed over video call" },
      { id: "demo-tl-09", caseNumber: "DEMO-DL-2026-003", evidenceId: "demo-evi-08", ts: daysAgo(6, 12), sourceType: "RECEIPT", phase: "PAYMENT", desc: "Coerced escrow transfer INR 12,40,000 to Meridian FinServe Gateway" },
      { id: "demo-tl-10", caseNumber: "DEMO-DL-2026-004", evidenceId: "demo-evi-09", ts: daysAgo(13, 12), sourceType: "BANK_SMS", phase: "CONTACT", desc: "Phishing KYC notice dispatched from demo-task-bonus-portal.example" },
      { id: "demo-tl-11", caseNumber: "DEMO-DL-2026-004", evidenceId: "demo-evi-10", ts: daysAgo(11, 17), sourceType: "SCREENSHOT", phase: "PAYMENT", desc: "Unauthorized debit INR 3,10,000 traced via ISP session log" },
      { id: "demo-tl-12", caseNumber: "DEMO-DL-2026-005", evidenceId: "demo-evi-11", ts: daysAgo(18, 13), sourceType: "WHATSAPP", phase: "PAYMENT", desc: "Customs clearance transfer INR 6,20,000 to apex.rewards.demo@ybl" },
      { id: "demo-tl-13", caseNumber: "DEMO-DL-2026-006", evidenceId: "demo-evi-12", ts: daysAgo(24, 16), sourceType: "RECEIPT", phase: "SEVERED", desc: "Bank lien confirmed and investigation closed" },
      { id: "demo-tl-14", caseNumber: "DEMO-MH-2026-001", evidenceId: "demo-evi-13", ts: daysAgo(2, 11), sourceType: "SCREENSHOT", phase: "CONTACT", desc: "Forex recruiter +919820000902 initiated onboarding" },
      { id: "demo-tl-15", caseNumber: "DEMO-MH-2026-001", evidenceId: "demo-evi-14", ts: daysAgo(1, 16), sourceType: "RECEIPT", phase: "PAYMENT", desc: "QR deposit INR 24,00,000 routed to k.gill.mule@okaxis" },
      { id: "demo-tl-16", caseNumber: "DEMO-MH-2026-002", evidenceId: "demo-evi-15", ts: daysAgo(9, 13), sourceType: "CALL_LOG", phase: "TRUST", desc: "Recorded VoIP threat call instructing immediate payment" },
      { id: "demo-tl-17", caseNumber: "DEMO-MH-2026-003", evidenceId: "demo-evi-17", ts: daysAgo(16, 12), sourceType: "SCREENSHOT", phase: "CONTACT", desc: "Forged KYC form submitted to telecom outlet" },
    ];

    for (const tl of timelineSpecs) {
      const targetCase = casesByNumber[tl.caseNumber];
      await prisma.timelineEvent.create({
        data: {
          id: tl.id,
          caseId: targetCase.id,
          evidenceId: tl.evidenceId,
          timestamp: tl.ts,
          description: tl.desc,
          sourceType: tl.sourceType,
          phase: tl.phase,
        },
      });
    }

    // Legal Provisions & Mappings
    const provIt66d = await prisma.legalProvision.create({
      data: {
        id: "demo-leg-66d",
        act: "Information Technology Act, 2000",
        actCode: "IT_ACT_2000",
        section: "Section 66D",
        title: "Punishment for cheating by personation by using computer resource",
        description: "Whoever, by means of any communication device or computer resource cheats by personation.",
        offenceCategory: "CYBER_FRAUD",
        cognizable: true,
        bailable: true,
      },
    });
    const provBns318 = await prisma.legalProvision.create({
      data: {
        id: "demo-leg-318",
        act: "Bharatiya Nyaya Sanhita, 2023",
        actCode: "BNS_2023",
        section: "Section 318(4)",
        title: "Cheating and dishonestly inducing delivery of property",
        description: "Dishonest inducement of financial transfers via electronic deception.",
        offenceCategory: "FINANCIAL_FRAUD",
        cognizable: true,
        bailable: false,
      },
    });
    await prisma.caseLegalMapping.createMany({
      data: [
        {
          id: "demo-clm-01",
          caseId: casesByNumber["DEMO-DL-2026-001"].id,
          sectionCode: "IT_ACT_66D",
          act: provIt66d.act,
          section: provIt66d.section,
          description: provIt66d.description,
          relevance: "PRIMARY",
          status: "CONFIRMED",
          rationale: "Telegram impersonation supported by chat export and UPI payment trail",
          reviewerName: delSup.name,
          reviewedAt: daysAgo(0, 12),
        },
        {
          id: "demo-clm-02",
          caseId: casesByNumber["DEMO-DL-2026-002"].id,
          sectionCode: "BNS_318_4",
          act: provBns318.act,
          section: provBns318.section,
          description: provBns318.description,
          relevance: "PRIMARY",
          status: "CONFIRMED",
          rationale: "Fraudulent IPO platform induced INR 18.5L transfer",
          reviewerName: delSup.name,
          reviewedAt: daysAgo(2, 10),
        },
      ],
    });

    // ── 8. Dossiers & Reports (3 dossiers + review workflows + real exports) ──
    console.log("[8/9] Generating 3 synthetic dossiers, supervisor approvals & exports...");

    // Dossier 1: DEMO-DL-2026-002 (GENERATED -> UNDER_REVIEW -> APPROVED -> FINALIZED + exported JSON & TXT)
    const doss1Gen = await assembleInvestigativeDossier(
      casesByNumber["DEMO-DL-2026-002"].id,
      delInv1,
      {
        title: "Forensic Dossier — Synthetic IPO Syndicate (DEMO-DL-2026-002)",
        summary: "Source-attributed investigative dossier compiling ledger facts, custody events, and confirmed phone link.",
      },
      prisma
    );
    if (!doss1Gen.success) throw new Error(`Dossier 1 failed: ${doss1Gen.error}`);

    await submitDossierReview(delInv1, {
      dossierId: doss1Gen.dossier.id,
      toStatus: "UNDER_REVIEW",
      decision: "STATUS_TRANSITION",
      rationale: "Submitting completed IPO fraud dossier for supervisor review.",
    }, prisma);
    await submitDossierReview(delSup, {
      dossierId: doss1Gen.dossier.id,
      toStatus: "APPROVED",
      decision: "APPROVE",
      rationale: "Approved under Section 63 BSA after verifying hash manifest and fact corrections.",
    }, prisma);
    await submitDossierReview(delSup, {
      dossierId: doss1Gen.dossier.id,
      toStatus: "FINALIZED",
      decision: "APPROVE",
      rationale: "Finalized for judicial chargesheet annexure.",
    }, prisma);
    const doss1ExpJson = await exportInvestigativeDossier(doss1Gen.dossier.id, delInv1, "JSON", prisma);
    const doss1ExpTxt = await exportInvestigativeDossier(doss1Gen.dossier.id, delInv1, "TXT", prisma);
    if (!doss1ExpJson.success || !doss1ExpTxt.success) {
      throw new Error("Dossier 1 export failed");
    }

    // Dossier 2: DEMO-DL-2026-001 (GENERATED -> UNDER_REVIEW + exported JSON)
    const doss2Gen = await assembleInvestigativeDossier(
      casesByNumber["DEMO-DL-2026-001"].id,
      delInv1,
      {
        title: "Interim Dossier — Task Scam Telegram Ring (DEMO-DL-2026-001)",
        summary: "Interim dossier linking Telegram handler +919811000901 and UPI apex.rewards.demo@ybl.",
      },
      prisma
    );
    if (!doss2Gen.success) throw new Error(`Dossier 2 failed: ${doss2Gen.error}`);
    await submitDossierReview(delInv1, {
      dossierId: doss2Gen.dossier.id,
      toStatus: "UNDER_REVIEW",
      decision: "STATUS_TRANSITION",
      rationale: "Advancing interim task-scam dossier to supervisor queue.",
    }, prisma);
    await exportInvestigativeDossier(doss2Gen.dossier.id, delInv1, "JSON", prisma);

    // Dossier 3: DEMO-MH-2026-001 (GENERATED + exported TXT)
    const doss3Gen = await assembleInvestigativeDossier(
      casesByNumber["DEMO-MH-2026-001"].id,
      mumInv1,
      {
        title: "Initial Dossier — Mumbai Forex Syndicate (DEMO-MH-2026-001)",
        summary: "Preliminary Mumbai Cyber Crime dossier documenting QR trail and cross-state recruiter lead.",
      },
      prisma
    );
    if (!doss3Gen.success) throw new Error(`Dossier 3 failed: ${doss3Gen.error}`);
    await exportInvestigativeDossier(doss3Gen.dossier.id, mumInv1, "TXT", prisma);

    // GeneratedReport rows backed by actual dossiers
    await prisma.generatedReport.createMany({
      data: [
        {
          id: "demo-rpt-01",
          reportNumber: "DEMO-RPT-2026-001",
          reportType: "SECTION_63_BSA_DOSSIER",
          caseId: casesByNumber["DEMO-DL-2026-002"].id,
          title: doss1Gen.dossier.title,
          generatedBy: delInv1.name,
          officerId: delInv1.id,
          status: "COMPLETED",
          outputFormat: "JSON",
          sectionsIncluded: JSON.stringify(["Case Details", "Evidence Inventory", "Custody Chain", "Confirmed Links"]),
          fileSizeBytes: doss1ExpJson.buffer?.length || 4096,
          metadata: JSON.stringify({
            caseNumber: "DEMO-DL-2026-002",
            dossierNumber: doss1Gen.dossier.dossierNumber,
            artifactHash: doss1ExpJson.artifactHash,
            approvedBy: delSup.name,
          }),
        },
        {
          id: "demo-rpt-02",
          reportNumber: "DEMO-RPT-2026-002",
          reportType: "INTERIM_INTELLIGENCE",
          caseId: casesByNumber["DEMO-DL-2026-001"].id,
          title: doss2Gen.dossier.title,
          generatedBy: delInv1.name,
          officerId: delInv1.id,
          status: "UNDER_REVIEW",
          outputFormat: "JSON",
          sectionsIncluded: JSON.stringify(["Case Details", "Evidence Inventory", "Entity Resolution"]),
          fileSizeBytes: 3200,
          metadata: JSON.stringify({
            caseNumber: "DEMO-DL-2026-001",
            dossierNumber: doss2Gen.dossier.dossierNumber,
          }),
        },
        {
          id: "demo-rpt-03",
          reportNumber: "DEMO-RPT-2026-003",
          reportType: "PRELIMINARY_BRIEF",
          caseId: casesByNumber["DEMO-MH-2026-001"].id,
          title: doss3Gen.dossier.title,
          generatedBy: mumInv1.name,
          officerId: mumInv1.id,
          status: "COMPLETED",
          outputFormat: "TXT",
          sectionsIncluded: JSON.stringify(["Case Details", "Evidence Inventory"]),
          fileSizeBytes: 2800,
          metadata: JSON.stringify({
            caseNumber: "DEMO-MH-2026-001",
            dossierNumber: doss3Gen.dossier.dossierNumber,
          }),
        },
      ],
    });

    // ── 9. Audit Logs (Registration, Assignment, Intake, Fact Correction, Approvals, Exports) ─
    console.log("[9/9] Seeding append-only audit trail events...");
    const auditSpecs = [
      {
        id: "demo-aud-01",
        officerId: delInv1.id,
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        action: "CASE_CREATED",
        module: "Cases",
        targetType: "Case",
        targetId: casesByNumber["DEMO-DL-2026-001"].id,
        details: "Registered synthetic demonstration case DEMO-DL-2026-001",
        result: "SUCCESS",
        timestamp: daysAgo(1, 11),
      },
      {
        id: "demo-aud-02",
        officerId: delSup.id,
        officerName: delSup.name,
        officerBadge: delSup.badgeNumber,
        action: "CASE_ASSIGNED",
        module: "Cases",
        targetType: "Case",
        targetId: casesByNumber["DEMO-DL-2026-002"].id,
        details: "Assigned Inspector Aarav Sharma (DL-CYBER-001) as primary investigator",
        result: "SUCCESS",
        timestamp: daysAgo(4, 14),
      },
      {
        id: "demo-aud-03",
        officerId: delInv1.id,
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        action: "EVIDENCE_INTAKE_VERIFIED",
        module: "Evidence",
        targetType: "Evidence",
        targetId: "demo-evi-03",
        details: "Ingested demo_ipo_ledger_statement.pdf with verified dual SHA-256 checksum",
        result: "SUCCESS",
        timestamp: daysAgo(4, 15),
      },
      {
        id: "demo-aud-04",
        officerId: delInv1.id,
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        action: "FACT_REVIEW_CORRECT",
        module: "Evidence",
        targetType: "ExtractedFact",
        targetId: "demo-fact-04",
        details: "Corrected OCR account number glyph '9988776655440l' -> '99887766554401'",
        result: "SUCCESS",
        timestamp: daysAgo(3, 16),
      },
      {
        id: "demo-aud-05",
        officerId: delSup.id,
        officerName: delSup.name,
        officerBadge: delSup.badgeNumber,
        action: "REVIEW_ENTITY_LINK",
        module: "Syndicate",
        targetType: "EntityLink",
        targetId: "demo-ce-09",
        details: "Supervisor confirmed shared mule UPI apex.rewards.demo@ybl across Delhi cases",
        result: "SUCCESS",
        timestamp: daysAgo(1, 16),
      },
      {
        id: "demo-aud-06",
        officerId: delSup.id,
        officerName: delSup.name,
        officerBadge: delSup.badgeNumber,
        action: "DOSSIER_APPROVE",
        module: "Reports",
        targetType: "Dossier",
        targetId: doss1Gen.dossier.id,
        details: `Supervisor approved and finalized ${doss1Gen.dossier.dossierNumber} under BSA §63`,
        result: "SUCCESS",
        timestamp: daysAgo(0, 11),
      },
      {
        id: "demo-aud-07",
        officerId: delInv1.id,
        officerName: delInv1.name,
        officerBadge: delInv1.badgeNumber,
        action: "DOSSIER_EXPORT",
        module: "Reports",
        targetType: "Dossier",
        targetId: doss1Gen.dossier.id,
        details: `Exported ${doss1Gen.dossier.dossierNumber} in JSON and TXT formats`,
        result: "SUCCESS",
        timestamp: daysAgo(0, 12),
      },
      {
        id: "demo-aud-08",
        officerId: sysAdmin.id,
        officerName: sysAdmin.name,
        officerBadge: sysAdmin.badgeNumber,
        action: "ACCESS_CONTROL_VERIFY",
        module: "Admin",
        targetType: "Officer",
        targetId: "demo-off-del-susp",
        details: "Verified suspended account DL-SUSP-001 login lock and RLS tenant isolation",
        result: "BLOCKED",
        timestamp: daysAgo(0, 13),
      },
    ];

    await prisma.auditLog.createMany({ data: auditSpecs });

    // Summary verification
    const summary = {
      departments: await prisma.department.count(),
      officers: await prisma.officer.count(),
      cases: await prisma.case.count(),
      evidence: await prisma.evidence.count(),
      caseEntities: await prisma.caseEntity.count(),
      entityLinks: await prisma.entityLink.count(),
      extractedFacts: await prisma.extractedFact.count(),
      factReviews: await prisma.factReviewHistory.count(),
      timelineEvents: await prisma.timelineEvent.count(),
      dossiers: await prisma.investigativeDossier.count(),
      dossierExports: await prisma.dossierExportAudit.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log("\n================================================================");
    console.log("   DEMO SEEDING COMPLETE — rakshak_demo SUMMARY");
    console.log("================================================================");
    console.log(JSON.stringify(summary, null, 2));
    console.log("\nDemo Login Accounts (Password: Rakshak@2026!):");
    console.log("  - Delhi Investigator (Quick-Fill): DL-CYBER-001");
    console.log("  - Delhi Supervisor:                DL-SUP-001");
    console.log("  - Mumbai Investigator:             MH-INV-001");
    console.log("  - System Administrator:            SYS-ADM-001");
    console.log("  - Suspended Officer (Auth Test):   DL-SUSP-001");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL: Presentation demo seeding failed:", err);
  process.exit(1);
});
