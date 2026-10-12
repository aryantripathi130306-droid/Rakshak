// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase7_legal.mjs
// Comprehensive test suite for Phase 7: Legal Matrix & BSA Section 63 Dossier Export
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';
const CASE_ID = 'CASE-2026-0891';

async function runTests() {
  console.log('=== RUNNING RAKSHAK PHASE 7 TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Authenticate test session
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badgeNumber: 'DL-002', password: 'Rakshak@2026' }),
    });
    const sessionCookie = loginRes.headers.get('set-cookie');
    const authHeaders = sessionCookie ? { Cookie: sessionCookie } : {};

    // Test 1: Fetch Legal Intelligence
    console.log('[1] Testing GET /api/cases/:caseId/legal...');
    const resLegal = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/legal`, { headers: authHeaders });
    assert(resLegal.status === 200, 'GET /api/cases/:caseId/legal returns 200');
    const legalData = await resLegal.json();
    assert(legalData.caseNumber === CASE_ID, 'Case number matches requested case');
    assert(Array.isArray(legalData.applicableSections) && legalData.applicableSections.length > 0, 'Applicable legal sections returned');
    assert(Array.isArray(legalData.evidenceMappings) && legalData.evidenceMappings.length > 0, 'Evidence mappings returned');
    assert(legalData.legalSeverity === 'High', 'Legal severity calculated correctly');
    assert(Array.isArray(legalData.analysisPoints) && legalData.analysisPoints.length > 0, 'AI/Rules analysis points returned');
    assert(Array.isArray(legalData.courtReadinessChecklist), 'BSA §63 court readiness checklist returned');

    // Test 2: Fetch Statutory Provisions Registry
    console.log('\n[2] Testing GET /api/legal/provisions...');
    const resProvisions = await fetch(`${BASE_URL}/api/legal/provisions`);
    assert(resProvisions.status === 200, 'GET /api/legal/provisions returns 200');
    const provisionsData = await resProvisions.json();
    assert(provisionsData.total >= 8, `Official statutory provisions registered (found ${provisionsData.total})`);
    assert(provisionsData.authoritativeSources?.BNS.includes('indiacode.nic.in'), 'Authoritative BNS source URL present');

    // Test 3: Add New Section Mapping
    console.log('\n[3] Testing POST /api/cases/:caseId/legal (Add Section)...');
    const resAdd = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/legal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        act: 'BNS',
        section: '§ 351(2)',
        description: 'Criminal intimidation',
        relevance: 'SECONDARY',
        rationale: 'Threats made via WhatsApp during payment extortion.',
        reviewerName: 'ACP Vikram Singh (Badge #DL-002)',
      }),
    });
    assert(resAdd.status === 200, 'POST /api/cases/:caseId/legal returns 200');
    const addResult = await resAdd.json();
    assert(addResult.success && addResult.mapping?.section === '§ 351(2)', 'Section § 351(2) mapped to case');

    // Test 4: Record Legal Review Decision
    console.log('\n[4] Testing POST /api/cases/:caseId/legal/review...');
    const resReview = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/legal/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionCode: 'BNS___351_2_',
        status: 'APPROVED',
        reviewerName: 'ACP Vikram Singh',
        reviewerNotes: 'Approved based on audio recording transcripts.',
      }),
    });
    assert(resReview.status === 200, 'POST /api/cases/:caseId/legal/review returns 200');
    const reviewResult = await resReview.json();
    assert(reviewResult.updated?.status === 'APPROVED', 'Legal review status updated to APPROVED');

    // Test 5: Map Evidence to Statutory Provision
    console.log('\n[5] Testing POST /api/cases/:caseId/legal/map-evidence...');
    const firstEvId = legalData.evidenceMappings[0].evidenceId;
    const resMapEv = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/legal/map-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidenceId: firstEvId,
        section: '§ 318(4), § 66D',
        relevance: 'HIGH',
        rationale: 'Primary WhatsApp dialogue exhibiting impersonation and inducement.',
      }),
    });
    assert(resMapEv.status === 200, 'POST /api/cases/:caseId/legal/map-evidence returns 200');
    const mapEvResult = await resMapEv.json();
    assert(mapEvResult.mapping?.section === '§ 318(4), § 66D', 'Evidence successfully mapped to statutory provisions');

    // Test 6: Dossier Validation against BSA Section 63
    console.log('\n[6] Testing GET /api/cases/:caseId/dossier/validate...');
    const resValidate = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/dossier/validate`);
    assert(resValidate.status === 200, 'GET /api/cases/:caseId/dossier/validate returns 200');
    const validateData = await resValidate.json();
    assert(validateData.checks?.length >= 5, 'All BSA §63 validation checkpoints evaluated');
    assert(validateData.certificateParticulars?.section.includes('Section 63'), 'Statutory particulars reference BSA Section 63');

    // Test 7: Export JSON Dossier Manifest
    console.log('\n[7] Testing POST /api/cases/:caseId/dossier/export (JSON)...');
    const resExportJson = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/dossier/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ format: 'JSON' }),
    });
    assert(resExportJson.status === 200, 'POST /api/cases/:caseId/dossier/export (JSON) returns 200');
    const exportJsonData = await resExportJson.json();
    assert(exportJsonData.statutoryFramework?.evidenceAct.includes('Section 63'), 'Exported JSON contains BSA §63 statutory framework');
    assert(Array.isArray(exportJsonData.evidenceManifest), 'Exported JSON contains evidence integrity manifest');

    // Test 8: Export ZIP Evidence Package
    console.log('\n[8] Testing POST /api/cases/:caseId/dossier/export (ZIP)...');
    const resExportZip = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/dossier/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ format: 'ZIP' }),
    });
    assert(resExportZip.status === 200, 'POST /api/cases/:caseId/dossier/export (ZIP) returns 200');
    const zipBytes = await resExportZip.arrayBuffer();
    assert(zipBytes.byteLength > 100, `ZIP evidence archive generated (${zipBytes.byteLength} bytes)`);

    // Test 9: Clean up added test section
    console.log('\n[9] Testing DELETE /api/cases/:caseId/legal...');
    const resDel = await fetch(`${BASE_URL}/api/cases/${CASE_ID}/legal?sectionCode=BNS___351_2_`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert(resDel.status === 200, 'DELETE /api/cases/:caseId/legal returns 200');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
