// ─────────────────────────────────────────────────────────────────────────────
// lib/validators.ts — Zod schemas, regex patterns, and entity extractors
// Every schema here is the single source of truth used by both the API
// routes and the extraction service.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

// ─── Forensic Regex Patterns ──────────────────────────────────────────────────

/** UPI Virtual Payment Address: localpart@psp */
export const REGEX_UPI = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;

/** Indian mobile number — normalised to E.164 (+91XXXXXXXXXX) */
export const REGEX_PHONE = /(?:\+91|0)?[6-9]\d{9}/g;

/** IFSC: 4 alpha + '0' + 6 alphanumeric */
export const REGEX_IFSC = /[A-Z]{4}0[A-Z0-9]{6}/g;

/** Domain / URL */
export const REGEX_DOMAIN =
  /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/[^\s]*)?/g;

/** UTR / Transaction reference: 12-digit numeric or 12-22 char alphanumeric */
export const REGEX_UTR = /\b(?:\d{12}|[A-Z0-9]{12,22})\b/g;

/** Standard Email address pattern */
export const REGEX_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** IPv4 address pattern */
export const REGEX_IP_V4 = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

/** 64-char hex SHA-256 */
export const REGEX_SHA256 = /^[a-fA-F0-9]{64}$/;

// ─── Forensic Normalisation Engine (Version 2) ────────────────────────────────

export const PHONE_NORMALIZATION_VERSION = "PHONE_NORM_V2";

export interface PhoneNormalizationDetails {
  isValid: boolean;
  normalizedValue: string;
  countryCode: string | null;
  nationalNumber: string | null;
  extension?: string;
  isGeneric: boolean;
  isAmbiguous: boolean;
  ruleVersion: string;
  limitations?: string;
  error?: string;
}

// Common emergency & cybercrime helplines in India
const INDIAN_HELPLINE_NUMBERS = new Set(["100", "112", "1930", "1090", "1091", "1073", "1098"]);

// Recognized international calling codes (ITU-T E.164)
const KNOWN_COUNTRY_CODES = [
  "971", "972", "974", "966", "965", "968", "880", "977", "92", "93", "94", "95",
  "91", "44", "61", "65", "81", "49", "33", "39", "86", "82", "84", "60", "62", "63",
  "64", "66", "20", "27", "30", "31", "32", "34", "36", "40", "41", "43", "45", "46",
  "47", "48", "51", "52", "53", "54", "55", "56", "57", "58", "1", "7"
];

/**
 * Detailed versioned phone normalization adhering to ITU-T E.164 & Indian TRAI allocations.
 */
