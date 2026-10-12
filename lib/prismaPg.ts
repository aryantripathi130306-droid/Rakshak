// ─────────────────────────────────────────────────────────────────────────────
// lib/prismaPg.ts
// Rakshak v3.0 — Phase 27 PostgreSQL Prisma Client Singleton
//
// Dedicated Prisma client generated from prisma/schema.postgresql.prisma.
// Isolated from the default SQLite client (@prisma/client) to prevent cross-engine conflicts.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient as PrismaClientPg } from "@prisma/client-pg";

const globalForPrismaPg = globalThis as unknown as {
  prismaPg: PrismaClientPg | undefined;
};

export function createPrismaPgClient(databaseUrl?: string): PrismaClientPg {
  const url = databaseUrl || process.env.PG_DATABASE_URL || process.env.DATABASE_URL;
  return new PrismaClientPg({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prismaPg =
  globalForPrismaPg.prismaPg ??
  createPrismaPgClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaPg.prismaPg = prismaPg;
}

export default prismaPg;
