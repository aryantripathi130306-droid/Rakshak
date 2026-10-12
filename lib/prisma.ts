// ─────────────────────────────────────────────────────────────────────────────
// lib/prisma.ts — Singleton PrismaClient with multi-engine routing guard
// Intelligently routes to @prisma/client-pg when PostgreSQL connection URL is
// provided, and @prisma/client when SQLite is used (with /tmp replication in serverless).
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient as PrismaClientSqlite } from "@prisma/client";
import { PrismaClient as PrismaClientPg } from "@prisma/client-pg";
import path from "node:path";
import fs from "node:fs";

const rawDbUrl = process.env.PG_DATABASE_URL || process.env.DATABASE_URL || "";
const isPostgres = rawDbUrl.startsWith("postgresql://") || rawDbUrl.startsWith("postgres://");

function createClient(): PrismaClientSqlite | PrismaClientPg {
  if (isPostgres) {
    const pgUrl = process.env.PG_DATABASE_URL || process.env.DATABASE_URL;
    return new PrismaClientPg({
      datasources: pgUrl ? { db: { url: pgUrl } } : undefined,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  // SQLite configuration
  let sqliteUrl = process.env.DATABASE_URL;

  // In serverless environments (e.g. Vercel / AWS Lambda), /var/task is read-only.
  // Replicate dev.db into /tmp/dev.db to allow write operations (sessions, audit logs).
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    try {
      const tmpDb = path.join("/tmp", "dev.db");
      const srcDb = path.join(process.cwd(), "prisma", "dev.db");
      if (!fs.existsSync(/*turbopackIgnore: true*/ tmpDb)) {
        if (fs.existsSync(/*turbopackIgnore: true*/ srcDb)) {
          fs.copyFileSync(srcDb, tmpDb);
        }
      }
      if (fs.existsSync(/*turbopackIgnore: true*/ tmpDb)) {
        sqliteUrl = `file:${tmpDb}`;
      }
    } catch (e) {
      console.warn("[lib/prisma] Serverless SQLite /tmp replication note:", e);
    }
  }

  return new PrismaClientSqlite({
    datasources: sqliteUrl ? { db: { url: sqliteUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSqlite | undefined;
};

export const prisma: PrismaClientSqlite = (globalForPrisma.prisma ?? createClient()) as unknown as PrismaClientSqlite;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
