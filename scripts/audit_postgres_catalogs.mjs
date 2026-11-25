// scripts/audit_postgres_catalogs.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";

const dbs = [
  "rakshak_phase36_test",
  "rakshak_phase37_test",
  "rakshak_phase38_test",
  "rakshak_phase39_test",
  "rakshak_phase39_1_audit_test",
];

const env = { ...process.env, PGPASSWORD: "change_me_in_vault" };

function queryPsql(db, sql) {
  try {
    const res = execFileSync(
      PSQL,
      ["-h", "127.0.0.1", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql],
      { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return res.trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

const auditReport = {};

for (const db of dbs) {
  console.log(`Auditing ${db}...`);
  const tablesRaw = queryPsql(
    db,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"
  );
  const tables = tablesRaw.split("\n").map((t) => t.trim()).filter(Boolean);

  const rlsRaw = queryPsql(
    db,
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND relkind = 'r' ORDER BY relname;"
  );
  const rls = rlsRaw.split("\n").map((line) => {
    const [relname, rowsec, forcerowsec] = line.split("|");
    return { relname, rowsec: rowsec === "t", forcerowsec: forcerowsec === "t" };
  });

  const policiesRaw = queryPsql(
    db,
    "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;"
  );
  const policies = policiesRaw.split("\n").map((line) => {
    const [tablename, policyname, cmd] = line.split("|");
    return { tablename, policyname, cmd };
  }).filter((p) => p.tablename);

  const rowCounts = {};
  for (const table of tables) {
    if (table.startsWith("_")) continue;
    const count = queryPsql(db, `SELECT count(*) FROM "${table}";`);
    rowCounts[table] = parseInt(count, 10) || 0;
  }

  // Check columns on ExtractedFact
  const extractedFactColsRaw = queryPsql(
    db,
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='ExtractedFact' ORDER BY ordinal_position;"
  );
  const extractedFactCols = extractedFactColsRaw.split("\n").map((line) => {
    const [col, type, nullable, def] = line.split("|");
    return { col, type, nullable: nullable === "YES", def };
  }).filter((c) => c.col);

  auditReport[db] = {
    tableCount: tables.length,
    tables,
    rowCounts,
    rlsCount: rls.filter((r) => r.rowsec).length,
    forcedRlsCount: rls.filter((r) => r.forcerowsec).length,
    policyCount: policies.length,
    policies,
    extractedFactColumnsCount: extractedFactCols.length,
    extractedFactCols,
  };
}

fs.writeFileSync("PHASE39_2_DB_AUDIT_DATA.json", JSON.stringify(auditReport, null, 2), "utf8");
console.log("Audit complete. Data written to PHASE39_2_DB_AUDIT_DATA.json");
