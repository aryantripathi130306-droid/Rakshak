// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_page05_reports.mjs
// Seeds authentic investigation reports, associated cases, evidence items,
// extracted findings, timeline events, and standard scheduled report templates.
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve("prisma/dev.db")}`;
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

async function main() {
  console.log("Seeding authentic reports and dossiers into dev.db...");

  // 1. Ensure templates exist in ScheduledReport
  const templates = [
    {
      name: "Weekly Case Summary",
      reportType: "INVESTIGATION_SUMMARY",
      frequency: "WEEKLY",
      status: "ACTIVE",
    },
    {
      name: "High-Risk Entity Report",
      reportType: "ENTITY_ANALYSIS",
      frequency: "DAILY",
      status: "ACTIVE",
    },
    {
      name: "Pending Reviews",
      reportType: "LEGAL_CLASSIFICATION",
      frequency: "DAILY",
      status: "ACTIVE",
    },
    {
      name: "Section 63 BSA Dossier Manifest",
      reportType: "EVIDENCE_INTEGRITY",
      frequency: "WEEKLY",
      status: "ACTIVE",
    },
    {
      name: "Syndicate Intelligence Brief",
      reportType: "SYNDICATE_INTELLIGENCE",
      frequency: "MONTHLY",
      status: "ACTIVE",
    },
  ];

  for (const t of templates) {
    const existing = await prisma.scheduledReport.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.scheduledReport.create({
        data: {
          name: t.name,
          reportType: t.reportType,
          frequency: t.frequency,
          status: t.status,
          nextRun: new Date(Date.now() + 7 * 86400000),
        },
      });
    }
  }

  // 2. Ensure Primary Case CB-2025-1042 exists with full forensic evidence & findings
  let case1042 = await prisma.case.findFirst({
    where: { OR: [{ caseNumber: "CB-2025-1042" }, { caseNumber: "CASE-2025-1042" }] },
  });

  if (!case1042) {
    case1042 = await prisma.case.create({
      data: {
        caseNumber: "CB-2025-1042",
        incidentType: "Task_Scam",
        complainantName: "Rohit Malhotra",
        jurisdiction: "Crime Branch (DEL)",
        status: "UNDER_INQUIRY",
        amountDefrauded: 1250000,
        firNumber: "FIR-2025-DEL-1042",
        description: "Multi-jurisdictional financial fraud and shell account money laundering investigation.",
        departmentId: "dept-del-01",
      },
    });
  }

  // Evidence files for CB-2025-1042
  const evidenceData = [
    { fileName: "Bank_Statement_Axis_9821.pdf", fileType: "PDF", mimeType: "application/pdf", fileSize: 1420800, category: "UPI_FINANCIAL" },
    { fileName: "WhatsApp_Chat_Export_Encrypted.txt", fileType: "TXT", mimeType: "text/plain", fileSize: 420500, category: "CHAT" },
    { fileName: "GPay_Payment_Slip_49999.png", fileType: "PNG", mimeType: "image/png", fileSize: 320400, category: "UPI_FINANCIAL" },
    { fileName: "Telegram_Channel_Dump_OTC.json", fileType: "JSON", mimeType: "application/json", fileSize: 890100, category: "CHAT" },
    { fileName: "Seized_iPhone_14_Cellebrite_Extraction.tar", fileType: "TAR", mimeType: "application/x-tar", fileSize: 4520000, category: "DOCUMENT" },
    { fileName: "CCTV_ATM_Cash_Withdrawal_Sec18.mp4", fileType: "MP4", mimeType: "video/mp4", fileSize: 18400000, category: "VIDEO" },
    { fileName: "Audio_Intercept_Call_Tape_04.wav", fileType: "WAV", mimeType: "audio/wav", fileSize: 2400000, category: "AUDIO" },
    { fileName: "Forged_Aadhaar_Card_Rohit.jpg", fileType: "JPG", mimeType: "image/jpeg", fileSize: 580000, category: "CRIME_SCENE_PHOTO" },
    { fileName: "NetBanking_Login_IP_Logs.csv", fileType: "CSV", mimeType: "text/csv", fileSize: 120400, category: "DOCUMENT" },
    { fileName: "Syndicate_Ledger_Spreadsheet.xlsx", fileType: "XLSX", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileSize: 650000, category: "UPI_FINANCIAL" },
    { fileName: "Confiscated_SIM_Card_IMSI_Dump.bin", fileType: "BIN", mimeType: "application/octet-stream", fileSize: 98000, category: "DOCUMENT" },
    { fileName: "Mule_Account_KYC_Verification_Form.pdf", fileType: "PDF", mimeType: "application/pdf", fileSize: 1100000, category: "DOCUMENT" },
  ];

  const seededEvidences = [];
  for (const ev of evidenceData) {
    const hash = crypto.createHash("sha256").update(ev.fileName + case1042.id).digest("hex");
    let existingEv = await prisma.evidence.findFirst({
      where: { caseId: case1042.id, fileName: ev.fileName },
    });
    if (!existingEv) {
      existingEv = await prisma.evidence.create({
        data: {
          caseId: case1042.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          mimeType: ev.mimeType,
          fileSize: ev.fileSize,
          sha256Hash: hash,
          clientHash: hash,
          storagePath: `/uploads/raw/${hash}.${ev.fileType.toLowerCase()}`,
          evidenceCategory: ev.category,
        },
      });
    }
    seededEvidences.push(existingEv);
  }

  // Findings / Extracted Facts for CB-2025-1042
  const findingsData = [
    { text: "Transaction layering identified across 4 shell accounts in Mumbai and Surat.", type: "ACCOUNT", raw: "HDFC0001234", norm: "hdfc0001234", conf: 0.98, status: "VERIFIED" },
    { text: "Suspect device IMEI matched previously seized handset from Case CB-2025-1036.", type: "PHONE", raw: "IMEI 864210041234567", norm: "864210041234567", conf: 1.0, status: "VERIFIED" },
    { text: "Telegram channel 'CryptoPay_OTC' used for illicit fund liquidation.", type: "TELEGRAM", raw: "t.me/CryptoPay_OTC", norm: "cryptopay_otc", conf: 0.95, status: "VERIFIED" },
    { text: "Mule account IFSC HDFC0001234 flagged in 3 simultaneous cyber complaints.", type: "IFSC", raw: "HDFC0001234", norm: "HDFC0001234", conf: 1.0, status: "VERIFIED" },
    { text: "Cross-jurisdictional IP cluster located in Phnom Penh routing through commercial VPN.", type: "IP", raw: "103.45.67.89", norm: "103.45.67.89", conf: 0.92, status: "UNVERIFIED" },
    { text: "Voice note audio biometric match with Syndicate Leader 'Vikram @ Apex'.", type: "NAME", raw: "Vikram @ Apex", norm: "vikram_apex", conf: 0.99, status: "VERIFIED" },
    { text: "WhatsApp export contains clear transaction coordinates and target bank lists.", type: "PHONE", raw: "+91 98765 43210", norm: "+919876543210", conf: 0.96, status: "VERIFIED" },
    { text: "Forged GST invoices uploaded to payment gateway as verification artifacts.", type: "DOMAIN", raw: "portal-verify-gst.in", norm: "portal-verify-gst.in", conf: 0.97, status: "DISPUTED" },
  ];

  for (let i = 0; i < findingsData.length; i++) {
    const f = findingsData[i];
    const parentEv = seededEvidences[i % seededEvidences.length];
    const existingFact = await prisma.extractedFact.findFirst({
      where: { evidenceId: parentEv.id, factAssertion: f.text },
    });
    if (!existingFact) {
      await prisma.extractedFact.create({
        data: {
          caseId: case1042.id,
          evidenceId: parentEv.id,
          factAssertion: f.text,
          entityType: f.type,
          rawValue: f.raw,
          normalizedValue: f.norm,
          confidence: f.conf,
          sourceHash: parentEv.sha256Hash,
          verificationStatus: f.status,
          verifiedBy: f.status === "VERIFIED" ? "ACP Rajeev Kumar" : null,
        },
      });
    }
  }

  // Persons / Entities for CB-2025-1042
  const entitiesData = [
    { type: "NAME", raw: "Rohit Malhotra", norm: "ROHIT MALHOTRA" },
    { type: "NAME", raw: "Vikram @ Apex", norm: "VIKRAM APEX" },
    { type: "PHONE", raw: "+91 98765 43210", norm: "+919876543210" },
    { type: "UPI", raw: "mule.operator@ybl", norm: "mule.operator@ybl" },
    { type: "ACCOUNT", raw: "Axis Bank 9821004123", norm: "9821004123" },
  ];
  for (const ent of entitiesData) {
    const existingEnt = await prisma.caseEntity.findFirst({
      where: { caseId: case1042.id, entityType: ent.type, normalizedValue: ent.norm },
    });
    if (!existingEnt) {
      await prisma.caseEntity.create({
        data: {
          caseId: case1042.id,
          entityType: ent.type,
          rawValue: ent.raw,
          normalizedValue: ent.norm,
        },
      });
    }
  }

  // Timeline events for CB-2025-1042
  const timelineData = [
    { desc: "Final dossier compiled and Section 63 BSA certificate attached.", phase: "REPORTING", src: "SCREENSHOT", date: new Date("2025-10-16T11:20:00Z") },
    { desc: "ACP Rajeev Kumar approved supervisory sign-off.", phase: "SEVERED", src: "BANK_SMS", date: new Date("2025-10-16T09:15:00Z") },
    { desc: "Forensic audit of seized iPhone Cellebrite manifest completed.", phase: "PAYMENT", src: "RECEIPT", date: new Date("2025-10-15T16:30:00Z") },
    { desc: "Banking intelligence response received from Axis Bank Nodal Officer.", phase: "TRUST", src: "BANK_SMS", date: new Date("2025-10-14T14:00:00Z") },
    { desc: "Initial complaint registered under Section 318(4) BNS.", phase: "CONTACT", src: "WHATSAPP", date: new Date("2025-10-12T10:45:00Z") },
  ];
  for (const tl of timelineData) {
    const existingTl = await prisma.timelineEvent.findFirst({
      where: { caseId: case1042.id, description: tl.desc },
    });
    if (!existingTl) {
      await prisma.timelineEvent.create({
        data: {
          caseId: case1042.id,
          evidenceId: seededEvidences[0].id,
          description: tl.desc,
          phase: tl.phase,
          sourceType: tl.src,
          timestamp: tl.date,
        },
      });
    }
  }

  // 3. Seed other referenced cases
  const otherCases = [
    { caseNumber: "CB-2025-1039", incidentType: "Task_Scam", comp: "Aakash Mehta", jur: "Cyber Crime Cell", st: "OPEN" },
    { caseNumber: "CB-2025-1036", incidentType: "Investment_Fraud", comp: "Kavita Rao", jur: "Crime Branch (DEL)", st: "CHARGESHEETED" },
    { caseNumber: "CB-2025-1031", incidentType: "Task_Scam", comp: "Harish Pillai", jur: "Cyber Cell", st: "CLOSED" },
    { caseNumber: "CB-2025-1028", incidentType: "Digital_Arrest", comp: "Deepak Soni", jur: "Special Cell", st: "UNDER_INQUIRY" },
    { caseNumber: "CB-2025-1025", incidentType: "Task_Scam", comp: "Simran Kaur", jur: "Cyber Crime Wing", st: "CLOSED" },
    { caseNumber: "CB-2025-1019", incidentType: "Task_Scam", comp: "Mohit Bansal", jur: "Crime Branch", st: "OPEN" },
    { caseNumber: "CB-2025-1016", incidentType: "Investment_Fraud", comp: "Naveen Joshi", jur: "Special Cell", st: "CHARGESHEETED" },
    { caseNumber: "CB-2025-1012", incidentType: "Task_Scam", comp: "Sunita Roy", jur: "Cyber Cell", st: "UNDER_INQUIRY" },
    { caseNumber: "CB-2025-1008", incidentType: "Task_Scam", comp: "Vikas Tyagi", jur: "Crime Branch", st: "CLOSED" },
  ];

  const caseMap = { "CB-2025-1042": case1042.id };
  for (const c of otherCases) {
    let existingCase = await prisma.case.findFirst({ where: { caseNumber: c.caseNumber } });
    if (!existingCase) {
      existingCase = await prisma.case.create({
        data: {
          caseNumber: c.caseNumber,
          incidentType: c.incidentType,
          complainantName: c.comp,
          jurisdiction: c.jur,
          status: c.st,
          amountDefrauded: 500000,
          departmentId: "dept-del-01",
        },
      });
    }
    caseMap[c.caseNumber] = existingCase.id;
  }

  // 4. Seed all 28 Reports
  const rawReports = [
    {
      reportNumber: "RPT-2025-0047",
      title: "Financial Fraud Analysis",
      caseNum: "CB-2025-1042",
      category: "Financial Crime",
      reportType: "INVESTIGATION_COMPLETE",
      status: "COMPLETED",
      priority: "High",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Rajeev Kumar",
      date: new Date("2025-10-16T11:24:00Z"),
      summary: "Comprehensive analysis of financial transactions, digital evidence and communication records related to money laundering activities. The report identifies key entities, transaction patterns and cross-case links with supporting evidence.",
      evidenceCount: 12,
      personsCount: 5,
      linkedCasesCount: 3,
      findingsCount: 8,
    },
    {
      reportNumber: "RPT-2025-0046",
      title: "Cyber Breach Technical Report",
      caseNum: "CB-2025-1039",
      category: "Cyber Crime",
      reportType: "EVIDENCE_INTEGRITY",
      status: "UNDER_REVIEW",
      priority: "Critical",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "Pending Supervisory Review",
      date: new Date("2025-10-15T18:17:00Z"),
      summary: "Technical forensic assessment of unauthorized server intrusion, remote payload detonation, and exfiltrated credential hashes across enterprise infrastructure.",
      evidenceCount: 9,
      personsCount: 3,
      linkedCasesCount: 2,
      findingsCount: 6,
    },
    {
      reportNumber: "RPT-2025-0045",
      title: "Organized Syndicate Dossier",
      caseNum: "CB-2025-1036",
      category: "Organized Crime",
      reportType: "SYNDICATE_INTELLIGENCE",
      status: "COMPLETED",
      priority: "High",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Rajeev Kumar",
      date: new Date("2025-10-14T15:22:00Z"),
      summary: "Cross-case cluster mapping connecting 14 dummy account holders, operational tele-callers, and hawala conduits orchestrated by the Western Node syndicate.",
      evidenceCount: 16,
      personsCount: 8,
      linkedCasesCount: 5,
      findingsCount: 11,
    },
    {
      reportNumber: "RPT-2025-0044",
      title: "Narcotics Investigation Report",
      caseNum: "CB-2025-1031",
      category: "Narcotics",
      reportType: "INVESTIGATION_COMPLETE",
      status: "COMPLETED",
      priority: "High",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Vikram Singh",
      date: new Date("2025-10-12T16:51:00Z"),
      summary: "Detailed digital tracking of darknet courier drops, encrypted communication chains, and cryptocurrency payment escrows.",
      evidenceCount: 8,
      personsCount: 4,
      linkedCasesCount: 2,
      findingsCount: 7,
    },
    {
      reportNumber: "RPT-2025-0043",
      title: "Digital Evidence Summary",
      caseNum: "CB-2025-1028",
      category: "Cyber Crime",
      reportType: "EVIDENCE_INTEGRITY",
      status: "IN_DRAFT",
      priority: "Medium",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "Unassigned",
      date: new Date("2025-10-10T14:14:00Z"),
      summary: "Interim hash verification log of 7 seized mobile storage cards, cloud backup snapshots, and preliminary Cellebrite timeline manifests.",
      evidenceCount: 7,
      personsCount: 2,
      linkedCasesCount: 1,
      findingsCount: 4,
    },
    {
      reportNumber: "RPT-2025-0042",
      title: "Missing Person Final Report",
      caseNum: "CB-2025-1025",
      category: "Person Related",
      reportType: "INVESTIGATION_SUMMARY",
      status: "COMPLETED",
      priority: "Normal",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Rajeev Kumar",
      date: new Date("2025-10-08T09:37:00Z"),
      summary: "Cell site tower triangulation, toll plaza FASTag tracking, and UPI transaction geolocation timeline resolving suspect relocation.",
      evidenceCount: 6,
      personsCount: 2,
      linkedCasesCount: 1,
      findingsCount: 5,
    },
    {
      reportNumber: "RPT-2025-0041",
      title: "Identity Fraud Dossier",
      caseNum: "CB-2025-1019",
      category: "Identity Fraud",
      reportType: "ENTITY_ANALYSIS",
      status: "IN_DRAFT",
      priority: "Medium",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "Unassigned",
      date: new Date("2025-10-05T15:22:00Z"),
      summary: "Analysis of counterfeit biometric credentials, cloned Aadhaar registrations, and fabricated employer verification letters.",
      evidenceCount: 5,
      personsCount: 3,
      linkedCasesCount: 2,
      findingsCount: 4,
    },
    {
      reportNumber: "RPT-2025-0040",
      title: "Arms Supply Investigation",
      caseNum: "CB-2025-1016",
      category: "Arms & Weapons",
      reportType: "INVESTIGATION_COMPLETE",
      status: "COMPLETED",
      priority: "Critical",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Vikram Singh",
      date: new Date("2025-10-03T13:15:00Z"),
      summary: "Cross-border illicit weapon procurement channels mapped through seized WhatsApp catalogs and encrypted courier dispatch notes.",
      evidenceCount: 11,
      personsCount: 6,
      linkedCasesCount: 4,
      findingsCount: 9,
    },
    {
      reportNumber: "RPT-2025-0039",
      title: "Human Trafficking Network",
      caseNum: "CB-2025-1012",
      category: "Human Trafficking",
      reportType: "SYNDICATE_INTELLIGENCE",
      status: "UNDER_REVIEW",
      priority: "Critical",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "Pending Supervisory Review",
      date: new Date("2025-09-29T17:48:00Z"),
      summary: "Interstate syndicate intelligence dossier analyzing recruitment adverts on social media, transit ticketing records, and safe-house phone intercepts.",
      evidenceCount: 14,
      personsCount: 9,
      linkedCasesCount: 3,
      findingsCount: 10,
    },
    {
      reportNumber: "RPT-2025-0038",
      title: "Homicide Forensic Report",
      caseNum: "CB-2025-1008",
      category: "Homicide",
      reportType: "INVESTIGATION_COMPLETE",
      status: "COMPLETED",
      priority: "High",
      generatedBy: "Inspector Sharma (DEL-001)",
      approvedBy: "ACP Rajeev Kumar",
      date: new Date("2025-09-25T11:06:00Z"),
      summary: "Digital CCTV timeline correlation, cell phone tower proximity dumps, and vehicle license plate recognition forensics establishing presence at crime scene.",
      evidenceCount: 10,
      personsCount: 4,
      linkedCasesCount: 1,
      findingsCount: 8,
    },
    // Reports 11-28
    { reportNumber: "RPT-2025-0037", title: "Corporate Data Exfiltration Report", caseNum: "CB-2025-1039", category: "Cyber Crime", reportType: "EVIDENCE_INTEGRITY", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-09-22T10:00:00Z"), summary: "Forensic log analysis of unauthorized cloud file transfers.", evidenceCount: 6, personsCount: 2, linkedCasesCount: 1, findingsCount: 4 },
    { reportNumber: "RPT-2025-0036", title: "Banking Trojan Malware Analysis", caseNum: "CB-2025-1042", category: "Cyber Crime", reportType: "INVESTIGATION_SUMMARY", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-09-18T14:30:00Z"), summary: "Reverse engineering breakdown of malicious APK masquerading as utility app.", evidenceCount: 5, personsCount: 2, linkedCasesCount: 2, findingsCount: 5 },
    { reportNumber: "RPT-2025-0035", title: "SIM Swap Ring Intelligence", caseNum: "CB-2025-1036", category: "Identity Fraud", reportType: "ENTITY_ANALYSIS", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-09-15T09:20:00Z"), summary: "Telecom KYC fraud and coordinated SIM swap attacks on victim accounts.", evidenceCount: 8, personsCount: 4, linkedCasesCount: 3, findingsCount: 6 },
    { reportNumber: "RPT-2025-0034", title: "Cryptocurrency Trace & Seizure Dossier", caseNum: "CB-2025-1042", category: "Financial Crime", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-09-10T16:15:00Z"), summary: "Blockchain hop analysis tracking 2.4 BTC across mixer services to exchange deposit addresses.", evidenceCount: 9, personsCount: 3, linkedCasesCount: 3, findingsCount: 7 },
    { reportNumber: "RPT-2025-0033", title: "Extortion Network Call Logs Brief", caseNum: "CB-2025-1028", category: "Organized Crime", reportType: "INVESTIGATION_SUMMARY", status: "UNDER_REVIEW", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "Pending Review", date: new Date("2025-09-08T11:45:00Z"), summary: "VoIP gateway call pattern clustering linking international numbers to local handlers.", evidenceCount: 7, personsCount: 4, linkedCasesCount: 2, findingsCount: 5 },
    { reportNumber: "RPT-2025-0032", title: "Phishing Infrastructure Audit", caseNum: "CB-2025-1039", category: "Cyber Crime", reportType: "EVIDENCE_INTEGRITY", status: "COMPLETED", priority: "Medium", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-09-04T12:00:00Z"), summary: "Registrar records, SSL cert fingerprints, and DNS infrastructure for 18 fraudulent domains.", evidenceCount: 6, personsCount: 2, linkedCasesCount: 2, findingsCount: 4 },
    { reportNumber: "RPT-2025-0031", title: "Fake Government Portal Analysis", caseNum: "CB-2025-1019", category: "Identity Fraud", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-08-30T15:10:00Z"), summary: "Investigation of cloned e-governance service portal collecting citizen fee payments.", evidenceCount: 8, personsCount: 3, linkedCasesCount: 2, findingsCount: 6 },
    { reportNumber: "RPT-2025-0030", title: "Mule Account Network Mapping", caseNum: "CB-2025-1042", category: "Financial Crime", reportType: "SYNDICATE_INTELLIGENCE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-08-25T13:40:00Z"), summary: "Graph traversal revealing 28 linked mule accounts used across 6 regional police jurisdictions.", evidenceCount: 11, personsCount: 7, linkedCasesCount: 6, findingsCount: 9 },
    { reportNumber: "RPT-2025-0029", title: "Illegal Betting App Ledger Investigation", caseNum: "CB-2025-1036", category: "Financial Crime", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-08-20T17:25:00Z"), summary: "Database extraction of unauthorized gaming platform showing illegal deposits and payout routes.", evidenceCount: 9, personsCount: 5, linkedCasesCount: 3, findingsCount: 7 },
    { reportNumber: "RPT-2025-0028", title: "Ransomware Decryption Assessment", caseNum: "CB-2025-1039", category: "Cyber Crime", reportType: "EVIDENCE_INTEGRITY", status: "IN_DRAFT", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "Unassigned", date: new Date("2025-08-16T10:15:00Z"), summary: "Binary analysis of ransomware strain and key extraction viability report.", evidenceCount: 4, personsCount: 1, linkedCasesCount: 1, findingsCount: 3 },
    { reportNumber: "RPT-2025-0027", title: "Cross-Border Hawala Communication Dump", caseNum: "CB-2025-1016", category: "Financial Crime", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "Critical", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-08-12T14:50:00Z"), summary: "Forensic decoding of handwritten token ledgers and Signal chat histories.", evidenceCount: 10, personsCount: 6, linkedCasesCount: 4, findingsCount: 8 },
    { reportNumber: "RPT-2025-0026", title: "ATM Skimmer Device Hardware Report", caseNum: "CB-2025-1042", category: "Financial Crime", reportType: "EVIDENCE_INTEGRITY", status: "COMPLETED", priority: "Medium", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-08-08T11:20:00Z"), summary: "Physical and flash memory analysis of recovered magnetic stripe skimmer.", evidenceCount: 5, personsCount: 2, linkedCasesCount: 2, findingsCount: 4 },
    { reportNumber: "RPT-2025-0025", title: "Dark Web Vendor Storefront Analysis", caseNum: "CB-2025-1031", category: "Narcotics", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-08-03T16:00:00Z"), summary: "PGP key verification and order receipt cataloging for vendor storefront.", evidenceCount: 7, personsCount: 3, linkedCasesCount: 2, findingsCount: 5 },
    { reportNumber: "RPT-2025-0024", title: "Telecom CDR Tower Dump Correlation", caseNum: "CB-2025-1025", category: "Person Related", reportType: "INVESTIGATION_SUMMARY", status: "COMPLETED", priority: "Normal", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-07-28T09:40:00Z"), summary: "Comparative analysis of 4 BTS cell towers identifying common phone numbers during robbery window.", evidenceCount: 6, personsCount: 3, linkedCasesCount: 1, findingsCount: 4 },
    { reportNumber: "RPT-2025-0023", title: "Counterfeit Passport Verification", caseNum: "CB-2025-1019", category: "Identity Fraud", reportType: "ENTITY_ANALYSIS", status: "IN_DRAFT", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "Unassigned", date: new Date("2025-07-22T13:30:00Z"), summary: "UV spectral and MRZ comparison of forged travel documents seized at airport.", evidenceCount: 4, personsCount: 2, linkedCasesCount: 1, findingsCount: 3 },
    { reportNumber: "RPT-2025-0022", title: "Stolen Vehicle Fastag Transit Matrix", caseNum: "CB-2025-1008", category: "Homicide", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Vikram Singh", date: new Date("2025-07-16T15:15:00Z"), summary: "NHAI toll transaction mapping plotting getaway vehicle path across 4 state borders.", evidenceCount: 8, personsCount: 3, linkedCasesCount: 2, findingsCount: 6 },
    { reportNumber: "RPT-2025-0021", title: "Illegal VoIP Gateway Seizure Brief", caseNum: "CB-2025-1028", category: "Cyber Crime", reportType: "EVIDENCE_INTEGRITY", status: "IN_DRAFT", priority: "Medium", generatedBy: "Inspector Sharma", approvedBy: "Unassigned", date: new Date("2025-07-10T11:05:00Z"), summary: "Hardware and routing table recovery from unlicensed telecom exchange.", evidenceCount: 5, personsCount: 2, linkedCasesCount: 1, findingsCount: 3 },
    { reportNumber: "RPT-2025-0020", title: "Synthetic Identity Loan App Scam", caseNum: "CB-2025-1042", category: "Financial Crime", reportType: "INVESTIGATION_COMPLETE", status: "COMPLETED", priority: "High", generatedBy: "Inspector Sharma", approvedBy: "ACP Rajeev Kumar", date: new Date("2025-07-04T14:45:00Z"), summary: "Full forensic review of aggressive instant loan recovery and fake contact harvesting application.", evidenceCount: 9, personsCount: 4, linkedCasesCount: 3, findingsCount: 7 },
  ];

  for (const rpt of rawReports) {
    const caseId = caseMap[rpt.caseNum] || case1042.id;
    const metadataObj = {
      reportNumber: rpt.reportNumber,
      title: rpt.title,
      category: rpt.category,
      caseNumber: rpt.caseNum,
      priority: rpt.priority,
      generatedBy: rpt.generatedBy,
      approvedBy: rpt.approvedBy,
      summary: rpt.summary,
      metrics: {
        evidenceFiles: rpt.evidenceCount,
        personsIdentified: rpt.personsCount,
        linkedCases: rpt.linkedCasesCount,
        keyFindings: rpt.findingsCount,
      },
    };

    await prisma.generatedReport.upsert({
      where: { reportNumber: rpt.reportNumber },
      update: {
        title: rpt.title,
        status: rpt.status,
        reportType: rpt.reportType,
        caseId,
        generatedBy: rpt.generatedBy,
        outputFormat: "PDF",
        fileSizeBytes: 2150000,
        metadata: JSON.stringify(metadataObj),
        createdAt: rpt.date,
      },
      create: {
        reportNumber: rpt.reportNumber,
        title: rpt.title,
        status: rpt.status,
        reportType: rpt.reportType,
        caseId,
        generatedBy: rpt.generatedBy,
        outputFormat: "PDF",
        sectionsIncluded: JSON.stringify(["Case Details", "Legal Matrix", "Timeline", "Evidence Manifest", "Syndicate Links"]),
        fileSizeBytes: 2150000,
        metadata: JSON.stringify(metadataObj),
        createdAt: rpt.date,
      },
    });
  }

  const reportCount = await prisma.generatedReport.count();
  const templateCount = await prisma.scheduledReport.count();
  console.log(`Seeding complete: ${reportCount} reports and ${templateCount} templates in dev.db.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error seeding reports:", err);
  process.exit(1);
});
