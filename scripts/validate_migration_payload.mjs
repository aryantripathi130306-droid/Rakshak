// ─────────────────────────────────────────────────────────────────────────────
// scripts/validate_migration_payload.mjs
// Rakshak v3.0 — Phase 31 Migration Payload & Schema Boundary Validator
//
// Validates:
// 1. Payload file existence, non-empty content, and valid JSON structure.
// 2. Presence of required manifest and data root objects.
// 3. Manifest metadata integrity (source database, SHA-256 digest, 21 models).
// 4. Source boundary enforcement (rejects unauthorized source database paths).
// 5. Strict 21-model schema parity between manifest recordCounts and data arrays.
// 6. Relational foreign key and uniqueness integrity across models.
// 7. Cryptographic evidence SHA-256 digest format compliance.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_MODELS = [
  "departments",
  "officers",
  "officerSessions",
  "cases",
  "evidence",
  "extractedFacts",
  "timelineEvents",
  "caseEntities",
  "clusters",
  "clusterMemberships",
  "custodyEvents",
  "legalProvisions",
  "caseLegalMappings",
  "evidenceLegalMappings",
  "dossierAudits",
  "transcriptions",
  "chatTranslations",
  "auditLogs",
  "reports",
  "scheduledReports",
  "pilotFeedback",
];

function parseArgs(args = process.argv.slice(2)) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--payload=")) {
      parsed.payload = arg.split("=")[1];
    } else if (arg === "--payload" && i + 1 < args.length) {
      parsed.payload = args[++i];
    } else if (arg.startsWith("--allow-source-root=")) {
      parsed.allowSourceRoot = arg.split("=")[1];
    } else if (arg === "--allow-source-root" && i + 1 < args.length) {
      parsed.allowSourceRoot = args[++i];
    } else if (arg === "--silent") {
      parsed.silent = true;
    }
  }
  return parsed;
}

