// ─────────────────────────────────────────────────────────────────────────────
// lib/tenantContext.ts
// Rakshak v3.0 — Phase 27 Transaction-Local Tenant Context & RLS Isolation Helper
//
// Defense-in-depth PostgreSQL connection pool tenant isolation:
// 1. Binds transaction to authenticated server-side officer identity & department.
// 2. Scopes GUC session variables strictly to the current transaction (is_local = true).
// 3. Guarantees zero tenant context leakage upon COMMIT, ROLLBACK, or pool return.
// 4. Enforces strict fail-closed exceptions for unauthorized department access.
// ─────────────────────────────────────────────────────────────────────────────
import type { Prisma, PrismaClient as PrismaClientPg } from "@prisma/client-pg";

export interface TenantContextOptions {
  officerId: string;
  departmentId: string;
}

/**
 * Executes a database operation within an authenticated departmental tenant context.
 * Uses PostgreSQL's set_authenticated_tenant_context() inside a dedicated transaction block.
 */
export async function withTenantContext<T>(
  client: PrismaClientPg,
  context: TenantContextOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const { officerId, departmentId } = context;

  if (!officerId || !departmentId) {
    throw new Error("TenantContextError: Both officerId and departmentId are required.");
  }

  // Interactive transaction ensures all operations occur on a single connection
  return await client.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Establish validated tenant context (validates Officer table assignment)
    await tx.$executeRaw`SELECT set_authenticated_tenant_context(${officerId}, ${departmentId});`;

    try {
      // 2. Execute protected operations under RLS enforcement
      const result = await operation(tx);
      return result;
    } finally {
      // 3. Clear context prior to commit for defense-in-depth pool hygiene
      try {
        await tx.$executeRaw`SELECT clear_tenant_context();`;
      } catch {
        // Transaction is in aborted state if operation threw an error; rollback clears context
      }
    }
  });
}

/**
 * Executes a database operation within supervisory platform administrator context.
 * Restricted strictly to callers connected under an authorized administrative role.
 */
export async function withPlatformAdminContext<T>(
  client: PrismaClientPg,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await client.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Assert platform admin context (enforces membership in rakshak_admin_role)
    await tx.$executeRaw`SELECT set_platform_admin_context();`;

    try {
      // 2. Execute supervisory read/write
      const result = await operation(tx);
      return result;
    } finally {
      // 3. Clear admin context prior to commit
      await tx.$executeRaw`SELECT clear_tenant_context();`;
    }
  });
}
