// ─────────────────────────────────────────────────────────────────────────────
// services/extractionService.ts
// Deterministic forensic entity extraction pipeline.
// Phase 1 is always hard-regex (confidence=0.95-1.0). Phase 2 is contextual NER
// (mocked here at 0.85–0.95 confidence). Every extracted entity is bound to
// its source evidenceId and the source hash.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
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
  type ExtractedEntity,
  type ExtractedPayload,
  type BoundingBox,
  ExtractedPayloadSchema,
} from "@/lib/validators";

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawHit {
  type: ExtractedEntity["type"];
  rawValue: string;
  normalizedValue: string;
  confidence: number;
  charOffset: number; // byte offset inside the source text
  verificationStatus?: "UNVERIFIED" | "VERIFIED" | "DISPUTED";
}

// ─── Deterministic regex phase ────────────────────────────────────────────────

function runRegexPhase(text: string): RawHit[] {
  const hits: RawHit[] = [];

  // UPI VPA — confidence 1.0
  for (const match of text.matchAll(new RegExp(REGEX_UPI.source, "g"))) {
    const raw = match[0];
    // Skip e-mail-like strings that have common TLDs (gmail, yahoo, etc.)
    if (/\.(com|org|net|in|co|gov|edu)$/i.test(raw.split("@")[1])) continue;
    hits.push({
      type: "UPI",
      rawValue: raw,
      normalizedValue: normaliseUpi(raw),
      confidence: 1.0,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // Phone — confidence 1.0
  for (const match of text.matchAll(new RegExp(REGEX_PHONE.source, "g"))) {
    const raw = match[0];
    const normalised = normalisePhone(raw);
    // Only Indian mobile range: 6–9 prefix after +91
    if (!/^\+91[6-9]\d{9}$/.test(normalised)) continue;
    hits.push({
      type: "PHONE",
      rawValue: raw,
      normalizedValue: normalised,
      confidence: 1.0,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // Email — confidence 0.95
  for (const match of text.matchAll(new RegExp(REGEX_EMAIL.source, "g"))) {
    const raw = match[0];
    const lower = raw.toLowerCase();
    // Skip standard system / bounce accounts
    if (/^(noreply|no-reply|donotreply|bounce|mailer-daemon)@/i.test(lower)) continue;
    hits.push({
      type: "EMAIL",
      rawValue: raw,
      normalizedValue: normaliseEmail(raw),
      confidence: 0.95,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // IPv4 Address — confidence 0.85
  for (const match of text.matchAll(new RegExp(REGEX_IP_V4.source, "g"))) {
    const raw = match[0];
    // Skip loopback, broadcast, or private class addresses if desired
    if (/^(127\.|0\.|255\.|10\.|192\.168\.)/.test(raw)) continue;
    hits.push({
      type: "IP",
      rawValue: raw,
      normalizedValue: raw.trim(),
      confidence: 0.85,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // IFSC — confidence 1.0
  for (const match of text.matchAll(new RegExp(REGEX_IFSC.source, "g"))) {
    hits.push({
      type: "IFSC",
      rawValue: match[0],
      normalizedValue: normaliseIfsc(match[0]),
      confidence: 1.0,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // UTR / Transaction reference — confidence 0.95
  for (const match of text.matchAll(new RegExp(REGEX_UTR.source, "g"))) {
    hits.push({
      type: "UTR",
      rawValue: match[0],
      normalizedValue: match[0].toUpperCase(),
      confidence: 0.95,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // Domain / URL — confidence 0.9 (contextual — domains are noisy)
  const domainSeen = new Set<string>();
  for (const match of text.matchAll(new RegExp(REGEX_DOMAIN.source, "g"))) {
    const raw = match[0];
    const normalised = normaliseDomain(raw);
    // Skip generic public domains
    if (
      /^(google|facebook|twitter|instagram|youtube|whatsapp|telegram)\.\w+$/.test(
        normalised
      )
    )
      continue;
    if (domainSeen.has(normalised)) continue;
    domainSeen.add(normalised);
    hits.push({
      type: "DOMAIN",
      rawValue: raw,
      normalizedValue: normalised,
      confidence: 0.9,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  return hits;
}

// ─── Contextual NER phase (mocked / heuristics) ──────────────────────────────

function runContextualPhase(text: string): RawHit[] {
  const hits: RawHit[] = [];

  // Detect Telegram handles: @word_word patterns not captured by other regexes
  const telegramRe = /@[a-zA-Z][a-zA-Z0-9_]{4,31}/g;
  for (const match of text.matchAll(telegramRe)) {
    hits.push({
      type: "TELEGRAM",
      rawValue: match[0],
      normalizedValue: match[0].toLowerCase(),
      confidence: 0.88,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // Detect raw bank account numbers: 9–18 digit strings near "account" keyword
  const accountContextRe =
    /(?:account|acc|a\/c)[^\d]{0,10}(\d{9,18})/gi;
  for (const match of text.matchAll(accountContextRe)) {
    hits.push({
      type: "ACCOUNT",
      rawValue: match[1],
      normalizedValue: match[1],
      confidence: 0.87,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  // Detect suspect identity names (heuristics for identity documents)
  const nameContextRe = /(?:name|holder|suspect|beneficiary)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi;
  for (const match of text.matchAll(nameContextRe)) {
    const rawName = match[1].trim();
    if (rawName.length > 3 && rawName.length < 50) {
      hits.push({
        type: "NAME",
        rawValue: rawName,
        normalizedValue: rawName.toUpperCase(),
        confidence: 0.78,
        charOffset: match.index ?? 0,
        verificationStatus: "UNVERIFIED",
      });
    }
  }

  // Detect GPS coordinates: e.g. 30.7333° N, 76.7794° E or Lat: 30.7333 Long: 76.7794
  const gpsRe = /(?:lat|gps|location)?[:\s]*([-+]?\d{1,2}\.\d{4,8})[\s,]+([-+]?\d{1,3}\.\d{4,8})/gi;
  for (const match of text.matchAll(gpsRe)) {
    const lat = match[1];
    const lng = match[2];
    const raw = `${lat}, ${lng}`;
    hits.push({
      type: "GPS_COORD",
      rawValue: raw,
      normalizedValue: `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`,
      confidence: 0.92,
      charOffset: match.index ?? 0,
      verificationStatus: "VERIFIED",
    });
  }

  return hits;
}

// ─── Mock bounding box generator (real OCR would return these) ───────────────

function mockBoundingBox(charOffset: number, textLength: number): BoundingBox {
  const lineHeight = 22;
  const charsPerLine = 80;
  const lineIndex = Math.floor(charOffset / charsPerLine);
  const colIndex = charOffset % charsPerLine;
  return {
    x: colIndex * 6,
    y: lineIndex * lineHeight + 10,
    width: Math.min(textLength * 6, 300),
    height: lineHeight,
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateHits(hits: RawHit[]): RawHit[] {
  const seen = new Map<string, RawHit>();
  for (const hit of hits) {
    const key = `${hit.type}::${hit.normalizedValue}`;
    const existing = seen.get(key);
    // Keep the hit with the highest confidence
    if (!existing || hit.confidence > existing.confidence) {
      seen.set(key, hit);
    }
  }
  return Array.from(seen.values());
}

// ─── Category Specific Metadata Extractors ───────────────────────────────────

export interface EmailMetadata {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  replyTo?: string;
  spfResult?: string;
  dmarcResult?: string;
  phishingIndicators?: string[];
  linksFound?: string[];
}

export function extractEmailMetadata(text: string): EmailMetadata {
  const meta: EmailMetadata = {
    phishingIndicators: [],
    linksFound: [],
  };

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const fromMatch = line.match(/^From:\s*(.+)$/i);
    if (fromMatch) meta.from = fromMatch[1].trim();

    const toMatch = line.match(/^To:\s*(.+)$/i);
    if (toMatch) meta.to = toMatch[1].trim();

    const subMatch = line.match(/^Subject:\s*(.+)$/i);
    if (subMatch) meta.subject = subMatch[1].trim();

    const dateMatch = line.match(/^Date:\s*(.+)$/i);
    if (dateMatch) meta.date = dateMatch[1].trim();

    const replyMatch = line.match(/^Reply-To:\s*(.+)$/i);
    if (replyMatch) meta.replyTo = replyMatch[1].trim();
  }

  // Extract embedded links
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    meta.linksFound?.push(m[0]);
  }

  // Phishing indicators
  if (meta.from && meta.replyTo && meta.from !== meta.replyTo) {
    meta.phishingIndicators?.push("Mismatch between From header and Reply-To header");
  }
  if (meta.subject && /(urgent|verify|suspended|lottery|winner|bank alert|kyc update)/i.test(meta.subject)) {
    meta.phishingIndicators?.push("Urgency or fear-inducing keywords in subject line");
  }
  if (meta.linksFound && meta.linksFound.some(l => /verify|login|secure|portal|reward/i.test(l))) {
    meta.phishingIndicators?.push("Deceptive domain structure detected in hyperlink anchors");
  }

  return meta;
}

export interface ImageMetadata {
  dimensions?: { width: number; height: number };
  colorSpace?: string;
  deviceMake?: string;
  deviceModel?: string;
  gpsCoordinates?: { latitude: number; longitude: number; altitudeMeters?: number };
  timestamp?: string;
  aiObservations?: string[];
}

export function extractImageMetadata(buffer: Buffer, mimeType: string): ImageMetadata {
  // Simulated forensic header inspection (EXIF / JFIF metadata parsing)
  return {
    dimensions: { width: 1920, height: 1080 },
    colorSpace: "sRGB",
    deviceMake: "HIKVISION / CCTV-DOME",
    deviceModel: "DS-2CD2143G0-I",
    gpsCoordinates: {
      latitude: 30.7333,
      longitude: 76.7794,
      altitudeMeters: 312,
    },
    timestamp: new Date().toISOString(),
    aiObservations: [
      "Subject observed at ATM terminal counter at 14:18:50 UTC",
      "Face covered with surgical mask and dark cap",
      "Apparent physical handover of transaction card noted",
    ],
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the full deterministic extraction pipeline on a raw text string.
 * This function is pure — it takes text in, returns a validated payload out.
 */
export async function extractEntities(
  text: string,
  evidenceId: string,
  sourceHash: string
): Promise<ExtractedPayload> {
  if (!text || text.trim().length === 0) {
    return ExtractedPayloadSchema.parse({
      evidenceId,
      sourceHash,
      extractedAt: new Date().toISOString(),
      entities: [],
      rawTextLength: 0,
      pipelineVersion: "4.0-expanded",
    });
  }

  const regexHits = runRegexPhase(text);
  const contextHits = runContextualPhase(text);
  const allHits = deduplicateHits([...regexHits, ...contextHits]);

  const entities: ExtractedEntity[] = allHits.map((hit) => ({
    type: hit.type,
    rawValue: hit.rawValue,
    normalizedValue: hit.normalizedValue,
    confidence: hit.confidence,
    evidenceId,
    sourceHash,
    boundingBox: mockBoundingBox(hit.charOffset, hit.rawValue.length),
    verificationStatus: hit.verificationStatus ?? "UNVERIFIED",
    verifiedBy: hit.verificationStatus === "VERIFIED" ? "SYSTEM_RULE_ENGINE" : null,
  }));

  const payload: ExtractedPayload = ExtractedPayloadSchema.parse({
    evidenceId,
    sourceHash,
    extractedAt: new Date().toISOString(),
    entities,
    rawTextLength: text.length,
    pipelineVersion: "4.0-expanded",
  });

  return payload;
}

/**
 * Convert a raw file Buffer to text for extraction.
 * For plain text / json / eml: UTF-8 decode.
 * For binary/image/PDF: returns Latin-1 for ASCII string discovery.
 */
export function bufferToText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): string {
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "message/rfc822" ||
    fileName?.endsWith(".eml") ||
    fileName?.endsWith(".txt")
  ) {
    return buffer.toString("utf8");
  }
  return buffer.toString("latin1");
}
