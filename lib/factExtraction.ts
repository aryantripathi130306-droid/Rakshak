// ─────────────────────────────────────────────────────────────────────────────
// lib/factExtraction.ts
// RAKSHAK v3.0 — Phase 39: Deterministic Candidate Fact Extraction Layer
//
// Extracts structured candidate facts from OCR/text artifacts.
// Preserves character offsets, page coordinates, normalization rules,
// and epistemic limits. Candidate facts are NEVER treated as confirmed
// conclusions or proof of wrongdoing.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import prisma from "./prisma.ts";
import {
  REGEX_UPI,
  REGEX_PHONE,
  REGEX_IFSC,
  REGEX_DOMAIN,
  REGEX_UTR,
  REGEX_EMAIL,
  REGEX_IP_V4,
  normalisePhone,
  normaliseUpi,
  normaliseIfsc,
  normaliseEmail,
  normaliseDomain,
} from "./validators.ts";

export const FACT_EXTRACTION_RULE_VERSION = "2.0.0";

export interface CandidateFactHit {
  id: string;
  artifactId: string;
  evidenceId: string;
  caseId: string;
  entityType: string;
  rawValue: string;
  normalizedValue: string;
  confidence: number;
  sourceHash: string;
  pageNumber: number;
  charOffset: number;
  extractionRule: string;
  ruleVersion: string;
  reviewStatus: "PENDING_REVIEW" | "ACCEPTED" | "CORRECTED" | "REJECTED" | "SUPERSEDED";
  limitations?: string | null;
  boundingBox?: any;
}

// Regex for Dates: YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
export const REGEX_DATE = /\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/g;

// Regex for Bank Account: 9 to 18 digits (isolated)
export const REGEX_ACCOUNT = /\b[0-9]{9,18}\b/g;

// Regex for Cryptographic Hashes: SHA-256 (64 hex) or MD5 (32 hex)
export const REGEX_HASH = /\b([a-fA-F0-9]{64}|[a-fA-F0-9]{32})\b/g;

/**
 * Robustly normalizes phone numbers to E.164 (+91XXXXXXXXXX)
 */
export function normalisePhoneNumber(raw: string): string {
  return normalisePhone(raw);
}

/**
 * Normalizes date to ISO YYYY-MM-DD format if possible.
 */
export function normaliseDate(raw: string): string {
  const clean = raw.trim().replace(/[/]/g, "-");
  const parts = clean.split("-");
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    return clean;
  }
  if (parts[2]?.length === 4) {
    // DD-MM-YYYY -> YYYY-MM-DD
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return clean;
}

/**
 * Extract candidate facts from raw text and bind to an extracted text artifact.
 */
