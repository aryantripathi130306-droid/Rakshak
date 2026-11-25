// ─────────────────────────────────────────────────────────────────────────────
// lib/entityResolution.ts
// Rakshak v3.0 — Phase 37 Deterministic Entity Normalization & Explainable Matching
//
// Provides:
// 1. Type-specific deterministic identifier normalization (v1).
// 2. Generic/shared identifier detection with explicit limitation tagging.
// 3. Masked identifier formatting for privacy-preserving graph representation.
// 4. Keyed HMAC digest calculation for comparative privacy guarantees.
// 5. Explainable candidate-linking evaluation with provenance tracking.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import { normalisePhoneDetailed, type PhoneNormalizationDetails } from "./validators.ts";

export const NORMALIZATION_VERSION = "v2";
export const LEGACY_NORMALIZATION_VERSION = "v1";

export type EntityType =
  | "EMAIL"
  | "PHONE"
  | "UPI"
  | "ACCOUNT"
  | "IFSC"
  | "DOMAIN"
  | "URL"
  | "IP"
  | "DEVICE_HASH"
  | "NAME"
  | "UTR"
  | "TELEGRAM"
  | "OTHER";

export type LinkType =
  | "EXACT_IDENTIFIER_MATCH"
  | "SHARED_HASH"
  | "SHARED_ACCOUNT"
  | "EXPLICIT_RELATIONSHIP"
  | "ANALYST_CONFIRMED"
  | "POTENTIAL_MATCH";

export type ConfidenceCategory =
  | "EXACT_IDENTIFIER_MATCH"
  | "POTENTIAL_MATCH"
  | "ANALYST_CONFIRMED";

export type ReviewStatus =
  | "CANDIDATE"
  | "UNDER_REVIEW"
  | "CONFIRMED"
  | "REJECTED"
  | "REVOKED";

export interface NormalizationResult {
  isValid: boolean;
  normalizedValue: string;
  isGeneric: boolean;
  isAmbiguous?: boolean;
  ruleVersion?: string;
  countryCode?: string | null;
  nationalNumber?: string | null;
  extension?: string;
  limitations?: string;
  error?: string;
}

// Common / generic email domains where shared address domain implies zero association
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "aol.com",
  "zoho.com",
  "rediffmail.com",
  "example.com",
]);

// Generic public/shared email prefixes
const GENERIC_EMAIL_PREFIXES = new Set([
  "info",
  "support",
  "admin",
  "contact",
  "help",
  "sales",
  "service",
  "noreply",
  "no-reply",
  "office",
  "billing",
]);

// Generic domains
const GENERIC_DOMAINS = new Set([
  "google.com",
  "whatsapp.com",
  "telegram.org",
  "facebook.com",
  "instagram.com",
  "apple.com",
  "microsoft.com",
  "paytm.com",
  "phonepe.com",
  "amazon.in",
  "flipkart.com",
  "sbi.co.in",
  "hdfcbank.com",
  "icicibank.com",
]);

// Common emergency / public helpline numbers
const HELPLINE_NUMBERS = new Set(["100", "112", "1930", "1090", "1091", "1073"]);

// ─── 1. Type-Specific Normalization Functions ────────────────────────────────

export function normalizeEmail(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid email" };
  }
  const trimmed = raw.trim().toLowerCase();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0 || atIdx !== trimmed.lastIndexOf("@") || atIdx >= trimmed.length - 1) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Malformed email format" };
  }

  const userPart = trimmed.slice(0, atIdx);
  const domainPart = trimmed.slice(atIdx + 1);

  if (!domainPart.includes(".") || domainPart.startsWith(".") || domainPart.endsWith(".")) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid email domain structure" };
  }

  const isGeneric = GENERIC_EMAIL_PREFIXES.has(userPart) || (GENERIC_EMAIL_DOMAINS.has(domainPart) && userPart.length <= 3);
  const limitations = isGeneric
    ? "Shared generic mailbox prefix or high-volume test domain. Non-conclusive identity evidence."
    : undefined;

  return {
    isValid: true,
    normalizedValue: trimmed,
    isGeneric,
    limitations,
  };
}

export function normalizePhone(raw: string): NormalizationResult {
  const details = normalisePhoneDetailed(raw);
  if (!details.isValid) {
    return {
      isValid: false,
      normalizedValue: "",
      isGeneric: false,
      isAmbiguous: details.isAmbiguous,
      ruleVersion: details.ruleVersion,
      error: details.error || "Empty or invalid phone number",
    };
  }

  return {
    isValid: true,
    normalizedValue: details.normalizedValue,
    isGeneric: details.isGeneric,
    isAmbiguous: details.isAmbiguous,
    ruleVersion: details.ruleVersion,
    countryCode: details.countryCode,
    nationalNumber: details.nationalNumber,
    extension: details.extension,
    limitations: details.limitations,
  };
}

