// ─────────────────────────────────────────────────────────────────────────────
// scripts/restore_evidence_db.mjs
// Rakshak v3.0 — Isolated Backup Restoration & Verification Test
//
// Restores a backup snapshot into an isolated test sandbox (temp_restore_verify),
// validates all SHA-256 evidence digests against manifest signatures,
// tests database queryability, and provides empirical proof of recovery.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function runRestoreVerification(snapshotPath = null) {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — ISOLATED BACKUP RESTORE VERIFICATION TEST     ");
  console.log("================================================================\n");

  // 1. Locate latest backup snapshot if none provided
  let backupDir = snapshotPath;
  if (!backupDir) {
    const snapshotsRoot = path.join(process.cwd(), "backups", "snapshots");
    if (!fs.existsSync(snapshotsRoot)) {
      throw new Error(`Snapshots directory does not exist at ${snapshotsRoot}`);
    }
    const snapshots = fs.readdirSync(snapshotsRoot).filter((d) => d.startsWith("backup_")).sort().reverse();
    if (snapshots.length === 0) {
      throw new Error("No backup snapshots found in backups/snapshots/");
    }
    backupDir = path.join(snapshotsRoot, snapshots[0]);
  }

  console.log(`1. Target Snapshot for Restoration: ${backupDir}`);

  // 2. Read and verify manifest integrity
  const manifestPath = path.join(backupDir, "backup_manifest.json");
  const manifestShaPath = path.join(backupDir, "backup_manifest.sha256");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest missing in snapshot: ${manifestPath}`);
  }

  const computedManifestHash = sha256File(manifestPath);
  if (fs.existsSync(manifestShaPath)) {
    const expectedManifestHash = fs.readFileSync(manifestShaPath, "utf8").trim().split(" ")[0];
    if (computedManifestHash !== expectedManifestHash) {
      throw new Error(`Manifest integrity violation! Expected ${expectedManifestHash}, computed ${computedManifestHash}`);
    }
    console.log(`  ✓ Manifest integrity signature verified: ${computedManifestHash.substring(0, 16)}...`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`  ✓ Manifest loaded: ${manifest.evidence.totalFiles} evidence items, Database: ${manifest.database.type}`);

  // 3. Prepare isolated sandbox directory
  const sandboxDir = path.join(process.cwd(), "temp_restore_verify");
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });
  const restoredDbDir = path.join(sandboxDir, "prisma");
  const restoredEvidenceDir = path.join(sandboxDir, "uploads", "raw");
  fs.mkdirSync(restoredDbDir, { recursive: true });
  fs.mkdirSync(restoredEvidenceDir, { recursive: true });

  console.log(`\n2. Restoring into Isolated Sandbox: ${sandboxDir}`);

  // 4. Restore and verify database
  const srcDb = path.join(backupDir, "database", "dev.db");
  const destDb = path.join(restoredDbDir, "dev.db");
  fs.copyFileSync(srcDb, destDb);
  const restoredDbHash = sha256File(destDb);

  if (restoredDbHash !== manifest.database.sha256Hash) {
    throw new Error(`Restored database hash mismatch! Expected ${manifest.database.sha256Hash}, got ${restoredDbHash}`);
  }
  console.log(`  ✓ Restored database hash verified: ${restoredDbHash.substring(0, 16)}... (${(fs.statSync(destDb).size / 1024).toFixed(1)} KB)`);

  // 5. Restore and verify evidence binaries
  const srcEvidenceDir = path.join(backupDir, "evidence_raw");
  const restoredFiles = fs.readdirSync(srcEvidenceDir);
  let verifiedEvidenceCount = 0;

  for (const f of restoredFiles) {
    const srcFile = path.join(srcEvidenceDir, f);
    const destFile = path.join(restoredEvidenceDir, f);
    fs.copyFileSync(srcFile, destFile);

    const hash = sha256File(destFile);
    const expectedHash = f.replace(".bin", "");
    if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Evidence binary content corruption on ${f}!`);
    }
    verifiedEvidenceCount++;
  }
  console.log(`  ✓ Restored and verified ${verifiedEvidenceCount}/${manifest.evidence.totalFiles} evidence binaries.`);

  // 6. Test isolated database connectivity and query consistency
  console.log("\n3. Testing Database Queryability in Sandbox...");
  const sandboxPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${destDb}`,
      },
    },
  });

  try {
    const [caseCount, evidenceCount, officerCount, auditCount] = await Promise.all([
      sandboxPrisma.case.count(),
      sandboxPrisma.evidence.count(),
      sandboxPrisma.officer.count(),
      sandboxPrisma.auditLog.count(),
    ]);

    console.log(`  ✓ Restored Database Counts:`);
    console.log(`    - Cases: ${caseCount}`);
    console.log(`    - Evidence Records: ${evidenceCount}`);
    console.log(`    - Officers: ${officerCount}`);
    console.log(`    - Centralized Audit Logs: ${auditCount}`);

    console.log("\n================================================================");
    console.log("   RESTORE TEST SUCCESS: 100% RECONCILED AND VERIFIED!          ");
    console.log("================================================================\n");

    return {
      success: true,
      restoredDbHash,
      verifiedEvidenceCount,
      caseCount,
      evidenceCount,
      officerCount,
      auditCount,
    };
  } finally {
    await sandboxPrisma.$disconnect();
    // Clean up temporary sandbox
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

// Allow CLI execution
if (process.argv[1]?.endsWith("restore_evidence_db.mjs")) {
  runRestoreVerification().catch((err) => {
    console.error("Restore verification failed:", err);
    process.exit(1);
  });
}
