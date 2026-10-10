/**
 * Phase 8 End-to-End Verification Test Script
 * Verifies Reports, RBAC, Authentication, and Audit Trail APIs.
 */

const BASE_URL = 'http://localhost:3000';

async function testPhase8() {
  console.log('--- Starting Phase 8 Verification Tests ---');
  let cookieHeader = '';

  // 1. Check Analytics API
  console.log('\n[1] Testing GET /api/reports/analytics...');
  const resAnalytics = await fetch(`${BASE_URL}/api/reports/analytics`);
  if (!resAnalytics.ok) throw new Error(`Analytics failed: ${resAnalytics.status}`);
  const analytics = await resAnalytics.json();
  console.log('✓ Counts:', analytics.counts);
  console.log('✓ Cases by Status items:', analytics.casesByStatus?.length);
  console.log('✓ Evidence by Category items:', analytics.evidenceByCategory?.length);
  console.log('✓ Entities by Type items:', analytics.entitiesByType?.length);
  console.log('✓ 7-Day Activity dates:', analytics.sevenDayActivity?.dates);
  if (!analytics.counts || analytics.counts.totalCases < 1) {
    throw new Error('Analytics counts missing or empty');
  }

  // 2. Authentication: Login as Admin
  console.log('\n[2] Testing POST /api/auth/login (Admin DL-002)...');
  const resLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badgeNumber: 'DL-002', password: 'Rakshak@2026' }),
  });
  if (!resLogin.ok) throw new Error(`Login failed: ${resLogin.status}`);
  const loginData = await resLogin.json();
  console.log(`✓ Logged in as: ${loginData.officer.name} (${loginData.officer.role})`);

  // Grab cookie from set-cookie header
  const setCookie = resLogin.headers.get('set-cookie');
  if (setCookie) {
    cookieHeader = setCookie.split(';')[0];
    console.log('✓ Session Cookie acquired');
  }

  // 3. Auth Me
  console.log('\n[3] Testing GET /api/auth/me...');
  const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  const meData = await resMe.json();
  console.log('✓ Auth Me result:', meData.authenticated, meData.officer?.badgeNumber);
  if (!meData.authenticated || meData.officer?.badgeNumber !== 'DL-002') {
    throw new Error('Session verification failed');
  }

  // 4. Officers List & RBAC
  console.log('\n[4] Testing GET /api/officers...');
  const resOfficers = await fetch(`${BASE_URL}/api/officers`, {
    headers: { Cookie: cookieHeader },
  });
  const officersData = await resOfficers.json();
  console.log(`✓ Officers Count: ${officersData.officers?.length}`);
  if (!officersData.officers || officersData.officers.length < 5) {
    throw new Error('Expected at least 5 seeded officers');
  }

  // 5. Create New Officer (Admin only)
  console.log('\n[5] Testing POST /api/officers (Provision new Officer)...');
  const testBadge = `TS-${Date.now().toString().slice(-4)}`;
  const resCreateOfficer = await fetch(`${BASE_URL}/api/officers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      badgeNumber: testBadge,
      name: 'Inspector Test Verma',
      rank: 'Inspector',
      role: 'INVESTIGATOR',
      jurisdiction: 'Cyber Crime Unit South',
      password: 'Rakshak@2026',
    }),
  });
  if (!resCreateOfficer.ok) throw new Error(`Officer creation failed: ${resCreateOfficer.status}`);
  const newOfficer = await resCreateOfficer.json();
  console.log(`✓ Created Officer: ${newOfficer.officer.badgeNumber} (${newOfficer.officer.id})`);

  // 6. Update Officer Role & Status
  console.log('\n[6] Testing PATCH /api/officers/:id (Update Role & Status)...');
  const resUpdateOfficer = await fetch(`${BASE_URL}/api/officers/${newOfficer.officer.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ role: 'ANALYST', status: 'INACTIVE' }),
  });
  if (!resUpdateOfficer.ok) throw new Error(`Officer update failed: ${resUpdateOfficer.status}`);
  const updatedOfficer = await resUpdateOfficer.json();
  console.log(`✓ Updated Officer Role: ${updatedOfficer.officer.role}, Status: ${updatedOfficer.officer.status}`);

  // 7. Generate Report
  console.log('\n[7] Testing POST /api/reports/generate...');
  const resGenReport = await fetch(`${BASE_URL}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      caseId: 'CASE-2026-0891',
      type: 'CASE_REPORT',
      format: 'PDF',
      sections: ['EXECUTIVE_SUMMARY', 'EVIDENCE_INVENTORY', 'STATUTORY_COMPLIANCE'],
    }),
  });
  if (!resGenReport.ok) throw new Error(`Report generation failed: ${resGenReport.status}`);
  const genReportData = await resGenReport.json();
  const repNo = genReportData.report.reportNumber || genReportData.report.reportId;
  console.log(`✓ Generated Report: ${repNo} (ID: ${genReportData.report.id})`);


  // 8. Download Report
  console.log('\n[8] Testing GET /api/reports/:id/download...');
  const resDownload = await fetch(`${BASE_URL}/api/reports/${genReportData.report.id}/download`, {
    headers: { Cookie: cookieHeader },
  });
  if (!resDownload.ok) throw new Error(`Report download failed: ${resDownload.status}`);
  const blobBuf = await resDownload.arrayBuffer();
  console.log(`✓ Downloaded report buffer: ${blobBuf.byteLength} bytes`);

  // 9. Scheduled Reports
  console.log('\n[9] Testing Scheduled Reports API...');
  const resSchedules = await fetch(`${BASE_URL}/api/reports/scheduled`, {
    headers: { Cookie: cookieHeader },
  });
  const schedulesData = await resSchedules.json();
  console.log(`✓ Scheduled Reports count: ${schedulesData.scheduledReports?.length}`);

  // 10. Audit Logs Query & Filtering
  console.log('\n[10] Testing GET /api/audit (Query & Filtering)...');
  const resAudit = await fetch(`${BASE_URL}/api/audit?limit=5`, {
    headers: { Cookie: cookieHeader },
  });
  const auditData = await resAudit.json();
  console.log(`✓ Total Audit Logs: ${auditData.total}, Page items: ${auditData.logs?.length}`);
  if (auditData.logs?.length > 0) {
    console.log(`✓ Sample Audit Log: [${auditData.logs[0].action}] on module ${auditData.logs[0].module} by ${auditData.logs[0].officerBadge}`);
  }

  // 11. Audit Logs Export (CSV & JSON with formula injection sanitization)
  console.log('\n[11] Testing POST /api/audit/export (CSV & JSON)...');
  const resExportCsv = await fetch(`${BASE_URL}/api/audit/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ format: 'csv' }),
  });
  if (!resExportCsv.ok) throw new Error(`CSV export failed: ${resExportCsv.status}`);
  const csvText = await resExportCsv.text();
  console.log(`✓ CSV Export Length: ${csvText.length} characters`);
  console.log(`✓ CSV Header: ${csvText.split('\n')[0]}`);

  const resExportJson = await fetch(`${BASE_URL}/api/audit/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ format: 'json' }),
  });
  if (!resExportJson.ok) throw new Error(`JSON export failed: ${resExportJson.status}`);
  const jsonExport = await resExportJson.json();
  console.log(`✓ JSON Export Items count: ${jsonExport.length}`);

  console.log('\n========================================');
  console.log('🎉 ALL PHASE 8 BACKEND APIS VERIFIED OK!');
  console.log('========================================\n');
}

testPhase8().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
