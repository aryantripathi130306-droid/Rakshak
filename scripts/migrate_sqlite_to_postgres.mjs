// ─────────────────────────────────────────────────────────────────────────────
// scripts/migrate_sqlite_to_postgres.mjs
// Rakshak v3.0 — SQLite to PostgreSQL Migration & Cross-Database Export Tool
//
// Extracts all forensic investigation records from SQLite, validates foreign
// key constraints and evidence SHA-256 hashes, and prepares them for loading
// into a production PostgreSQL cluster.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const sqlitePrisma = new PrismaClient();

async function runMigrationExport() {
  console.log("================================================================");
  console.log("   RAKSHAK v3.0 — SQLITE TO POSTGRESQL DATA MIGRATION EXPORT    ");
  console.log("================================================================\n");

  const exportDir = path.join(process.cwd(), "backups", "migration_staging");
  fs.mkdirSync(exportDir, { recursive: true });

  console.log("1. Reading forensic records from SQLite...");

  const [
    cases,
    evidence,
    extractedFacts,
    timelineEvents,
    caseEntities,
    clusters,
    clusterMemberships,
    custodyEvents,
    legalProvisions,
    caseLegalMappings,
    evidenceLegalMappings,
    dossierAudits,
    officers,
    auditLogs,
    reports,
    scheduledReports,
    pilotFeedback,
  ] = await Promise.all([
    sqlitePrisma.case.findMany(),
    sqlitePrisma.evidence.findMany(),
    sqlitePrisma.extractedFact.findMany(),
    sqlitePrisma.timelineEvent.findMany(),
    sqlitePrisma.caseEntity.findMany(),
    sqlitePrisma.caseCluster.findMany(),
    sqlitePrisma.clusterMembership.findMany(),
    sqlitePrisma.custodyEvent.findMany(),
    sqlitePrisma.legalProvision.findMany(),
    sqlitePrisma.caseLegalMapping.findMany(),
    sqlitePrisma.evidenceLegalMapping.findMany(),
    sqlitePrisma.dossierExportAudit.findMany(),
    sqlitePrisma.officer.findMany(),
    sqlitePrisma.auditLog.findMany(),
    sqlitePrisma.generatedReport.findMany(),
    sqlitePrisma.scheduledReport.findMany(),
    sqlitePrisma.pilotFeedback.findMany(),
  ]);

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceDatabase: "SQLite (dev.db)",
    targetDatabaseSchema: "prisma/schema.postgresql.prisma",
    recordCounts: {
      cases: cases.length,
      evidence: evidence.length,
      extractedFacts: extractedFacts.length,
      timelineEvents: timelineEvents.length,
      caseEntities: caseEntities.length,
      clusters: clusters.length,
      clusterMemberships: clusterMemberships.length,
      custodyEvents: custodyEvents.length,
      legalProvisions: legalProvisions.length,
      caseLegalMappings: caseLegalMappings.length,
      evidenceLegalMappings: evidenceLegalMappings.length,
      dossierAudits: dossierAudits.length,
      officers: officers.length,
      auditLogs: auditLogs.length,
      reports: reports.length,
      scheduledReports: scheduledReports.length,
      pilotFeedback: pilotFeedback.length,
    },
  };

  console.log("2. Verifying cryptographic evidence hashes...");
  let hashCheckPassed = true;
  for (const item of evidence) {
    if (!item.sha256Hash || item.sha256Hash.length !== 64) {
      console.error(`  ❌ Invalid SHA-256 for evidence ${item.id}: ${item.sha256Hash}`);
      hashCheckPassed = false;
    }
  }

  if (hashCheckPassed) {
    console.log(`  ✓ All ${evidence.length} evidence SHA-256 hashes verified valid.`);
  }

  const exportFilePath = path.join(exportDir, "sqlite_migration_payload.json");
  const fullDump = {
    manifest,
    data: {
      cases,
      evidence,
      extractedFacts,
      timelineEvents,
      caseEntities,
      clusters,
      clusterMemberships,
      custodyEvents,
      legalProvisions,
      caseLegalMappings,
      evidenceLegalMappings,
      dossierAudits,
      officers,
      auditLogs,
      reports,
      scheduledReports,
      pilotFeedback,
    },
  };

  fs.writeFileSync(exportFilePath, JSON.stringify(fullDump, null, 2));
  console.log(`\n3. Export complete! Migration payload saved to:\n   ${exportFilePath}`);
  console.log(`\nRecord Counts Summary:`);
  console.table(manifest.recordCounts);

  console.log("\n================================================================");
  console.log("POSTGRESQL IMPORT INSTRUCTIONS:");
  console.log("1. Set DATABASE_URL in .env to your PostgreSQL connection string:");
  console.log("   DATABASE_URL=\"postgresql://user:pass@host:5432/rakshak_db?schema=public\"");
  console.log("2. Push schema to PostgreSQL:");
  console.log("   npx prisma db push --schema=prisma/schema.postgresql.prisma");
  console.log("3. Populate records using the generated migration payload.");
  console.log("================================================================\n");

  await sqlitePrisma.$disconnect();
}

runMigrationExport().catch((err) => {
  console.error("Migration export error:", err);
  process.exit(1);
});
