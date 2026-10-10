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

// ─── Normalisation helpers ────────────────────────────────────────────────────

/** Normalise Indian phone to E.164 format: +91XXXXXXXXXX */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/^\+91/, "").replace(/^0/, "");
  return `+91${digits}`;
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
