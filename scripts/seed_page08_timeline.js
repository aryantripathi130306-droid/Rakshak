// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_page08_timeline.js
// Seeds canonical investigation timeline events for Page 08:
// Investigation Timeline & Event Details in Rakshak v3.0
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Page 08 Timeline events...');

  // Ensure case CC/2024/001 exists
  const caseRecord = await prisma.case.upsert({
    where: { caseNumber: 'CC/2024/001' },
    update: {
      incidentType: 'Financial_Fraud',
      description: 'Financial Fraud Investigation',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'UNDER_INVESTIGATION',
      amountDefrauded: 4500000,
    },
    create: {
      caseNumber: 'CC/2024/001',
      incidentType: 'Financial_Fraud',
      complainantName: 'Aman Gupta',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'UNDER_INVESTIGATION',
      amountDefrauded: 4500000,
      description: 'Financial Fraud Investigation',
      firNumber: 'FIR-2024-CC-001',
      officerName: 'Inspector Rajesh Kumar',
      officerBadge: 'DL-CC-001',
    },
  });

  // Ensure evidence MOBILE_001.jpg exists
  const evidenceRecord = await prisma.evidence.upsert({
    where: { id: 'ev-cc001-mobile' },
    update: {
      fileName: 'MOBILE_001.jpg',
      fileType: 'JPG',
      mimeType: 'image/jpeg',
      fileSize: 2516582, // ~2.4 MB
      sha256Hash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      clientHash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      storagePath: '/uploads/raw/mobile_001.jpg',
      evidenceCategory: 'CRIME_SCENE_PHOTO',
    },
    create: {
      id: 'ev-cc001-mobile',
      caseId: caseRecord.id,
      fileName: 'MOBILE_001.jpg',
      fileType: 'JPG',
      mimeType: 'image/jpeg',
      fileSize: 2516582,
      sha256Hash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      clientHash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      storagePath: '/uploads/raw/mobile_001.jpg',
      evidenceCategory: 'CRIME_SCENE_PHOTO',
    },
  });

  // Also ensure BANK_STMT.pdf, EMAIL_TRAIL.eml, DEVICE_DUMP.zip
  const bankEvidence = await prisma.evidence.upsert({
    where: { id: 'ev-cc045-bank' },
    update: {
      fileName: 'BANK_STMT.pdf',
      fileType: 'PDF',
      fileSize: 1845000,
      sha256Hash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      clientHash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      storagePath: '/uploads/raw/bank_stmt.pdf',
    },
    create: {
      id: 'ev-cc045-bank',
      caseId: caseRecord.id,
      fileName: 'BANK_STMT.pdf',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      fileSize: 1845000,
      sha256Hash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      clientHash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      storagePath: '/uploads/raw/bank_stmt.pdf',
      evidenceCategory: 'UPI_FINANCIAL',
    },
  });

  const emailEvidence = await prisma.evidence.upsert({
    where: { id: 'ev-cc045-email' },
    update: {
      fileName: 'EMAIL_TRAIL.eml',
      fileType: 'EML',
      fileSize: 420000,
      sha256Hash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      clientHash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      storagePath: '/uploads/raw/email_trail.eml',
    },
    create: {
      id: 'ev-cc045-email',
      caseId: caseRecord.id,
      fileName: 'EMAIL_TRAIL.eml',
      fileType: 'EML',
      mimeType: 'message/rfc822',
      fileSize: 420000,
      sha256Hash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      clientHash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      storagePath: '/uploads/raw/email_trail.eml',
      evidenceCategory: 'EMAIL',
    },
  });

  const deviceDumpEvidence = await prisma.evidence.upsert({
    where: { id: 'ev-cc078-dump' },
    update: {
      fileName: 'DEVICE_DUMP.zip',
      fileType: 'ZIP',
      fileSize: 45200000,
      sha256Hash: 'd41d8cd98f00b204e9800998ecf8427e0123456789abcdef0123456789abcdef',
      clientHash: 'd41d8cd98f00b204e9800998ecf8427e0123456789abcdef0123456789abcdef',
      storagePath: '/uploads/raw/device_dump.zip',
    },
    create: {
      id: 'ev-cc078-dump',
      caseId: caseRecord.id,
      fileName: 'DEVICE_DUMP.zip',
      fileType: 'ZIP',
      mimeType: 'application/zip',
      fileSize: 45200000,
      sha256Hash: 'd41d8cd98f00b204e9800998ecf8427e0123456789abcdef0123456789abcdef',
      clientHash: 'd41d8cd98f00b204e9800998ecf8427e0123456789abcdef0123456789abcdef',
      storagePath: '/uploads/raw/device_dump.zip',
      evidenceCategory: 'FORENSIC_IMAGE',
    },
  });

  // Timeline canonical events matching reference image
  const timelineEvents = [
    {
      id: 'EVT-2024-001001',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-15T10:30:00Z'),
      description: 'Case CC/2024/001 created by Inspector Rajesh Kumar',
      sourceType: 'CASE_MGMT',
      phase: 'CONTACT',
    },
    {
      id: 'EVT-2024-001245', // Highlighted/selected event in the reference image
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-15T11:20:00Z'),
      description: 'mobile_001.jpg accepted into evidence',
      sourceType: 'SCREENSHOT',
      phase: 'CONTACT',
    },
    {
      id: 'EVT-2024-001003',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-15T12:15:00Z'),
      description: 'Phone number +91 98765 43210 linked to case',
      sourceType: 'WHATSAPP',
      phase: 'CONTACT',
    },
    {
      id: 'EVT-2024-001004',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-16T09:45:00Z'),
      description: 'Initial forensic analysis completed on mobile device',
      sourceType: 'CALL_LOG',
      phase: 'TRUST',
    },
    {
      id: 'EVT-2024-001005',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-16T14:30:00Z'),
      description: 'Status changed from Open to Under Investigation',
      sourceType: 'BANK_SMS',
      phase: 'TRUST',
    },
    {
      id: 'EVT-2024-001006',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-17T11:10:00Z'),
      description: 'Hash verification completed - No tampering detected',
      sourceType: 'RECEIPT',
      phase: 'TRUST',
    },
    {
      id: 'EVT-2024-001007',
      caseId: caseRecord.id,
      evidenceId: bankEvidence.id,
      timestamp: new Date('2024-01-18T15:20:00Z'),
      description: 'Entity linked with CC/2024/045 (cross-case match)',
      sourceType: 'WHATSAPP',
      phase: 'PAYMENT',
    },
    {
      id: 'EVT-2024-001008',
      caseId: caseRecord.id,
      evidenceId: evidenceRecord.id,
      timestamp: new Date('2024-01-19T10:00:00Z'),
      description: 'Field investigation conducted at Sector 17',
      sourceType: 'CALL_LOG',
      phase: 'PAYMENT',
    },
    {
      id: 'EVT-2024-001009',
      caseId: caseRecord.id,
      evidenceId: emailEvidence.id,
      timestamp: new Date('2024-01-20T16:15:00Z'),
      description: 'Chargesheet preparation initiated',
      sourceType: 'RECEIPT',
      phase: 'SEVERED',
    },
    {
      id: 'EVT-2024-001010',
      caseId: caseRecord.id,
      evidenceId: deviceDumpEvidence.id,
      timestamp: new Date('2024-01-21T09:30:00Z'),
      description: 'Report generated by Inspector Priya Singh',
      sourceType: 'SCREENSHOT',
      phase: 'SEVERED',
    },
  ];

  for (const ev of timelineEvents) {
    await prisma.timelineEvent.upsert({
      where: { id: ev.id },
      update: ev,
      create: ev,
    });
  }

  const count = await prisma.timelineEvent.count();
  console.log(`Page 08 timeline events seeded successfully. Total in DB: ${count}`);
}

main()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