export function normalizeUpi(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid UPI handle" };
  }
  const trimmed = raw.trim().toLowerCase();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0 || atIdx !== trimmed.lastIndexOf("@") || atIdx >= trimmed.length - 1) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Malformed UPI handle (must contain exactly one '@')" };
  }

  const handle = trimmed.slice(0, atIdx);
  const psp = trimmed.slice(atIdx + 1);

  if (!/^[a-z0-9._-]+$/.test(handle) || !/^[a-z0-9]+$/.test(psp)) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid characters in UPI handle" };
  }

  const isGeneric = handle === "pay" || handle === "merchant" || handle === "qr" || handle === "test";
  const limitations = isGeneric
    ? "Generic aggregator UPI handle. Non-conclusive identity evidence."
    : undefined;

  return {
    isValid: true,
    normalizedValue: trimmed,
    isGeneric,
    limitations,
  };
}

export function normalizeBankAccount(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid bank account" };
  }
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{6,26}$/.test(clean)) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid account number format" };
  }

  const isGeneric = /^0+$/.test(clean) || clean === "1234567890";
  return {
    isValid: true,
    normalizedValue: clean,
    isGeneric,
    limitations: isGeneric ? "Dummy test account number." : undefined,
  };
}

export function normalizeIfsc(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid IFSC" };
  }
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid IFSC format (must be 4 letters, 0, then 6 alphanumeric)" };
  }

  return {
    isValid: true,
    normalizedValue: clean,
    isGeneric: false,
  };
}

export function normalizeDomain(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid domain" };
  }
  let clean = raw.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/\/.*$/, "");
  clean = clean.replace(/:\d+$/, "");
  if (clean.startsWith("www.")) {
    clean = clean.slice(4);
  }

  if (!clean.includes(".") || clean.startsWith(".") || clean.endsWith(".")) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid domain structure" };
  }

  const isGeneric = GENERIC_DOMAINS.has(clean);
  const limitations = isGeneric
    ? `Shared generic high-traffic infrastructure (${clean}). Cannot be used as conclusive linking evidence.`
    : undefined;

  return {
    isValid: true,
    normalizedValue: clean,
    isGeneric,
    limitations,
  };
}

export function normalizeUrl(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid URL" };
  }
  let clean = raw.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `http://${clean}`;
  }

  try {
    const parsed = new URL(clean);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);

    let normPath = parsed.pathname.replace(/\/+$/, "");
    if (!normPath) normPath = "/";

    const normalized = `${parsed.protocol}//${host}${normPath}${parsed.search}`;
    const isGeneric = GENERIC_DOMAINS.has(host) && normPath === "/";

    return {
      isValid: true,
      normalizedValue: normalized,
      isGeneric,
      limitations: isGeneric ? "Generic top-level domain URL." : undefined,
    };
  } catch {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Malformed URL" };
  }
}

export function normalizeIp(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid IP address" };
  }
  const clean = raw.trim();
  const parts = clean.split(".");
  if (parts.length !== 4) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "IPv4 must consist of 4 octets" };
  }

  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) {
      return { isValid: false, normalizedValue: "", isGeneric: false, error: "Malformed IP octet" };
    }
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) {
      return { isValid: false, normalizedValue: "", isGeneric: false, error: "IP octet out of range (0-255)" };
    }
    octets.push(n);
  }

  const normalized = octets.join(".");

  // Private, loopback, link-local, and CGNAT ranges
  const isLoopback = octets[0] === 127;
  const isZero = octets[0] === 0;
  const isPrivate =
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127); // CGNAT

  const isGeneric = isLoopback || isZero || isPrivate;
  const limitations = isGeneric
    ? `Private, loopback, or Carrier-Grade NAT IP address (${normalized}). Shared by millions of subscribers; non-conclusive identity evidence.`
    : undefined;

  return {
    isValid: true,
    normalizedValue: normalized,
    isGeneric,
    limitations,
  };
}

