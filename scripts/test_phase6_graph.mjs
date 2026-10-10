import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Phase 6 Cross-Case Syndicate Intelligence test suite...\n');

  // Test 1: Global Graph Retrieval
  console.log('Test 1: Global Graph Resolution (GET /api/graph)');
  const resGlobal = await fetch(`${BASE_URL}/api/graph`);
  assert.strictEqual(resGlobal.status, 200, 'Expected status 200 from GET /api/graph');
  const globalData = await resGlobal.json();
  assert.ok(globalData.nodes?.length > 0, 'Expected non-empty nodes');
  assert.ok(globalData.edges?.length > 0, 'Expected non-empty edges');
  assert.strictEqual(globalData.summary.linkedCaseCount, 12, 'Expected 12 linked cases');
  assert.strictEqual(globalData.summary.totalFraudAmount, 2840000, 'Expected ₹28.4L total fraud amount');
  assert.ok(globalData.summary.highFrequencyMules.includes('+919876543210'), 'Central phone mule detected');
  console.log('  ✅ Passed: Global graph contains 12 cases and exact ₹28.4L fraud total\n');

  // Test 2: Explainable Edges
  console.log('Test 2: Edge Relationship Explainability & Provenance');
  const sampleEdge = globalData.edges[0];
  assert.ok(sampleEdge.relationshipType, 'Edge must specify relationshipType');
  assert.ok(['SAME_ENTITY', 'FINANCIAL_FLOW', 'COMMUNICATION', 'SHARED_EVIDENCE', 'COMMON_INFRASTRUCTURE'].includes(sampleEdge.relationshipType), 'Valid relationshipType');
  assert.ok(sampleEdge.source && sampleEdge.target, 'Edge must have source and target');
  assert.ok(sampleEdge.explanation, 'Edge must have explanatory sentence');
  console.log(`  ✅ Passed: Edge ${sampleEdge.id} is explainable with relationship '${sampleEdge.relationshipType}'\n`);

  // Test 3: Central Mule Risk Classification & Metrics
  console.log('Test 3: Entity Node Risk Scoring & HIGH_FREQUENCY_MULE');
  const centralMule = globalData.nodes.find(n => n.normalizedValue === '+919876543210');
  assert.ok(centralMule, 'Central mule node must exist');
  assert.strictEqual(centralMule.riskLevel, 'HIGH', 'Central mule must be classified HIGH');
  assert.strictEqual(centralMule.riskScore, 95, 'Case count >= 5 triggers score 95');
  assert.ok(centralMule.flags.includes('HIGH_FREQUENCY_MULE'), 'Must have HIGH_FREQUENCY_MULE flag');
  assert.ok(centralMule.flags.includes('SYNDICATE_INDICATOR'), 'Must have SYNDICATE_INDICATOR flag');
  assert.strictEqual(centralMule.caseCount, 12, 'Must appear in 12 independent cases');
  assert.ok(centralMule.linkedCases.length >= 12, 'Linked cases list populated');
  assert.ok(centralMule.relatedEntities.length > 0, 'Co-occurring entities populated');
  console.log('  ✅ Passed: Central mule risk score 95 with HIGH_FREQUENCY_MULE & SYNDICATE_INDICATOR\n');

  // Test 4: Single Case Anchor Graph
  console.log('Test 4: Single Case Graph Anchor (GET /api/cases/CASE-2026-0891/graph)');
  const resCase = await fetch(`${BASE_URL}/api/cases/CASE-2026-0891/graph`);
  assert.strictEqual(resCase.status, 200, 'Expected status 200 from single case graph');
  const caseData = await resCase.json();
  const currentCaseNode = caseData.nodes.find(n => n.type === 'CURRENT_CASE');
  assert.ok(currentCaseNode, 'CURRENT_CASE node must exist');
  assert.ok(currentCaseNode.label.includes('CASE-2026-0891'), 'Anchor case is CASE-2026-0891');
  console.log('  ✅ Passed: Single case graph correctly anchors CURRENT_CASE\n');

  // Test 5: Server-Side Filtering
  console.log('Test 5: Server-Side Filtering by entityType & riskLevel');
  const resPhoneFilter = await fetch(`${BASE_URL}/api/graph?entityType=PHONE`);
  const phoneData = await resPhoneFilter.json();
  const nonPhoneEntities = phoneData.nodes.filter(n => n.type === 'ENTITY' && n.entityType !== 'PHONE');
  assert.strictEqual(nonPhoneEntities.length, 0, 'entityType filter must exclude other entity types');

  const resRiskFilter = await fetch(`${BASE_URL}/api/graph?riskLevel=HIGH`);
  const riskData = await resRiskFilter.json();
  const nonHighEntities = riskData.nodes.filter(n => n.type === 'ENTITY' && n.riskLevel !== 'HIGH');
  assert.strictEqual(nonHighEntities.length, 0, 'riskLevel filter must exclude non-HIGH entities');
  console.log('  ✅ Passed: Server-side filtering by entityType and riskLevel operates correctly\n');

  // Test 6: Cross-Jurisdiction Intelligence
  console.log('Test 6: Cross-Jurisdiction Intelligence Scope');
  assert.ok(globalData.summary.jurisdictionsAffected.length >= 3, 'Multiple jurisdictions represented');
  assert.ok(globalData.summary.jurisdictionsAffected.some(j => j.includes('Delhi')), 'Contains Delhi jurisdiction');
  assert.ok(globalData.summary.jurisdictionsAffected.some(j => j.includes('Mumbai')), 'Contains Mumbai jurisdiction');
  assert.ok(globalData.summary.jurisdictionsAffected.some(j => j.includes('Bengaluru')), 'Contains Bengaluru jurisdiction');
  console.log('  ✅ Passed: Cross-jurisdiction intelligence aggregates multi-state FIRs accurately\n');

  console.log('🎉 All Phase 6 Cross-Case Syndicate Intelligence tests passed successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
