// scripts/seed_page10_admin.js
// Seeds the canonical officers, departments, and audit activities for Page 10 (Administration & Officer Management)
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding Page 10 Administration & Officer Management canonical records...");

  // 1. Ensure canonical departments exist
  const departmentsData = [
    {
      code: "CCD",
      name: "Cyber Crime Department",
      state: "Delhi",
      jurisdiction: "National Cyber Command & Central Cyber Crime Branch",
      status: "ACTIVE",
    },
    {
      code: "EOW",
      name: "Economic Offences Wing",
      state: "Delhi",
      jurisdiction: "Economic Crimes & Financial Forensic Division",
      status: "ACTIVE",
    },
    {
      code: "NCB",
      name: "Narcotics Control Bureau",
      state: "Delhi",
      jurisdiction: "Narcotics Intelligence & Special Enforcement",
      status: "ACTIVE",
    },
    {
      code: "DL-POLICE",
      name: "State Police (Delhi)",
      state: "Delhi",
      jurisdiction: "Delhi NCT Police Headquarters",
      status: "ACTIVE",
    },
    {
      code: "IB",
      name: "Intelligence Bureau",
      state: "Central",
      jurisdiction: "National Intelligence Grid",
      status: "ACTIVE",
    },
    {
      code: "CBI",
      name: "Central Bureau of Investigation",
      state: "Central",
      jurisdiction: "Special Crimes Division Headquarters",
      status: "ACTIVE",
    },
    {
      code: "FSL",
      name: "Central Forensic Science Laboratory",
      state: "Delhi",
      jurisdiction: "Forensic Digital & Physical Lab",
      status: "ACTIVE",
    },
  ];

  const deptMap = {};
  for (const dept of departmentsData) {
    const upserted = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, jurisdiction: dept.jurisdiction, status: dept.status },
      create: dept,
    });
    deptMap[dept.code] = upserted.id;
  }
  console.log("Seeded/Verified departments:", Object.keys(deptMap));

  // 2. Canonical Officers matching Page 10 reference image
  const defaultPasswordHash = await bcrypt.hash("Rakshak@2026", 10);

  const canonicalOfficers = [
    {
      badgeNumber: "INS-001",
      name: "Rajesh Kumar",
      email: "rajesh.kumar@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Inspector",
      role: "INVESTIGATOR", // Also has Case Approver and Evidence Viewer capabilities
      jurisdiction: "Delhi NCR",
      unit: "Cyber Crime Department",
      status: "ACTIVE",
      departmentId: deptMap["CCD"],
    },
    {
      badgeNumber: "SI-027",
      name: "Priya Singh",
      email: "priya.singh@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Sub Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Delhi NCR",
      unit: "Cyber Crime Department",
      status: "ACTIVE",
      departmentId: deptMap["CCD"],
    },
    {
      badgeNumber: "HC-105",
      name: "Amit Sharma",
      email: "amit.sharma@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Head Constable",
      role: "INVESTIGATOR",
      jurisdiction: "Delhi NCT",
      unit: "State Police (Delhi)",
      status: "ACTIVE",
      departmentId: deptMap["DL-POLICE"],
    },
    {
      badgeNumber: "SI-043",
      name: "Neha Verma",
      email: "neha.verma@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Sub Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Delhi NCR",
      unit: "Economic Offences Wing",
      status: "SUSPENDED", // Represents Pending / Awaiting Verification
      departmentId: deptMap["EOW"],
    },
    {
      badgeNumber: "INS-012",
      name: "Vikram Patel",
      email: "vikram.patel@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Central Zone",
      unit: "Narcotics Control Bureau",
      status: "ACTIVE",
      departmentId: deptMap["NCB"],
    },
    {
      badgeNumber: "HC-221",
      name: "Sandeep Rai",
      email: "sandeep.rai@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Head Constable",
      role: "VIEWER",
      jurisdiction: "National Command",
      unit: "Intelligence Bureau",
      status: "ACTIVE",
      departmentId: deptMap["IB"],
    },
    {
      badgeNumber: "SI-067",
      name: "Karan Mehta",
      email: "karan.mehta@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Sub Inspector",
      role: "INVESTIGATOR",
      jurisdiction: "Central Special Crimes",
      unit: "CBI",
      status: "ACTIVE",
      departmentId: deptMap["CBI"],
    },
    {
      badgeNumber: "ANL-015",
      name: "Pooja Arora",
      email: "pooja.arora@gov.in",
      passwordHash: defaultPasswordHash,
      designation: "Analyst",
      role: "ANALYST",
      jurisdiction: "Forensic Digital Lab",
      unit: "Forensic Lab",
      status: "INACTIVE",
      departmentId: deptMap["FSL"],
    },
  ];

  for (const off of canonicalOfficers) {
    const existing = await prisma.officer.findUnique({
      where: { badgeNumber: off.badgeNumber },
    });
    if (existing) {
      await prisma.officer.update({
        where: { badgeNumber: off.badgeNumber },
        data: off,
      });
      console.log(`Updated canonical officer: ${off.name} (${off.badgeNumber})`);
    } else {
      await prisma.officer.create({
        data: off,
      });
      console.log(`Created canonical officer: ${off.name} (${off.badgeNumber})`);
    }
  }

  // 3. Seed canonical audit activities shown in bottom left panel
  const activities = [
    {
      officerName: "Rajesh Kumar",
      officerBadge: "INS-001",
      action: "LOGIN_SUCCESS",
      module: "Auth",
      details: "Rajesh Kumar logged in to the system",
      result: "SUCCESS",
      timestamp: new Date("2024-01-15T10:30:00.000Z"),
    },
    {
      officerName: "Priya Singh",
      officerBadge: "SI-027",
      action: "VIEW_EVIDENCE",
      module: "Evidence",
      details: "Priya Singh updated evidence record",
      result: "SUCCESS",
      timestamp: new Date("2024-01-15T09:15:00.000Z"),
    },
    {
      officerName: "Amit Sharma",
      officerBadge: "HC-105",
      action: "UPDATE_CASE",
      module: "Cases",
      details: "Amit Sharma created a new case",
      result: "SUCCESS",
      timestamp: new Date("2024-01-15T08:45:00.000Z"),
    },
    {
      officerName: "Neha Verma",
      officerBadge: "SI-043",
      action: "ACCESS_DENIED",
      module: "Cases",
      details: "Neha Verma requested access to CC/2024/001",
      result: "SUCCESS",
      timestamp: new Date("2024-01-14T17:20:00.000Z"),
    },
  ];

  for (const act of activities) {
    await prisma.auditLog.create({
      data: act,
    });
  }
  console.log("Seeded canonical audit events for Page 10.");

  console.log("Page 10 seeding completed successfully!");
}

seed()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