export function normalizeDeviceHash(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid device/artifact hash" };
  }
  const clean = raw.trim().toLowerCase().replace(/[\s-]/g, "");

  // SHA-256 (64 hex), MD5 (32 hex), or MAC address (12 hex)
  if (/^[0-9a-f]{64}$/.test(clean) || /^[0-9a-f]{32}$/.test(clean) || /^[0-9a-f]{12}$/.test(clean)) {
    return {
      isValid: true,
      normalizedValue: clean,
      isGeneric: false,
    };
  }

  // MAC address with colons
  if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(clean)) {
    return {
      isValid: true,
      normalizedValue: clean.replace(/:/g, ""),
      isGeneric: false,
    };
  }

  return { isValid: false, normalizedValue: "", isGeneric: false, error: "Invalid hash or MAC format" };
}

export function normalizeUtr(raw: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty or invalid UTR/transaction reference" };
  }
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  // Standard banking UTR: 12-digit numeric, or 12-22 char alphanumeric transaction reference
  if (!/^[A-Z0-9]{12,22}$/.test(clean)) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "UTR must be 12-22 alphanumeric characters" };
  }
  const isGeneric = /^0+$/.test(clean) || clean === "123456789012" || clean === "TESTTRANSACTION";
  return {
    isValid: true,
    normalizedValue: clean,
    isGeneric,
    limitations: isGeneric ? "Dummy or generic transaction test identifier." : undefined,
  };
}

export function normalizeGenericIdentifier(raw: string, type: string): NormalizationResult {
  if (!raw || typeof raw !== "string") {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty identifier" };
  }
  const clean = raw.trim();
  if (clean.length === 0) {
    return { isValid: false, normalizedValue: "", isGeneric: false, error: "Empty identifier" };
  }

  const upper = clean.toUpperCase();
  const isGeneric = upper === "UNKNOWN" || upper === "N/A" || upper === "SUSPECT" || upper === "VICTIM" || upper === "CASH";
  return {
    isValid: true,
    normalizedValue: upper,
    isGeneric,
    limitations: isGeneric ? "Common generic placeholder. Non-conclusive identity evidence." : undefined,
  };
}

/**
 * Universal dispatcher for entity normalization.
 */
export function normalizeEntityIdentifier(type: string, raw: string): NormalizationResult {
  const normType = (type || "").trim().toUpperCase();

  switch (normType) {
    case "EMAIL":
      return normalizeEmail(raw);
    case "PHONE":
      return normalizePhone(raw);
    case "UPI":
      return normalizeUpi(raw);
    case "ACCOUNT":
      return normalizeBankAccount(raw);
    case "IFSC":
      return normalizeIfsc(raw);
    case "DOMAIN":
      return normalizeDomain(raw);
    case "URL":
      return normalizeUrl(raw);
    case "IP":
      return normalizeIp(raw);
    case "DEVICE_HASH":
    case "HASH":
      return normalizeDeviceHash(raw);
    case "UTR":
      return normalizeUtr(raw);
    case "NAME":
    case "TELEGRAM":
    case "OTHER":
      return normalizeGenericIdentifier(raw, normType);
    default:
      return {
        isValid: false,
        normalizedValue: "",
        isGeneric: false,
        error: `Unsupported entity type: '${type}'`,
      };
  }
}

// ─── 2. Masked Representation for UI & Privacy ──────────────────────────────

export function maskIdentifier(value: string, type: string): string {
  if (!value || typeof value !== "string") return "";
  const normType = (type || "").trim().toUpperCase();

  switch (normType) {
    case "EMAIL": {
      const atIdx = value.indexOf("@");
      if (atIdx <= 1) return "***" + value.slice(atIdx);
      const user = value.slice(0, atIdx);
      const domain = value.slice(atIdx + 1);
      const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
      return `${maskedUser}@${domain}`;
    }
    case "PHONE": {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 10) {
        const last3 = digits.slice(-3);
        return `+91-XXXXX-XX${last3}`;
      }
      return "XXXXX-" + value.slice(-3);
    }
    case "UPI": {
      const atIdx = value.indexOf("@");
      if (atIdx <= 1) return "***" + value.slice(atIdx);
      const handle = value.slice(0, atIdx);
      const bank = value.slice(atIdx + 1);
      const maskedHandle = handle.length > 2 ? `${handle[0]}***${handle[handle.length - 1]}` : `${handle[0]}***`;
      return `${maskedHandle}@${bank}`;
    }
    case "ACCOUNT": {
      if (value.length > 4) {
        return `XXXX-XXXX-${value.slice(-4)}`;
      }
      return `XXXX-${value}`;
    }
    case "IP": {
      const parts = value.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
      return "***.***";
    }
    case "DEVICE_HASH":
    case "HASH": {
      if (value.length > 12) {
        return `${value.slice(0, 6)}...${value.slice(-6)}`;
      }
      return value;
    }
    default:
      return value;
  }
}

