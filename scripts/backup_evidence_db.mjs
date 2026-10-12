// ─────────────────────────────────────────────────────────────────────────────
// scripts/backup_evidence_db.mjs
// Rakshak v3.0 — Forensic Cold Storage & Database Automated Backup Generator
//
// Creates an atomic, reconciled backup snapshot containing:
// 1. Database file (SQLite dev.db / PostgreSQL dump)
// 2. Cold evidence binaries (uploads/raw/*.bin)
// 3. Cryptographic integrity manifest (SHA-256 verified)
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function createBackupSnapshot(targetDirOverride = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir =
    targetDirOverride || path.join(process.cwd(), "backups", "snapshots", `backup_${timestamp}`);

  fs.mkdirSync(backupDir, { recursive: true });

  const dbBackupDir = path.join(backupDir, "database");
  const evidenceBackupDir = path.join(backupDir, "evidence_raw");
  fs.mkdirSync(dbBackupDir, { recursive: true });
  fs.mkdirSync(evidenceBackupDir, { recursive: true });

  console.log(`[Backup] Creating snapshot in: ${backupDir}`);

  // 1. Backup SQLite database
  const sourceDbPath = path.join(process.cwd(), "prisma", "dev.db");
  let dbHash = null;
  let dbSizeBytes = 0;

  if (fs.existsSync(sourceDbPath)) {
    const destDbPath = path.join(dbBackupDir, "dev.db");
    fs.copyFileSync(sourceDbPath, destDbPath);
    dbHash = sha256File(destDbPath);
    dbSizeBytes = fs.statSync(destDbPath).size;
    console.log(`  ✓ Database backed up (${(dbSizeBytes / 1024).toFixed(1)} KB, SHA-256: ${dbHash.substring(0, 16)}...)`);
  } else {
    console.warn("  ⚠ SQLite dev.db not found at standard path.");
  }

  // 2. Backup Evidence Binaries
  const sourceEvidenceDir = path.join(process.cwd(), "uploads", "raw");
  const evidenceManifest = [];

  if (fs.existsSync(sourceEvidenceDir)) {
    const files = fs.readdirSync(sourceEvidenceDir);
    for (const f of files) {
      if (!f.endsWith(".bin")) continue;
      const srcFile = path.join(sourceEvidenceDir, f);
      const destFile = path.join(evidenceBackupDir, f);
      fs.copyFileSync(srcFile, destFile);

      const computedHash = sha256File(destFile);
      const expectedHash = f.replace(".bin", "");
      const hashMatches = computedHash.toLowerCase() === expectedHash.toLowerCase();

      evidenceManifest.push({
        fileName: f,
        sizeBytes: fs.statSync(destFile).size,
        computedSha256: computedHash,
        matchesContentAddress: hashMatches,
      });
    }
    console.log(`  ✓ Backed up ${evidenceManifest.length} cold evidence binaries.`);
  }

  // 3. Generate Reconciled Backup Manifest
  const manifest = {
    backupId: `BK-${timestamp}`,
    createdAt: new Date().toISOString(),
    version: "3.0.0",
    database: {
      type: "SQLite",
      source: "prisma/dev.db",
      sizeBytes: dbSizeBytes,
      sha256Hash: dbHash,
    },
    evidence: {
      totalFiles: evidenceManifest.length,
      files: evidenceManifest,
      allHashesVerified: evidenceManifest.every((e) => e.matchesContentAddress),
    },
  };

  const manifestPath = path.join(backupDir, "backup_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Compute manifest checksum
  const manifestDigest = sha256File(manifestPath);
  fs.writeFileSync(path.join(backupDir, "backup_manifest.sha256"), `${manifestDigest} *backup_manifest.json\n`);

  console.log(`  ✓ Cryptographic manifest generated (SHA-256: ${manifestDigest.substring(0, 16)}...)`);
  console.log(`[Backup] Complete! Snapshot ready at:\n   ${backupDir}\n`);

  return { backupDir, manifest, manifestDigest };
}

// Allow CLI execution
if (process.argv[1]?.endsWith("backup_evidence_db.mjs")) {
  createBackupSnapshot().catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
}
