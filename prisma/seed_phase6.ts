import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Phase 6 Cross-Case Syndicate Intelligence data...");

  // 1. Cases
  const casesData = [
    {
      caseNumber: "CASE-2026-0932",
      incidentType: "Digital_Arrest",
      complainantName: "Kavita Rao",
      jurisdiction: "Cyber Police Station — BKC, Mumbai",
      status: "UNDER_INQUIRY",
      amountDefrauded: 480000,
      createdAt: new Date("2026-08-10T10:00:00Z"),
    },
    {
      caseNumber: "CASE-2026-1032",
      incidentType: "Investment_Fraud",
      complainantName: "Suresh Desai",
      jurisdiction: "Cyber Cell — South Region, Mumbai",
      status: "OPEN",
      amountDefrauded: 320000,
      createdAt: new Date("2026-07-20T11:00:00Z"),
    },
    {
      caseNumber: "CASE-2026-0987",
      incidentType: "Digital_Arrest",
      complainantName: "Mahesh Joshi",
      jurisdiction: "Special Cyber Cell — Jaipur, Rajasthan",
      status: "UNDER_INQUIRY",
      amountDefrauded: 350000,
      createdAt: new Date("2026-08-01T09:30:00Z"),
    },
    {
      caseNumber: "CASE-2026-0765",
      incidentType: "Task_Scam",
      complainantName: "Deepak Reddy",
      jurisdiction: "Cyber Crime Division — Bengaluru City",
      status: "CHARGESHEETED",
      amountDefrauded: 220000,
      createdAt: new Date("2026-08-15T14:15:00Z"),
    },
    {
      caseNumber: "CASE-2026-0654",
      incidentType: "Investment_Fraud",
      complainantName: "Vikas Kulkarni",
      jurisdiction: "Cyber Crime Cell — Shivajinagar, Pune",
      status: "OPEN",
      amountDefrauded: 540000,
      createdAt: new Date("2026-08-20T16:00:00Z"),
    },
    {
      caseNumber: "CASE-2026-0521",
      incidentType: "Task_Scam",
      complainantName: "Rajesh Goud",
      jurisdiction: "Cyber Crimes Wing — CID Telangana",
      status: "OPEN",
      amountDefrauded: 288801,
      createdAt: new Date("2026-08-25T12:00:00Z"),
    },
  ];

  const caseMap = new Map<string, string>(); // caseNumber -> id

  // Load existing cases into map
  const existingCases = await prisma.case.findMany();
  existingCases.forEach((c) => caseMap.set(c.caseNumber, c.id));

  // Upsert new cases
  for (const c of casesData) {
    const record = await prisma.case.upsert({
      where: { caseNumber: c.caseNumber },
      update: {
        amountDefrauded: c.amountDefrauded,
        jurisdiction: c.jurisdiction,
        status: c.status,
      },
      create: c,
    });
    caseMap.set(c.caseNumber, record.id);
  }

  console.log(`Cases in database: ${caseMap.size}`);

  // Helper for upserting CaseEntity
  async function addCaseEntity(caseNumber: string, entityType: string, raw: string, norm: string) {
    const caseId = caseMap.get(caseNumber);
    if (!caseId) return;
    await prisma.caseEntity.upsert({
      where: {
        caseId_entityType_normalizedValue: {
          caseId,
          entityType,
          normalizedValue: norm,
        },
      },
      update: {},
      create: {
        caseId,
        entityType,
        rawValue: raw,
        normalizedValue: norm,
      },
    });
  }

  // All 12 cases in syndicate
  const allCaseNumbers = [
    "CASE-2026-0891",
    "CASE-2026-1021",
    "CASE-2026-1078",
    "CASE-2026-1134",
    "CASE-2026-1150",
    "CASE-2026-1151",
    "CASE-2026-0932",
    "CASE-2026-1032",
    "CASE-2026-0987",
    "CASE-2026-0765",
    "CASE-2026-0654",
    "CASE-2026-0521",
  ];

  // Primary central hub: +91 9876543210 (in all 12 cases)
  for (const cn of allCaseNumbers) {
    await addCaseEntity(cn, "PHONE", "+91 9876543210", "+919876543210");
    await addCaseEntity(cn, "UPI", "rahul123@paytm", "rahul123@paytm");
  }

  // amit456@oksbi in 8 cases
  for (const cn of allCaseNumbers.slice(0, 8)) {
    await addCaseEntity(cn, "UPI", "amit456@oksbi", "amit456@oksbi");
  }

  // task-reward@paytm in 5 cases
  for (const cn of ["CASE-2026-0891", "CASE-2026-0765", "CASE-2026-0932", "CASE-2026-0987", "CASE-2026-0654"]) {
    await addCaseEntity(cn, "UPI", "task-reward@paytm", "task-reward@paytm");
  }

  // HDFC0001234 in 5 cases
  for (const cn of ["CASE-2026-0891", "CASE-2026-1032", "CASE-2026-0932", "CASE-2026-0765", "CASE-2026-0654"]) {
    await addCaseEntity(cn, "IFSC", "HDFC0001234", "HDFC0001234");
  }

  // SBIIN0012345 in 3 cases
  for (const cn of ["CASE-2026-0891", "CASE-2026-0765", "CASE-2026-0987"]) {
    await addCaseEntity(cn, "IFSC", "SBIIN0012345", "SBIIN0012345");
  }

  // task-reward.com in 4 cases
  for (const cn of ["CASE-2026-0891", "CASE-2026-0765", "CASE-2026-0987", "CASE-2026-0654"]) {
    await addCaseEntity(cn, "DOMAIN", "task-reward.com", "task-reward.com");
  }

  // Person nodes / entities
  for (const cn of ["CASE-2026-0891", "CASE-2026-1021", "CASE-2026-0932", "CASE-2026-0765"]) {
    await addCaseEntity(cn, "NAME", "Rahul Sharma", "Rahul Sharma");
  }
  for (const cn of ["CASE-2026-0891", "CASE-2026-0932", "CASE-2026-1032", "CASE-2026-0654"]) {
    await addCaseEntity(cn, "NAME", "Amit Kumar", "Amit Kumar");
  }
  for (const cn of ["CASE-2026-0765", "CASE-2026-0987", "CASE-2026-0521"]) {
    await addCaseEntity(cn, "NAME", "Neha Verma", "Neha Verma");
  }

  // Additional co-occurring entities
  for (const cn of ["CASE-2026-0891", "CASE-2026-0765", "CASE-2026-1032"]) {
    await addCaseEntity(cn, "PHONE", "+91 9123456789", "+919123456789");
    await addCaseEntity(cn, "ACCOUNT", "420680123456", "420680123456");
    await addCaseEntity(cn, "EMAIL", "scamteam@gmail.com", "scamteam@gmail.com");
    await addCaseEntity(cn, "IP", "103.45.67.89", "103.45.67.89");
  }

  // 3. Upsert Supporting Evidences
  const evidences = [
    {
      id: "EV-2026-0043",
      caseNumber: "CASE-2026-0891",
      fileName: "whatsapp_chat.zip",
      fileType: "ZIP",
      evidenceCategory: "CHAT",
      sha256Hash: "4343434343434343434343434343434343434343434343434343434343434343",
    },
    {
      id: "EV-2026-0076",
      caseNumber: "CASE-2026-1032",
      fileName: "payment_screenshot.jpg",
      fileType: "JPG",
      evidenceCategory: "UPI_FINANCIAL",
      sha256Hash: "7676767676767676767676767676767676767676767676767676767676767676",
    },
    {
      id: "EV-2026-0091",
      caseNumber: "CASE-2026-0987",
      fileName: "call_recording.m4a",
      fileType: "M4A",
      evidenceCategory: "AUDIO",
      sha256Hash: "9191919191919191919191919191919191919191919191919191919191919191",
    },
    {
      id: "EV-2026-0112",
      caseNumber: "CASE-2026-0765",
      fileName: "bank_statement.pdf",
      fileType: "PDF",
      evidenceCategory: "UPI_FINANCIAL",
      sha256Hash: "1212121212121212121212121212121212121212121212121212121212121212",
    },
    {
      id: "EV-2026-0134",
      caseNumber: "CASE-2026-0654",
      fileName: "telegram_chat.txt",
      fileType: "TXT",
      evidenceCategory: "CHAT",
      sha256Hash: "3434343434343434343434343434343434343434343434343434343434343434",
    },
  ];

  for (const ev of evidences) {
    const cid = caseMap.get(ev.caseNumber);
    if (!cid) continue;
    await prisma.evidence.upsert({
      where: { id: ev.id },
      update: { evidenceCategory: ev.evidenceCategory },
      create: {
        id: ev.id,
        caseId: cid,
        fileName: ev.fileName,
        fileType: ev.fileType,
        mimeType: "application/octet-stream",
        fileSize: 1048576,
        sha256Hash: ev.sha256Hash,
        clientHash: ev.sha256Hash,
        storagePath: `/uploads/raw/${ev.sha256Hash}.bin`,
        evidenceCategory: ev.evidenceCategory,
      },
    });

    // Link ExtractedFact for primary phone & UPI
    await prisma.extractedFact.upsert({
      where: { id: `fact-${ev.id}-phone` },
      update: {},
      create: {
        id: `fact-${ev.id}-phone`,
        evidenceId: ev.id,
        caseId: cid,
        factAssertion: `Discovered mobile number +91 9876543210 in ${ev.fileName}`,
        entityType: "PHONE",
        rawValue: "+91 9876543210",
        normalizedValue: "+919876543210",
        confidence: 0.98,
        sourceHash: ev.sha256Hash,
        verificationStatus: "VERIFIED",
        verifiedBy: "Inspector Rajesh Kumar (Badge #DL-CY-042)",
      },
    });

    await prisma.extractedFact.upsert({
      where: { id: `fact-${ev.id}-upi` },
      update: {},
      create: {
        id: `fact-${ev.id}-upi`,
        evidenceId: ev.id,
        caseId: cid,
        factAssertion: `Observed UPI VPA rahul123@paytm in ${ev.fileName}`,
        entityType: "UPI",
        rawValue: "rahul123@paytm",
        normalizedValue: "rahul123@paytm",
        confidence: 0.96,
        sourceHash: ev.sha256Hash,
        verificationStatus: "VERIFIED",
        verifiedBy: "SI Anjali Kapoor (Badge #CCB-0912)",
      },
    });
  }

  // 4. Timeline Events for Recent Activity Feed
  const recentEvents = [
    {
      id: "evt-feed-01",
      caseNumber: "CASE-2026-0765",
      evidenceId: "EV-2026-0112",
      timestamp: new Date("2026-12-18T16:42:00Z"),
      description: "Found in #CASE-2026-0765 (Fake Job Scam)",
      sourceType: "WHATSAPP",
      phase: "CONTACT",
    },
    {
      id: "evt-feed-02",
      caseNumber: "CASE-2026-1032",
      evidenceId: "EV-2026-0076",
      timestamp: new Date("2026-12-16T14:28:00Z"),
      description: "UPI payment to amit456@oksbi (₹25,000)",
      sourceType: "BANK_SMS",
      phase: "PAYMENT",
    },
    {
      id: "evt-feed-03",
      caseNumber: "CASE-2026-0987",
      evidenceId: "EV-2026-0091",
      timestamp: new Date("2026-12-14T11:05:00Z"),
      description: "Outgoing call (duration 04:32)",
      sourceType: "CALL_LOG",
      phase: "TRUST",
    },
    {
      id: "evt-feed-04",
      caseNumber: "CASE-2026-0891",
      evidenceId: "EV-2026-0043",
      timestamp: new Date("2026-12-12T13:18:00Z"),
      description: "Message: \"Payment done\" (WhatsApp)",
      sourceType: "WHATSAPP",
      phase: "PAYMENT",
    },
    {
      id: "evt-feed-05",
      caseNumber: "CASE-2026-0987",
      evidenceId: "EV-2026-0091",
      timestamp: new Date("2026-12-11T09:45:00Z"),
      description: "Found in #CASE-2026-0987 (Digital Arrest)",
      sourceType: "SCREENSHOT",
      phase: "CONTACT",
    },
  ];

  for (const e of recentEvents) {
    const cid = caseMap.get(e.caseNumber);
    if (!cid) continue;
    await prisma.timelineEvent.upsert({
      where: { id: e.id },
      update: { description: e.description },
      create: {
        id: e.id,
        caseId: cid,
        evidenceId: e.evidenceId,
        timestamp: e.timestamp,
        description: e.description,
        sourceType: e.sourceType,
        phase: e.phase,
      },
    });
  }

  console.log("Phase 6 data seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
