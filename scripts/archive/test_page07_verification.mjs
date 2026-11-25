import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

async function verifyPage07() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    RAKSHAK v3.0 — PAGE 07: ENTITY MANAGEMENT VERIFICATION     ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Verify HTML File
  const htmlPath = path.resolve('public/frontend/pages/entities.html');
  assert(fs.existsSync(htmlPath), 'public/frontend/pages/entities.html exists');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  assert(htmlContent.includes('Entity Management'), 'HTML contains correct page heading');
  assert(htmlContent.includes('class="neu-nav-item active"'), 'HTML highlights Entities in sidebar navigation');
  assert(htmlContent.includes('id="metric-total-entities"'), 'HTML contains Total Entities metric card');
  assert(htmlContent.includes('id="metric-count-people"'), 'HTML contains People metric card');
  assert(htmlContent.includes('id="metric-count-orgs"'), 'HTML contains Organizations metric card');
  assert(htmlContent.includes('id="metric-count-devices"'), 'HTML contains Devices metric card');
  assert(htmlContent.includes('id="metric-count-financial"'), 'HTML contains Financial Accounts metric card');
  assert(htmlContent.includes('id="metric-count-locations"'), 'HTML contains Locations metric card');
  assert(htmlContent.includes('id="entity-directory-table"'), 'HTML contains Entity Directory table');
  assert(htmlContent.includes('id="panel-selected-profile"'), 'HTML contains Selected Entity profile panel');
  assert(htmlContent.includes('id="panel-related-entities"'), 'HTML contains Related Entities lower panel');
  assert(htmlContent.includes('id="panel-related-cases"'), 'HTML contains Related Cases lower panel');
  assert(htmlContent.includes('id="panel-evidence-references"'), 'HTML contains Evidence References lower panel');

  // 2. Verify CSS File
  const cssPath = path.resolve('public/frontend/css/entities-neumorphic.css');
  assert(fs.existsSync(cssPath), 'public/frontend/css/entities-neumorphic.css exists');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  assert(cssContent.includes('--neu-bg:                #E9EEF5'), 'CSS contains exact background color #E9EEF5');
  assert(cssContent.includes('--neu-surface:           #F5F8FC'), 'CSS contains exact card surface color #F5F8FC');
  assert(cssContent.includes('--neu-navy:              #172B4D'), 'CSS contains primary navy #172B4D');
  assert(cssContent.includes('--neu-blue:              #3988F5'), 'CSS contains primary accent blue #3988F5');
  assert(cssContent.includes('.neu-metric-strip-6'), 'CSS contains 6-column metric strip layout');
  assert(cssContent.includes('--neu-shadow-raised-md:'), 'CSS contains neumorphic dual raised shadows');
  assert(cssContent.includes('--neu-shadow-inset:'), 'CSS contains neumorphic inset shadow');

  // 3. Verify JS File
  const jsPath = path.resolve('public/frontend/js/entities.js');
  assert(fs.existsSync(jsPath), 'public/frontend/js/entities.js exists');
  const jsContent = fs.readFileSync(jsPath, 'utf-8');

  assert(jsContent.includes('CANONICAL_ENTITIES'), 'JS defines canonical entities dataset');
  assert(jsContent.includes('selectEntity'), 'JS defines selectEntity function');
  assert(jsContent.includes('applyFiltersAndRender'), 'JS defines filtering logic');
  assert(jsContent.includes('updateLowerPanels'), 'JS defines updateLowerPanels function');

  // 4. Verify Database Records
  const prisma = new PrismaClient();
  try {
    const totalFacts = await prisma.extractedFact.count();
    assert(totalFacts >= 8, `Database contains seeded ExtractedFacts (Found: ${totalFacts})`);

    const rahulFact = await prisma.extractedFact.findFirst({
      where: { normalizedValue: 'Rahul Sharma' }
    });
    assert(!!rahulFact, 'Database contains extracted fact for Rahul Sharma');

    const cc001Case = await prisma.case.findUnique({
      where: { caseNumber: 'CC/2024/001' }
    });
    assert(!!cc001Case, 'Database contains case CC/2024/001');

    const mobileEvidence = await prisma.evidence.findFirst({
      where: { fileName: 'MOBILE_001.jpg' }
    });
    assert(!!mobileEvidence, 'Database contains evidence record MOBILE_001.jpg');
  } catch (err) {
    console.error('Database check error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\nVerification Complete: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

verifyPage07().catch((e) => {
  console.error(e);
  process.exit(1);
});
