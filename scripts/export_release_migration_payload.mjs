// ─────────────────────────────────────────────────────────────────────────────
// scripts/export_release_migration_payload.mjs
// Rakshak v3.0 — Phase 35.1 Release Migration Payload Generator
// Exports all 24 current schema models from an isolated synthetic SQLite replica
// into backups/migration_staging/release_migration_payload.json.
// Accounts for:
// - AccessGrant (Phase 33)
// - CaseAssignmentHistory (Phase 35)
// - CaseStatusHistory (Phase 35)
// - All 21 prior investigative and operational models
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function exportReleaseMigrationPayload(options = {}) {
  const silent = Boolean(options.silent);
  const log = (...msg) => {
    if (!silent) console.log(...msg);
  };

  log("================================================================");
  log("   RAKSHAK v3.0 — RELEASE MIGRATION PAYLOAD GENERATOR (24 MODELS)");
  log("================================================================\n");

  const defaultStagingDir = path.join(process.cwd(), "backups", "migration_staging");
  const defaultIsolatedDb = path.join(defaultStagingDir, "isolated_rehearsal_sandbox.db");
  const defaultDevDb = path.join(process.cwd(), "prisma", "dev.db");

  const sourceDbPath = path.resolve(
    options.sourceDbPath ||
      (fs.existsSync(defaultIsolatedDb) ? defaultIsolatedDb : defaultDevDb)
  );

  const exportFilePath = path.resolve(
    options.outputPath ||
      path.join(defaultStagingDir, "release_migration_payload.json")
  );

  fs.mkdirSync(path.dirname(exportFilePath), { recursive: true });

  const sourceDbHash = sha256File(sourceDbPath);
  const sourceDbSize = fs.statSync(sourceDbPath).size;

  log(`Source Database:  ${sourceDbPath}`);
  log(`Source SHA-256:   ${sourceDbHash.substring(0, 16)}... (${(sourceDbSize / 1024 / 1024).toFixed(2)} MB)`);
  log(`Destination File: ${exportFilePath}\n`);

  log("1. Extracting all 24 current schema models from SQLite source...");

  const sqlitePrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${sourceDbPath}`,
      },
    },
  });

  try {
    const [
      departments,
      officers,
      officerSessions,
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
      transcriptions,
      chatTranslations,
      auditLogs,
      reports,
      scheduledReports,
      pilotFeedback,
      accessGrants,
      caseAssignmentHistories,
      caseStatusHistories,
    ] = await Promise.all([
      sqlitePrisma.department.findMany(),
      sqlitePrisma.officer.findMany(),
      sqlitePrisma.officerSession.findMany(),
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
      sqlitePrisma.transcription.findMany(),
      sqlitePrisma.chatTranslation.findMany(),
      sqlitePrisma.auditLog.findMany(),
      sqlitePrisma.generatedReport.findMany(),
      sqlitePrisma.scheduledReport.findMany(),
      sqlitePrisma.pilotFeedback.findMany(),
      sqlitePrisma.accessGrant.findMany(),
      sqlitePrisma.caseAssignmentHistory.findMany(),
      sqlitePrisma.caseStatusHistory.findMany(),
    ]);

    const recordCounts = {
      departments: departments.length,
      officers: officers.length,
      officerSessions: officerSessions.length,
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
      transcriptions: transcriptions.length,
      chatTranslations: chatTranslations.length,
      auditLogs: auditLogs.length,
      reports: reports.length,
      scheduledReports: scheduledReports.length,
      pilotFeedback: pilotFeedback.length,
      accessGrants: accessGrants.length,
      caseAssignmentHistories: caseAssignmentHistories.length,
      caseStatusHistories: caseStatusHistories.length,
    };

    const manifest = {
      exportedAt: new Date().toISOString(),
      releaseVersion: "3.5.1",
      sourceDatabase: "SQLite",
      sourceDatabasePath: sourceDbPath,
      sourceDatabaseHash: sourceDbHash,
      targetDatabaseSchema: "prisma/schema.postgresql.prisma",
      modelCount: 24,
      recordCounts,
      schemaClassification: {
        investigativeModels: 17,
        operationalAndMultimodalModels: 4,
        accessControlAndLifecycleModels: 3,
      },
    };

    const payload = {
      manifest,
      data: {
        departments,
        officers,
        officerSessions,
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
        transcriptions,
        chatTranslations,
        auditLogs,
        reports,
        scheduledReports,
        pilotFeedback,
        accessGrants,
        caseAssignmentHistories,
        caseStatusHistories,
      },
    };

    fs.writeFileSync(exportFilePath, JSON.stringify(payload, null, 2), "utf8");
    log(`  ✔ Successfully exported all 24 models (${Object.values(recordCounts).reduce((a, b) => a + b, 0)} records) to:`);
    log(`    ${exportFilePath}`);

    return {
      success: true,
      manifest,
      exportFilePath,
      totalRecords: Object.values(recordCounts).reduce((a, b) => a + b, 0),
    };
  } finally {
    await sqlitePrisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("export_release_migration_payload.mjs")) {
  exportReleaseMigrationPayload().catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
}
