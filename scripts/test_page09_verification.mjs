// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_page09_verification.mjs
// Automated verification for Page 09: Cross-Department Collaboration
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   RAKSHAK v3.0 — PAGE 09: CROSS-DEPARTMENT VERIFICATION       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Verify HTML File
  const htmlPath = path.resolve('public/frontend/pages/cross-dept.html');
  test('public/frontend/pages/cross-dept.html exists', () => {
    assert(fs.existsSync(htmlPath));
  });

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  test('HTML contains correct page heading "Cross-Department Collaboration"', () => {
    assert(htmlContent.includes('Cross-Department Collaboration'));
  });

  test('HTML highlights Cross-Department in sidebar navigation', () => {
    assert(htmlContent.includes('class="neu-nav-item active"'));
    assert(htmlContent.includes('Cross-Department</span>'));
  });

  test('HTML contains action buttons: Request Access, Share Case, Department Directory', () => {
    assert(htmlContent.includes('id="btn-request-access"'));
    assert(htmlContent.includes('id="btn-share-case"'));
    assert(htmlContent.includes('id="btn-dept-dir"'));
  });

  test('HTML contains 5 horizontal summary metric cards', () => {
    assert(htmlContent.includes('id="metric-connected-depts"'));
    assert(htmlContent.includes('id="metric-pending-requests"'));
    assert(htmlContent.includes('id="metric-approved-requests"'));
    assert(htmlContent.includes('id="metric-shared-cases"'));
    assert(htmlContent.includes('id="metric-active-collabs"'));
  });

  test('HTML contains workspace tabs', () => {
    assert(htmlContent.includes('class="cd-workspace-tabs"'));
    assert(htmlContent.includes('data-view="requests"'));
    assert(htmlContent.includes('data-view="shared-cases"'));
    assert(htmlContent.includes('data-view="network"'));
    assert(htmlContent.includes('data-view="directory"'));
  });

  test('HTML contains Access Requests table panel', () => {
    assert(htmlContent.includes('id="panel-access-requests"'));
    assert(htmlContent.includes('id="access-requests-table"'));
    assert(htmlContent.includes('id="search-requests-input"'));
  });

  test('HTML contains Selected Request Details panel with Approve and Reject actions', () => {
    assert(htmlContent.includes('id="panel-request-details"'));
    assert(htmlContent.includes('id="btn-approve-request"'));
    assert(htmlContent.includes('id="btn-reject-request"'));
    assert(htmlContent.includes('id="details-hero-id"'));
  });

  test('HTML contains three lower panels: Recent Approved, Active Collabs, Directory', () => {
    assert(htmlContent.includes('id="panel-recent-approved"'));
    assert(htmlContent.includes('id="panel-active-collabs"'));
    assert(htmlContent.includes('id="panel-dept-dir"'));
  });

  test('HTML contains modal dialogs for Request Access, Approve, and Reject', () => {
    assert(htmlContent.includes('id="modal-request-access"'));
    assert(htmlContent.includes('id="modal-approve-confirm"'));
    assert(htmlContent.includes('id="modal-reject-confirm"'));
  });

  // 2. Verify CSS File
  const cssPath = path.resolve('public/frontend/css/cross-dept-neumorphic.css');
  test('public/frontend/css/cross-dept-neumorphic.css exists', () => {
    assert(fs.existsSync(cssPath));
  });

  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  test('CSS contains exact background color #E9EEF5', () => {
    assert(cssContent.includes('--neu-bg:                #E9EEF5'));
  });

  test('CSS contains exact surface card color #F5F8FC', () => {
    assert(cssContent.includes('--neu-surface:           #F5F8FC'));
  });

  test('CSS contains primary navy #172B4D', () => {
    assert(cssContent.includes('--neu-navy:              #172B4D'));
  });

  test('CSS contains primary accent blue #3988F5', () => {
    assert(cssContent.includes('--neu-blue:              #3988F5'));
  });

  test('CSS contains 5-column metric strip layout', () => {
    assert(cssContent.includes('.neu-metric-strip-5'));
  });

  test('CSS contains main grid layout and lower 3-column grid', () => {
    assert(cssContent.includes('.cd-main-grid'));
    assert(cssContent.includes('.cd-lower-grid'));
  });

  test('CSS contains neumorphic dual raised and inset shadows', () => {
    assert(cssContent.includes('--neu-shadow-raised-md:'));
    assert(cssContent.includes('--neu-shadow-inset:'));
  });

  // 3. Verify JS File
  const jsPath = path.resolve('public/frontend/js/cross-dept.js');
  test('public/frontend/js/cross-dept.js exists', () => {
    assert(fs.existsSync(jsPath));
  });

  const jsContent = fs.readFileSync(jsPath, 'utf-8');
  test('JS defines canonical access requests dataset', () => {
    assert(jsContent.includes('CANONICAL_REQUESTS'));
    assert(jsContent.includes('REQ-2024-001'));
  });

  test('JS defines selectRequest controller function', () => {
    assert(jsContent.includes('export function selectRequest'));
  });

  test('JS defines applyFilters and clearFilters functions', () => {
    assert(jsContent.includes('export function applyFilters'));
    assert(jsContent.includes('export function clearFilters'));
  });

  test('JS defines renderTable function', () => {
    assert(jsContent.includes('export function renderTable'));
  });

  // 4. Verify Database Records
  try {
    const deptCount = await prisma.department.count();
    test(`Database contains seeded Departments (Found: ${deptCount})`, () => {
      assert(deptCount >= 8);
    });

    const cyberDept = await prisma.department.findFirst({
      where: { name: { contains: 'Cyber Crime' } }
    });
    test('Database contains Cyber Crime Department', () => {
      assert(cyberDept !== null);
    });

    const eowDept = await prisma.department.findFirst({
      where: { name: { contains: 'Economic Offences' } }
    });
    test('Database contains Economic Offences Wing', () => {
      assert(eowDept !== null);
    });

    const case001 = await prisma.case.findUnique({
      where: { caseNumber: 'CC/2024/001' }
    });
    test('Database contains canonical Case CC/2024/001', () => {
      assert(case001 !== null);
    });
  } catch (dbErr) {
    console.error('[DB FAIL]', dbErr);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\nVerification Complete: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
