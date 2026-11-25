import fs from "node:fs";

const HBA_FILE = "C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf";
const BAK_FILE = "C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf.bak";

if (fs.existsSync(BAK_FILE)) {
  fs.copyFileSync(BAK_FILE, HBA_FILE);
  console.log("Restored original pg_hba.conf with scram-sha-256.");
  console.log("To apply in PostgreSQL, restart the service in an Administrator terminal:");
  console.log("  Restart-Service postgresql-x64-16");
} else {
  let content = fs.readFileSync(HBA_FILE, "utf-8");
  content = content.replace(/host\s+all\s+all\s+127\.0\.0\.1\/32\s+trust/, "host    all             all             127.0.0.1/32            scram-sha-256");
  fs.writeFileSync(HBA_FILE, content, "utf-8");
  console.log("Updated pg_hba.conf back to scram-sha-256.");
  console.log("To apply in PostgreSQL, restart the service in an Administrator terminal:");
  console.log("  Restart-Service postgresql-x64-16");
}