export function normalisePhoneDetailed(raw: string): PhoneNormalizationDetails {
  if (!raw || typeof raw !== "string") {
    return {
      isValid: false,
      normalizedValue: "",
      countryCode: null,
      nationalNumber: null,
      isGeneric: false,
      isAmbiguous: false,
      ruleVersion: PHONE_NORMALIZATION_VERSION,
      error: "Empty or non-string phone input",
    };
  }

  const clean = raw.trim();

  // 1. Check emergency / public helpline numbers
  if (INDIAN_HELPLINE_NUMBERS.has(clean)) {
    return {
      isValid: true,
      normalizedValue: clean,
      countryCode: "+91",
      nationalNumber: clean,
      isGeneric: true,
      isAmbiguous: false,
      ruleVersion: PHONE_NORMALIZATION_VERSION,
      limitations: `National emergency/cyber helpline number (${clean}). Shared public infrastructure; non-conclusive identity evidence.`,
    };
  }

  // 2. Extract and isolate extensions (e.g. "ext 123", "x402", "#101")
  let extension: string | undefined;
  let core = clean;
  const extMatch = clean.match(/(?:(?:\s+|^)(?:ext|extension|x|#)\s*([0-9]{1,6})\b)/i);
  if (extMatch) {
    extension = extMatch[1];
    core = clean.slice(0, extMatch.index).trim();
  }

  // 3. Detect leading international direct dialing prefixes
  let hasPlus = core.startsWith("+");
  let working = core;
  if (working.startsWith("00") && working.length > 4 && !/^0+$/.test(working)) {
    hasPlus = true;
    working = working.slice(2).trim();
  } else if (hasPlus) {
    working = working.slice(1).trim();
  }

  const digits = working.replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      normalizedValue: "",
      countryCode: null,
      nationalNumber: null,
      isGeneric: /^0+$/.test(digits) || digits.length === 0,
      isAmbiguous: false,
      ruleVersion: PHONE_NORMALIZATION_VERSION,
      error: `Invalid digit count (${digits.length}). E.164 phone numbers must be between 8 and 15 digits.`,
    };
  }

  // 4. Resolve Country Code and National Number
  let resolvedCountryCode: string | null = null;
  let nationalNumber: string | null = null;
  let isAmbiguous = false;

  if (hasPlus) {
    // Explicit international number: match longest valid country code
    for (const cc of KNOWN_COUNTRY_CODES) {
      if (digits.startsWith(cc) && digits.length > cc.length + 5) {
        resolvedCountryCode = `+${cc}`;
        nationalNumber = digits.slice(cc.length);
        break;
      }
    }

    if (!resolvedCountryCode) {
      // Unknown country code: retain format but flag ambiguous
      resolvedCountryCode = `+${digits.slice(0, 3)}`;
      nationalNumber = digits.slice(3);
      isAmbiguous = true;
    }
  } else {
    // Domestic number without explicit '+' prefix
    if (digits.length === 10 || (digits.length === 11 && (digits.startsWith("1800") || digits.startsWith("1860")))) {
      if (/^[6-9]/.test(digits)) {
        // Standard Indian Mobile (TRAI allocation)
        resolvedCountryCode = "+91";
        nationalNumber = digits;
      } else if (/^[2-5]/.test(digits)) {
        // Indian Landline with 2-4 digit STD code (total 10 digits)
        resolvedCountryCode = "+91";
        nationalNumber = digits;
      } else if (digits.startsWith("1800") || digits.startsWith("1860")) {
        // Indian Toll-Free / Shared-Cost Service (TRAI allocation)
        resolvedCountryCode = "+91";
        nationalNumber = digits;
      } else {
        // Starts with 0 or 1: cannot be assumed as valid Indian mobile
        return {
          isValid: false,
          normalizedValue: "",
          countryCode: null,
          nationalNumber: digits,
          isGeneric: /^0+$/.test(digits),
          isAmbiguous: true,
          ruleVersion: PHONE_NORMALIZATION_VERSION,
          error: "Invalid domestic phone format: Indian mobile numbers must start with digits 6-9.",
        };
      }
    } else if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
      // 0-prefixed Indian mobile
      resolvedCountryCode = "+91";
      nationalNumber = digits.slice(1);
    } else if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
      // 91-prefixed Indian mobile without '+'
      resolvedCountryCode = "+91";
      nationalNumber = digits.slice(2);
    } else {
      // Non-standard length without country code: ambiguous
      return {
        isValid: false,
        normalizedValue: "",
        countryCode: null,
        nationalNumber: digits,
        isGeneric: /^0+$/.test(digits),
        isAmbiguous: true,
        ruleVersion: PHONE_NORMALIZATION_VERSION,
        error: `Ambiguous phone format: ${digits.length} digits without country code.`,
      };
    }
  }

  if (!nationalNumber) {
    return {
      isValid: false,
      normalizedValue: "",
      countryCode: resolvedCountryCode,
      nationalNumber: null,
      isGeneric: false,
      isAmbiguous: true,
      ruleVersion: PHONE_NORMALIZATION_VERSION,
      error: "Unable to resolve valid national significant number.",
    };
  }

  // 5. Check for repeated/sequential dummy numbers
  const isRepeated = /^(\d)\1{7,}$/.test(nationalNumber);
  const isAllZero = /^0+$/.test(nationalNumber);
  const isAscending = "0123456789".includes(nationalNumber);
  const isTollFree = resolvedCountryCode === "+91" && nationalNumber.startsWith("1800");
  const isGeneric = isRepeated || isAllZero || isAscending || isTollFree;

  const limitationsList: string[] = [];
  if (isTollFree) {
    limitationsList.push("Toll-free commercial/shared helpline (1800). Non-conclusive identity evidence.");
  } else if (isRepeated || isAllZero || isAscending) {
    limitationsList.push("Repeated or sequential dummy digits detected. Non-conclusive identity evidence.");
  }
  if (extension) {
    limitationsList.push(`Extension '${extension}' isolated from canonical E.164 number.`);
  }

  const limitations = limitationsList.length > 0 ? limitationsList.join(" ") : undefined;

  const normalizedValue = `${resolvedCountryCode}${nationalNumber}`;

  return {
    isValid: true,
    normalizedValue,
    countryCode: resolvedCountryCode,
    nationalNumber,
    extension,
    isGeneric,
    isAmbiguous,
    ruleVersion: PHONE_NORMALIZATION_VERSION,
    limitations,
  };
}

