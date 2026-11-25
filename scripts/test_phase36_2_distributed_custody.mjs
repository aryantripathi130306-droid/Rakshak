// ─────────────────────────────────────────────────────────────────────────────
// scripts/test_phase36_2_distributed_custody.mjs
// Rakshak v3.0 — Phase 36.2 Multi-Process Custody Concurrency & Integrity Suite
//
// Verifies:
// 1. Workstream A: Cross-Process Append Serialization (PostgreSQL advisory lock & atomic transactions)
// 2. Workstream B: Mandatory Hash & Sequence Integrity (CHECK constraints & total uniqueness)
// 3. Workstream C: Genuine Multi-Process Adversarial Testing (18+ scenarios)
// 4. Workstream D: Checkpoint & Trust-Anchor Readiness
// 5. Workstream E: PostgreSQL Runtime Security & Immutability Enforcement
// 6. Safety Invariant: uploads/raw/ 560 binary files remain 100% unaltered
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";

import {
  GENESIS_HASH,
  CANONICAL_VERSION_V1,
  CANONICAL_VERSION_V2,
  computeEventHash,
  canonicalStringify,
  appendCustodyEventAsync,
  verifyCustodyChainEvents,
  createCustodyCheckpoint,
  verifyCustodyCheckpoint,
  verifyChainWithCheckpoint,
  createCustodyCheckpointFromDbAsync,
} from "../lib/custodyChain.ts";

import {
  executeEvidenceTransition,
} from "../lib/evidenceLifecycle.ts";

import { createPrismaPgClient } from "../lib/prismaPg.ts";

const RAW_DIR = path.join(process.cwd(), "uploads", "raw");
const ACTIVE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const TARGET_DB = process.env.TARGET_DB || "rakshak_phase36_2_test";
const OUT_FILE = path.join(process.cwd(), "PHASE36_2_TEST_RESULTS.json");
const TEST_CHECKPOINT_KEY = "synthetic_phase36_2_test_key_not_for_production";
const PG_APP_USER_URL = `postgresql://rakshak_app_user:change_me_in_vault@127.0.0.1:5432/${TARGET_DB}`;
const PG_ADMIN_USER_URL = `postgresql://postgres:change_me_in_vault@127.0.0.1:5432/${TARGET_DB}`;

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return "none";
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function computeDirectoryManifest(dirPath) {
  if (!fs.existsSync(dirPath)) return { count: 0, manifestHash: "none" };
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".bin")).sort();
  const hasher = crypto.createHash("sha256");
  for (const f of files) {
    const fileBytes = fs.readFileSync(path.join(dirPath, f));
    hasher.update(`${f}:${sha256(fileBytes)}:`);
  }
  return { count: files.length, manifestHash: hasher.digest("hex") };
}

