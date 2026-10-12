// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_page07_entities.js
// Populates authentic forensic entities, cases, and evidence for Page 07
// Entity Management & Intelligence Records.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Page 07 Entity Management data...');

  // 1. Ensure cases CC/2024/001, CC/2024/045, CC/2024/078 exist
  const casesData = [
    {
      caseNumber: 'CC/2024/001',
      incidentType: 'Financial_Fraud',
      complainantName: 'Aman Gupta',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'OPEN',
      amountDefrauded: 4500000,
      description: 'Financial Fraud Investigation',
      firNumber: 'FIR-2024-CC-001',
      officerName: 'Inspector Rajesh Kumar',
      officerBadge: 'DL-CC-001'
    },
    {
      caseNumber: 'CC/2024/045',
      incidentType: 'Cyber_Extortion',
      complainantName: 'Pooja Sharma',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'UNDER_INQUIRY',
      amountDefrauded: 2800000,
      description: 'Cyber Extortion Case',
      firNumber: 'FIR-2024-CC-045',
      officerName: 'Inspector Rajesh Kumar',
      officerBadge: 'DL-CC-001'
    },
    {
      caseNumber: 'CC/2024/078',
      incidentType: 'Money_Laundering',
      complainantName: 'State of Delhi',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'OPEN',
      amountDefrauded: 8900000,
      description: 'Money Laundering Syndicate',
      firNumber: 'FIR-2024-CC-078',
      officerName: 'Inspector Rajesh Kumar',
      officerBadge: 'DL-CC-001'
    }
  ];

  const caseMap = {};
  for (const c of casesData) {
    const record = await prisma.case.upsert({
      where: { caseNumber: c.caseNumber },
      update: c,
      create: c
    });
    caseMap[c.caseNumber] = record;
  }

  // 2. Ensure evidence records for these cases
  const evidenceData = [
    {
      id: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      fileName: 'MOBILE_001.jpg',
      fileType: 'JPG',
      mimeType: 'image/jpeg',
      fileSize: 3412000,
      sha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      clientHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      storagePath: '/uploads/raw/mobile_001.jpg',
      evidenceCategory: 'CRIME_SCENE_PHOTO',
      metadata: JSON.stringify({ description: 'Seized mobile handset screen photo with active UPI session' }),
      uploadedAt: new Date('2024-01-15T10:30:00Z')
    },
    {
      id: 'ev-cc045-bank',
      caseId: caseMap['CC/2024/045'].id,
      fileName: 'BANK_STMT.pdf',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      fileSize: 1845000,
      sha256Hash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      clientHash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      storagePath: '/uploads/raw/bank_stmt.pdf',
      evidenceCategory: 'UPI_FINANCIAL',
      metadata: JSON.stringify({ description: 'HDFC Corporate bank account transaction ledger' }),
      uploadedAt: new Date('2024-03-12T14:15:00Z')
    },
    {
      id: 'ev-cc045-email',
      caseId: caseMap['CC/2024/045'].id,
      fileName: 'EMAIL_TRAIL.eml',
      fileType: 'EML',
      mimeType: 'message/rfc822',
      fileSize: 420000,
      sha256Hash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      clientHash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      storagePath: '/uploads/raw/email_trail.eml',
      evidenceCategory: 'EMAIL',
      metadata: JSON.stringify({ description: 'Extortion email communications header analysis' }),
      uploadedAt: new Date('2024-03-12T16:20:00Z')
    },
    {
      id: 'ev-cc078-dump',
      caseId: caseMap['CC/2024/078'].id,
      fileName: 'DEVICE_DUMP.zip',
      fileType: 'ZIP',
      mimeType: 'application/zip',
      fileSize: 15420000,
      sha256Hash: 'd4e5f6a1b2c30718293a4b5c6d7e8f90123456789abcdef0123456789abcdef3',
      clientHash: 'd4e5f6a1b2c30718293a4b5c6d7e8f90123456789abcdef0123456789abcdef3',
      storagePath: '/uploads/raw/device_dump.zip',
      evidenceCategory: 'IDENTITY_DATA',
      metadata: JSON.stringify({ description: 'Physical forensic bitstream acquisition of MacBook Pro' }),
      uploadedAt: new Date('2024-05-28T11:45:00Z')
    }
  ];

  for (const ev of evidenceData) {
    await prisma.evidence.upsert({
      where: { id: ev.id },
      update: ev,
      create: ev
    });
  }

  // 3. Clear old ExtractedFacts with these specific IDs to avoid duplicates
  const targetFactIds = [
    'fact-ent-001', 'fact-ent-002', 'fact-ent-003', 'fact-ent-004',
    'fact-ent-005', 'fact-ent-006', 'fact-ent-007', 'fact-ent-008'
  ];
  await prisma.extractedFact.deleteMany({
    where: { id: { in: targetFactIds } }
  });

  // 4. Seed Canonical Page 07 Entities in ExtractedFact
  const factsToInsert = [
    {
      id: 'fact-ent-001',
      evidenceId: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      entityType: 'NAME',
      rawValue: 'Rahul Sharma',
      normalizedValue: 'Rahul Sharma',
      factAssertion: 'Primary syndicate suspect: Rahul Sharma identified from device session logs.',
      confidence: 0.98,
      sourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 100, y: 120, width: 210, height: 28 }),
      extractedAt: new Date('2024-01-15T10:30:00Z')
    },
    {
      id: 'fact-ent-002',
      evidenceId: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      entityType: 'DOMAIN',
      rawValue: 'Sharma Enterprises',
      normalizedValue: 'Sharma Enterprises',
      factAssertion: 'Corporate entity: Sharma Enterprises (MCA-123456) operating as shell merchant.',
      confidence: 0.95,
      sourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 80, y: 200, width: 240, height: 32 }),
      extractedAt: new Date('2024-01-16T11:20:00Z')
    },
    {
      id: 'fact-ent-003',
      evidenceId: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      entityType: 'PHONE',
      rawValue: '+91 98765 43210',
      normalizedValue: '+919876543210',
      factAssertion: 'Primary contact phone: +91 98765 43210 registered with Airtel India.',
      confidence: 0.99,
      sourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 120, y: 280, width: 180, height: 26 }),
      extractedAt: new Date('2024-01-15T10:45:00Z')
    },
    {
      id: 'fact-ent-004',
      evidenceId: 'ev-cc045-email',
      caseId: caseMap['CC/2024/045'].id,
      entityType: 'EMAIL',
      rawValue: 'rahul.s@gmail.com',
      normalizedValue: 'rahul.s@gmail.com',
      factAssertion: 'Email address: rahul.s@gmail.com observed in extortion message headers.',
      confidence: 0.97,
      sourceHash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 60, y: 150, width: 220, height: 24 }),
      extractedAt: new Date('2024-03-12T16:22:00Z')
    },
    {
      id: 'fact-ent-005',
      evidenceId: 'ev-cc045-bank',
      caseId: caseMap['CC/2024/045'].id,
      entityType: 'ACCOUNT',
      rawValue: 'HDFC Bank XXXX4321',
      normalizedValue: 'HDFC Bank XXXX4321',
      factAssertion: 'Mule account: HDFC Bank XXXX4321 receiving extortion deposits.',
      confidence: 0.96,
      sourceHash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 140, y: 320, width: 200, height: 26 }),
      extractedAt: new Date('2024-03-12T14:20:00Z')
    },
    {
      id: 'fact-ent-006',
      evidenceId: 'ev-cc078-dump',
      caseId: caseMap['CC/2024/078'].id,
      entityType: 'IP',
      rawValue: 'MacBook Pro',
      normalizedValue: 'MacBook Pro (SN: C02X1234)',
      factAssertion: 'Hardware identifier: MacBook Pro MacOS 14.2 SN: C02X1234 seized in raid.',
      confidence: 0.94,
      sourceHash: 'd4e5f6a1b2c30718293a4b5c6d7e8f90123456789abcdef0123456789abcdef3',
      verificationStatus: 'UNVERIFIED',
      verifiedBy: null,
      boundingBox: JSON.stringify({ x: 90, y: 110, width: 190, height: 28 }),
      extractedAt: new Date('2024-05-28T12:00:00Z')
    },
    {
      id: 'fact-ent-007',
      evidenceId: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      entityType: 'ADDRESS',
      rawValue: '142, MG Road',
      normalizedValue: '142, MG Road, Bengaluru, KA',
      factAssertion: 'Physical location: 142, MG Road, Bengaluru, KA GPS coordinates flagged.',
      confidence: 0.92,
      sourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 110, y: 400, width: 250, height: 30 }),
      extractedAt: new Date('2024-01-15T11:15:00Z')
    },
    {
      id: 'fact-ent-008',
      evidenceId: 'ev-cc001-mobile',
      caseId: caseMap['CC/2024/001'].id,
      entityType: 'NAME',
      rawValue: 'Ravi Verma',
      normalizedValue: 'Ravi Verma',
      factAssertion: 'Known accomplice: Ravi Verma (+91 91234 56789) identified in chat logs.',
      confidence: 0.95,
      sourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Inspector Rajesh Kumar',
      boundingBox: JSON.stringify({ x: 130, y: 480, width: 190, height: 26 }),
      extractedAt: new Date('2024-01-15T11:30:00Z')
    }
  ];

  for (const f of factsToInsert) {
    await prisma.extractedFact.create({ data: f });
  }

  // 5. Also upsert CaseEntity cross-links so multi-case linkage query matches
  const caseEntityRows = [
    { caseId: caseMap['CC/2024/001'].id, entityType: 'NAME', rawValue: 'Rahul Sharma', normalizedValue: 'Rahul Sharma' },
    { caseId: caseMap['CC/2024/045'].id, entityType: 'NAME', rawValue: 'Rahul Sharma', normalizedValue: 'Rahul Sharma' },
    { caseId: caseMap['CC/2024/078'].id, entityType: 'NAME', rawValue: 'Rahul Sharma', normalizedValue: 'Rahul Sharma' },

    { caseId: caseMap['CC/2024/001'].id, entityType: 'DOMAIN', rawValue: 'Sharma Enterprises', normalizedValue: 'Sharma Enterprises' },
    { caseId: caseMap['CC/2024/045'].id, entityType: 'DOMAIN', rawValue: 'Sharma Enterprises', normalizedValue: 'Sharma Enterprises' },

    { caseId: caseMap['CC/2024/001'].id, entityType: 'PHONE', rawValue: '+91 98765 43210', normalizedValue: '+919876543210' },
    { caseId: caseMap['CC/2024/045'].id, entityType: 'PHONE', rawValue: '+91 98765 43210', normalizedValue: '+919876543210' },

    { caseId: caseMap['CC/2024/045'].id, entityType: 'EMAIL', rawValue: 'rahul.s@gmail.com', normalizedValue: 'rahul.s@gmail.com' },

    { caseId: caseMap['CC/2024/045'].id, entityType: 'ACCOUNT', rawValue: 'HDFC Bank XXXX4321', normalizedValue: 'HDFC Bank XXXX4321' },
    { caseId: caseMap['CC/2024/078'].id, entityType: 'ACCOUNT', rawValue: 'HDFC Bank XXXX4321', normalizedValue: 'HDFC Bank XXXX4321' },

    { caseId: caseMap['CC/2024/078'].id, entityType: 'IP', rawValue: 'MacBook Pro', normalizedValue: 'MacBook Pro (SN: C02X1234)' },

    { caseId: caseMap['CC/2024/001'].id, entityType: 'ADDRESS', rawValue: '142, MG Road', normalizedValue: '142, MG Road, Bengaluru, KA' },

    { caseId: caseMap['CC/2024/001'].id, entityType: 'NAME', rawValue: 'Ravi Verma', normalizedValue: 'Ravi Verma' },
    { caseId: caseMap['CC/2024/045'].id, entityType: 'NAME', rawValue: 'Ravi Verma', normalizedValue: 'Ravi Verma' }
  ];

  for (const row of caseEntityRows) {
    await prisma.caseEntity.upsert({
      where: {
        caseId_entityType_normalizedValue: {
          caseId: row.caseId,
          entityType: row.entityType,
          normalizedValue: row.normalizedValue
        }
      },
      update: {},
      create: row
    });
  }

  console.log(`Seeded ${factsToInsert.length} canonical ExtractedFacts and ${caseEntityRows.length} CaseEntity mappings.`);
  console.log(`Current ExtractedFact total in DB: ${await prisma.extractedFact.count()}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
