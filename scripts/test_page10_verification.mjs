// scripts/test_page10_verification.mjs
// Automated verification suite for Page 10: Administration & Officer Management
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
  console.log("  RAKSHAK v3.0 — PAGE 10 AUTOMATED VERIFICATION SUITE");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const cwd = process.cwd();

  // Test 1: File Presence
  console.log("Test Suite 1: File Existence & Integrity");
  const htmlPath = path.join(cwd, "public", "frontend", "pages", "admin.html");
  const cssPath = path.join(cwd, "public", "frontend", "css", "admin-neumorphic.css");
  const jsPath = path.join(cwd, "public", "frontend", "js", "admin.js");
  const deptApiPath = path.join(cwd, "app", "api", "departments", "route.ts");

  assert(fs.existsSync(htmlPath), "public/frontend/pages/admin.html exists");
  assert(fs.existsSync(cssPath), "public/frontend/css/admin-neumorphic.css exists");
  assert(fs.existsSync(jsPath), "public/frontend/js/admin.js exists");
  assert(fs.existsSync(deptApiPath), "app/api/departments/route.ts exists");

  // Test 2: HTML Content Verification
  console.log("\nTest Suite 2: HTML Semantic Elements & Structure");
  const html = fs.readFileSync(htmlPath, "utf-8");

  assert(html.includes("Administration &amp; Officer Management") || html.includes("Administration & Officer Management"), "Page title matches specification");
  assert(html.includes("Manage users, roles, departments and system settings"), "Subtitle matches specification");
  assert(html.includes("btn-add-officer"), "+ Add New Officer button exists");
  assert(html.includes("btn-create-dept"), "Create Department button exists");
  assert(html.includes("btn-role-mgmt"), "Role Management button exists");
  assert(html.includes("stat-total-officers"), "Summary card 1 (Total Officers) exists");
  assert(html.includes("stat-total-departments"), "Summary card 2 (Departments) exists");
  assert(html.includes("stat-total-roles"), "Summary card 3 (Roles) exists");
  assert(html.includes("stat-active-accounts"), "Summary card 4 (Active Accounts) exists");
  assert(html.includes("stat-pending-approvals"), "Summary card 5 (Pending Approvals) exists");
  assert(html.includes("officers-table"), "Officer table element exists");
  assert(html.includes("selected-officer-panel"), "Right-hand Selected Officer Profile panel exists");
  assert(html.includes("recent-activities-list"), "Lower Panel 1: Recent User Activities exists");
  assert(html.includes("departments-overview-list"), "Lower Panel 2: Department Overview exists");
  assert(html.includes("system-settings-list"), "Lower Panel 3: System Settings exists");
  assert(html.includes("modal-add-officer"), "Modal dialog for adding officers exists");
  assert(html.includes("modal-create-dept"), "Modal dialog for creating departments exists");
  assert(html.includes("modal-manage-roles"), "Modal dialog for role management exists");
  assert(html.includes('class="neu-nav-item active"'), "Administration link in sidebar is set to active");

  // Test 3: CSS Token & Neumorphic Design Rules
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
  assert(css.includes(".neu-nav-item.active"), "CSS styles active Administration sidebar pill");

  // Test 4: JavaScript Controller Functionality
  console.log("\nTest Suite 4: Controller Baseline & Handlers");
  const js = fs.readFileSync(jsPath, "utf-8");

  assert(js.includes("CANONICAL_OFFICERS"), "JS defines canonical officer dataset");
  assert(js.includes("INS-001"), "Rajesh Kumar (INS-001) is defined in baseline");
  assert(js.includes("SI-027"), "Priya Singh (SI-027) is defined in baseline");
  assert(js.includes("HC-105"), "Amit Sharma (HC-105) is defined in baseline");
  assert(js.includes("SI-043"), "Neha Verma (SI-043) is defined in baseline");
  assert(js.includes("INS-012"), "Vikram Patel (INS-012) is defined in baseline");
  assert(js.includes("HC-221"), "Sandeep Rai (HC-221) is defined in baseline");
  assert(js.includes("SI-067"), "Karan Mehta (SI-067) is defined in baseline");
  assert(js.includes("ANL-015"), "Pooja Arora (ANL-015) is defined in baseline");
  assert(js.includes("selectOfficer"), "Officer row selection function is implemented");
  assert(js.includes("applyFilters"), "Search and multi-dropdown filtering is implemented");
  assert(js.includes("handleAddOfficerSubmit"), "POST /api/officers submission handler exists");
  assert(js.includes("handleCreateDeptSubmit"), "POST /api/departments submission handler exists");

  // Test 5: Database Seeding Verification
  console.log("\nTest Suite 5: SQLite Database Integrity");
  const officersCount = await prisma.officer.count();
  const rajesh = await prisma.officer.findUnique({ where: { badgeNumber: "INS-001" } });
  const priya = await prisma.officer.findUnique({ where: { badgeNumber: "SI-027" } });
  const ccd = await prisma.department.findUnique({ where: { code: "CCD" } });

  assert(officersCount >= 8, `Database contains >= 8 officers (actual: ${officersCount})`);
  assert(rajesh !== null && rajesh.name === "Rajesh Kumar", "Rajesh Kumar is present in Prisma database");
  assert(priya !== null && priya.name === "Priya Singh", "Priya Singh is present in Prisma database");
  assert(ccd !== null && ccd.name === "Cyber Crime Department", "Cyber Crime Department (CCD) exists in Prisma database");

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