// ─── 3. Keyed HMAC Digest for Comparing Sensitive Identifiers ────────────────

export function computeKeyedDigest(value: string, secretKey?: string): string {
  const secret = secretKey || process.env.RAKSHAK_ENTITY_DIGEST_SECRET || "synthetic_rakshak_digest_key_default";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

// ─── 4. Explainable Candidate-Linking Engine ─────────────────────────────────

export interface CandidateEvaluationInput {
  sourceCaseId: string;
  sourceCaseNumber: string;
  targetCaseId: string;
  targetCaseNumber: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  sourceEvidenceId?: string;
  targetEvidenceId?: string;
  entityType: string;
  rawValueA: string;
  rawValueB: string;
}

export interface CandidateEvaluationResult {
  isMatch: boolean;
  linkType?: LinkType;
  matchRule?: string;
  normalizationVersion: string;
  normalizedValue?: string;
  confidenceCategory?: ConfidenceCategory;
  isGeneric: boolean;
  explanation: string;
  limitations?: string;
  sourceCaseId: string;
  targetCaseId: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  sourceEvidenceId?: string;
  targetEvidenceId?: string;
  entityType: string;
}

/**
 * Evaluates whether two entity occurrences represent an explainable candidate link.
 * Fails closed on unsupported types, missing provenance, or mismatched normalized digests.
 */
export function evaluateCandidateLink(input: CandidateEvaluationInput): CandidateEvaluationResult {
  const {
    sourceCaseId,
    sourceCaseNumber,
    targetCaseId,
    targetCaseNumber,
    sourceEntityId,
    targetEntityId,
    sourceEvidenceId,
    targetEvidenceId,
    entityType,
    rawValueA,
    rawValueB,
  } = input;

  // 1. Provenance boundary check: require distinct cases and non-empty IDs
  if (!sourceCaseId || !targetCaseId) {
    return {
      isMatch: false,
      normalizationVersion: NORMALIZATION_VERSION,
      isGeneric: false,
      explanation: "Evaluation failed: Missing source or target case identifier.",
      sourceCaseId,
      targetCaseId,
      entityType,
    };
  }

  if (sourceCaseId === targetCaseId) {
    return {
      isMatch: false,
      normalizationVersion: NORMALIZATION_VERSION,
      isGeneric: false,
      explanation: "Intra-case link evaluation: Cross-case candidate links require distinct source and target cases.",
      sourceCaseId,
      targetCaseId,
      entityType,
    };
  }

  // 2. Normalization check
  const normA = normalizeEntityIdentifier(entityType, rawValueA);
  const normB = normalizeEntityIdentifier(entityType, rawValueB);

  if (!normA.isValid || !normB.isValid) {
    return {
      isMatch: false,
      normalizationVersion: NORMALIZATION_VERSION,
      isGeneric: false,
      explanation: `Normalization failed: ${normA.error || normB.error}`,
      sourceCaseId,
      targetCaseId,
      entityType,
    };
  }

  if (normA.normalizedValue !== normB.normalizedValue) {
    return {
      isMatch: false,
      normalizationVersion: NORMALIZATION_VERSION,
      isGeneric: false,
      explanation: `Normalized values do not match: '${normA.normalizedValue}' != '${normB.normalizedValue}'`,
      sourceCaseId,
      targetCaseId,
      entityType,
    };
  }

  // 3. Match classification
  const normalizedValue = normA.normalizedValue;
  const isGeneric = normA.isGeneric || normB.isGeneric;
  const limitations = normA.limitations || normB.limitations;

  let linkType: LinkType = "EXACT_IDENTIFIER_MATCH";
  let matchRule = `RULE_EXACT_NORM_${entityType.toUpperCase()}_V2`;
  let confidenceCategory: ConfidenceCategory = "EXACT_IDENTIFIER_MATCH";

  if (isGeneric) {
    linkType = "POTENTIAL_MATCH";
    matchRule = `RULE_GENERIC_SHARED_${entityType.toUpperCase()}_V2`;
    confidenceCategory = "POTENTIAL_MATCH";
  } else if (entityType === "DEVICE_HASH" || entityType === "HASH") {
    linkType = "SHARED_HASH";
    matchRule = "RULE_SHARED_DEVICE_HASH_V2";
    confidenceCategory = "EXACT_IDENTIFIER_MATCH";
  } else if (entityType === "ACCOUNT") {
    linkType = "SHARED_ACCOUNT";
    matchRule = "RULE_SHARED_FINANCIAL_ACCOUNT_V2";
    confidenceCategory = "EXACT_IDENTIFIER_MATCH";
  } else if (entityType === "UTR") {
    linkType = "EXACT_IDENTIFIER_MATCH";
    matchRule = "RULE_EXACT_NORM_UTR_V2";
    confidenceCategory = "EXACT_IDENTIFIER_MATCH";
  }

  const masked = maskIdentifier(normalizedValue, entityType);
  let explanation = "";

  if (isGeneric) {
    explanation = `Candidate link based on shared generic ${entityType.toLowerCase()} '${masked}' observed in ${sourceCaseNumber} and ${targetCaseNumber}. ${limitations || "Generic identifier; non-conclusive identity evidence."}`;
  } else if (linkType === "SHARED_HASH") {
    explanation = `Identical cryptographic device/artifact digest '${masked}' detected across evidence in ${sourceCaseNumber} and ${targetCaseNumber}.`;
  } else if (linkType === "SHARED_ACCOUNT") {
    explanation = `Matching financial reference '${masked}' identified across case records in ${sourceCaseNumber} and ${targetCaseNumber}.`;
  } else {
    explanation = `Deterministic exact match on verified ${entityType.toLowerCase()} '${masked}' linking ${sourceCaseNumber} and ${targetCaseNumber}.`;
  }

  return {
    isMatch: true,
    linkType,
    matchRule,
    normalizationVersion: NORMALIZATION_VERSION,
    normalizedValue,
    confidenceCategory,
    isGeneric,
    explanation,
    limitations,
    sourceCaseId,
    targetCaseId,
    sourceEntityId,
    targetEntityId,
    sourceEvidenceId,
    targetEvidenceId,
    entityType,
  };
}

// ─── 5. Safe Candidate Link Re-evaluation Engine ─────────────────────────────

export interface ReevaluationSummary {
  totalEvaluated: number;
  unaffectedCount: number;
  affectedCount: number;
  confirmedPreservedCount: number;
  affectedCandidateLinks: Array<{
    linkId: string;
    entityType: string;
    currentNormalizedValue: string;
    newNormalizedValue: string;
    status: ReviewStatus;
    reason: string;
    requiresReview: boolean;
  }>;
}

/**
 * Safely evaluates existing candidate links against V2 normalization rules.
 * Never mutates or overrides analyst-confirmed links.
 */
export async function reevaluateCandidateLinks(
  prisma: any,
  options: { caseId?: string; dryRun?: boolean } = {}
): Promise<ReevaluationSummary> {
  const whereClause: any = {};
  if (options.caseId) {
    whereClause.OR = [
      { sourceCaseId: options.caseId },
      { targetCaseId: options.caseId },
    ];
  }

  const existingLinks = await prisma.entityLink.findMany({
    where: whereClause,
  });

  const summary: ReevaluationSummary = {
    totalEvaluated: existingLinks.length,
    unaffectedCount: 0,
    affectedCount: 0,
    confirmedPreservedCount: 0,
    affectedCandidateLinks: [],
  };

  for (const link of existingLinks) {
    // Analyst-confirmed links are strictly preserved
    if (link.status === "CONFIRMED") {
      summary.confirmedPreservedCount++;
      summary.unaffectedCount++;
      continue;
    }

    // Re-evaluate candidate links with V2 normalization
    const norm = normalizeEntityIdentifier(link.entityType, link.normalizedValue);
    const hasValueDivergence = norm.isValid && norm.normalizedValue !== link.normalizedValue;
    const hasBecomeGenericOrInvalid = !norm.isValid || norm.isGeneric;

    if (hasValueDivergence || hasBecomeGenericOrInvalid) {
      summary.affectedCount++;
      summary.affectedCandidateLinks.push({
        linkId: link.id,
        entityType: link.entityType,
        currentNormalizedValue: link.normalizedValue,
        newNormalizedValue: norm.normalizedValue,
        status: link.status as ReviewStatus,
        reason: !norm.isValid
          ? `Normalization V2 invalid: ${norm.error}`
          : norm.isGeneric
          ? `Normalization V2 detected generic/shared identifier: ${norm.limitations}`
          : `Normalized value changed from '${link.normalizedValue}' to '${norm.normalizedValue}'`,
        requiresReview: true,
      });

      if (options.dryRun === false) {
        await prisma.entityLink.update({
          where: { id: link.id },
          data: {
            limitations: `${link.limitations || ""} [FLAGGED_FOR_REEVALUATION_V2]`.trim(),
          },
        });
      }
    } else {
      summary.unaffectedCount++;
    }
  }

  return summary;
}
