import fs from "node:fs";
import { execSync } from "node:child_process";

const trackedFiles = execSync("git ls-files", { encoding: "utf-8" }).split(/\r?\n/).filter(Boolean);

const patterns = [
  { name: "Private Key", regex: /-----BEGIN (RSA |EC |PGP |OPENSSH )?PRIVATE KEY-----/ },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Google API Key", regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: "Hardcoded Password", regex: /(?:password|secret|apiKey)\s*[:=]\s*["'][^"']{8,}["']/i }
];

const findings = [];

for (const file of trackedFiles) {
  if (
    file.endsWith(".bin") ||
    file.endsWith(".png") ||
    file.endsWith(".traineddata") ||
    file.includes("node_modules") ||
    file.startsWith("backups/") ||
    file.endsWith("_REPORT.md") ||
    file.startsWith("scripts/test_")
  ) {
    continue;
  }
  try {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const pat of patterns) {
        if (pat.regex.test(line)) {
          if (
            line.includes("REPLACE_WITH") ||
            line.includes("change_me") ||
            line.includes("dummy") ||
            line.includes("placeholder") ||
            line.includes("example") ||
            line.includes("Hash") ||
            line.includes("hashPassword") ||
            line.includes("verifyPassword")
          ) {
            continue;
          }
          findings.push({ file, line: idx + 1, type: pat.name, snippet: line.trim().slice(0, 80) });
        }
      }
    });
  } catch (e) {}
}

console.log("Secret Scan Findings Count:", findings.length);
findings.forEach((f) => console.log(`  [${f.type}] ${f.file}:${f.line} -> ${f.snippet}`));
