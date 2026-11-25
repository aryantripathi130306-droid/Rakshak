import fs from "node:fs";
import { execFileSync } from "node:child_process";

const HBA_FILE = "C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf";
const BAK_FILE = "C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf.bak";
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const PG_CTL = "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe";
const DATA_DIR = "C:\\Program Files\\PostgreSQL\\16\\data";

console.log("Backing up pg_hba.conf...");
if (!fs.existsSync(BAK_FILE)) {
  fs.copyFileSync(HBA_FILE, BAK_FILE);
}

console.log("Updating pg_hba.conf to trust 127.0.0.1/32...");
let content = fs.readFileSync(HBA_FILE, "utf-8");
content = content.replace(/host\s+all\s+all\s+127\.0\.0\.1\/32\s+scram-sha-256/, "host    all             all             127.0.0.1/32            trust");
fs.writeFileSync(HBA_FILE, content, "utf-8");

console.log("Reloading PostgreSQL configuration...");
try {
  execFileSync(PG_CTL, ["reload", "-D", DATA_DIR], { stdio: "inherit" });
} catch (e) {
  console.log("pg_ctl reload failed, trying restart-service via powershell...");
  execFileSync("powershell", ["-Command", "Restart-Service -Name postgresql-x64-16"], { stdio: "inherit" });
}

console.log("Testing connection as postgres...");
const out = execFileSync(PSQL, ["-U", "postgres", "-h", "127.0.0.1", "-c", "SELECT version();"], { encoding: "utf-8" });
console.log("Connection successful!");
console.log(out.trim());
