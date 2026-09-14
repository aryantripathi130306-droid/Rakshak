// ─────────────────────────────────────────────────────────────────────────────
// prisma/seed.ts — Cross-case seeded mock data
// Creates 5 interconnected scam cases with shared entities so the graph resolver
// triggers deterministic syndicate alerts during demo evaluation.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding NyayaSetu forensic database...");

  // ─── Case 0: Chandigarh — Active Primary Case (CASE-2026-0891) ───────────
  const case0 = await prisma.case.upsert({
    where: { caseNumber: "CASE-2026-0891" },
    update: {},
    create: {
      caseNumber: "CASE-2026-0891",
      incidentType: "Task_Scam",
      complainantName: "Priya Nair",
      jurisdiction: "Cyber Crime Branch — Sector 17, Chandigarh",
      status: "UNDER_INQUIRY",
      amountDefrauded: 49499,
      createdAt: new Date("2026-08-29T09:17:43.000Z"),
    },
  });

  // ─── Case 1: Delhi — Task Scam ──────────────────────────────────────────
  const case1 = await prisma.case.upsert({
    where: { caseNumber: "CASE-2026-1021" },
    update: {},
    create: {
      caseNumber: "CASE-2026-1021",
      incidentType: "Task_Scam",
      complainantName: "Rahul Verma",
      jurisdiction: "Cyber Cell — Rohini District, Delhi",
      status: "UNDER_INQUIRY",
      amountDefrauded: 72000,
      createdAt: new Date("2026-07-14T11:22:00.000Z"),
    },
  });

  // ─── Case 2: Bengaluru — Task Scam ──────────────────────────────────────
  const case2 = await prisma.case.upsert({
    where: { caseNumber: "CASE-2026-1078" },
    update: {},
    create: {
      caseNumber: "CASE-2026-1078",
      incidentType: "Task_Scam",
      complainantName: "Ananya Krishnamurthy",
      jurisdiction: "Cyber Crime Division — Bengaluru City",
      status: "CHARGESHEETED",
      amountDefrauded: 58500,
      createdAt: new Date("2026-06-28T08:10:00.000Z"),
    },
  });

  // ─── Case 3: Haryana — Investment Fraud ─────────────────────────────────
  const case3 = await prisma.case.upsert({
    where: { caseNumber: "CASE-2026-1134" },
    update: {},
    create: {
      caseNumber: "CASE-2026-1134",
      incidentType: "Investment_Fraud",
      complainantName: "Harpreet Kaur",
      jurisdiction: "Cyber Crime Haryana — Gurugram Unit",
      status: "OPEN",
      amountDefrauded: 165000,
      createdAt: new Date("2026-05-19T14:45:00.000Z"),
    },
  });

  // ─── Case 4: Punjab — Domain Fraud ──────────────────────────────────────
  const case4 = await prisma.case.upsert({
    where: { caseNumber: "CASE-2026-1150" },
    update: {},
    create: {
      caseNumber: "CASE-2026-1150",
      incidentType: "Task_Scam",
      complainantName: "Gurjeet Singh",
      jurisdiction: "Cyber Cell — Amritsar, Punjab",
      status: "OPEN",
      amountDefrauded: 46200,
      createdAt: new Date("2026-04-07T07:33:00.000Z"),
    },
  });

  console.log("✅ Cases seeded:", [case0.caseNumber, case1.caseNumber, case2.caseNumber, case3.caseNumber, case4.caseNumber].join(", "));

  // ─── Evidence for Case 0 ─────────────────────────────────────────────────
  const ev0_1 = await prisma.evidence.upsert({
    where: { id: "EV-101" },
    update: { evidenceCategory: "UPI_FINANCIAL" },
    create: {
      id: "EV-101",
      caseId: case0.id,
      fileName: "GPay_Slip_24999.png",
      fileType: "PNG",
      mimeType: "image/png",
      fileSize: 290816,
      sha256Hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      clientHash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      storagePath: "/uploads/raw/7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069.bin",
      evidenceCategory: "UPI_FINANCIAL",
      uploadedAt: new Date("2026-08-29T09:22:11.000Z"),
    },
  });

  const ev0_2 = await prisma.evidence.upsert({
    where: { id: "EV-102" },
    update: { evidenceCategory: "CHAT" },
    create: {
      id: "EV-102",
      caseId: case0.id,
      fileName: "WhatsApp_Chat_Export.txt",
      fileType: "TXT",
      mimeType: "text/plain",
      fileSize: 49152,
      sha256Hash: "8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
      clientHash: "8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
      storagePath: "/uploads/raw/8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a.bin",
      evidenceCategory: "CHAT",
      uploadedAt: new Date("2026-08-29T09:25:44.000Z"),
    },
  });

  const ev0_3 = await prisma.evidence.upsert({
    where: { id: "EV-103" },
    update: { evidenceCategory: "UPI_FINANCIAL" },
    create: {
      id: "EV-103",
      caseId: case0.id,
      fileName: "Bank_Statement_Aug2026.pdf",
      fileType: "PDF",
      mimeType: "application/pdf",
      fileSize: 1153433,
      sha256Hash: "c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d4",
      clientHash: "c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d4",
      storagePath: "/uploads/raw/c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d4.bin",
      evidenceCategory: "UPI_FINANCIAL",
      uploadedAt: new Date("2026-08-29T09:31:02.000Z"),
    },
  });

  const ev0_4 = await prisma.evidence.upsert({
    where: { id: "EV-104" },
    update: { evidenceCategory: "CALL_LOG" },
    create: {
      id: "EV-104",
      caseId: case0.id,
      fileName: "Call_Recording_Intercept.wav",
      fileType: "WAV",
      mimeType: "audio/wav",
      fileSize: 1887436,
      sha256Hash: "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f2",
      clientHash: "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f2",
      storagePath: "/uploads/raw/e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f2.bin",
      evidenceCategory: "CALL_LOG",
      uploadedAt: new Date("2026-08-29T09:44:18.000Z"),
    },
  });

  // ─── Evidence for Case 1–4 ───────────────────────────────────────────────
  const ev1 = await prisma.evidence.upsert({
    where: { id: "ev-seed-1021-001" },
    update: { evidenceCategory: "UPI_FINANCIAL" },
    create: {
      id: "ev-seed-1021-001",
      caseId: case1.id,
      fileName: "GPay_Slip_72000.png",
      fileType: "PNG",
      mimeType: "image/png",
      fileSize: 298112,
      sha256Hash: "4a3f8c2b1d9e7f0a5b6c3d2e1f8a4b9c0d7e2f5a8b3c6d1e4f7a0b9c2d5e8f1",
      clientHash: "4a3f8c2b1d9e7f0a5b6c3d2e1f8a4b9c0d7e2f5a8b3c6d1e4f7a0b9c2d5e8f1",
      storagePath: "/uploads/raw/4a3f8c2b1d9e7f0a5b6c3d2e1f8a4b9c0d7e2f5a8b3c6d1e4f7a0b9c2d5e8f1.bin",
      evidenceCategory: "UPI_FINANCIAL",
    },
  });

  const ev2 = await prisma.evidence.upsert({
    where: { id: "ev-seed-1078-001" },
    update: { evidenceCategory: "CHAT" },
    create: {
      id: "ev-seed-1078-001",
      caseId: case2.id,
      fileName: "WhatsApp_Chat_1078.txt",
      fileType: "TXT",
      mimeType: "text/plain",
      fileSize: 58240,
      sha256Hash: "b2e5f8a1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5",
      clientHash: "b2e5f8a1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5",
      storagePath: "/uploads/raw/b2e5f8a1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5.bin",
      evidenceCategory: "CHAT",
    },
  });

  const ev3 = await prisma.evidence.upsert({
    where: { id: "ev-seed-1134-001" },
    update: { evidenceCategory: "DOCUMENT" },
    create: {
      id: "ev-seed-1134-001",
      caseId: case3.id,
      fileName: "Bank_Statement_1134.pdf",
      fileType: "PDF",
      mimeType: "application/pdf",
      fileSize: 1245184,
      sha256Hash: "c3d6e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6",
      clientHash: "c3d6e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6",
      storagePath: "/uploads/raw/c3d6e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6.bin",
      evidenceCategory: "DOCUMENT",
    },
  });

  const ev4 = await prisma.evidence.upsert({
    where: { id: "ev-seed-1150-001" },
    update: { evidenceCategory: "CALL_LOG" },
    create: {
      id: "ev-seed-1150-001",
      caseId: case4.id,
      fileName: "Call_Log_1150.pdf",
      fileType: "PDF",
      mimeType: "application/pdf",
      fileSize: 890112,
      sha256Hash: "d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7",
      clientHash: "d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7",
      storagePath: "/uploads/raw/d4e7f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7.bin",
      evidenceCategory: "CALL_LOG",
    },
  });

  console.log("✅ Evidence seeded");

  // ─── CaseEntity seeds — Multi-Jurisdiction Mule Syndicate Linkages ────────
  // Case 0 (Chandigarh - Active):
  await upsertEntity(case0.id, "UPI",     "mule88@oksbi",          "mule88@oksbi");
  await upsertEntity(case0.id, "PHONE",   "+919876543210",         "+919876543210");
  await upsertEntity(case0.id, "DOMAIN",  "verify-job-portal.in",  "verify-job-portal.in");
  await upsertEntity(case0.id, "ACCOUNT", "919876543210",          "919876543210");
  await upsertEntity(case0.id, "IFSC",    "PYTM0123456",           "PYTM0123456");

  // Case 1 (Delhi): UPI mule88@oksbi + Phone +919876543210
  await upsertEntity(case1.id, "UPI",   "mule88@oksbi",  "mule88@oksbi");
  await upsertEntity(case1.id, "PHONE", "+919876543210", "+919876543210");

  // Case 2 (Bengaluru): UPI mule88@oksbi + Domain verify-job-portal.in
  await upsertEntity(case2.id, "UPI",    "mule88@oksbi",         "mule88@oksbi");
  await upsertEntity(case2.id, "DOMAIN", "verify-job-portal.in", "verify-job-portal.in");

  // Case 3 (Haryana): Phone +919876543210 + Account + IFSC
  await upsertEntity(case3.id, "PHONE",   "+919876543210",  "+919876543210");
  await upsertEntity(case3.id, "ACCOUNT", "919876543210",   "919876543210");
  await upsertEntity(case3.id, "IFSC",    "PYTM0123456",    "PYTM0123456");

  // Case 4 (Punjab): Domain verify-job-portal.in
  await upsertEntity(case4.id, "DOMAIN", "verify-job-portal.in", "verify-job-portal.in");

  console.log("✅ CaseEntity records seeded (5-node cross-case syndicate network)");

  // ─── Timeline events for Case 0 ──────────────────────────────────────────
  await prisma.timelineEvent.deleteMany({ where: { caseId: case0.id } });
  await prisma.timelineEvent.createMany({
    data: [
      {
        caseId: case0.id, evidenceId: ev0_2.id,
        timestamp: new Date("2026-08-22T06:14:32.000Z"),
        description: "First contact initiated by suspect via WhatsApp. Account presented as 'Amazon Task Reward Programme — Official.' Promised ₹500–₹2,000 per review.",
        sourceType: "WHATSAPP", phase: "CONTACT",
      },
      {
        caseId: case0.id, evidenceId: ev0_2.id,
        timestamp: new Date("2026-08-23T09:05:17.000Z"),
        description: "Victim directed to Telegram channel. First task completed (₹250 commission received). Trust-building phase established.",
        sourceType: "WHATSAPP", phase: "TRUST",
      },
      {
        caseId: case0.id, evidenceId: ev0_1.id,
        timestamp: new Date("2026-08-25T11:42:09.000Z"),
        description: "First payment of ₹24,999 transferred via GPay to UPI handle mule88@oksbi under pretext of 'Tier 2 Task Upgrade'.",
        sourceType: "BANK_SMS", phase: "PAYMENT",
      },
      {
        caseId: case0.id, evidenceId: ev0_1.id,
        timestamp: new Date("2026-08-26T14:18:55.000Z"),
        description: "Second payment of ₹24,500 transferred to account 919876543210 (PYTM0123456) after suspect claimed account frozen by system.",
        sourceType: "BANK_SMS", phase: "PAYMENT",
      },
      {
        caseId: case0.id, evidenceId: ev0_2.id,
        timestamp: new Date("2026-08-28T16:02:11.000Z"),
        description: "Suspect demanded additional ₹50,000 penalty. Victim realized scam, communications blocked by suspect. Account link severed.",
        sourceType: "WHATSAPP", phase: "SEVERED",
      },
    ],
  });

  // ─── Timeline events for Case 1 ──────────────────────────────────────────
  await prisma.timelineEvent.deleteMany({ where: { caseId: case1.id } });
  await prisma.timelineEvent.createMany({
    data: [
      {
        caseId: case1.id, evidenceId: ev1.id,
        timestamp: new Date("2026-07-01T07:30:00.000Z"),
        description: "Suspect sent WhatsApp message with job offer for part-time review tasks.",
        sourceType: "WHATSAPP", phase: "CONTACT",
      },
      {
        caseId: case1.id, evidenceId: ev1.id,
        timestamp: new Date("2026-07-05T12:00:00.000Z"),
        description: "₹500 commission credited as trust-building. Task completed on Telegram group.",
        sourceType: "WHATSAPP", phase: "TRUST",
      },
      {
        caseId: case1.id, evidenceId: ev1.id,
        timestamp: new Date("2026-07-10T14:32:00.000Z"),
        description: "Victim transferred ₹72,000 to mule88@oksbi for 'combo task unlock'.",
        sourceType: "BANK_SMS", phase: "PAYMENT",
      },
      {
        caseId: case1.id, evidenceId: ev1.id,
        timestamp: new Date("2026-07-12T09:00:00.000Z"),
        description: "Suspect's number switched off. Telegram channel deleted. Account frozen.",
        sourceType: "WHATSAPP", phase: "SEVERED",
      },
    ],
  });

  // ─── Timeline events for Case 2 ──────────────────────────────────────────
  await prisma.timelineEvent.deleteMany({ where: { caseId: case2.id } });
  await prisma.timelineEvent.createMany({
    data: [
      {
        caseId: case2.id, evidenceId: ev2.id,
        timestamp: new Date("2026-06-15T06:00:00.000Z"),
        description: "Victim received unsolicited message via WhatsApp advertising high-return investment via verify-job-portal.in.",
        sourceType: "WHATSAPP", phase: "CONTACT",
      },
      {
        caseId: case2.id, evidenceId: ev2.id,
        timestamp: new Date("2026-06-22T11:15:00.000Z"),
        description: "Victim paid ₹58,500 via UPI to mule88@oksbi for 'premium membership'.",
        sourceType: "BANK_SMS", phase: "PAYMENT",
      },
    ],
  });

  // ─── Case Cluster Seeding (Phase A6 & Change 3) ─────────────────────────
  const cluster = await prisma.caseCluster.upsert({
    where: { id: "cluster-task-scam-01" },
    update: {},
    create: {
      id: "cluster-task-scam-01",
      name: "Task Scam Syndicate — Pan-India Mule Network",
      theme: "Task_Scam",
      status: "ACTIVE",
      confidence: "PROBABLE",
      notes: "Cross-jurisdiction ring operating across Chandigarh, Delhi, Bengaluru, Haryana, and Punjab using shared mule account mule88@oksbi and domain verify-job-portal.in.",
    },
  });

  const clusterCases = [
    { caseId: case0.id, reason: "Primary anchor case: contains direct mule payments to mule88@oksbi and communication via suspect phone" },
    { caseId: case1.id, reason: "Exact matching UPI VPA mule88@oksbi and suspect contact +919876543210 (Delhi Cyber Cell)" },
    { caseId: case2.id, reason: "Shared UPI VPA mule88@oksbi and phishing domain verify-job-portal.in (Bengaluru City)" },
    { caseId: case3.id, reason: "Shared payout account 919876543210 and IFSC PYTM0123456 (Haryana Gurugram Unit)" },
    { caseId: case4.id, reason: "Shared infrastructure domain verify-job-portal.in (Amritsar Punjab)" },
  ];

  for (const m of clusterCases) {
    await prisma.clusterMembership.upsert({
      where: { clusterId_caseId: { clusterId: cluster.id, caseId: m.caseId } },
      update: { reason: m.reason },
      create: { clusterId: cluster.id, caseId: m.caseId, reason: m.reason },
    });
  }
  console.log("✅ CaseCluster and Memberships seeded (5 member cases)");

  // ─── Transcription Seeding for EV-104 (Audio Intercept) ─────────────────
  const transcriptionSegments = [
    {
      timestamp: "00:00:12",
      speaker: "Speaker A (Suspect)",
      originalText: "हां जी मैडम, आपका अमेज़न टास्क रिवॉर्ड अकाउंट वेरीफाई हो गया है।",
      translatedText: "Yes ma'am, your Amazon Task Reward account has been verified.",
    },
    {
      timestamp: "00:00:28",
      speaker: "Speaker B (Victim)",
      originalText: "मैंने पहले ही ₹24,999 भेजे हैं, मेरा कमीशन कब आएगा?",
      translatedText: "I already sent ₹24,999, when will my commission arrive?",
    },
    {
      timestamp: "00:00:45",
      speaker: "Speaker A (Suspect)",
      originalText: "सिस्टम में टियर-2 अनलॉक के लिए आपको बाकी ₹24,500 पेटीएम अकाउंट 919876543210 पर ट्रांसफर करने होंगे।",
      translatedText: "For Tier-2 unlock in the system, you need to transfer the remaining ₹24,500 to Paytm account 919876543210.",
    },
    {
      timestamp: "00:01:10",
      speaker: "Speaker B (Victim)",
      originalText: "क्या इसके बाद मुझे पूरा पैसा ₹49,499 वापस मिल जाएगा?",
      translatedText: "Will I get the entire ₹49,499 back after this?",
    },
    {
      timestamp: "00:01:25",
      speaker: "Speaker A (Suspect)",
      originalText: "बिल्कुल, 10 मिनट के अंदर सारा अमाउंट आपके बैंक में क्रेडिट हो जाएगा। आप mule88@oksbi पर भी चेक कर सकते हैं।",
      translatedText: "Absolutely, within 10 minutes the whole amount will be credited to your bank. You can also verify at mule88@oksbi.",
    },
    {
      timestamp: "00:01:50",
      speaker: "Speaker A (Suspect)",
      originalText: "जल्दी कीजिए, यह ऑफर सिर्फ आज दोपहर 3 बजे तक वैध है।",
      translatedText: "Hurry up, this offer is only valid till 3 PM today.",
    },
  ];

  await prisma.transcription.upsert({
    where: { id: "trans-104-01" },
    update: {},
    create: {
      id: "trans-104-01",
      evidenceId: ev0_4.id,
      originalLanguage: "hi",
      targetLanguage: "en",
      speakerCount: 2,
      transcriptionMethod: "WHISPER_AI",
      confidence: 0.94,
      originalText: transcriptionSegments.map(s => `[${s.timestamp}] ${s.speaker}: ${s.originalText}`).join("\n"),
      translatedText: transcriptionSegments.map(s => `[${s.timestamp}] ${s.speaker}: ${s.translatedText}`).join("\n"),
      segments: JSON.stringify(transcriptionSegments),
    },
  });
  console.log("✅ Transcription record seeded for EV-104");

  // ─── Chat Translation Seeding for EV-102 (WhatsApp Chat) ─────────────────
  const chatMessages = [
    {
      sender: "+919876543210",
      timestamp: "2026-08-22T06:14:32Z",
      originalText: "नमस्ते! Amazon Task Reward Programme mein aapka swagat hai.",
      translatedText: "Hello! Welcome to the Amazon Task Reward Programme.",
      language: "hinglish",
    },
    {
      sender: "Victim (Priya)",
      timestamp: "2026-08-22T06:16:10Z",
      originalText: "Ye kya kaam hai aur kitna payment milega?",
      translatedText: "What is this work and how much payment will I receive?",
      language: "hinglish",
    },
    {
      sender: "+919876543210",
      timestamp: "2026-08-22T06:18:45Z",
      originalText: "Aapko daily 5 product review karne honge. Har review ka ₹250-₹500 milega. Pehle demo task complete kijiye.",
      translatedText: "You have to do 5 product reviews daily. You will get ₹250-₹500 per review. First complete the demo task.",
      language: "hinglish",
    },
    {
      sender: "+919876543210",
      timestamp: "2026-08-25T11:30:15Z",
      originalText: "Tier 2 upgrade ke liye ₹24,999 mule88@oksbi par pay kijiye. Commission turant aayega.",
      translatedText: "For Tier 2 upgrade please pay ₹24,999 to mule88@oksbi. Commission will arrive immediately.",
      language: "hinglish",
    },
    {
      sender: "Victim (Priya)",
      timestamp: "2026-08-25T11:42:09Z",
      originalText: "Payment ho gaya hai, UTR 324598124578. Check kijiye.",
      translatedText: "Payment is done, UTR 324598124578. Please check.",
      language: "hinglish",
    },
    {
      sender: "+919876543210",
      timestamp: "2026-08-26T14:10:00Z",
      originalText: "System error ho gaya hai. Aapko ₹24,500 account 919876543210 IFSC PYTM0123456 me send karna hoga unfreeze ke liye.",
      translatedText: "A system error occurred. You need to send ₹24,500 to account 919876543210 IFSC PYTM0123456 to unfreeze.",
      language: "hinglish",
    },
  ];

  await prisma.chatTranslation.upsert({
    where: { id: "chat-trans-102-01" },
    update: {},
    create: {
      id: "chat-trans-102-01",
      evidenceId: ev0_2.id,
      originalLanguage: "hinglish",
      translationMethod: "INDIC_TRANS_AI",
      messages: JSON.stringify(chatMessages),
    },
  });
  console.log("✅ ChatTranslation record seeded for EV-102");

  console.log("✅ Timeline events seeded for all cases");
  console.log("🎉 Complete! The NyayaSetu database is live and fully linked with v3 features.");
}

async function upsertEntity(
  caseId: string,
  entityType: string,
  rawValue: string,
  normalizedValue: string
) {
  await prisma.caseEntity.upsert({
    where: {
      caseId_entityType_normalizedValue: { caseId, entityType, normalizedValue },
    },
    update: {},
    create: { caseId, entityType, rawValue, normalizedValue },
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
