// ─────────────────────────────────────────────────────────────────────────────
// lib/env.ts
// Production Environment & Configuration Validator for Rakshak v3.0
//
// Validates presence, formatting, and security invariants of runtime variables.
// Fails closed with informative, secret-redacted errors if security invariants fail.
// ─────────────────────────────────────────────────────────────────────────────

export interface AppConfig {
  isProduction: boolean;
  isStaging: boolean;
  strictAuth: boolean;
  databaseUrl: string;
  redactedDatabaseUrl: string;
  databaseEngine: "sqlite" | "postgresql";
  appOrigin: string;
  evidenceStoragePath: string;
  maxUploadSizeBytes: number;
  realIngestionEnabled: boolean;
  demoBypassAllowed: boolean;
}

let cachedConfig: AppConfig | null = null;

/**
 * Sanitizes connection strings to prevent credential leakage in logs and diagnostics.
 */
export function redactSecretUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "********";
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1********$2");
  }
}

/**
 * Checks whether production release gates are certified for live investigative ingestion.
 * Always returns false in local staging/development builds.
 */
export function isProductionReleaseCertified(): boolean {
  // Real investigative data ingestion requires external hardware WORM appliance,
  // production TLS 1.3 certificate, independent external penetration test signoff,
  // and law-enforcement legal operating procedure review under BSA §63.
  return false;
}

export function validateEnvironment(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const isStaging = process.env.RAKSHAK_STAGING === "true" || process.env.STAGING === "true";

  // 1. Database URL validation
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === "") {
    throw new Error(
      "[ConfigError] Security-critical variable DATABASE_URL is missing. Halting startup to prevent inconsistent state."
    );
  }

  const isPostgresUrl = databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
  const databaseEngine: "sqlite" | "postgresql" = isPostgresUrl ? "postgresql" : "sqlite";
  const redactedDatabaseUrl = redactSecretUrl(databaseUrl);

  // 2. Production Fail-Closed Guards
  if (isProduction) {
    // A. Prevent silent SQLite fallback if PostgreSQL is required
    const requirePostgres =
      process.env.REQUIRE_POSTGRES === "true" ||
      process.env.RAKSHAK_DB_ENGINE === "postgresql" ||
      process.env.DB_ENGINE === "postgresql";

    if (requirePostgres && databaseEngine === "sqlite") {
      throw new Error(
        "[ConfigError] Production environment requires PostgreSQL. Silent fallback to SQLite is strictly prohibited."
      );
    }

    // B. Prevent default development credentials in production
    if (
      databaseUrl.includes("change_me_in_vault") ||
      databaseUrl.includes("postgres:postgres") ||
      databaseUrl.includes("admin:admin") ||
      databaseUrl.includes("password123")
    ) {
      throw new Error(
        "[SecurityError] Production database connection string cannot use default development credentials."
      );
    }

    // C. Strict Authentication Guard
    if (process.env.STRICT_AUTH === "false") {
      throw new Error(
        "[SecurityError] STRICT_AUTH cannot be disabled in production. Anonymous demo bypass is prohibited."
      );
    }

    // D. Session Secret Entropy Guard
    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret) {
      if (
        sessionSecret.length < 32 ||
        sessionSecret.includes("REPLACE_WITH") ||
        sessionSecret.includes("dummy")
      ) {
        throw new Error(
          "[SecurityError] Production SESSION_SECRET must be at least 32 characters and cannot be a template placeholder."
        );
      }
    }

    // E. Real Investigative Ingestion Guard
    if (process.env.REAL_INGESTION_ENABLED === "true") {
      if (!isProductionReleaseCertified()) {
        throw new Error(
          "[ComplianceError] Real investigative evidence ingestion is locked until all production release gates (WORM storage, TLS 1.3, independent audit, departmental BSA §63 legal review) are verified and signed off."
        );
      }
    }
  }

  // 3. Strict Authentication Resolution
  const strictAuth =
    process.env.STRICT_AUTH === "true" ||
    (isProduction && process.env.STRICT_AUTH !== "false");

  const demoBypassAllowed = !isProduction && !strictAuth;

  // 4. Application Origin
  const appOrigin = process.env.APP_ORIGIN || "http://localhost:3000";

  // 5. Evidence storage path
  const evidenceStoragePath = process.env.EVIDENCE_STORAGE_PATH || "./uploads/raw";

  // 6. Max upload limit
  const maxUploadMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "100", 10);
  const maxUploadSizeBytes = (isNaN(maxUploadMb) ? 100 : maxUploadMb) * 1024 * 1024;

  cachedConfig = {
    isProduction,
    isStaging,
    strictAuth,
    databaseUrl,
    redactedDatabaseUrl,
    databaseEngine,
    appOrigin,
    evidenceStoragePath,
    maxUploadSizeBytes,
    realIngestionEnabled: false, // Invariant: Real ingestion is unconditionally false
    demoBypassAllowed,
  };

  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return validateEnvironment();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
