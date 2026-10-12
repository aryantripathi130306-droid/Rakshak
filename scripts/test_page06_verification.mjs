import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

async function verifyPage06() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   RAKSHAK v3.0 — PAGE 06: INTELLIGENCE VERIFICATION SUITE    ');
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
  const htmlPath = path.resolve('public/frontend/pages/graph.html');
  assert(fs.existsSync(htmlPath), 'public/frontend/pages/graph.html exists');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  assert(htmlContent.includes('Intelligence &amp; Cross-Case Analysis'), 'HTML contains correct page title');
  assert(htmlContent.includes('class="neu-nav-item active"'), 'HTML highlights Intelligence in sidebar navigation');
  assert(htmlContent.includes('id="metric-total-entities"'), 'HTML contains Total Entities metric card');
  assert(htmlContent.includes('id="metric-total-connections"'), 'HTML contains Total Connections metric card');
  assert(htmlContent.includes('id="metric-potential-clusters"'), 'HTML contains Potential Clusters metric card');
  assert(htmlContent.includes('id="metric-high-risk-entities"'), 'HTML contains High-Risk Entities metric card');
  assert(htmlContent.includes('id="graph-filter-box"'), 'HTML contains Filter Entities checklist overlay');
  assert(htmlContent.includes('id="panel-selected-entity"'), 'HTML contains Selected Entity panel');
  assert(htmlContent.includes('Rajesh Kumar'), 'HTML contains Rajesh Kumar as default central entity');
  assert(htmlContent.includes('panel-top-entity-types'), 'HTML contains Top Entity Types panel');
  assert(htmlContent.includes('panel-recent-links'), 'HTML contains Recent Detected Links panel');
  assert(htmlContent.includes('panel-cross-case-insights'), 'HTML contains Cross-Case Insights panel');

  // 2. Verify CSS File
  const cssPath = path.resolve('public/frontend/css/intelligence-neumorphic.css');
  assert(fs.existsSync(cssPath), 'public/frontend/css/intelligence-neumorphic.css exists');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  assert(cssContent.includes('--neu-bg:                #E9EEF5'), 'CSS contains exact background color #E9EEF5');
  assert(cssContent.includes('--neu-surface:           #F5F8FC'), 'CSS contains exact card surface color #F5F8FC');
  assert(cssContent.includes('--neu-navy:              #172B4D'), 'CSS contains primary navy #172B4D');
  assert(cssContent.includes('--neu-blue:              #3988F5'), 'CSS contains primary accent blue #3988F5');
  assert(cssContent.includes('--neu-shadow-raised-md:'), 'CSS contains neumorphic dual raised shadows');
  assert(cssContent.includes('--neu-shadow-inset:'), 'CSS contains neumorphic inset shadow');

  // 3. Verify JS File
  const jsPath = path.resolve('public/frontend/js/graph.js');
  assert(fs.existsSync(jsPath), 'public/frontend/js/graph.js exists');
  const jsContent = fs.readFileSync(jsPath, 'utf-8');

  assert(jsContent.includes('renderGraph'), 'JS defines renderGraph function');
  assert(jsContent.includes('selectEntity'), 'JS defines selectEntity function');
  assert(jsContent.includes('CANONICAL_GRAPH_NODES'), 'JS defines canonical nodes matching reference');
  assert(jsContent.includes('CANONICAL_GRAPH_EDGES'), 'JS defines canonical edges matching reference');

  // 4. Verify Database Records
  const prisma = new PrismaClient();
  try {
    const totalEntitiesInDB = await prisma.caseEntity.groupBy({
      by: ['normalizedValue'],
    });
    assert(totalEntitiesInDB.length === 124, `Database contains exactly 124 distinct entities (Found: ${totalEntitiesInDB.length})`);

    const totalClustersInDB = await prisma.caseCluster.count();
    assert(totalClustersInDB === 12, `Database contains exactly 12 clusters (Found: ${totalClustersInDB})`);

    const highRiskNode = await prisma.caseEntity.findFirst({
      where: { normalizedValue: 'Rajesh Kumar' }
    });
    assert(!!highRiskNode, 'Database contains central high-risk entity Rajesh Kumar');
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

verifyPage06().catch((e) => {
  console.error(e);
  process.exit(1);
});
