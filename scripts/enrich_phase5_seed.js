// ─────────────────────────────────────────────────────────────────────────────
// scripts/enrich_phase5_seed.js
// Populates ExtractedFacts and rich TimelineEvents for EV-101..104 in CASE-2026-0891
// Ensures 100% database-backed timeline and comms data.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Phase 5 timeline and extracted facts...');

  const case0 = await prisma.case.findUnique({
    where: { caseNumber: 'CASE-2026-0891' },
  });
  if (!case0) {
    console.error('CASE-2026-0891 not found');
    return;
  }

  // 1. Ensure ExtractedFacts for EV-101 (GPay Slip)
  await prisma.extractedFact.deleteMany({
    where: { evidenceId: { in: ['EV-101', 'EV-102', 'EV-103', 'EV-104'] } },
  });

  await prisma.extractedFact.createMany({
    data: [
      // EV-101 (GPay Slip 24,999)
      {
        id: 'fact-ev101-01',
        evidenceId: 'EV-101',
        caseId: case0.id,
        entityType: 'UPI',
        rawValue: 'mule88@oksbi',
        normalizedValue: 'mule88@oksbi',
        factAssertion: 'Destination UPI VPA on GPay transfer slip: mule88@oksbi',
        confidence: 0.99,
        sourceHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'OCR_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 120, y: 80, width: 140, height: 24 }),
      },
      {
        id: 'fact-ev101-02',
        evidenceId: 'EV-101',
        caseId: case0.id,
        entityType: 'UTR',
        rawValue: '324598124578',
        normalizedValue: '324598124578',
        factAssertion: 'Bank UTR Ref No: 324598124578 for ₹24,999 transaction',
        confidence: 0.98,
        sourceHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'OCR_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 120, y: 120, width: 160, height: 24 }),
      },
      {
        id: 'fact-ev101-03',
        evidenceId: 'EV-101',
        caseId: case0.id,
        entityType: 'ACCOUNT',
        rawValue: '919876543210',
        normalizedValue: '919876543210',
        factAssertion: 'Paytm Payments Bank mule account: 919876543210',
        confidence: 0.95,
        sourceHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'OCR_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 120, y: 160, width: 130, height: 24 }),
      },

      // EV-102 (WhatsApp Chat Export)
      {
        id: 'fact-ev102-01',
        evidenceId: 'EV-102',
        caseId: case0.id,
        entityType: 'PHONE',
        rawValue: '+919876543210',
        normalizedValue: '+919876543210',
        factAssertion: 'Suspect recruiting contact number on WhatsApp: +919876543210',
        confidence: 1.0,
        sourceHash: '8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PARSER_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 50, y: 40, width: 120, height: 20 }),
      },
      {
        id: 'fact-ev102-02',
        evidenceId: 'EV-102',
        caseId: case0.id,
        entityType: 'TELEGRAM',
        rawValue: '@task_rewards_official',
        normalizedValue: '@task_rewards_official',
        factAssertion: 'Fraudulent Telegram recruitment group: @task_rewards_official',
        confidence: 0.96,
        sourceHash: '8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PARSER_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 50, y: 80, width: 180, height: 20 }),
      },
      {
        id: 'fact-ev102-03',
        evidenceId: 'EV-102',
        caseId: case0.id,
        entityType: 'UPI',
        rawValue: 'mule88@oksbi',
        normalizedValue: 'mule88@oksbi',
        factAssertion: 'Mule UPI VPA shared in chat instructions: mule88@oksbi',
        confidence: 0.99,
        sourceHash: '8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PARSER_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 50, y: 120, width: 140, height: 20 }),
      },
      {
        id: 'fact-ev102-04',
        evidenceId: 'EV-102',
        caseId: case0.id,
        entityType: 'DOMAIN',
        rawValue: 'verify-job-portal.in',
        normalizedValue: 'verify-job-portal.in',
        factAssertion: 'Phishing job registration URL: verify-job-portal.in',
        confidence: 0.98,
        sourceHash: '8e3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PARSER_REGEX_ENGINE',
        boundingBox: JSON.stringify({ x: 50, y: 160, width: 160, height: 20 }),
      },

      // EV-103 (Bank Statement PDF)
      {
        id: 'fact-ev103-01',
        evidenceId: 'EV-103',
        caseId: case0.id,
        entityType: 'IFSC',
        rawValue: 'PYTM0123456',
        normalizedValue: 'PYTM0123456',
        factAssertion: 'Paytm Payments Bank branch IFSC: PYTM0123456',
        confidence: 0.99,
        sourceHash: 'c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d4',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PDF_TEXT_EXTRACTOR',
        boundingBox: JSON.stringify({ x: 80, y: 150, width: 100, height: 20 }),
      },
      {
        id: 'fact-ev103-02',
        evidenceId: 'EV-103',
        caseId: case0.id,
        entityType: 'ACCOUNT',
        rawValue: '919876543210',
        normalizedValue: '919876543210',
        factAssertion: 'Mule beneficiary account on statement: 919876543210',
        confidence: 0.99,
        sourceHash: 'c9d4e8f2a1b7c3d0e5f8a2b6c1d4e9f0a3b7c2d5e8f1a4b9c0d3e6f2a1b5c8d4',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'PDF_TEXT_EXTRACTOR',
        boundingBox: JSON.stringify({ x: 80, y: 190, width: 130, height: 20 }),
      },

      // EV-104 (Call Recording Intercept)
      {
        id: 'fact-ev104-01',
        evidenceId: 'EV-104',
        caseId: case0.id,
        entityType: 'PHONE',
        rawValue: '+919876543210',
        normalizedValue: '+919876543210',
        factAssertion: 'Caller CLI identified in recording metadata: +919876543210',
        confidence: 1.0,
        sourceHash: 'e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f2',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'AUDIO_METADATA_EXTRACTOR',
        boundingBox: JSON.stringify({ x: 100, y: 50, width: 120, height: 20 }),
      },
      {
        id: 'fact-ev104-02',
        evidenceId: 'EV-104',
        caseId: case0.id,
        entityType: 'ACCOUNT',
        rawValue: '919876543210',
        normalizedValue: '919876543210',
        factAssertion: 'Mule account verbally instructed by suspect: 919876543210',
        confidence: 0.94,
        sourceHash: 'e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f2',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'SPEECH_TO_TEXT_NER',
        boundingBox: JSON.stringify({ x: 100, y: 90, width: 130, height: 20 }),
      },
    ],
  });

  // 2. Clear and set complete 10-step timeline for CASE-2026-0891
  await prisma.timelineEvent.deleteMany({
    where: { caseId: case0.id },
  });

  await prisma.timelineEvent.createMany({
    data: [
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-22T06:14:32.000Z'), // 11:44:32 IST
        description: 'First contact initiated by suspect via WhatsApp offering part-time Amazon task reward of ₹500–₹2,000 per review.',
        sourceType: 'WHATSAPP',
        phase: 'CONTACT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-22T09:50:00.000Z'), // 15:20:00 IST
        description: 'Victim responds to WhatsApp job pitch. Suspect sends phishing registration link to verify-job-portal.in.',
        sourceType: 'WHATSAPP',
        phase: 'CONTACT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-23T09:05:17.000Z'), // 14:35:17 IST
        description: 'Demo task completed on Telegram channel. ₹250 commission credited to victim to build trust and demonstrate payout legitimacy.',
        sourceType: 'WHATSAPP',
        phase: 'TRUST',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-24T04:45:00.000Z'), // 10:15:00 IST
        description: 'Second review task verified. Suspect offers high-value Tier 2 upgrade with promised ₹5,000 returns.',
        sourceType: 'WHATSAPP',
        phase: 'TRUST',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-101',
        timestamp: new Date('2026-08-25T11:42:09.000Z'), // 17:12:09 IST
        description: 'First major fraudulent payment: ₹24,999 transferred via GPay to mule UPI handle mule88@oksbi (UTR: 324598124578).',
        sourceType: 'BANK_SMS',
        phase: 'PAYMENT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-104',
        timestamp: new Date('2026-08-26T04:45:00.000Z'), // 10:15:00 IST
        description: 'Extortion audio call: Suspect claims account frozen due to tier upgrade tax, instructs immediate transfer to Paytm account 919876543210.',
        sourceType: 'CALL_LOG',
        phase: 'PAYMENT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-101',
        timestamp: new Date('2026-08-26T14:18:55.000Z'), // 19:48:55 IST
        description: 'Second payment of ₹24,500 transferred to Paytm mule account 919876543210 (IFSC: PYTM0123456) under unfreeze pretext.',
        sourceType: 'BANK_SMS',
        phase: 'PAYMENT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-103',
        timestamp: new Date('2026-08-27T08:30:00.000Z'), // 14:00:00 IST
        description: 'Bank statement audit confirms debits of ₹24,999 and ₹24,500, showing cumulative fraud loss of ₹49,499.',
        sourceType: 'RECEIPT',
        phase: 'PAYMENT',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-28T16:02:11.000Z'), // 21:32:11 IST
        description: 'Suspect demands additional ₹50,000 penalty. Victim refuses and realizes fraud; suspect immediately blocks victim.',
        sourceType: 'WHATSAPP',
        phase: 'SEVERED',
      },
      {
        caseId: case0.id,
        evidenceId: 'EV-102',
        timestamp: new Date('2026-08-29T03:47:43.000Z'), // 09:17:43 IST
        description: 'Suspect contact number +919876543210 switched off. Telegram channel deleted. Formal police complaint filed at Cyber Cell.',
        sourceType: 'WHATSAPP',
        phase: 'SEVERED',
      },
    ],
  });

  console.log('✅ Seed enrichment complete: 11 ExtractedFacts and 10 TimelineEvents inserted.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
