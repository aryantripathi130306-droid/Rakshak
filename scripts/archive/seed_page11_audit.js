// scripts/seed_page11_audit.js
// Seeds the canonical audit records and security activity events for Page 11
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding Page 11 Audit Logs & Security Activity canonical records...");

  // Fetch officer mapping
  const officers = await prisma.officer.findMany();
  const offMap = {};
  officers.forEach((o) => {
    if (o.badgeNumber) offMap[o.badgeNumber] = o;
  });

  const canonicalAuditRecords = [
    {
      id: "LOG-2024-00012345",
      timestamp: new Date("2024-01-15T10:30:45.000Z"),
      officerId: offMap["INS-001"]?.id || null,
      officerName: "Rajesh Kumar",
      officerBadge: "INS-001",
      action: "VIEW_EVIDENCE",
      module: "Evidence",
      targetType: "Evidence",
      targetId: "EVT-2024-001245",
      details: "User viewed evidence file details in the system",
      result: "SUCCESS",
      ipAddress: "192.168.1.45",
      metadata: JSON.stringify({
        eventType: "Data Access",
        displayAction: "Viewed Evidence",
        resourceName: "mobile_001.jpg",
        resourceType: "Evidence File",
        caseNumber: "CC/2024/001",
        caseTitle: "Financial Fraud Investigation",
        department: "Cyber Crime Department",
        designation: "Inspector",
        sessionId: "sess_7f3a9c2d1e6b",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        source: "Web Application",
      }),
    },
    {
      id: "LOG-2024-00012344",
      timestamp: new Date("2024-01-15T10:25:12.000Z"),
      officerId: offMap["SI-027"]?.id || null,
      officerName: "Priya Singh",
      officerBadge: "SI-027",
      action: "UPDATE_CASE",
      module: "Cases",
      targetType: "Case",
      targetId: "CC/2024/001",
      details: "Updated case parameters and linked evidence references",
      result: "SUCCESS",
      ipAddress: "192.168.1.32",
      metadata: JSON.stringify({
        eventType: "User Action",
        displayAction: "Updated Case",
        resourceName: "CC/2024/001",
        resourceType: "Case File",
        caseNumber: "CC/2024/001",
        caseTitle: "Financial Fraud Investigation",
        department: "Cyber Crime Department",
        designation: "Sub Inspector",
        sessionId: "sess_4e2b8c91a03f",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        source: "Web Application",
      }),
    },
    {
      id: "LOG-2024-00012343",
      timestamp: new Date("2024-01-15T10:20:08.000Z"),
      officerId: null,
      officerName: "System",
      officerBadge: "SYSTEM",
      action: "LOGIN_FAILED",
      module: "Auth",
      targetType: "Officer",
      targetId: "N/A",
      details: "Multiple failed login attempts detected against administrative console",
      result: "FAILED",
      ipAddress: "203.0.113.45",
      metadata: JSON.stringify({
        eventType: "Security",
        displayAction: "Failed Login",
        resourceName: "N/A",
        resourceType: "Authentication Gateway",
        department: "Central Security Gateway",
        severity: "High",
        sessionId: "sess_unauth_threat_01",
        userAgent: "Python-requests/2.31.0",
        source: "External Network Perimeter",
      }),
    },
    {
      id: "LOG-2024-00012342",
      timestamp: new Date("2024-01-15T10:18:33.000Z"),
      officerId: offMap["HC-105"]?.id || null,
      officerName: "Amit Sharma",
      officerBadge: "HC-105",
      action: "GENERATE_REPORT",
      module: "Reports",
      targetType: "Report",
      targetId: "RPT-2024-0032",
      details: "Generated forensic summary dossier for judicial review",
      result: "SUCCESS",
      ipAddress: "192.168.1.78",
      metadata: JSON.stringify({
        eventType: "User Action",
        displayAction: "Created Report",
        resourceName: "RPT-2024-0032",
        resourceType: "Forensic Report",
        caseNumber: "CC/2024/001",
        caseTitle: "Financial Fraud Investigation",
        department: "State Police (Delhi)",
        designation: "Head Constable",
        sessionId: "sess_91b7d5f02c4a",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        source: "Web Application",
      }),
    },
    {
      id: "LOG-2024-00012341",
      timestamp: new Date("2024-01-15T10:15:27.000Z"),
      officerId: offMap["SI-043"]?.id || null,
      officerName: "System",
      officerBadge: "SYSTEM",
      action: "UPDATE_ROLE",
      module: "Officers",
      targetType: "Officer",
      targetId: "User: SI-043",
      details: "Rotated credentials according to 90-day password rotation policy",
      result: "SUCCESS",
      ipAddress: "192.168.1.56",
      metadata: JSON.stringify({
        eventType: "System",
        displayAction: "Password Change",
        resourceName: "User: SI-043",
        resourceType: "Officer Account",
        department: "Economic Offences Wing",
        sessionId: "sess_sys_policy_rot",
        userAgent: "Internal Daemon",
        source: "IAM Service",
      }),
    },
    {
      id: "LOG-2024-00012340",
      timestamp: new Date("2024-01-15T10:12:14.000Z"),
      officerId: offMap["SI-043"]?.id || null,
      officerName: "Neha Verma",
      officerBadge: "SI-043",
      action: "VIEW_EVIDENCE",
      module: "Evidence",
      targetType: "Evidence",
      targetId: "EVT-2024-000987",
      details: "Downloaded cryptographic container with SHA-256 validation",
      result: "SUCCESS",
      ipAddress: "192.168.1.33",
      metadata: JSON.stringify({
        eventType: "Data Access",
        displayAction: "Downloaded Evidence",
        resourceName: "EVT-2024-000987",
        resourceType: "Evidence Container",
        caseNumber: "CC/2024/001",
        caseTitle: "Financial Fraud Investigation",
        department: "Economic Offences Wing",
        designation: "Sub Inspector",
        sessionId: "sess_6a11ef03c89b",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        source: "Web Application",
      }),
    },
    {
      id: "LOG-2024-00012339",
      timestamp: new Date("2024-01-15T10:08:55.000Z"),
      officerId: offMap["INS-012"]?.id || null,
      officerName: "Vikram Patel",
      officerBadge: "INS-012",
      action: "UPDATE_CASE",
      module: "Entities",
      targetType: "Entity",
      targetId: "ENT-2024-0067",
      details: "Flagged duplicate entity for soft deletion and chain archiving",
      result: "SUCCESS",
      ipAddress: "192.168.1.90",
      metadata: JSON.stringify({
        eventType: "User Action",
        displayAction: "Deleted Entity (Soft)",
        resourceName: "ENT-2024-0067",
        resourceType: "Entity Record",
        department: "Narcotics Control Bureau",
        designation: "Inspector",
        sessionId: "sess_55f2ca09b11e",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        source: "Web Application",
      }),
    },
    {
      id: "LOG-2024-00012338",
      timestamp: new Date("2024-01-15T10:05:21.000Z"),
      officerId: offMap["ANL-015"]?.id || null,
      officerName: "System",
      officerBadge: "SYSTEM",
      action: "UPDATE_ROLE",
      module: "Officers",
      targetType: "Officer",
      targetId: "User: ANL-015",
      details: "Updated RBAC permissions profile to Forensic Analyst level",
      result: "SUCCESS",
      ipAddress: "192.168.1.10",
      metadata: JSON.stringify({
        eventType: "System",
        displayAction: "Role Updated",
        resourceName: "User: ANL-015",
        resourceType: "Officer Account",
        department: "Forensic Lab",
        sessionId: "sess_sys_rbac_sync",
        userAgent: "Internal Daemon",
        source: "RBAC Controller",
      }),
    },
  ];

  for (const log of canonicalAuditRecords) {
    const existing = await prisma.auditLog.findUnique({
      where: { id: log.id },
    });
    if (existing) {
      await prisma.auditLog.update({
        where: { id: log.id },
        data: log,
      });
      console.log(`Updated canonical audit log: ${log.id} (${log.action})`);
    } else {
      await prisma.auditLog.create({
        data: log,
      });
      console.log(`Created canonical audit log: ${log.id} (${log.action})`);
    }
  }

  console.log("Page 11 Audit Logs seeding completed successfully!");
}

seed()
  .catch((e) => {
    console.error("Error during audit seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
