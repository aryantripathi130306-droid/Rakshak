// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_page08_verification.mjs
// Automated verification for Page 08: Investigation Timeline & Event Details
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    RAKSHAK v3.0 — PAGE 08: INVESTIGATION TIMELINE VERIFICATION    ');
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
  const htmlPath = path.resolve('public/frontend/pages/timeline.html');
  test('public/frontend/pages/timeline.html exists', () => {
    assert(fs.existsSync(htmlPath));
  });

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  test('HTML contains correct page heading "Investigation Timeline"', () => {
    assert(htmlContent.includes('Investigation Timeline'));
  });

  test('HTML highlights Timeline as active page in sidebar', () => {
    assert(htmlContent.includes('class="neu-nav-item active"'));
    assert(htmlContent.includes('Timeline</span>'));
  });

  test('HTML contains Date Range selector and Add Timeline Event button', () => {
    assert(htmlContent.includes('id="btn-date-range"'));
    assert(htmlContent.includes('id="btn-add-event"'));
  });

  test('HTML contains Total Events metric card', () => {
    assert(htmlContent.includes('id="metric-total-events"'));
  });

  test('HTML contains Case Milestones metric card', () => {
    assert(htmlContent.includes('id="metric-milestones-count"'));
  });

  test('HTML contains Evidence Events metric card', () => {
    assert(htmlContent.includes('id="metric-evidence-count"'));
  });

  test('HTML contains Entity Activities metric card', () => {
    assert(htmlContent.includes('id="metric-entity-count"'));
  });

  test('HTML contains System Activities metric card', () => {
    assert(htmlContent.includes('id="metric-system-count"'));
  });

  test('HTML contains 3-column workstation grid and panels', () => {
    assert(htmlContent.includes('class="tl-workstation-grid"'));
    assert(htmlContent.includes('id="panel-filters"'));
    assert(htmlContent.includes('id="panel-timeline-stream"'));
    assert(htmlContent.includes('id="panel-event-details"'));
  });

  test('HTML contains Event Type filter checklist', () => {
    assert(htmlContent.includes('id="filter-type-checklist"'));
    assert(htmlContent.includes('data-type="CASE_EVENT"'));
    assert(htmlContent.includes('data-type="EVIDENCE_EVENT"'));
    assert(htmlContent.includes('data-type="ENTITY_EVENT"'));
    assert(htmlContent.includes('data-type="INVESTIGATION_ACTION"'));
    assert(htmlContent.includes('data-type="SYSTEM_EVENT"'));
  });

  test('HTML contains Timeline Events stream track and pagination', () => {
    assert(htmlContent.includes('id="timeline-events-track"'));
    assert(htmlContent.includes('class="tl-pagination-bar"'));
  });

  test('HTML contains Event Details hero banner, tabs and metadata', () => {
    assert(htmlContent.includes('id="detail-hero-banner"'));
    assert(htmlContent.includes('class="tl-tabs-strip"'));
    assert(htmlContent.includes('id="detail-event-id"'));
    assert(htmlContent.includes('id="btn-copy-hash"'));
  });

  test('HTML contains Add Timeline Event modal dialog', () => {
    assert(htmlContent.includes('id="modal-add-event"'));
    assert(htmlContent.includes('id="form-add-event"'));
  });

  // 2. Verify CSS File
  const cssPath = path.resolve('public/frontend/css/timeline-neumorphic.css');
  test('public/frontend/css/timeline-neumorphic.css exists', () => {
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

  test('CSS contains 3-column workstation grid layout', () => {
    assert(cssContent.includes('.tl-workstation-grid'));
  });

  test('CSS contains vertical timeline line rail style', () => {
    assert(cssContent.includes('.tl-timeline-track::before'));
  });

  test('CSS contains neumorphic dual raised and inset shadows', () => {
    assert(cssContent.includes('--neu-shadow-raised-md:'));
    assert(cssContent.includes('--neu-shadow-inset:'));
  });

  // 3. Verify JS File
  const jsPath = path.resolve('public/frontend/js/timeline.js');
  test('public/frontend/js/timeline.js exists', () => {
    assert(fs.existsSync(jsPath));
  });

  const jsContent = fs.readFileSync(jsPath, 'utf-8');
  test('JS defines canonical timeline events dataset', () => {
    assert(jsContent.includes('CANONICAL_TIMELINE_EVENTS'));
    assert(jsContent.includes('EVT-2024-001245'));
  });

  test('JS defines selectEvent controller function', () => {
    assert(jsContent.includes('export function selectEvent'));
  });

  test('JS defines applyFilters and clearFilters functions', () => {
    assert(jsContent.includes('export function applyFilters'));
    assert(jsContent.includes('export function clearFilters'));
  });

  test('JS defines renderStream function', () => {
    assert(jsContent.includes('export function renderStream'));
  });

  // 4. Verify Database Records
  try {
    const totalEvents = await prisma.timelineEvent.count();
    test(`Database contains seeded TimelineEvents (Found: ${totalEvents})`, () => {
      assert(totalEvents >= 10);
    });

    const evt1245 = await prisma.timelineEvent.findUnique({
      where: { id: 'EVT-2024-001245' },
      include: { case: true, evidence: true }
    });
    test('Database contains canonical event EVT-2024-001245', () => {
      assert(evt1245 !== null);
      assert(evt1245.description.includes('mobile_001.jpg accepted into evidence'));
    });

    test('Canonical event is linked to case CC/2024/001', () => {
      assert(evt1245?.case?.caseNumber === 'CC/2024/001');
    });

    test('Canonical event is linked to evidence MOBILE_001.jpg with SHA-256', () => {
      assert(evt1245?.evidence?.fileName === 'MOBILE_001.jpg');
      assert(evt1245?.evidence?.sha256Hash === 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9');
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
