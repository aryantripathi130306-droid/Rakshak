// ─────────────────────────────────────────────────────────────────────────────
// prisma/seed_phase8.ts
// Seed script for Phase 8: Officers, RBAC, Audit Logs, and Generated Reports
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("=== SEEDING PHASE 8: OFFICERS, RBAC & AUDIT LOGS ===");

  const salt = await bcrypt.genSalt(10);
  // Default development password for officers: "Rakshak@2026"
  const defaultPasswordHash = await bcrypt.hash("Rakshak@2026", salt);

  const officersData = [
    {
      badgeNumber: "DL-002",
      name: "ACP Vikram Singh",
      email: "vikram.singh@delhipolice.gov.in",
      designation: "ACP",
      role: "ADMIN",
      jurisdiction: "Delhi",
      unit: "Cyber Crime Cell",
      status: "ACTIVE",
    },
    {
      badgeNumber: "MH-104",
      name: "Inspector Priya Sharma",
      email: "priya.sharma@mumbaipolice.gov.in",
      designation: "Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Mumbai",
      unit: "Cyber Crime Wing",
      status: "ACTIVE",
    },
    {
      badgeNumber: "KA-042",
      name: "SI Amit Kumar",
      email: "amit.kumar@ksp.gov.in",
      designation: "SI",
      role: "ANALYST",
      jurisdiction: "Bengaluru",
      unit: "CID Cyber Cell",
      status: "ACTIVE",
    },
    {
      badgeNumber: "RJ-018",
      name: "Analyst Neha Verma",
      email: "neha.verma@rajasthanpolice.gov.in",
      designation: "Analyst",
      role: "ANALYST",
      jurisdiction: "Jaipur",
      unit: "State Cyber Security Agency",
      status: "ACTIVE",
    },
    {
      badgeNumber: "MH-088",
      name: "Head Constable Rahul Mehta",
      email: "rahul.mehta@punepolice.gov.in",
      designation: "Head Constable",
      role: "VIEWER",
      jurisdiction: "Pune",
      unit: "Cyber Cell",
      status: "ACTIVE",
    },
  ];

  const p = prisma as any;

  console.log(`Seeding ${officersData.length} officers...`);
  const seededOfficers: Record<string, string> = {};
  for (const off of officersData) {
    const record = await p.officer.upsert({
      where: { badgeNumber: off.badgeNumber },
      update: {
        name: off.name,
        email: off.email,
        designation: off.designation,
        role: off.role,
        jurisdiction: off.jurisdiction,
        unit: off.unit,
        status: off.status,
      },
      create: {
        ...off,
        passwordHash: defaultPasswordHash,
      },
    });
    seededOfficers[off.badgeNumber] = record.id;
  }

  // 2. Seed Reports
  console.log("Seeding reports history...");
  const reportsData = [
    {
      reportNumber: "RPT-2026-012",
      caseId: "CASE-2026-0891",
      reportType: "INVESTIGATION_COMPLETE",
      title: "Complete Investigation Dossier #CASE-2026-0891",
      generatedBy: "ACP Vikram Singh",
      officerId: seededOfficers["DL-002"],
      status: "COMPLETED",
      outputFormat: "PDF",
      sectionsIncluded: JSON.stringify(["Case Details", "Legal Matrix", "Timeline", "Evidence Manifest", "Syndicate Links"]),
      fileSizeBytes: 2450000,
      createdAt: new Date("2026-12-20T16:45:00.000Z"),
    },
    {
      reportNumber: "RPT-2026-011",
      caseId: "CASE-2026-0104",
      reportType: "EVIDENCE_INTEGRITY",
      title: "Evidence Integrity & Hash Manifest #CASE-2026-0104",
      generatedBy: "Inspector Priya Sharma",
      officerId: seededOfficers["MH-104"],
      status: "COMPLETED",
      outputFormat: "PDF",
      sectionsIncluded: JSON.stringify(["Evidence Manifest", "Chain of Custody", "Hash Verification"]),
      fileSizeBytes: 1820000,
      createdAt: new Date("2026-12-19T14:20:00.000Z"),
    },
    {
      reportNumber: "RPT-2026-010",
      caseId: "CASE-2026-0219",
      reportType: "SYNDICATE_INTELLIGENCE",
      title: "Syndicate Linkage Graph Analysis #CASE-2026-0219",
      generatedBy: "SI Amit Kumar",
      officerId: seededOfficers["KA-042"],
      status: "COMPLETED",
      outputFormat: "JSON",
      sectionsIncluded: JSON.stringify(["Syndicate Links", "Entity Cross-Match", "Clusters"]),
      fileSizeBytes: 950000,
      createdAt: new Date("2026-12-18T12:10:00.000Z"),
    },
    {
      reportNumber: "RPT-2026-009",
      caseId: "CASE-2026-0331",
      reportType: "INVESTIGATION_SUMMARY",
      title: "Legal Matrix & BNS Classification #CASE-2026-0331",
      generatedBy: "Analyst Neha Verma",
      officerId: seededOfficers["RJ-018"],
      status: "COMPLETED",
      outputFormat: "PDF",
      sectionsIncluded: JSON.stringify(["Case Summary", "Legal Matrix", "Section 63 Particulars"]),
      fileSizeBytes: 1350000,
      createdAt: new Date("2026-12-16T11:32:00.000Z"),
    },
    {
      reportNumber: "RPT-2026-008",
      caseId: "CASE-2026-0891",
      reportType: "INVESTIGATION_SUMMARY",
      title: "Case Summary Preliminary Brief #CASE-2026-0891",
      generatedBy: "Head Constable Rahul Mehta",
      officerId: seededOfficers["MH-088"],
      status: "FAILED",
      outputFormat: "PDF",
      sectionsIncluded: JSON.stringify(["Case Summary"]),
      fileSizeBytes: 0,
      createdAt: new Date("2026-12-14T09:18:00.000Z"),
    },
  ];

  for (const rpt of reportsData) {
    await p.generatedReport.upsert({
      where: { reportNumber: rpt.reportNumber },
      update: {
        status: rpt.status,
        outputFormat: rpt.outputFormat,
        title: rpt.title,
      },
      create: rpt,
    });
  }

  // 3. Seed Audit Logs
  console.log("Seeding authentic audit logs...");
  const auditLogsData = [
    {
      timestamp: new Date("2026-12-20T16:45:00.000Z"),
      officerId: seededOfficers["DL-002"],
      officerName: "ACP Vikram Singh",
      officerBadge: "DL-002",
      action: "GENERATE_REPORT",
      module: "Reports",
      targetType: "Report",
      targetId: "RPT-2026-012",
      details: "Generated complete investigation report RPT-2026-012 for case #CASE-2026-0891",
      result: "SUCCESS",
      ipAddress: "103.45.67.89",
    },
    {
      timestamp: new Date("2026-12-20T15:32:00.000Z"),
      officerId: seededOfficers["MH-104"],
      officerName: "Inspector Priya Sharma",
      officerBadge: "MH-104",
      action: "UPDATE_CASE",
      module: "Cases",
      targetType: "Case",
      targetId: "CASE-2026-0891",
      details: "Updated case status to Chargesheet",
      result: "SUCCESS",
      ipAddress: "103.45.67.90",
    },
    {
      timestamp: new Date("2026-12-20T14:18:00.000Z"),
      officerId: seededOfficers["KA-042"],
      officerName: "SI Amit Kumar",
      officerBadge: "KA-042",
      action: "VIEW_EVIDENCE",
      module: "Evidence",
      targetType: "Evidence",
      targetId: "EV-2026-0076",
      details: "Accessed evidence EV-2026-0076 (payment_screenshot.jpg)",
      result: "SUCCESS",
      ipAddress: "103.45.67.91",
    },
    {
      timestamp: new Date("2026-12-20T12:05:00.000Z"),
      officerId: seededOfficers["RJ-018"],
      officerName: "Analyst Neha Verma",
      officerBadge: "RJ-018",
      action: "EXPORT_JSON",
      module: "Entities",
      targetType: "Entity",
      targetId: "ENT-MULTI",
      details: "Exported entity data (42 records)",
      result: "SUCCESS",
      ipAddress: "103.45.67.92",
    },
    {
      timestamp: new Date("2026-12-19T18:20:00.000Z"),
      officerId: seededOfficers["MH-088"],
      officerName: "Head Constable Rahul Mehta",
      officerBadge: "MH-088",
      action: "VIEW_TIMELINE",
      module: "Timeline",
      targetType: "Timeline",
      targetId: "CASE-2026-0104",
      details: "Viewed timeline for #CASE-2026-0104",
      result: "SUCCESS",
      ipAddress: "103.45.67.93",
    },
    {
      timestamp: new Date("2026-12-19T10:14:00.000Z"),
      officerId: seededOfficers["DL-002"],
      officerName: "ACP Vikram Singh",
      officerBadge: "DL-002",
      action: "LOGIN_SUCCESS",
      module: "Auth",
      targetType: "Officer",
      targetId: seededOfficers["DL-002"],
      details: "Authenticated via secure officer portal session",
      result: "SUCCESS",
      ipAddress: "103.45.67.89",
    },
    {
      timestamp: new Date("2026-12-18T09:30:00.000Z"),
      officerId: null,
      officerName: "Unknown IP",
      officerBadge: null,
      action: "ACCESS_DENIED",
      module: "Auth",
      targetType: "Officer",
      targetId: "DL-999",
      details: "Invalid badge number or password provided",
      result: "BLOCKED",
      ipAddress: "45.112.89.21",
    },
  ];

  for (const log of auditLogsData) {
    await p.auditLog.create({ data: log });
  }

  // 4. Seed Scheduled Reports
  console.log("Seeding scheduled reports...");
  const scheduledData = [
    {
      name: "Weekly Case Summary",
      reportType: "INVESTIGATION_SUMMARY",
      frequency: "WEEKLY",
      nextRun: new Date("2026-12-27T08:00:00.000Z"),
      status: "ACTIVE",
    },
    {
      name: "High-Risk Entity Report",
      reportType: "ENTITY_ANALYSIS",
      frequency: "DAILY",
      nextRun: new Date("2026-12-21T08:00:00.000Z"),
      status: "ACTIVE",
    },
    {
      name: "Pending Reviews",
      reportType: "LEGAL_CLASSIFICATION",
      frequency: "DAILY",
      nextRun: new Date("2026-12-21T08:00:00.000Z"),
      status: "ACTIVE",
    },
  ];

  for (const s of scheduledData) {
    await p.scheduledReport.create({ data: s });
  }

  console.log("✅ PHASE 8 SEEDING COMPLETED SUCCESSFULLY!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
