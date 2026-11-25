// ─────────────────────────────────────────────────────────────────────────────
// scripts/seed_page09_cross_dept.js
// Seeds authentic department entities for Page 09: Cross-Department Collaboration
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Page 09 Cross-Department Collaboration data...');

  const departments = [
    {
      id: 'dept-cyber-crime',
      code: 'CYBER-CRIME-01',
      name: 'Cyber Crime Department',
      state: 'Delhi',
      jurisdiction: 'Cyber Crime Department — Delhi',
      status: 'ACTIVE'
    },
    {
      id: 'dept-eow',
      code: 'EOW-DEL-01',
      name: 'Economic Offences Wing',
      state: 'Delhi',
      jurisdiction: 'Economic Offences Wing — Central',
      status: 'ACTIVE'
    },
    {
      id: 'dept-ncb',
      code: 'NCB-HQ-01',
      name: 'Narcotics Control Bureau',
      state: 'Central',
      jurisdiction: 'National Narcotics Operations',
      status: 'ACTIVE'
    },
    {
      id: 'dept-ib',
      code: 'IB-HQ-01',
      name: 'Intelligence Bureau',
      state: 'Central',
      jurisdiction: 'Counter-Intelligence & Surveillance',
      status: 'ACTIVE'
    },
    {
      id: 'dept-cbi',
      code: 'CBI-HQ-01',
      name: 'Central Bureau of Investigation',
      state: 'Central',
      jurisdiction: 'Special Crimes & Anti-Corruption',
      status: 'ACTIVE'
    },
    {
      id: 'dept-nia',
      code: 'NIA-HQ-01',
      name: 'National Investigation Agency',
      state: 'Central',
      jurisdiction: 'National Cyber Security Cell',
      status: 'ACTIVE'
    },
    {
      id: 'dept-pb-police',
      code: 'PB-POLICE-01',
      name: 'State Police (Punjab)',
      state: 'Punjab',
      jurisdiction: 'State Crime Branch Punjab',
      status: 'ACTIVE'
    },
    {
      id: 'dept-dl-police',
      code: 'DL-POLICE-01',
      name: 'State Police (Delhi)',
      state: 'Delhi',
      jurisdiction: 'Delhi State Territorial Police',
      status: 'ACTIVE'
    }
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: d,
      create: d
    });
  }

  // Also ensure cases CC/2024/001, CC/2024/045, CC/2024/078, CC/2024/012, CC/2024/091, CC/2024/063, CC/2024/102, CC/2024/118 exist
  const casesData = [
    { caseNumber: 'CC/2024/001', incidentType: 'Financial_Fraud', complainantName: 'Aman Gupta', status: 'OPEN', amountDefrauded: 4500000, description: 'Financial Fraud Investigation' },
    { caseNumber: 'CC/2024/045', incidentType: 'Cyber_Extortion', complainantName: 'Pooja Sharma', status: 'UNDER_INQUIRY', amountDefrauded: 2800000, description: 'Cyber Extortion Case' },
    { caseNumber: 'CC/2024/078', incidentType: 'Money_Laundering', complainantName: 'State of Delhi', status: 'OPEN', amountDefrauded: 8900000, description: 'Money Laundering Syndicate' },
    { caseNumber: 'CC/2024/012', incidentType: 'Investment_Fraud', complainantName: 'Vikram Seth', status: 'OPEN', amountDefrauded: 12000000, description: 'Cross-Border Investment Scam' },
    { caseNumber: 'CC/2024/091', incidentType: 'Digital_Arrest', complainantName: 'Rajesh Verma', status: 'UNDER_INQUIRY', amountDefrauded: 3400000, description: 'Digital Arrest Threat Scheme' },
    { caseNumber: 'CC/2024/063', incidentType: 'Financial_Fraud', complainantName: 'Sunita Mehra', status: 'OPEN', amountDefrauded: 5100000, description: 'Card Cloning & Banking Fraud' },
    { caseNumber: 'CC/2024/102', incidentType: 'Task_Scam', complainantName: 'Arun Kumar', status: 'OPEN', amountDefrauded: 1900000, description: 'Telegram Part-Time Job Scam' },
    { caseNumber: 'CC/2024/118', incidentType: 'Money_Laundering', complainantName: 'Financial Intelligence Unit', status: 'OPEN', amountDefrauded: 15400000, description: 'Cryptocurrency Hawala Ring' }
  ];

  for (const c of casesData) {
    await prisma.case.upsert({
      where: { caseNumber: c.caseNumber },
      update: c,
      create: c
    });
  }

  const deptCount = await prisma.department.count();
  const caseCount = await prisma.case.count();
  console.log(`Page 09 seed completed. Departments: ${deptCount}, Cases: ${caseCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