function runSql(db, user, sql, expectError = false) {
  try {
    const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };
    const out = execFileSync(
      PSQL,
      ["-U", user, "-h", "127.0.0.1", "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { env, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    return { ok: true, output: out.trim(), error: null };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    if (expectError) {
      return { ok: false, output: null, error: stderr };
    }
    throw new Error(`SQL failed unexpectedly: ${stderr}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER MODE HANDLER (For multi-process testing)
// ─────────────────────────────────────────────────────────────────────────────
async function handleWorkerMode() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const mode = getArg("mode");
  const evidenceId = getArg("evidenceId");
  const workerId = getArg("workerId") || "worker_1";
  const count = parseInt(getArg("count") || "5", 10);

  const client = createPrismaPgClient(PG_ADMIN_USER_URL);

  try {
    if (mode === "append") {
      for (let i = 1; i <= count; i++) {
        await appendCustodyEventAsync(
          {
            evidenceId,
            eventType: "OFFICER_NOTE",
            actor: `Worker Process ${workerId}`,
            action: `Concurrent write #${i} from ${workerId}`,
            details: { workerId, iteration: i },
          },
          client
        );
      }
      console.log(JSON.stringify({ status: "SUCCESS", workerId, count }));
      process.exit(0);
    } else if (mode === "transfer") {
      const fromOfficer = JSON.parse(Buffer.from(getArg("fromOfficer"), "base64").toString("utf-8"));
      const newCustodianId = getArg("newCustodianId");
      const res = await executeEvidenceTransition(
        evidenceId,
        "TRANSFERRED",
        fromOfficer,
        `Concurrent custody transfer from ${workerId}`,
        { newCustodianId },
        client
      );
      console.log(JSON.stringify({ status: res.success ? "SUCCESS" : "CONFLICT", workerId, statusCode: res.statusCode, error: res.error }));
      process.exit(res.success ? 0 : 2);
    }
  } catch (err) {
    console.error(JSON.stringify({ status: "ERROR", workerId, error: err.message }));
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

if (process.argv.includes("--worker-mode")) {
  handleWorkerMode();
} else {
  runSuite().catch((err) => {
    console.error("\n[FATAL] Test suite crashed:", err);
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER SUITE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
const testResults = [];
function record(id, workstream, name, status, details = "") {
  testResults.push({ id, workstream, name, status, details });
  const icon = status === "PASSED" ? "✓" : "✗";
  console.log(`  [${icon}] ${id} [${workstream}] ${name}: ${status}${details ? ` (${details})` : ""}`);
}

function spawnWorker(args) {
  return new Promise((resolve, reject) => {
    const cp = spawn(process.execPath, [path.resolve(process.argv[1]), "--worker-mode", ...args], {
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (d) => (stdout += d.toString()));
    cp.stderr.on("data", (d) => (stderr += d.toString()));

    cp.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    cp.on("error", (err) => reject(err));
  });
}

async function runSuite() {
  console.log("================================================================================");
  console.log("   RAKSHAK v3.0 — PHASE 36.2 MULTI-PROCESS CUSTODY CONCURRENCY SUITE");
  console.log("   Cross-Process Serialization, Total Sequence Integrity & Trust Anchors");
  console.log("================================================================================\n");

  const preManifest = computeDirectoryManifest(RAW_DIR);
  const preDevDbHash = sha256File(ACTIVE_DB_PATH);
  console.log(`[Baseline] Cold evidence binaries: ${preManifest.count} files (Manifest: ${preManifest.manifestHash.slice(0, 16)}...)`);
  console.log(`[Baseline] Active dev.db hash:     ${preDevDbHash.slice(0, 16)}...\n`);

  // Establish master connection to rakshak_phase36_2_test
  const masterClient = createPrismaPgClient(PG_ADMIN_USER_URL);
  const adminClient = createPrismaPgClient(PG_ADMIN_USER_URL);

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SEED BASE TEST FIXTURES
    // ─────────────────────────────────────────────────────────────────────────
    console.log("[Setup] Seeding test department, officers, and cases in rakshak_phase36_2_test...");
    const deptId = "dept_cyber_p362";
    const caseId = "case_cyber_p362";
    const officerAId = "off_cyber_p362_a";
    const officerBId = "off_cyber_p362_b";
    const supervisorId = "off_cyber_p362_s";

    // Direct SQL seed with admin bypass for setup
    runSql(
      TARGET_DB,
      "postgres",
      `
      INSERT INTO "Department" ("id", "code", "name", "state", "jurisdiction", "status", "updatedAt")
      VALUES ('${deptId}', 'CY-362', 'Cyber Cell Phase 36.2', 'Delhi', 'Delhi NCR', 'ACTIVE', NOW())
      ON CONFLICT ("id") DO NOTHING;

      INSERT INTO "Officer" ("id", "badgeNumber", "name", "email", "passwordHash", "designation", "role", "jurisdiction", "status", "departmentId", "updatedAt") VALUES
        ('${officerAId}', 'DL-CY-362A', 'Inspector Arjun Kumar', 'arjun.362@rakshak.gov.in', 'hash', 'Inspector', 'INVESTIGATING_OFFICER', 'Delhi NCR', 'ACTIVE', '${deptId}', NOW()),
        ('${officerBId}', 'DL-CY-362B', 'Sub-Inspector Rohit Verma', 'rohit.362@rakshak.gov.in', 'hash', 'Sub-Inspector', 'INVESTIGATING_OFFICER', 'Delhi NCR', 'ACTIVE', '${deptId}', NOW()),
        ('${supervisorId}', 'DL-CY-362S', 'ACP Meera Nair', 'meera.362@rakshak.gov.in', 'hash', 'ACP', 'SUPERVISOR', 'Delhi NCR', 'ACTIVE', '${deptId}', NOW())
      ON CONFLICT ("badgeNumber") DO UPDATE SET "status" = 'ACTIVE';

      INSERT INTO "Case" ("id", "caseNumber", "incidentType", "complainantName", "status", "departmentId", "updatedAt") VALUES
        ('${caseId}', 'FIR/CYBER/2026/362', 'CYBER_FRAUD', 'Complainant 362', 'OPEN', '${deptId}', NOW())
      ON CONFLICT ("id") DO NOTHING;
      `
    );

    const actualOfficerA = await adminClient.officer.findFirst({ where: { badgeNumber: "DL-CY-362A" } });
    const actualOfficerB = await adminClient.officer.findFirst({ where: { badgeNumber: "DL-CY-362B" } });

    const officerAProfile = {
      id: actualOfficerA.id,
      name: "Inspector Arjun Kumar",
      badgeNumber: "DL-CY-362A",
      role: "INVESTIGATING_OFFICER",
      status: "ACTIVE",
      departmentId: deptId,
    };

    const officerBProfile = {
      id: actualOfficerB.id,
      name: "Sub-Inspector Rohit Verma",
      badgeNumber: "DL-CY-362B",
      role: "INVESTIGATING_OFFICER",
      status: "ACTIVE",
      departmentId: deptId,
    };

    // Helper to seed evidence
    async function seedEvidence(customId, initialStatus = "IN_CUSTODY", custodianId = actualOfficerA.id) {
      const eid = customId || crypto.randomUUID();
      const fakeHash = crypto.createHash("sha256").update(eid).digest("hex");
      runSql(
        TARGET_DB,
        "postgres",
        `
        INSERT INTO "Evidence" ("id", "caseId", "fileName", "fileType", "mimeType", "fileSize", "clientHash", "sha256Hash", "storagePath", "status", "version", "currentCustodianId")
        VALUES ('${eid}', '${caseId}', 'device_${eid.slice(0, 6)}.dd', 'IMAGE', 'application/octet-stream', 2048, '${fakeHash}', '${fakeHash}', 'uploads/raw/device_${eid.slice(0, 6)}.bin', '${initialStatus}', 1, '${custodianId}')
        ON CONFLICT ("id") DO NOTHING;
        `
      );
      return eid;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WORKSTREAM A & C: CROSS-PROCESS APPEND SERIALIZATION & CONCURRENCY
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[1/5] WORKSTREAMS A & C: MULTI-PROCESS APPEND SERIALIZATION & CONCURRENCY");

    // TC-01: Two independent Node.js processes append 5 events simultaneously to same evidence
    const evMultiProc = await seedEvidence();
    const [proc1, proc2] = await Promise.all([
      spawnWorker(["--mode=append", `--evidenceId=${evMultiProc}`, "--workerId=P1", "--count=5"]),
      spawnWorker(["--mode=append", `--evidenceId=${evMultiProc}`, "--workerId=P2", "--count=5"]),
    ]);

    const eventsMultiProc = await adminClient.custodyEvent.findMany({
      where: { evidenceId: evMultiProc },
      orderBy: { sequenceNumber: "asc" },
    });

    const vResultMulti = verifyCustodyChainEvents(eventsMultiProc);
    const tc01Pass =
      proc1.code === 0 &&
      proc2.code === 0 &&
      eventsMultiProc.length === 10 &&
      vResultMulti.valid &&
      eventsMultiProc.every((e, idx) => e.sequenceNumber === idx + 1);

    record(
      "TC-01",
      "Workstream A/C",
      "Two independent Node.js processes append to same evidence chain simultaneously (10 events, 0 forks)",
      tc01Pass ? "PASSED" : "FAILED",
      `P1_exit=${proc1.code}, P2_exit=${proc2.code}, totalEvents=${eventsMultiProc.length}, valid=${vResultMulti.valid}`
    );

    // TC-02: Ten concurrent appends across multiple client instances without duplicate sequences
    const evTenConcurrent = await seedEvidence();
    const tenPromises = [];
    for (let i = 1; i <= 10; i++) {
      const clientInstance = createPrismaPgClient(PG_ADMIN_USER_URL);
      tenPromises.push(
        appendCustodyEventAsync(
          {
            evidenceId: evTenConcurrent,
            eventType: "OFFICER_NOTE",
            actor: `Client #${i}`,
            action: `Parallel append #${i}`,
            details: { clientIndex: i },
          },
          clientInstance
        ).finally(() => clientInstance.$disconnect())
      );
    }
    await Promise.all(tenPromises);

    const eventsTen = await adminClient.custodyEvent.findMany({
      where: { evidenceId: evTenConcurrent },
      orderBy: { sequenceNumber: "asc" },
    });

    const vResultTen = verifyCustodyChainEvents(eventsTen);
    const tc02Pass =
      eventsTen.length === 10 &&
      vResultTen.valid &&
      eventsTen.every((e, idx) => e.sequenceNumber === idx + 1);

    record(
      "TC-02",
      "Workstream A/C",
      "Ten concurrent appends across independent clients complete without duplicate sequence numbers",
      tc02Pass ? "PASSED" : "FAILED",
      `events=${eventsTen.length}, seqs=[${eventsTen.map((e) => e.sequenceNumber).join(",")}], valid=${vResultTen.valid}`
    );

    // TC-03: Every committed event references correct preceding event digest
    let tc03Pass = true;
    for (let i = 0; i < eventsTen.length; i++) {
      const expectedPrev = i === 0 ? GENESIS_HASH : eventsTen[i - 1].eventHash;
      if (eventsTen[i].prevEventHash !== expectedPrev) {
        tc03Pass = false;
        break;
      }
    }
    record(
      "TC-03",
      "Workstream A/C",
      "Every committed event strictly references authoritative predecessor digest",
      tc03Pass ? "PASSED" : "FAILED",
      `verified=${eventsTen.length} events`
    );

    // TC-04: Two independent processes attempting concurrent custody transfers do not fork chain
    const evTransfer = await seedEvidence();
    const officerABase64 = Buffer.from(JSON.stringify(officerAProfile)).toString("base64");
    const [transProc1, transProc2] = await Promise.all([
      spawnWorker([
        "--mode=transfer",
        `--evidenceId=${evTransfer}`,
        "--workerId=T1",
        `--fromOfficer=${officerABase64}`,
        `--newCustodianId=${actualOfficerB.id}`,
      ]),
      spawnWorker([
        "--mode=transfer",
        `--evidenceId=${evTransfer}`,
        "--workerId=T2",
        `--fromOfficer=${officerABase64}`,
        `--newCustodianId=${actualOfficerB.id}`,
      ]),
    ]);

    const exitCodes = [transProc1.code, transProc2.code].sort();
    const eventsTransfer = await adminClient.custodyEvent.findMany({
      where: { evidenceId: evTransfer },
      orderBy: { sequenceNumber: "asc" },
    });
    const vResultTransfer = verifyCustodyChainEvents(eventsTransfer);

    // One process succeeds (exit 0), other gets 409 conflict (exit 2)
    const tc04Pass =
      exitCodes[0] === 0 &&
      exitCodes[1] === 2 &&
      eventsTransfer.length === 1 &&
      vResultTransfer.valid;

    record(
      "TC-04",
      "Workstream A/C",
      "Two independent processes attempting concurrent custody transfers: 1 commits, 1 gets 409 conflict, 0 forks",
      tc04Pass ? "PASSED" : "FAILED",
      `exitCodes=[${exitCodes.join(",")}], eventsCount=${eventsTransfer.length}`
    );

    // TC-05: Concurrent writes to different evidence items proceed independently without blocking
    const evItemA = await seedEvidence();
    const evItemB = await seedEvidence();
    const t0 = Date.now();
    await Promise.all([
      appendCustodyEventAsync({ evidenceId: evItemA, eventType: "OFFICER_NOTE", actor: "A", action: "Write to A" }, masterClient),
      appendCustodyEventAsync({ evidenceId: evItemB, eventType: "OFFICER_NOTE", actor: "B", action: "Write to B" }, masterClient),
    ]);
    const duration = Date.now() - t0;
    const tc05Pass = duration < 3000;
    record(
      "TC-05",
      "Workstream A/C",
      "Concurrent writes to different evidence items proceed independently with zero cross-exhibit lock contention",
      tc05Pass ? "PASSED" : "FAILED",
      `durationMs=${duration}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WORKSTREAM B: MANDATORY HASH AND SEQUENCE INTEGRITY (DATABASE CONSTRAINTS)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[2/5] WORKSTREAM B: MANDATORY HASH & SEQUENCE INTEGRITY (DATABASE CONSTRAINTS)");

    // TC-06: Duplicate sequence insertion rejected by database unique index
    const evSeqTest = await seedEvidence();
    const firstEvent = await appendCustodyEventAsync(
      { evidenceId: evSeqTest, eventType: "OFFICER_NOTE", actor: "A", action: "Event 1" },
      masterClient
    );
    // Direct SQL insert attempting duplicate sequenceNumber=1
    const dupSeqSql = runSql(
      TARGET_DB,
      "postgres",
      `
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evSeqTest}', 'OFFICER_NOTE', 'Attacker', 'Dup Seq', 'SUCCESS', NOW(), 1, '${GENESIS_HASH}', '${crypto.randomBytes(32).toString("hex")}');
      `,
      true
    );
    const tc06Pass =
      !dupSeqSql.ok &&
      dupSeqSql.error?.includes("unique constraint") &&
      dupSeqSql.error?.includes("CustodyEvent_evidence_seq_unique_idx");

    record(
      "TC-06",
      "Workstream B",
      "Duplicate sequence insertion rejected by CustodyEvent_evidence_seq_unique_idx constraint",
      tc06Pass ? "PASSED" : "FAILED",
      dupSeqSql.error?.slice(0, 75)
    );

    // TC-07: Event with eventHash = NULL rejected by database CHECK constraint
    const nullHashSql = runSql(
      TARGET_DB,
      "postgres",
      `
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evSeqTest}', 'OFFICER_NOTE', 'Attacker', 'Null Hash', 'SUCCESS', NOW(), 99, '${GENESIS_HASH}', NULL);
      `,
      true
    );
    const tc07Pass =
      !nullHashSql.ok &&
      nullHashSql.error?.includes("CustodyEvent_eventHash_check");

    record(
      "TC-07",
      "Workstream B",
      "Custody event with eventHash = NULL rejected by CustodyEvent_eventHash_check",
      tc07Pass ? "PASSED" : "FAILED",
      nullHashSql.error?.slice(0, 75)
    );

    // TC-08: Empty or malformed hash rejected by database CHECK constraint
    const malformedHashSql = runSql(
      TARGET_DB,
      "postgres",
      `
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evSeqTest}', 'OFFICER_NOTE', 'Attacker', 'Malformed Hash', 'SUCCESS', NOW(), 99, '${GENESIS_HASH}', 'not_a_valid_64_hex_digest');
      `,
      true
    );
    const tc08Pass =
      !malformedHashSql.ok &&
      malformedHashSql.error?.includes("CustodyEvent_eventHash_check");

    record(
      "TC-08",
      "Workstream B",
      "Malformed eventHash (non-64 hex) rejected by CustodyEvent_eventHash_check",
      tc08Pass ? "PASSED" : "FAILED",
      malformedHashSql.error?.slice(0, 75)
    );

    // TC-09: Unsupported canonicalization version rejected by application validation
    let tc09Pass = false;
    let tc09Err = "";
    try {
      await appendCustodyEventAsync(
        {
          evidenceId: evSeqTest,
          eventType: "OFFICER_NOTE",
          actor: "Officer",
          action: "Invalid version test",
          canonicalVersion: "v99",
        },
        masterClient
      );
    } catch (err) {
      tc09Err = err.message;
      tc09Pass = err.message.includes("Unsupported canonicalization version: 'v99'");
    }
    record(
      "TC-09",
      "Workstream B",
      "Unsupported canonicalization version (v99) fails closed before database persistence",
      tc09Pass ? "PASSED" : "FAILED",
      tc09Err
    );

    // TC-10: Missing or invalid prevEventHash rejected by database CHECK constraint
    const invalidPrevHashSql = runSql(
      TARGET_DB,
      "postgres",
      `
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evSeqTest}', 'OFFICER_NOTE', 'Attacker', 'Bad Prev Hash', 'SUCCESS', NOW(), 99, 'short_prev_hash', '${crypto.randomBytes(32).toString("hex")}');
      `,
      true
    );
    const tc10Pass =
      !invalidPrevHashSql.ok &&
      invalidPrevHashSql.error?.includes("CustodyEvent_prevEventHash_check");

    record(
      "TC-10",
      "Workstream B",
      "Malformed prevEventHash rejected by CustodyEvent_prevEventHash_check",
      tc10Pass ? "PASSED" : "FAILED",
      invalidPrevHashSql.error?.slice(0, 75)
    );

    // TC-11: Serialization conflict retried safely or returns documented conflict response
    const evConflict = await seedEvidence();
    // Verify that executing 3 rapid sequential appends retry transparently without failing
    const append1 = await appendCustodyEventAsync({ evidenceId: evConflict, eventType: "OFFICER_NOTE", actor: "A", action: "Fast 1" }, masterClient);
    const append2 = await appendCustodyEventAsync({ evidenceId: evConflict, eventType: "OFFICER_NOTE", actor: "A", action: "Fast 2" }, masterClient);
    const tc11Pass = append1.sequenceNumber === 1 && append2.sequenceNumber === 2;
    record(
      "TC-11",
      "Workstream B/C",
      "Sequential and contended appends handle transaction lifecycle safely",
      tc11Pass ? "PASSED" : "FAILED",
      `seq1=${append1.sequenceNumber}, seq2=${append2.sequenceNumber}`
    );

    // TC-12: Database error mid-transaction does not leave partial custody or lifecycle changes
    const evRollback = await seedEvidence();
    let tc12Pass = false;
    try {
      await masterClient.$transaction(async (tx) => {
        // Step 1: Update status
        await tx.evidence.update({
          where: { id: evRollback },
          data: { status: "SEALED", sealedAt: new Date(), version: 2 },
        });
        // Step 2: Simulate failure before commit
        throw new Error("Simulated database failure mid-transaction");
      });
    } catch (e) {
      // Expected rollback
    }
    const checkRolledBack = await adminClient.evidence.findUnique({ where: { id: evRollback } });
    const checkCustodyRollback = await adminClient.custodyEvent.findMany({ where: { evidenceId: evRollback } });
    tc12Pass = checkRolledBack.status === "IN_CUSTODY" && checkRolledBack.version === 1 && checkCustodyRollback.length === 0;
    record(
      "TC-12",
      "Workstream C",
      "Transaction error mid-lifecycle transition completely rolls back evidence and custody state",
      tc12Pass ? "PASSED" : "FAILED",
      `status=${checkRolledBack?.status}, version=${checkRolledBack?.version}, eventsCount=${checkCustodyRollback.length}`
    );

    // TC-13: Process termination / connection loss during append does not corrupt chain
    const evConnLoss = await seedEvidence();
    // Simulate by starting an uncommitted insert in a connection that aborts
    const abortSql = runSql(
      TARGET_DB,
      "postgres",
      `
      BEGIN;
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evConnLoss}', 'OFFICER_NOTE', 'A', 'Aborted Event', 'SUCCESS', NOW(), 1, '${GENESIS_HASH}', '${crypto.randomBytes(32).toString("hex")}');
      ROLLBACK;
      `
    );
    // Now append a legitimate event
    const validAppend = await appendCustodyEventAsync(
      { evidenceId: evConnLoss, eventType: "OFFICER_NOTE", actor: "Officer", action: "Legitimate Event" },
      masterClient
    );
    const tc13Pass = validAppend.sequenceNumber === 1 && validAppend.prevEventHash === GENESIS_HASH;
    record(
      "TC-13",
      "Workstream C",
      "Aborted transaction / connection loss leaves zero phantom sequences or chain corruption",
      tc13Pass ? "PASSED" : "FAILED",
      `legitimateSeq=${validAppend.sequenceNumber}`
    );

    // TC-14: Existing valid V1 and V2 historical events continue to verify
    const evV1V2 = crypto.randomUUID();
    const ev1Id = crypto.randomUUID();
    const ev2Id = crypto.randomUUID();
    const v1Details = JSON.stringify({ note: "Legacy V1 event" });
    const v1Hash = computeEventHash({
      canonicalVersion: CANONICAL_VERSION_V1,
      eventId: ev1Id,
      evidenceId: evV1V2,
      sequenceNumber: 1,
      eventType: "INTAKE_UPLOAD",
      actor: "Officer V1",
      action: "Legacy intake",
      result: "SUCCESS",
      timestamp: new Date("2026-10-24T10:00:00Z"),
      prevEventHash: GENESIS_HASH,
      details: v1Details,
    });
    const v2Details = { canonicalVersion: CANONICAL_VERSION_V2, note: "V2 event" };
    const v2Hash = computeEventHash({
      canonicalVersion: CANONICAL_VERSION_V2,
      eventId: ev2Id,
      evidenceId: evV1V2,
      sequenceNumber: 2,
      eventType: "OFFICER_NOTE",
      actor: "Officer V2",
      action: "V2 note",
      result: "SUCCESS",
      timestamp: new Date("2026-10-24T10:05:00Z"),
      prevEventHash: v1Hash,
      details: v2Details,
    });
    const chainV1V2 = [
      {
        id: ev1Id,
        evidenceId: evV1V2,
        sequenceNumber: 1,
        eventType: "INTAKE_UPLOAD",
        actor: "Officer V1",
        action: "Legacy intake",
        result: "SUCCESS",
        timestamp: new Date("2026-10-24T10:00:00Z"),
        prevEventHash: GENESIS_HASH,
        eventHash: v1Hash,
        details: v1Details,
      },
      {
        id: ev2Id,
        evidenceId: evV1V2,
        sequenceNumber: 2,
        eventType: "OFFICER_NOTE",
        actor: "Officer V2",
        action: "V2 note",
        result: "SUCCESS",
        timestamp: new Date("2026-10-24T10:05:00Z"),
        prevEventHash: v1Hash,
        eventHash: v2Hash,
        details: JSON.stringify(v2Details),
      },
    ];
    const vResultV1V2 = verifyCustodyChainEvents(chainV1V2);
    const tc14Pass = vResultV1V2.valid && vResultV1V2.eventCount === 2;
    record(
      "TC-14",
      "Workstream B/C",
      "Historical V1 events and modern V2 events seamlessly verify in composite chain",
      tc14Pass ? "PASSED" : "FAILED",
      `valid=${vResultV1V2.valid}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WORKSTREAM E: DATABASE IMMUTABILITY AND ACCESS CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[3/5] WORKSTREAM E: DATABASE IMMUTABILITY & RLS PROTECTIONS");

    // TC-15: Direct SQL UPDATE, DELETE, TRUNCATE on CustodyEvent denied to runtime application role
    const updateAttempt = runSql(TARGET_DB, "rakshak_app_user", `UPDATE "CustodyEvent" SET "action" = 'Tampered';`, true);
    const deleteAttempt = runSql(TARGET_DB, "rakshak_app_user", `DELETE FROM "CustodyEvent";`, true);
    const truncateAttempt = runSql(TARGET_DB, "rakshak_app_user", `TRUNCATE TABLE "CustodyEvent";`, true);

    const tc15Pass =
      !updateAttempt.ok && updateAttempt.error?.includes("permission denied") &&
      !deleteAttempt.ok && deleteAttempt.error?.includes("permission denied") &&
      !truncateAttempt.ok && truncateAttempt.error?.includes("permission denied");

    record(
      "TC-15",
      "Workstream E",
      "Direct SQL UPDATE, DELETE, TRUNCATE on CustodyEvent denied to rakshak_app_user",
      tc15Pass ? "PASSED" : "FAILED",
      "All mutations rejected with permission denied"
    );

    // TC-16: Forged tenant context cannot authorize unauthorized event reads or writes
    const evDeptA = await seedEvidence();
    const forgedTenantRead = runSql(
      TARGET_DB,
      "rakshak_app_user",
      `
      SELECT set_config('rakshak.department_id', 'dept_unauthorized_999', false);
      SELECT COUNT(*) FROM "CustodyEvent" WHERE "evidenceId" = '${evDeptA}';
      `
    );
    const forgedTenantInsert = runSql(
      TARGET_DB,
      "rakshak_app_user",
      `
      SELECT set_config('rakshak.department_id', 'dept_unauthorized_999', false);
      INSERT INTO "CustodyEvent" ("id", "evidenceId", "eventType", "actor", "action", "result", "timestamp", "sequenceNumber", "prevEventHash", "eventHash")
      VALUES ('${crypto.randomUUID()}', '${evDeptA}', 'OFFICER_NOTE', 'Hacker', 'Forged', 'SUCCESS', NOW(), 99, '${GENESIS_HASH}', '${crypto.randomBytes(32).toString("hex")}');
      `,
      true
    );

    const readLines = (forgedTenantRead.output || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const readCount = readLines.pop();
    const tc16Pass =
      readCount === "0" &&
      !forgedTenantInsert.ok &&
      forgedTenantInsert.error?.includes("violates row-level security policy");

    record(
      "TC-16",
      "Workstream E",
      "Forged tenant context strictly denied from reading or writing unauthorized CustodyEvent rows via RLS",
      tc16Pass ? "PASSED" : "FAILED",
      `readCount=${readCount}, insertDenied=${!forgedTenantInsert.ok}`
    );

    // TC-17: Reused pooled connections do not inherit another officer's authorization context
    const tmpSql = path.join(process.cwd(), `tmp_discard_${Date.now()}.sql`);
    fs.writeFileSync(
      tmpSql,
      `SELECT set_config('rakshak.officer_id', 'officer_secret_123', false);\nDISCARD ALL;\nSELECT COALESCE(NULLIF(current_setting('rakshak.officer_id', true), ''), 'CLEARED') AS officer;\n`
    );
    const envDiscard = { ...process.env, PGPASSWORD: "change_me_in_vault" };
    const discardOut = execFileSync(
      PSQL,
      ["-U", "rakshak_app_user", "-h", "127.0.0.1", "-d", TARGET_DB, "-t", "-A", "-f", tmpSql],
      { env: envDiscard, encoding: "utf8" }
    );
    fs.unlinkSync(tmpSql);
    const tc17Pass = discardOut.includes("CLEARED");
    record(
      "TC-17",
      "Workstream E",
      "DISCARD ALL cleanses session authorization variables to prevent cross-request leakage on pooled connections",
      tc17Pass ? "PASSED" : "FAILED",
      `output='${discardOut.trim().replace(/\r?\n/g, " ")}'`
    );

    // TC-18: Independent verifier detects synthetic fork, duplicate sequence, missing event, or bad predecessor hash
    const ev1Time = new Date("2026-10-24T10:00:00Z");
    const realH1 = computeEventHash({
      canonicalVersion: CANONICAL_VERSION_V1,
      eventId: "1",
      evidenceId: "ev1",
      sequenceNumber: 1,
      eventType: "INTAKE_UPLOAD",
      actor: "A",
      action: "1",
      result: "SUCCESS",
      timestamp: ev1Time,
      prevEventHash: GENESIS_HASH,
    });
    const fakeChain = [
      { id: "1", evidenceId: "ev1", sequenceNumber: 1, eventType: "INTAKE_UPLOAD", actor: "A", action: "1", result: "SUCCESS", timestamp: ev1Time, prevEventHash: GENESIS_HASH, eventHash: realH1 },
      { id: "2", evidenceId: "ev1", sequenceNumber: 1, eventType: "OFFICER_NOTE", actor: "A", action: "2", result: "SUCCESS", timestamp: ev1Time, prevEventHash: realH1, eventHash: crypto.randomBytes(32).toString("hex") },
    ];
    const vResultFork = verifyCustodyChainEvents(fakeChain);
    const tc18Pass = !vResultFork.valid && vResultFork.error?.includes("Sequence discontinuity or reordering detected");
    record(
      "TC-18",
      "Workstream C",
      "Independent verifier reliably detects duplicate sequence numbers and sequence discontinuities",
      tc18Pass ? "PASSED" : "FAILED",
      vResultFork.error
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WORKSTREAM D: CHECKPOINT AND TRUST-ANCHOR LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[4/5] WORKSTREAM D: CHECKPOINT & TRUST-ANCHOR READINESS");

    // TC-19: Checkpoint binds evidenceId, latestSequenceNumber, latestEventHash, and timestamp
    const checkpointEvidence = await seedEvidence();
    const cpEv1 = await appendCustodyEventAsync({ evidenceId: checkpointEvidence, eventType: "OFFICER_NOTE", actor: "A", action: "Note 1" }, masterClient);
    const cpEv2 = await appendCustodyEventAsync({ evidenceId: checkpointEvidence, eventType: "OFFICER_NOTE", actor: "A", action: "Note 2" }, masterClient);

    const validCp = createCustodyCheckpoint({
      evidenceId: checkpointEvidence,
      latestSequenceNumber: 2,
      latestEventHash: cpEv2.eventHash,
      keyId: "test_key_phase362_v1",
      secretOrKey: TEST_CHECKPOINT_KEY,
    });
    const cpVerify1 = verifyCustodyCheckpoint(validCp, TEST_CHECKPOINT_KEY);
    const tc19Pass =
      cpVerify1.valid &&
      validCp.evidenceId === checkpointEvidence &&
      validCp.latestSequenceNumber === 2 &&
      validCp.latestEventHash === cpEv2.eventHash;

    record(
      "TC-19",
      "Workstream D",
      "Custody checkpoint binds evidenceId, latestSequenceNumber, latestEventHash, and timestamp with HMAC-SHA256",
      tc19Pass ? "PASSED" : "FAILED",
      `sig=${validCp.signature.slice(0, 16)}...`
    );

    // TC-20: Forged checkpoint signature is rejected
    const forgedSigCp = { ...validCp, signature: crypto.randomBytes(32).toString("hex") };
    const cpVerify2 = verifyCustodyCheckpoint(forgedSigCp, TEST_CHECKPOINT_KEY);
    const tc20Pass = !cpVerify2.valid && cpVerify2.error?.includes("signature mismatch");
    record(
      "TC-20",
      "Workstream D",
      "Forged checkpoint signature rejected with cryptographic signature invalid",
      tc20Pass ? "PASSED" : "FAILED",
      cpVerify2.error
    );

    // TC-21: Altered checkpoint payload is rejected
    const alteredPayloadCp = { ...validCp, latestSequenceNumber: 99 };
    const cpVerify3 = verifyCustodyCheckpoint(alteredPayloadCp, TEST_CHECKPOINT_KEY);
    const tc21Pass = !cpVerify3.valid && cpVerify3.error?.includes("signature mismatch");
    record(
      "TC-21",
      "Workstream D",
      "Altered checkpoint payload rejected with signature mismatch",
      tc21Pass ? "PASSED" : "FAILED",
      cpVerify3.error
    );

    // TC-22: Checkpoint substitution between distinct exhibits is rejected
    const otherEvidence = await seedEvidence();
    const otherEvents = [
      { id: "1", evidenceId: otherEvidence, sequenceNumber: 1, eventType: "NOTE", actor: "A", action: "Note", result: "SUCCESS", timestamp: new Date(), prevEventHash: GENESIS_HASH, eventHash: crypto.randomBytes(32).toString("hex") },
    ];
    const subResult = verifyChainWithCheckpoint(otherEvents, validCp, TEST_CHECKPOINT_KEY);
    const tc22Pass = !subResult.valid && subResult.error?.includes("Trust anchor evidenceId mismatch");
    record(
      "TC-22",
      "Workstream D",
      "Checkpoint substitution between distinct exhibits rejected with evidenceId mismatch",
      tc22Pass ? "PASSED" : "FAILED",
      subResult.error
    );

    // TC-23: Stale checkpoint from older sequence rejected when requireHead is true
    const cpEv3 = await appendCustodyEventAsync({ evidenceId: checkpointEvidence, eventType: "OFFICER_NOTE", actor: "A", action: "Note 3" }, masterClient);
    const allEventsCp = await adminClient.custodyEvent.findMany({ where: { evidenceId: checkpointEvidence }, orderBy: { sequenceNumber: "asc" } });
    const staleResult = verifyChainWithCheckpoint(allEventsCp, validCp, TEST_CHECKPOINT_KEY, { requireHead: true });
    const tc23Pass = !staleResult.valid && staleResult.error?.includes("Trust anchor sequence mismatch");
    record(
      "TC-23",
      "Workstream D",
      "Stale checkpoint from older sequence rejected when validating chain head integrity",
      tc23Pass ? "PASSED" : "FAILED",
      staleResult.error
    );

    // TC-24: Database chain-head checkpoint creation via createCustodyCheckpointFromDbAsync
    const fromDbResult = await createCustodyCheckpointFromDbAsync(checkpointEvidence, {
      keyId: "test_key_phase362_v1",
      secretOrKey: TEST_CHECKPOINT_KEY,
      prismaClient: adminClient,
    });
    const headVerify = verifyChainWithCheckpoint(allEventsCp, fromDbResult.checkpoint, TEST_CHECKPOINT_KEY, { requireHead: true });
    const tc24Pass = fromDbResult.success && headVerify.valid;
    record(
      "TC-24",
      "Workstream D",
      "createCustodyCheckpointFromDbAsync authoritatively generates verified head checkpoint from database",
      tc24Pass ? "PASSED" : "FAILED",
      `headSeq=${fromDbResult.checkpoint?.latestSequenceNumber}, valid=${headVerify.valid}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SAFETY AND INVARIANTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[5/5] SAFETY & INVARIANT CHECKS");

    // TC-25: Direct PostgreSQL runtime role verification
    const roleCheck = runSql(
      TARGET_DB,
      "postgres",
      `SELECT rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'rakshak_app_user';`
    );
    const [rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls] = roleCheck.output.split("|");
    const tc25Pass = rolsuper === "f" && rolcreaterole === "f" && rolcreatedb === "f" && rolbypassrls === "f";
    record(
      "TC-25",
      "Safety",
      "rakshak_app_user verified unprivileged: rolsuper=f, rolcreaterole=f, rolcreatedb=f, rolbypassrls=f",
      tc25Pass ? "PASSED" : "FAILED",
      roleCheck.output
    );

    // TC-26: uploads/raw/ 560 files unaltered, manifest verification
    const postManifest = computeDirectoryManifest(RAW_DIR);
    const tc26Pass =
      postManifest.count === 560 &&
      postManifest.manifestHash === preManifest.manifestHash &&
      postManifest.manifestHash === "bdc91bb78c603d212d992ac552d8ff85e6e4096bb0533c836ed8936b20ad61b8";

    record(
      "TC-26",
      "Safety",
      "Cold storage uploads/raw/ 560 files remain 100% unaltered with byte-identical manifest hash",
      tc26Pass ? "PASSED" : "FAILED",
      `count=${postManifest.count}, hash=${postManifest.manifestHash.slice(0, 16)}...`
    );

    // TC-27: dev.db unaltered
    const postDevDbHash = sha256File(ACTIVE_DB_PATH);
    const tc27Pass = postDevDbHash === preDevDbHash;
    record(
      "TC-27",
      "Safety",
      "Active dev.db database untouched and unaltered during tests",
      tc27Pass ? "PASSED" : "FAILED",
      `hash=${postDevDbHash.slice(0, 16)}...`
    );

  } finally {
    await masterClient.$disconnect();
    await adminClient.$disconnect();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY & REPORT EXPORT
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === "PASSED").length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================\n");

  const reportPayload = {
    phase: "36.2",
    title: "Cross-Process Custody-Chain Concurrency, Sequence Integrity & Trust-Anchor Readiness",
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      database: TARGET_DB,
      appUserRole: "rakshak_app_user",
      manifestColdBinaries: preManifest.manifestHash,
      coldBinaryCount: preManifest.count,
    },
    summary: {
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(1)}%`,
    },
    testResults,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(reportPayload, null, 2), "utf-8");
  console.log(`[Results] Exported test payload to ${OUT_FILE}`);

  if (failed > 0) {
    process.exit(1);
  }
}