/**
 * Normalises phone numbers to canonical E.164 format while preserving international country codes.
 * Returns E.164 string (e.g. "+919876543210" or "+14155552671") if valid, or safe fallback.
 */
export function normalisePhone(raw: string): string {
  const details = normalisePhoneDetailed(raw);
  if (details.isValid) {
    return details.normalizedValue;
  }
  // Safe fallback: if raw has digits, format cleanly without corrupting country code
  const cleanDigits = (raw || "").replace(/\D/g, "");
  if (cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) {
    return `+91${cleanDigits}`;
  }
  return details.normalizedValue || raw;
}

/** Normalise UPI VPA to lowercase */
export function normaliseUpi(raw: string): string {
  return raw.toLowerCase().trim();
}

/** Normalise IFSC to uppercase */
export function normaliseIfsc(raw: string): string {
  return raw.toUpperCase().trim();
}

/** Normalise email — lowercase & trim */
export function normaliseEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

/** Normalise domain — extract host only, strip protocol and path */
export function normaliseDomain(raw: string): string {
  const match = raw.match(
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)/
  );
  return (match?.[1] ?? raw).toLowerCase().trim();
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const EvidenceCategorySchema = z.enum([
  "CHAT",
  "UPI_FINANCIAL",
  "CALL_LOG",
  "EMAIL",
  "PHISHING_EMAIL",
  "IDENTITY_DATA",
  "DOCUMENT",
  "CRIME_SCENE_PHOTO",
  "AUDIO",
  "VIDEO",
  "URL_WEB",
  "OTHER",
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;

export const EntityTypeSchema = z.enum([
  "UPI",
  "PHONE",
  "ACCOUNT",
  "IFSC",
  "DOMAIN",
  "UTR",
  "TELEGRAM",
  "EMAIL",
  "NAME",
  "ADDRESS",
  "IP",
  "GPS_COORD",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const VerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "VERIFIED",
  "DISPUTED",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const ExtractedEntitySchema = z.object({
  type: EntityTypeSchema,
  rawValue: z.string().min(1),
  normalizedValue: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceId: z.string().uuid(),
  sourceHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  boundingBox: BoundingBoxSchema.nullable().default(null),
  verificationStatus: VerificationStatusSchema.optional().default("UNVERIFIED"),
  verifiedBy: z.string().nullable().optional(),
});
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;

/** The full validated payload returned from the extraction worker */
export const ExtractedPayloadSchema = z.object({
  evidenceId: z.string().uuid(),
  sourceHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  extractedAt: z.string().datetime(),
  entities: z.array(ExtractedEntitySchema),
  rawTextLength: z.number().int().min(0),
  pipelineVersion: z.string().default("4.0-expanded"),
});
export type ExtractedPayload = z.infer<typeof ExtractedPayloadSchema>;

// ─── Communication Intelligence Schemas ──────────────────────────────────────

export const TranscriptionSegmentSchema = z.object({
  timestamp: z.string(),
  speaker: z.string(),
  originalText: z.string(),
  translatedText: z.string().optional(),
});
export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;

export const ChatMessageSchema = z.object({
  sender: z.string(),
  timestamp: z.string(),
  originalText: z.string(),
  translatedText: z.string().optional(),
  language: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ─── Upload route schemas ──────────────────────────────────────────────────────

export const UploadResponseSchema = z.object({
  evidenceId: z.string().uuid(),
  sha256Hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  verified: z.literal(true),
  storagePath: z.string(),
  evidenceCategory: EvidenceCategorySchema.default("OTHER"),
  uploadedAt: z.string().datetime(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ─── Timeline schemas ──────────────────────────────────────────────────────────

export const ScamPhaseSchema = z.enum([
  "CONTACT",
  "TRUST",
  "PAYMENT",
  "SEVERED",
  "UNKNOWN",
]);
export type ScamPhase = z.infer<typeof ScamPhaseSchema>;

export const RawEventInputSchema = z.object({
  rawTimestamp: z.string(),
  description: z.string(),
  sourceType: z
    .enum(["WHATSAPP", "BANK_SMS", "RECEIPT", "CALL_LOG", "SCREENSHOT"])
    .default("WHATSAPP"),
  evidenceId: z.string().uuid(),
  caseId: z.string().uuid(),
});
export type RawEventInput = z.infer<typeof RawEventInputSchema>;

export const NormalisedTimelineEventSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  timestamp: z.date(),
  isoTimestamp: z.string().datetime(),
  description: z.string(),
  phase: ScamPhaseSchema,
  sourceType: z.string(),
});
export type NormalisedTimelineEvent = z.infer<
  typeof NormalisedTimelineEventSchema
>;

// ─── Graph DTO schemas ────────────────────────────────────────────────────────

export const GraphNodeTypeSchema = z.enum([
  "CURRENT_CASE",
  "LINKED_CASE",
  "ENTITY",
  "PERSON",
  "EVIDENCE",
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const RiskLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: GraphNodeTypeSchema,
  entityType: EntityTypeSchema.nullable().default(null),
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  caseCount: z.number().int().min(0).default(0),
  totalFraudAmount: z.number().min(0).default(0),
  jurisdictions: z.array(z.string()).default([]),
  flags: z.array(z.string()).default([]),
  // Phase 6 enriched explainable properties
  rawValue: z.string().optional(),
  normalizedValue: z.string().optional(),
  firstSeen: z.string().optional(),
  lastSeen: z.string().optional(),
  evidenceCount: z.number().int().optional(),
  role: z.string().optional(),
  incidentType: z.string().optional(),
  status: z.string().optional(),
  title: z.string().optional(),
  linkedCases: z.array(z.any()).optional(),
  relatedEntities: z.array(z.any()).optional(),
  associatedPersons: z.array(z.string()).optional(),
  context: z.string().optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  weight: z.number().min(0).max(1).default(1),
  animated: z.boolean().default(false),
  // Phase 6 explainable relationship properties
  relationshipType: z.string().optional(),
  sharedEntity: z.string().optional(),
  supportingEvidenceCount: z.number().int().optional(),
  supportingEvidenceIds: z.array(z.string()).optional(),
  caseIds: z.array(z.string()).optional(),
  firstSeen: z.string().optional(),
  lastSeen: z.string().optional(),
  explanation: z.string().optional(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphIntelligenceResponseSchema = z.object({
  caseId: z.string(),
  generatedAt: z.string().datetime(),
  syndicateDetected: z.boolean(),
  riskLevel: RiskLevelSchema,
  totalFraudAmountLinked: z.number(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  summary: z.object({
    linkedCaseCount: z.number().int(),
    sharedEntityCount: z.number().int(),
    highFrequencyMules: z.array(z.string()),
    jurisdictionsAffected: z.array(z.string()),
    highRiskEntityCount: z.number().int().optional(),
    totalFraudAmount: z.number().optional(),
    jurisdictionCount: z.number().int().optional(),
  }),
});
export type GraphIntelligenceResponse = z.infer<
  typeof GraphIntelligenceResponseSchema
>;
