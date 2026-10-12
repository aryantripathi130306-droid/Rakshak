// scripts/test_page11_verification.mjs
// Automated verification suite for Page 11: Audit Logs & Security Activity
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  RAKSHAK v3.0 — PAGE 11 AUTOMATED VERIFICATION SUITE");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const cwd = process.cwd();

  // Test 1: File Existence & Integrity
  console.log("Test Suite 1: File Existence & Integrity");
  const htmlPath = path.join(cwd, "public", "frontend", "pages", "audit.html");
  const cssPath = path.join(cwd, "public", "frontend", "css", "audit-neumorphic.css");
  const jsPath = path.join(cwd, "public", "frontend", "js", "audit.js");
  const auditApiPath = path.join(cwd, "app", "api", "audit", "route.ts");
  const exportApiPath = path.join(cwd, "app", "api", "audit", "export", "route.ts");

  assert(fs.existsSync(htmlPath), "public/frontend/pages/audit.html exists");
  assert(fs.existsSync(cssPath), "public/frontend/css/audit-neumorphic.css exists");
  assert(fs.existsSync(jsPath), "public/frontend/js/audit.js exists");
  assert(fs.existsSync(auditApiPath), "app/api/audit/route.ts exists");
  assert(fs.existsSync(exportApiPath), "app/api/audit/export/route.ts exists");

  // Test 2: HTML Semantic Elements & Structure
  console.log("\nTest Suite 2: HTML Semantic Elements & Layout");
  const html = fs.readFileSync(htmlPath, "utf-8");

  assert(html.includes("Audit Logs &amp; Security Activity") || html.includes("Audit Logs & Security Activity"), "Page title matches specification");
  assert(html.includes("Track system activities, user actions and security events for complete audit trail"), "Subtitle matches specification");
  assert(html.includes("btn-date-range"), "Date range selector control exists");
  assert(html.includes("btn-export-logs"), "Export Logs button exists");
  assert(html.includes("stat-total-events"), "Summary card 1 (Total Log Events) exists");
  assert(html.includes("stat-user-activities"), "Summary card 2 (User Activities) exists");
  assert(html.includes("stat-security-events"), "Summary card 3 (Security Events) exists");
  assert(html.includes("stat-data-access-events"), "Summary card 4 (Data Access Events) exists");
  assert(html.includes("stat-system-events"), "Summary card 5 (System Events) exists");
  assert(html.includes("audit-table"), "Audit logs table element exists");
  assert(html.includes("log-details-panel"), "Right-hand Log Details panel exists");
  assert(html.includes("trend-chart-container"), "Lower Panel 1: Activity Trend chart exists");
  assert(html.includes("top-users-list"), "Lower Panel 2: Top Users by Activity exists");
  assert(html.includes("security-alerts-list"), "Lower Panel 3: Recent Security Alerts exists");
  assert(html.includes("modal-export"), "Export modal dialog exists");
  assert(html.includes('href="/frontend/pages/audit.html" class="neu-nav-item active"'), "Audit Logs link in sidebar is set to active");

  // Test 3: CSS Neumorphic Design Tokens
  console.log("\nTest Suite 3: CSS Neumorphic Design Tokens");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert(css.includes("#E9EEF5"), "CSS includes background token #E9EEF5");
  assert(css.includes("#F5F8FC"), "CSS includes surface token #F5F8FC");
  assert(css.includes("#172B4D"), "CSS includes primary navy token #172B4D");
  assert(css.includes("#637692"), "CSS includes secondary text token #637692");
  assert(css.includes("#3988F5"), "CSS includes primary blue token #3988F5");
  assert(css.includes("#36C98F"), "CSS includes success green token #36C98F");
  assert(css.includes("#F5B544"), "CSS includes warning amber token #F5B544");
  assert(css.includes("#9461F5"), "CSS includes accent purple token #9461F5");
  assert(css.includes("box-shadow"), "CSS includes dual neumorphic box-shadow rules");
  assert(css.includes("inset"), "CSS includes subtle inset shadows for search/inputs");
  assert(css.includes(".neu-nav-item.active"), "CSS styles active Audit Logs sidebar pill");

  // Test 4: JavaScript Controller Baseline & Handlers
  console.log("\nTest Suite 4: Controller Baseline & Handlers");
  const js = fs.readFileSync(jsPath, "utf-8");

  assert(js.includes("CANONICAL_LOGS"), "JS defines canonical audit dataset");
  assert(js.includes("LOG-2024-00012345"), "LOG-2024-00012345 (Viewed Evidence) is defined in baseline");
  assert(js.includes("LOG-2024-00012344"), "LOG-2024-00012344 (Updated Case) is defined in baseline");
  assert(js.includes("LOG-2024-00012343"), "LOG-2024-00012343 (Failed Login) is defined in baseline");
  assert(js.includes("LOG-2024-00012342"), "LOG-2024-00012342 (Created Report) is defined in baseline");
  assert(js.includes("LOG-2024-00012341"), "LOG-2024-00012341 (Password Change) is defined in baseline");
  assert(js.includes("LOG-2024-00012340"), "LOG-2024-00012340 (Downloaded Evidence) is defined in baseline");
  assert(js.includes("LOG-2024-00012339"), "LOG-2024-00012339 (Deleted Entity) is defined in baseline");
  assert(js.includes("LOG-2024-00012338"), "LOG-2024-00012338 (Role Updated) is defined in baseline");
  assert(js.includes("selectLog"), "Log row selection function is implemented");
  assert(js.includes("applyFilters"), "Search and multi-dropdown filtering is implemented");
  assert(js.includes("handleExport"), "Audit export handler is implemented");

  // Test 5: Database Seeding & API Integrity
  console.log("\nTest Suite 5: SQLite Database Integrity");
  const auditLogsCount = await prisma.auditLog.count();
  const canonicalLog = await prisma.auditLog.findUnique({ where: { id: "LOG-2024-00012345" } });
  const failedLog = await prisma.auditLog.findUnique({ where: { id: "LOG-2024-00012343" } });

  assert(auditLogsCount >= 8, `Database contains >= 8 audit logs (actual: ${auditLogsCount})`);
  assert(canonicalLog !== null && canonicalLog.action === "VIEW_EVIDENCE", "Canonical LOG-2024-00012345 is present in Prisma database");
  assert(failedLog !== null && failedLog.action === "LOGIN_FAILED", "Canonical LOG-2024-00012343 (LOGIN_FAILED) is present in Prisma database");

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("══════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
