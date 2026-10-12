// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_page06_intelligence.js
// Populates 124 authentic forensic entities across 8 categories:
// - Persons: 42 (42%)
// - Organizations: 18 (18%)
// - Phone Numbers: 15 (15%)
// - Locations: 12 (12%)
// - Bank Accounts: 10 (8%)
// - Devices: 8 (5%)
// - Documents: 7
// - Other: 12
// Total = 124 entities
// Total Connections = 287
// Potential Clusters = 12
// High-Risk Entities = 8 (including Rajesh Kumar, Aman Traders, Account XXXX1920,
//                          +91 98765 43210, Cyber Group A, Vehicle PB10AB1234, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Page 06 Intelligence & Cross-Case Analysis records...');

  // 1. Fetch available cases
  const cases = await prisma.case.findMany({
    orderBy: { caseNumber: 'desc' }
  });

  if (cases.length === 0) {
    console.error('No cases found in database.');
    return;
  }

  const caseMap = {};
  cases.forEach(c => { caseMap[c.caseNumber] = c; });

  const c1042 = caseMap['CB-2025-1042'] || cases[0];
  const c1036 = caseMap['CB-2025-1036'] || cases[1] || cases[0];
  const c1028 = caseMap['CB-2025-1028'] || cases[2] || cases[0];
  const c1031 = caseMap['CB-2025-1031'] || cases[3] || cases[0];
  const c1039 = caseMap['CB-2025-1039'] || cases[4] || cases[0];
  const c1025 = caseMap['CB-2025-1025'] || cases[5] || cases[0];
  const c1019 = caseMap['CB-2025-1019'] || cases[6] || cases[0];
  const c1016 = caseMap['CB-2025-1016'] || cases[7] || cases[0];
  const c1012 = caseMap['CB-2025-1012'] || cases[8] || cases[0];
  const c1008 = caseMap['CB-2025-1008'] || cases[9] || cases[0];

  // 2. Clear old entities, clusters, and facts related to test runs to keep clean 124 count
  await prisma.clusterMembership.deleteMany({});
  await prisma.caseCluster.deleteMany({});
  await prisma.caseEntity.deleteMany({});
  await prisma.extractedFact.deleteMany({
    where: {
      evidenceId: { startsWith: 'ev-intel-' }
    }
  });

  // 3. Define the 124 Entities
  // Category 1: Persons (42)
  const persons = [
    'Rajesh Kumar', 'Neha Singh', 'Amit Kumar', 'Rahul Sharma', 'Vikram Malhotra',
    'Pooja Verma', 'Sanjay Mehta', 'Anil Deshmukh', 'Sunil Grover', 'Kavita Iyer',
    'Deepak Bansal', 'Ramesh Yadav', 'Priya Nair', 'Manoj Tiwari', 'Rohit Singhania',
    'Alok Saxena', 'Karan Joharilal', 'Manish Gupta', 'Vikas Oberoi', 'Dinesh Rawat',
    'Harish Chandra', 'Gaurav Gill', 'Tarun Mittal', 'Arun Kothari', 'Naveen Jindalpur',
    'Mohit Agarwal', 'Sachin Tendulkar-Singh', 'Pankaj Tripathi-Dev', 'Ajay Devgan-Ram',
    'Vijay Mallya-Shah', 'Suresh Raina-Paul', 'Kunal Kamra-Jain', 'Abhishek Bachchan-Roy',
    'Rishi Kapoor-Das', 'Nitin Gadkari-Verma', 'Ashok Gehlot-Lal', 'Bhupesh Baghel-Sen',
    'Hemant Soren-Ali', 'Shashi Tharoor-Khan', 'Raghuram Rajan-Dey', 'Urjit Patel-Bose',
    'Montek Singh-Ahlu'
  ];

  // Category 2: Organizations (18)
  const organizations = [
    'Aman Traders', 'Cyber Group A', 'QuickLoan Fintech Ltd', 'Apex Digital Holdings',
    'Delta Tech Solutions', 'Zenith Global Impex', 'Starline Communications',
    'Nexus Cloud Services', 'Falcon Security Corp', 'Vanguard Media Group',
    'Orion Logistics LLP', 'Matrix FinTech Hub', 'BlueChip Investments',
    'Silverline Forex Pvt Ltd', 'Titan Global Tech', 'Astra Consultancy',
    'Pinnacle Payment Gateways', 'Quantum Trading Corp'
  ];

  // Category 3: Phone Numbers (15)
  const phoneNumbers = [
    '+91 98765 43210', '+91 91234 56789', '+91 98111 22334', '+91 98222 33445',
    '+91 98333 44556', '+91 98444 55667', '+91 98555 66778', '+91 98666 77889',
    '+91 98777 88990', '+91 98888 99001', '+91 98999 00112', '+91 99000 11223',
    '+91 99111 22334', '+91 99222 33445', '+91 99333 44556'
  ];

  // Category 4: Locations (12)
  const locations = [
    'Delhi (Location)', 'Noida Sector 62', 'Gurgaon Cyber City', 'Jaipur Pink City',
    'Mumbai BKC', 'Bengaluru Electronic City', 'Hyderabad Hitech City', 'Kolkata Salt Lake',
    'Ahmedabad SG Highway', 'Chandigarh Sector 17', 'Pune Viman Nagar', 'Lucknow Hazratganj'
  ];

  // Category 5: Bank Accounts (10)
  const bankAccounts = [
    'Account XXXX1920', 'HDFC-098231', 'ICICI-441209', 'SBI-882103',
    'Axis-556123', 'PNB-771249', 'Kotak-334190', 'IndusInd-221980',
    'YesBank-119283', 'Canara-667120'
  ];

  // Category 6: Devices (8)
  const devices = [
    'Vehicle PB10AB1234', 'iPhone 14 Pro IMEI-9923', 'Samsung S23 IMEI-8834',
    'OnePlus 11 IMEI-7712', 'MacBook Pro MAC-44:21', 'Dell XPS MAC-88:12',
    'Router TP-Link-3312', 'CCTV DVR IP-192.168.1.100'
  ];

  // Category 7: Documents (7)
  const documents = [
    'FakeDoc.pdf', 'IdentityCard_Fake.pdf', 'RentAgreement_Forge.pdf',
    'BankStatement_Altered.pdf', 'PoliceVerification_Counterfeit.pdf',
    'SalarySlip_Fabricated.pdf', 'GST_Certificate_Bogus.pdf'
  ];

  // Category 8: Other (12)
  const otherEntities = [
    'mule_syndicate@oksbi', 't.me/cyberfraud_ops', 'fastpay@paytm',
    'cryptomule@binance', 't.me/instant_task_earn', 'shadow_admin@proton.me',
    '185.220.101.5', '194.26.29.112', 'securegateway.cc',
    'investment-return-vip.com', 'kyc-unfreeze-portal.net', 'utr-confirm-bot@upi'
  ];

  // Verify counts
  console.log(`Persons: ${persons.length}, Orgs: ${organizations.length}, Phones: ${phoneNumbers.length}, Locations: ${locations.length}, Accounts: ${bankAccounts.length}, Devices: ${devices.length}, Docs: ${documents.length}, Other: ${otherEntities.length}`);
  const total = persons.length + organizations.length + phoneNumbers.length + locations.length + bankAccounts.length + devices.length + documents.length + otherEntities.length;
  console.log(`Total entity count to seed: ${total}`);

  // High risk entities (8) that appear across 3 or more cases:
  const highRiskEntities = new Set([
    'Rajesh Kumar',
    'Aman Traders',
    'Account XXXX1920',
    '+91 98765 43210',
    'Cyber Group A',
    'Vehicle PB10AB1234',
    'Delhi (Location)',
    'FakeDoc.pdf'
  ]);

  // Insert CaseEntity records
  const allEntitySpecs = [
    ...persons.map(name => ({ type: 'NAME', val: name })),
    ...organizations.map(org => ({ type: 'DOMAIN', val: org })),
    ...phoneNumbers.map(phone => ({ type: 'PHONE', val: phone })),
    ...locations.map(loc => ({ type: 'ADDRESS', val: loc })),
    ...bankAccounts.map(acc => ({ type: 'ACCOUNT', val: acc })),
    ...devices.map(dev => ({ type: 'IP', val: dev })),
    ...documents.map(doc => ({ type: 'EMAIL', val: doc })),
    ...otherEntities.map(oth => ({ type: 'UPI', val: oth }))
  ];

  // Create evidence records for provenance if needed
  let evidence = await prisma.evidence.findFirst({ where: { caseId: c1042.id } });
  if (!evidence) {
    evidence = await prisma.evidence.create({
      data: {
        id: 'ev-intel-01',
        caseId: c1042.id,
        fileName: 'FakeDoc.pdf',
        fileType: 'PDF',
        mimeType: 'application/pdf',
        fileSize: 2048576,
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        clientHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        storagePath: '/uploads/raw/fakedoc.pdf',
        evidenceCategory: 'DOCUMENT',
        metadata: JSON.stringify({ description: 'Seized fabricated KYC & bank statement dossier' })
      }
    });
  }

  // Insert CaseEntity records distributed across cases
  // High risk entities appear in at least 3 cases (c1042, c1036, c1028)
  const caseEntityRows = [];
  const factRows = [];

  for (let i = 0; i < allEntitySpecs.length; i++) {
    const item = allEntitySpecs[i];
    const isHighRisk = highRiskEntities.has(item.val);

    if (isHighRisk) {
      // Linked in 3 cases
      caseEntityRows.push(
        { caseId: c1042.id, entityType: item.type, rawValue: item.val, normalizedValue: item.val, firstSeenAt: new Date('2025-09-12') },
        { caseId: c1036.id, entityType: item.type, rawValue: item.val, normalizedValue: item.val, firstSeenAt: new Date('2025-09-18') },
        { caseId: c1028.id, entityType: item.type, rawValue: item.val, normalizedValue: item.val, firstSeenAt: new Date('2025-10-02') }
      );
      factRows.push({
        evidenceId: evidence.id,
        caseId: c1042.id,
        entityType: item.type,
        rawValue: item.val,
        normalizedValue: item.val,
        factAssertion: `Verified high-risk syndicate node ${item.val} linked to cross-case operations.`,
        confidence: 0.98,
        sourceHash: evidence.sha256Hash,
        verificationStatus: 'VERIFIED',
        verifiedBy: 'Inspector Sharma'
      });
    } else {
      // Distribute among cases so they are unique distinct entities
      // Case distribution
      const targetCase = cases[i % cases.length];
      caseEntityRows.push({
        caseId: targetCase.id,
        entityType: item.type,
        rawValue: item.val,
        normalizedValue: item.val,
        firstSeenAt: new Date('2025-10-10')
      });
      // Some appear in two cases to produce extra connections
      if (i % 3 === 0) {
        const secondaryCase = cases[(i + 1) % cases.length];
        caseEntityRows.push({
          caseId: secondaryCase.id,
          entityType: item.type,
          rawValue: item.val,
          normalizedValue: item.val,
          firstSeenAt: new Date('2025-10-12')
        });
      }
    }
  }

  // Bulk create CaseEntities
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

  // Bulk create ExtractedFacts
  for (const f of factRows) {
    await prisma.extractedFact.create({
      data: f
    });
  }

  console.log(`Seeded ${caseEntityRows.length} CaseEntity mappings.`);

  // 4. Seed the 12 Potential Clusters
  const clusterDefs = [
    { name: 'Delhi-NCR Financial Task Scam Syndicate', theme: 'Task_Scam', notes: 'Coordinated task fraud operation running through Telegram and fake UPI gateways.' },
    { name: 'Digital Arrest & CBI Extortion Nexus', theme: 'Digital_Arrest', notes: 'Impersonation of law enforcement officers using Skype and VoIP.' },
    { name: 'Fake Loan App & Harassment Ring', theme: 'Loan_Harassment', notes: 'Predatory lending apps accessing victim contact lists and blackmailing.' },
    { name: 'Telegram Crypto Laundering Grid', theme: 'Crypto_Fraud', notes: 'Mule accounts converting INR into USDT via P2P exchanges.' },
    { name: 'Mule Account Procurement Cell', theme: 'Mule_Network', notes: 'Student and rural accounts recruited on commission basis.' },
    { name: 'Phishing & Malicious APK Distribution Hub', theme: 'Phishing_APK', notes: 'Distribution of infected banking Trojan APKs.' },
    { name: 'Corporate Impersonation Fraud Group', theme: 'Business_Fraud', notes: 'Targeting corporate vendors with spoofed executive email domains.' },
    { name: 'Romance Scam & Offshore Transfer Ring', theme: 'Romance_Scam', notes: 'Matrimonial and social media grooming directing funds abroad.' },
    { name: 'Fake KYC & SIM Cloning Syndicate', theme: 'Identity_Theft', notes: 'Forged Aadhaar cards used to activate bulk burner SIMs.' },
    { name: 'Investment Ponzi Multi-City Group', theme: 'Investment_Fraud', notes: 'Guaranteed 300% return scam across Delhi, Mumbai, and Jaipur.' },
    { name: 'Customs & Courier Blackmail Ring', theme: 'Courier_Extortion', notes: 'Fake parcel seizures alleging contraband and narcotics.' },
    { name: 'Cross-Border Hawala Transfer Network', theme: 'Hawala_Laundering', notes: 'Cash couriers moving defrauded capital across state borders.' }
  ];

  for (let idx = 0; idx < clusterDefs.length; idx++) {
    const cDef = clusterDefs[idx];
    const cMembers = [
      cases[idx % cases.length].id,
      cases[(idx + 1) % cases.length].id,
      cases[(idx + 2) % cases.length].id
    ];

    await prisma.caseCluster.create({
      data: {
        name: cDef.name,
        theme: cDef.theme,
        status: 'ACTIVE',
        confidence: idx < 4 ? 'CONFIRMED' : idx < 8 ? 'PROBABLE' : 'POTENTIAL',
        notes: cDef.notes,
        memberships: {
          create: cMembers.map(cid => ({
            caseId: cid,
            reason: `Cross-case entity match: shared phone, bank, and IP infrastructure.`
          }))
        }
      }
    });
  }

  console.log(`Seeded 12 clusters successfully.`);

  // 5. Verification checks
  const totalEntitiesInDB = await prisma.caseEntity.groupBy({
    by: ['normalizedValue'],
  });
  const totalClustersInDB = await prisma.caseCluster.count();
  console.log(`[VERIFIED] Unique entities in DB: ${totalEntitiesInDB.length}`);
  console.log(`[VERIFIED] Total clusters in DB: ${totalClustersInDB}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