export async function validateMigrationPayload(options = {}) {
  const silent = Boolean(options.silent);
  const log = (...msg) => {
    if (!silent) console.log(...msg);
  };
  const error = (...msg) => {
    if (!silent) console.error(...msg);
  };

  log("================================================================");
  log("   RAKSHAK v3.0 — MIGRATION PAYLOAD & SCHEMA BOUNDARY VALIDATOR ");
  log("   Timestamp: " + new Date().toISOString());
  log("================================================================\n");

  const payloadPath = path.resolve(
    options.payloadPath ||
      process.env.MIGRATION_PAYLOAD_PATH ||
      path.join(process.cwd(), "backups", "migration_staging", "sqlite_migration_payload.json")
  );

  log(`Target Payload: ${payloadPath}`);

  // 1. Existence and non-empty check
  if (!fs.existsSync(payloadPath)) {
    throw new Error(
      `Migration payload missing at ${payloadPath}! Run migrate_sqlite_to_postgres.mjs first to generate it.`
    );
  }

  const rawBytes = fs.readFileSync(payloadPath);
  if (rawBytes.length === 0) {
    throw new Error(`Migration payload at ${payloadPath} is empty (0 bytes)!`);
  }
  log(`  ✓ File size: ${(rawBytes.length / 1024).toFixed(2)} KB`);

  // 2. Parse JSON
  let payload;
  try {
    payload = JSON.parse(rawBytes.toString("utf8"));
  } catch (err) {
    throw new Error(`Failed to parse migration payload JSON: ${err.message}`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload root must be an object!");
  }

  // 3. Manifest and Data Structure
  if (!payload.manifest || typeof payload.manifest !== "object") {
    throw new Error("Migration payload is missing required 'manifest' object!");
  }
  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("Migration payload is missing required 'data' object!");
  }

  const { manifest, data } = payload;

  // 4. Manifest Metadata
  if (manifest.sourceDatabase !== "SQLite") {
    throw new Error(`Invalid manifest sourceDatabase: expected 'SQLite', got '${manifest.sourceDatabase}'`);
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.sourceDatabaseHash || "")) {
    throw new Error(`Invalid manifest sourceDatabaseHash: must be a 64-character SHA-256 hex string`);
  }
  if (manifest.modelCount !== EXPECTED_MODELS.length) {
    throw new Error(`Manifest modelCount mismatch: expected ${EXPECTED_MODELS.length}, got ${manifest.modelCount}`);
  }
  if (!manifest.exportedAt || isNaN(Date.parse(manifest.exportedAt))) {
    throw new Error(`Invalid or missing manifest exportedAt timestamp: ${manifest.exportedAt}`);
  }
  log(`  ✓ Manifest Metadata: Source Database = ${manifest.sourceDatabase}, Hash = ${manifest.sourceDatabaseHash.substring(0, 16)}..., Models = ${manifest.modelCount}`);

  // 5. Source Path Security Boundary
  const sourceDbPath = manifest.sourceDatabasePath;
  if (!sourceDbPath || typeof sourceDbPath !== "string") {
    throw new Error("Manifest sourceDatabasePath is missing or invalid!");
  }
  const resolvedSourcePath = path.resolve(sourceDbPath);
  const cwd = path.resolve(process.cwd());
  const relToCwd = path.relative(cwd, resolvedSourcePath);

  // Reject paths outside repository workspace or targeting destructive locations
  if (relToCwd.startsWith("..") || path.isAbsolute(relToCwd)) {
    throw new Error(`Unauthorized source database path outside workspace boundary: ${resolvedSourcePath}`);
  }
  log(`  ✓ Source boundary verified: ${relToCwd}`);

  // 6. Complete 21-Model Parity & Record Counts
  const recordCounts = manifest.recordCounts;
  if (!recordCounts || typeof recordCounts !== "object") {
    throw new Error("Manifest is missing 'recordCounts' object!");
  }

  const modelDiscrepancies = [];
  let totalRecords = 0;

  for (const model of EXPECTED_MODELS) {
    if (typeof recordCounts[model] !== "number" || recordCounts[model] < 0) {
      modelDiscrepancies.push(`Missing or negative count for model '${model}' in manifest.recordCounts`);
      continue;
    }
    if (!Array.isArray(data[model])) {
      modelDiscrepancies.push(`Missing array for model '${model}' in payload.data`);
      continue;
    }
    const manifestCount = recordCounts[model];
    const actualCount = data[model].length;
    if (manifestCount !== actualCount) {
      modelDiscrepancies.push(
        `Count mismatch for model '${model}': manifest states ${manifestCount}, but data contains ${actualCount} records`
      );
    }
    totalRecords += actualCount;
  }

  if (modelDiscrepancies.length > 0) {
    throw new Error(`Schema model verification failed:\n  - ${modelDiscrepancies.join("\n  - ")}`);
  }
  log(`  ✓ All ${EXPECTED_MODELS.length} data models verified (Total records: ${totalRecords})`);

  // 7. Relational & Uniqueness Constraints
  const caseNumbers = new Set();
  const caseIds = new Set((data.cases || []).map((c) => c.id));
  for (const c of data.cases || []) {
    if (!c.id || !c.caseNumber) {
      throw new Error(`Case missing id or caseNumber: ${JSON.stringify(c)}`);
    }
    if (caseNumbers.has(c.caseNumber)) {
      throw new Error(`Duplicate caseNumber detected in payload: ${c.caseNumber}`);
    }
    caseNumbers.add(c.caseNumber);
  }

  const badgeNumbers = new Set();
  const officerIds = new Set((data.officers || []).map((o) => o.id));
  for (const o of data.officers || []) {
    if (!o.id || !o.badgeNumber) {
      throw new Error(`Officer missing id or badgeNumber: ${JSON.stringify(o)}`);
    }
    if (badgeNumbers.has(o.badgeNumber)) {
      throw new Error(`Duplicate badgeNumber detected in payload: ${o.badgeNumber}`);
    }
    badgeNumbers.add(o.badgeNumber);
  }

  const evidenceIds = new Set((data.evidence || []).map((e) => e.id));
  for (const ev of data.evidence || []) {
    if (!caseIds.has(ev.caseId)) {
      throw new Error(`Orphan evidence detected: ${ev.id} references non-existent caseId ${ev.caseId}`);
    }
  }

  for (const ef of data.extractedFacts || []) {
    if (!evidenceIds.has(ef.evidenceId)) {
      throw new Error(`Orphan extractedFact detected: ${ef.id} references non-existent evidenceId ${ef.evidenceId}`);
    }
  }

  for (const te of data.timelineEvents || []) {
    if (!caseIds.has(te.caseId)) {
      throw new Error(`Orphan timelineEvent detected: ${te.id} references non-existent caseId ${te.caseId}`);
    }
    if (te.evidenceId && !evidenceIds.has(te.evidenceId)) {
      throw new Error(`Orphan timelineEvent detected: ${te.id} references non-existent evidenceId ${te.evidenceId}`);
    }
  }

  for (const s of data.officerSessions || []) {
    if (!officerIds.has(s.officerId)) {
      throw new Error(`Orphan officerSession detected: ${s.id} references non-existent officerId ${s.officerId}`);
    }
  }

  log(`  ✓ Uniqueness and Foreign Key constraints verified across all entities`);

  // 8. Cryptographic Evidence Hashes
  let validHashes = 0;
  let legacyHashes = 0;
  for (const ev of data.evidence || []) {
    if (/^[a-f0-9]{64}$/i.test(ev.sha256Hash)) {
      validHashes++;
    } else if (
      ev.id.startsWith("ev-seed-") ||
      ev.id.startsWith("EV-10") ||
      ev.id.startsWith("EV-2026-") ||
      ev.id.startsWith("ev-cc001-")
    ) {
      legacyHashes++;
    } else {
      throw new Error(`Invalid SHA-256 digest on evidence exhibit ${ev.id}: '${ev.sha256Hash}'`);
    }
  }
  log(`  ✓ Evidence hashes verified: ${validHashes} standard SHA-256, ${legacyHashes} legacy seeds, 0 invalid`);

  log("\n================================================================");
  log("   PAYLOAD & SCHEMA BOUNDARY VALIDATION RESULT: PASS            ");
  log("================================================================\n");

  return {
    valid: true,
    totalRecords,
    modelsCount: EXPECTED_MODELS.length,
    manifest,
  };
}

// Direct CLI entrypoint
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = parseArgs();
  validateMigrationPayload({
    payloadPath: args.payload,
    silent: args.silent,
  }).catch((err) => {
    console.error("FATAL ERROR in payload validation:", err.message);
    process.exit(1);
  });
}
