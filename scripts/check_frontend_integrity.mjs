// scripts/check_frontend_integrity.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const pagesDir = path.join(process.cwd(), "public", "frontend", "pages");
const jsDir = path.join(process.cwd(), "public", "frontend", "js");
const cssDir = path.join(process.cwd(), "public", "frontend", "css");

const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith(".html"));

console.log(`Checking ${pages.length} pages in ${pagesDir}...\n`);

let issues = [];

// 1. Check all HTML file references
for (const page of pages) {
  const filePath = path.join(pagesDir, page);
  const content = fs.readFileSync(filePath, "utf-8");

  // Check CSS links
  const linkMatches = content.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of linkMatches) {
    const href = match[1];
    if (href.startsWith("http") || href.startsWith("//")) continue;
    // resolve relative to pagesDir
    const resolved = path.resolve(pagesDir, href);
    if (!fs.existsSync(resolved)) {
      issues.push({ page, type: "BROKEN_CSS_LINK", reference: href, resolved });
    }
  }

  // Check Script src
  const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi);
  for (const match of scriptMatches) {
    const src = match[1];
    if (src.startsWith("http") || src.startsWith("//")) continue;
    const resolved = path.resolve(pagesDir, src);
    if (!fs.existsSync(resolved)) {
      issues.push({ page, type: "BROKEN_SCRIPT_SRC", reference: src, resolved });
    }
  }
}

// 2. Syntax check all JS files
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith(".js"));
for (const jsFile of jsFiles) {
  const fullPath = path.join(jsDir, jsFile);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
  } catch (err) {
    issues.push({ file: jsFile, type: "JS_SYNTAX_ERROR", error: err.message });
  }
}

console.log("Integrity Check Results:");
if (issues.length === 0) {
  console.log("✓ No broken links or syntax errors found in static analysis.");
} else {
  console.log(`Found ${issues.length} issues:`);
  console.log(JSON.stringify(issues, null, 2));
}