export function extractCandidateFactsFromText(
  text: string,
  artifactId: string,
  evidenceId: string,
  caseId: string,
  sourceHash: string,
  words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>
): CandidateFactHit[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const hits: CandidateFactHit[] = [];

  // Helper to find matching bounding box from words
  const findBBox = (raw: string) => {
    if (!words || words.length === 0) return null;
    const cleanRaw = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = words.find((w) => {
      const cw = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      return cw.length >= 3 && (cw.includes(cleanRaw) || cleanRaw.includes(cw));
    });
    if (match) {
      return {
        x: match.bbox.x0,
        y: match.bbox.y0,
        width: Math.max(match.bbox.x1 - match.bbox.x0, 20),
        height: Math.max(match.bbox.y1 - match.bbox.y0, 14),
      };
    }
    return null;
  };

  // 1. UPI VPA
  for (const match of text.matchAll(new RegExp(REGEX_UPI.source, "g"))) {
    const raw = match[0];
    if (/\.(com|org|net|in|co|gov|edu)$/i.test(raw.split("@")[1])) continue;
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "UPI",
      rawValue: raw,
      normalizedValue: normaliseUpi(raw),
      confidence: 0.98,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_UPI",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 2. Phone Numbers
  for (const match of text.matchAll(new RegExp(REGEX_PHONE.source, "g"))) {
    const raw = match[0];
    const norm = normalisePhoneNumber(raw);
    if (!/^\+91[6-9]\d{9}$/.test(norm)) continue;
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "PHONE",
      rawValue: raw,
      normalizedValue: norm,
      confidence: 0.98,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_PHONE",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 3. Email Identifiers
  for (const match of text.matchAll(new RegExp(REGEX_EMAIL.source, "g"))) {
    const raw = match[0];
    const norm = normaliseEmail(raw);
    if (/^(noreply|no-reply|donotreply|bounce|mailer-daemon)@/i.test(norm)) continue;
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "EMAIL",
      rawValue: raw,
      normalizedValue: norm,
      confidence: 0.95,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_EMAIL",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 4. IFSC Codes
  for (const match of text.matchAll(new RegExp(REGEX_IFSC.source, "g"))) {
    const raw = match[0];
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "IFSC",
      rawValue: raw,
      normalizedValue: normaliseIfsc(raw),
      confidence: 0.99,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_IFSC",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 5. UTR / Transaction References
  for (const match of text.matchAll(new RegExp(REGEX_UTR.source, "g"))) {
    const raw = match[0];
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "UTR",
      rawValue: raw,
      normalizedValue: raw.toUpperCase(),
      confidence: 0.95,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_UTR",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 6. IP Addresses (with private range / loopback limitation detection)
  for (const match of text.matchAll(new RegExp(REGEX_IP_V4.source, "g"))) {
    const raw = match[0].trim();
    const isPrivate = /^(127\.|0\.|255\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(raw);
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "IP",
      rawValue: raw,
      normalizedValue: raw,
      confidence: isPrivate ? 0.6 : 0.85,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_IPV4",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      limitations: isPrivate
        ? "Private or loopback IP range: non-unique and not conclusively attributable to a single external entity."
        : null,
      boundingBox: findBBox(raw),
    });
  }

  // 7. Domain Names (with generic service limitation detection)
  for (const match of text.matchAll(new RegExp(REGEX_DOMAIN.source, "g"))) {
    const raw = match[0];
    const norm = normaliseDomain(raw);
    const isGeneric = /^(google|facebook|twitter|instagram|youtube|whatsapp|telegram|github|microsoft|apple)\.\w+$/.test(
      norm
    );
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "DOMAIN",
      rawValue: raw,
      normalizedValue: norm,
      confidence: isGeneric ? 0.5 : 0.88,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_DOMAIN",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      limitations: isGeneric
        ? "Generic public platform domain: not uniquely attributable to suspect infrastructure."
        : null,
      boundingBox: findBBox(raw),
    });
  }

  // 8. Dates
  for (const match of text.matchAll(new RegExp(REGEX_DATE.source, "g"))) {
    const raw = match[0];
    const norm = normaliseDate(raw);
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "DATE",
      rawValue: raw,
      normalizedValue: norm,
      confidence: 0.9,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_DATE",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  // 9. Cryptographic Hashes (SHA-256 or MD5)
  for (const match of text.matchAll(new RegExp(REGEX_HASH.source, "g"))) {
    const raw = match[0].toLowerCase();
    // Exclude sourceHash itself to prevent self-referential clutter
    if (raw === sourceHash.toLowerCase()) continue;
    hits.push({
      id: crypto.randomUUID(),
      artifactId,
      evidenceId,
      caseId,
      entityType: "HASH",
      rawValue: raw,
      normalizedValue: raw,
      confidence: 0.99,
      sourceHash,
      pageNumber: 1,
      charOffset: match.index ?? 0,
      extractionRule: "REGEX_V2_CRYPTO_HASH",
      ruleVersion: FACT_EXTRACTION_RULE_VERSION,
      reviewStatus: "PENDING_REVIEW",
      boundingBox: findBBox(raw),
    });
  }

  return hits;
}

/**
 * Persists candidate facts to the database idempotently, avoiding duplicate facts
 * from repeated processing runs.
 */
export async function persistCandidateFactsAsync(
  candidateFacts: CandidateFactHit[],
  prismaClient: any = prisma
): Promise<number> {
  const p = prismaClient as any;
  let insertedCount = 0;

  for (const fact of candidateFacts) {
    // Check if identical fact already exists for this evidence exhibit
    const existing = await p.extractedFact.findFirst({
      where: {
        evidenceId: fact.evidenceId,
        entityType: fact.entityType,
        normalizedValue: fact.normalizedValue,
      },
    });

    if (existing) {
      // If already exists and has been reviewed, preserve the human review status!
      continue;
    }

    await p.extractedFact.create({
      data: {
        id: fact.id,
        evidenceId: fact.evidenceId,
        caseId: fact.caseId,
        factAssertion: `${fact.entityType} candidate identifier extracted via ${fact.extractionRule} v${fact.ruleVersion}: ${fact.normalizedValue}`,
        entityType: fact.entityType,
        rawValue: fact.rawValue,
        normalizedValue: fact.normalizedValue,
        confidence: fact.confidence,
        sourceHash: fact.sourceHash,
        verificationStatus: "UNVERIFIED",
        verifiedBy: null,
        boundingBox: fact.boundingBox ? JSON.stringify(fact.boundingBox) : null,
        artifactId: fact.artifactId,
        pageNumber: fact.pageNumber,
        charOffset: fact.charOffset,
        extractionRule: fact.extractionRule,
        ruleVersion: fact.ruleVersion,
        reviewStatus: "PENDING_REVIEW",
        limitations: fact.limitations || null,
      },
    });

    insertedCount++;
  }

  return insertedCount;
}
