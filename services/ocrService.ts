// ─────────────────────────────────────────────────────────────────────────────
// services/ocrService.ts
// Forensic OCR & Document Text Extraction Engine for Rakshak v3.0
//
// Operates strictly on-premises without external network transmission.
// Supports:
//   1. Raster images (PNG, JPEG, WEBP, BMP) via Tesseract.js (eng)
//   2. Scanned / Digital PDF documents via pdf-parse
//   3. Structured text (TXT, CSV, EML, JSON) via UTF-8 parsing
//
// Preserves raw evidence files, tracks SHA-256 digests, and captures
// word-level bounding boxes and confidence metrics for court admissibility.
// ─────────────────────────────────────────────────────────────────────────────

import path from "path";
import fs from "fs/promises";
import Tesseract from "tesseract.js";
import prisma from "@/lib/prisma";
import { extractEntities } from "@/services/extractionService";
import { type ExtractedEntity } from "@/lib/validators";

class PolyfillDOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  translate() { return this; }
  scale() { return this; }
  preMultiplySelf() { return this; }
  invertSelf() { return this; }
  multiplySelf() { return this; }
}
class PolyfillImageData {}
class PolyfillPath2D { addPath() {} }

// Safe Node.js environment polyfills required by pdf-parse v2 in Next.js/Turbopack runtime
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = PolyfillDOMMatrix;
}
if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = PolyfillImageData;
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = PolyfillPath2D;
}

import { createRequire } from "module";
const nodeRequire = createRequire(process.cwd() + "/package.json");

// Helper function to lazy-load pdf-parse v2 in Next.js runtime
function getPdfParser(): any {
  try {
    if (!(globalThis as any).pdfjsWorker) {
      try {
        const worker = nodeRequire("./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs");
        (globalThis as any).pdfjsWorker = worker;
      } catch (e) {
        console.warn("[OcrService] Could not preload pdf.worker.mjs via nodeRequire:", e);
      }
    }
    return nodeRequire("pdf-parse");
  } catch (err) {
    console.error("[OcrService] Error requiring pdf-parse:", err);
    return null;
  }
}

export interface OcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export type OcrStatus = "SUCCESS" | "EMPTY" | "UNSUPPORTED" | "FAILED";

export interface OcrResult {
  status: OcrStatus;
  engine: "TESSERACT_OCR_V5" | "PDF_PARSE_V1" | "TEXT_PARSER" | "NONE";
  engineVersion: string;
  evidenceId: string;
  sourceHash: string;
  mimeType: string;
  fileName?: string;
  rawText: string;
  confidence: number; // 0 to 100
  charCount: number;
  lineCount: number;
  pageCount?: number;
  processingTimeMs: number;
  words?: OcrWord[];
  error?: string;
  extractedAt: string;
}

export interface OcrExtractionPayload {
  ocr: OcrResult;
  entities: ExtractedEntity[];
}

// Limits for safety & resource protection
const MAX_OCR_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const OCR_TIMEOUT_MS = 45_000; // 45 seconds

/**
 * Determine engine suitability from MIME type & filename
 */
export function getExtractionEngineType(mimeType: string, fileName?: string): "IMAGE" | "PDF" | "TEXT" | "UNSUPPORTED" {
  const lowerName = (fileName || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (
    lowerMime.startsWith("image/") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".bmp") ||
    lowerName.endsWith(".tiff")
  ) {
    return "IMAGE";
  }

  if (lowerMime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "PDF";
  }

  if (
    lowerMime.startsWith("text/") ||
    lowerMime === "application/json" ||
    lowerMime === "message/rfc822" ||
    lowerName.endsWith(".eml") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".log") ||
    lowerName.endsWith(".md")
  ) {
    return "TEXT";
  }

  return "UNSUPPORTED";
}

/**
 * Perform OCR on an image buffer using Tesseract
 */
async function processImageOcr(
  buffer: Buffer,
  evidenceId: string,
  sourceHash: string,
  mimeType: string,
  fileName?: string
): Promise<OcrResult> {
  const startTime = Date.now();

  try {
    const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
    const ocrPromise = Tesseract.recognize(buffer, "eng", {
      workerPath,
      errorHandler: (err) => console.warn("[Tesseract Worker]", err),
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`OCR processing timed out after ${OCR_TIMEOUT_MS / 1000}s`)), OCR_TIMEOUT_MS);
    });

    const res: any = await Promise.race([ocrPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    const rawText = (res.data?.text || "").trim();
    const confidence = Math.round(res.data?.confidence || 0);

    // Collect word bounding boxes
    const words: OcrWord[] = [];
    if (Array.isArray(res.data?.words)) {
      for (const w of res.data.words) {
        if (w.text && w.bbox) {
          words.push({
            text: w.text,
            confidence: Math.round(w.confidence || 0),
            bbox: {
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
            },
          });
        }
      }
    }

    const lines = rawText.length > 0 ? rawText.split(/\r?\n/).filter((l: string) => l.trim().length > 0) : [];
    const status: OcrStatus = rawText.length === 0 ? "EMPTY" : "SUCCESS";

    return {
      status,
      engine: "TESSERACT_OCR_V5",
      engineVersion: "5.1.1",
      evidenceId,
      sourceHash,
      mimeType,
      fileName,
      rawText,
      confidence,
      charCount: rawText.length,
      lineCount: lines.length,
      pageCount: 1,
      processingTimeMs: duration,
      words: words.slice(0, 500), // Cap word boxes to prevent giant JSON blobs
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: "FAILED",
      engine: "TESSERACT_OCR_V5",
      engineVersion: "5.1.1",
      evidenceId,
      sourceHash,
      mimeType,
      fileName,
      rawText: "",
      confidence: 0,
      charCount: 0,
      lineCount: 0,
      processingTimeMs: duration,
      error: err instanceof Error ? err.message : String(err),
      extractedAt: new Date().toISOString(),
    };
  }
}

/**
 * Extract text from PDF document using pdf-parse
 */
async function processPdfExtraction(
  buffer: Buffer,
  evidenceId: string,
  sourceHash: string,
  mimeType: string,
  fileName?: string
): Promise<OcrResult> {
  const startTime = Date.now();
  try {
    const pdfParse = getPdfParser();
    if (!pdfParse) {
      throw new Error("PDF parser engine failed to initialize");
    }

    let rawText = "";
    let pageCount = 1;

    if (pdfParse.PDFParse) {
      // pdf-parse v2 API
      const parser = new pdfParse.PDFParse({ data: buffer });
      const parsed = await parser.getText();
      rawText = (parsed.text || "").trim();
      pageCount = parsed.total || (Array.isArray(parsed.pages) ? parsed.pages.length : 1);
    } else if (typeof pdfParse === "function") {
      // pdf-parse v1 API
      const parsed = await pdfParse(buffer, { max: 50 });
      rawText = (parsed.text || "").trim();
      pageCount = parsed.numpages || 1;
    } else if (pdfParse.default && typeof pdfParse.default === "function") {
      const parsed = await pdfParse.default(buffer, { max: 50 });
      rawText = (parsed.text || "").trim();
      pageCount = parsed.numpages || 1;
    } else {
      throw new Error("Compatible PDF parser engine not found in pdf-parse module");
    }

    const duration = Date.now() - startTime;
    const lines = rawText.length > 0 ? rawText.split(/\r?\n/).filter((l: string) => l.trim().length > 0) : [];
    const status: OcrStatus = rawText.length === 0 ? "EMPTY" : "SUCCESS";

    return {
      status,
      engine: "PDF_PARSE_V1",
      engineVersion: "2.4.5",
      evidenceId,
      sourceHash,
      mimeType,
      fileName,
      rawText,
      confidence: rawText.length > 0 ? 98 : 0, // Direct digital extraction has high fidelity
      charCount: rawText.length,
      lineCount: lines.length,
      pageCount,
      processingTimeMs: duration,
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: "FAILED",
      engine: "PDF_PARSE_V1",
      engineVersion: "1.1.1",
      evidenceId,
      sourceHash,
      mimeType,
      fileName,
      rawText: "",
      confidence: 0,
      charCount: 0,
      lineCount: 0,
      processingTimeMs: duration,
      error: err instanceof Error ? err.message : String(err),
      extractedAt: new Date().toISOString(),
    };
  }
}

/**
 * Parse text from plain text formats (TXT, CSV, EML, JSON)
 */
function processTextExtraction(
  buffer: Buffer,
  evidenceId: string,
  sourceHash: string,
  mimeType: string,
  fileName?: string
): OcrResult {
  const startTime = Date.now();
  const rawText = buffer.toString("utf8").trim();
  const duration = Date.now() - startTime;
  const lines = rawText.length > 0 ? rawText.split(/\r?\n/).filter((l: string) => l.trim().length > 0) : [];

  return {
    status: rawText.length > 0 ? "SUCCESS" : "EMPTY",
    engine: "TEXT_PARSER",
    engineVersion: "1.0.0",
    evidenceId,
    sourceHash,
    mimeType,
    fileName,
    rawText,
    confidence: 100,
    charCount: rawText.length,
    lineCount: lines.length,
    pageCount: 1,
    processingTimeMs: duration,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Core text & OCR extraction entry point.
 * Given evidence metadata and a buffer, routes to the appropriate engine.
 */
export async function performForensicTextExtraction(
  buffer: Buffer,
  evidenceId: string,
  sourceHash: string,
  mimeType: string,
  fileName?: string
): Promise<OcrResult> {
  // Guard against oversized inputs
  if (buffer.length > MAX_OCR_FILE_SIZE) {
    return {
      status: "FAILED",
      engine: "NONE",
      engineVersion: "1.0",
      evidenceId,
      sourceHash,
      mimeType,
      fileName,
      rawText: "",
      confidence: 0,
      charCount: 0,
      lineCount: 0,
      processingTimeMs: 0,
      error: `Evidence file exceeds maximum OCR processing size limit of ${MAX_OCR_FILE_SIZE / (1024 * 1024)}MB (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`,
      extractedAt: new Date().toISOString(),
    };
  }

  const engineType = getExtractionEngineType(mimeType, fileName);

  switch (engineType) {
    case "IMAGE":
      return await processImageOcr(buffer, evidenceId, sourceHash, mimeType, fileName);

    case "PDF":
      return await processPdfExtraction(buffer, evidenceId, sourceHash, mimeType, fileName);

    case "TEXT":
      return processTextExtraction(buffer, evidenceId, sourceHash, mimeType, fileName);

    case "UNSUPPORTED":
    default:
      return {
        status: "UNSUPPORTED",
        engine: "NONE",
        engineVersion: "1.0",
        evidenceId,
        sourceHash,
        mimeType,
        fileName,
        rawText: "",
        confidence: 0,
        charCount: 0,
        lineCount: 0,
        processingTimeMs: 0,
        error: `MIME type '${mimeType}' does not support text/OCR extraction.`,
        extractedAt: new Date().toISOString(),
      };
  }
}

/**
 * Match extracted entity values back to OCR word bounding boxes.
 */
function anchorEntitiesToBoundingBoxes(entities: ExtractedEntity[], words?: OcrWord[]): ExtractedEntity[] {
  if (!words || words.length === 0) return entities;

  return entities.map((ent) => {
    // If the entity already has an anchor, preserve it
    const normalizedTarget = ent.rawValue.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Look for matching word in OCR words
    const matchedWord = words.find((w) => {
      const cleanWord = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      return cleanWord.includes(normalizedTarget) || normalizedTarget.includes(cleanWord);
    });

    if (matchedWord) {
      return {
        ...ent,
        boundingBox: {
          x: matchedWord.bbox.x0,
          y: matchedWord.bbox.y0,
          width: Math.max(matchedWord.bbox.x1 - matchedWord.bbox.x0, 20),
          height: Math.max(matchedWord.bbox.y1 - matchedWord.bbox.y0, 14),
        },
      };
    }

    return ent;
  });
}

/**
 * Full Pipeline:
 * 1. Extract raw text / run OCR on evidence buffer.
 * 2. Run deterministic entity extraction on resulting text.
 * 3. Anchor entities to coordinates if OCR provided words.
 * 4. Persist ExtractedFact rows and CaseEntity records.
 * 5. Update Evidence.metadata with OCR telemetry.
 * 6. Record Chain of Custody event.
 */
export async function executeOcrAndEntityExtraction(
  evidenceId: string,
  caseId: string,
  buffer?: Buffer
): Promise<OcrExtractionPayload> {
  const p = prisma as any;

  // 1. Fetch evidence record
  const evidence = await p.evidence.findFirst({
    where: { id: evidenceId },
  });

  if (!evidence) {
    throw new Error(`Evidence record ${evidenceId} not found`);
  }

  // 2. Fetch raw buffer from cold storage if not passed
  let fileBuffer = buffer;
  if (!fileBuffer) {
    const storagePath = path.join(process.cwd(), "uploads", "raw", `${evidence.sha256Hash}.bin`);
    fileBuffer = await fs.readFile(storagePath);
  }

  // 3. Perform OCR / text extraction
  const ocr = await performForensicTextExtraction(
    fileBuffer,
    evidence.id,
    evidence.sha256Hash,
    evidence.mimeType,
    evidence.fileName
  );

  // 4. Run deterministic entity extraction if text was retrieved
  let rawEntities: ExtractedEntity[] = [];
  if (ocr.status === "SUCCESS" && ocr.rawText.length > 0) {
    const payload = await extractEntities(ocr.rawText, evidence.id, evidence.sha256Hash);
    rawEntities = payload.entities;
  }

  // 5. Anchor entities with truthful bounding boxes
  const entities = anchorEntitiesToBoundingBoxes(rawEntities, ocr.words);

  // 6. Delete old ExtractedFact rows for clean re-extraction
  await p.extractedFact.deleteMany({
    where: { evidenceId: evidence.id },
  });

  // 7. Insert new ExtractedFact rows
  if (entities.length > 0) {
    await p.extractedFact.createMany({
      data: entities.map((ent) => ({
        evidenceId: evidence.id,
        caseId,
        factAssertion: `${ent.type} identifier extracted via ${ocr.engine}: ${ent.normalizedValue}`,
        entityType: ent.type,
        rawValue: ent.rawValue,
        normalizedValue: ent.normalizedValue,
        confidence: Math.min(ent.confidence, (ocr.confidence || 90) / 100),
        sourceHash: ent.sourceHash,
        verificationStatus: ent.verificationStatus || "UNVERIFIED",
        verifiedBy: ent.verifiedBy || (ocr.confidence >= 80 ? "OCR_AUTOMATION" : null),
        boundingBox: ent.boundingBox ? JSON.stringify(ent.boundingBox) : null,
      })),
    });

    // 8. Upsert CaseEntity rows for Cross-Case Graph resolution
    for (const ent of entities) {
      if (!["UPI", "PHONE", "ACCOUNT", "IFSC", "DOMAIN", "EMAIL", "NAME", "IP", "GPS_COORD"].includes(ent.type)) {
        continue;
      }

      await p.caseEntity
        .upsert({
          where: {
            caseId_entityType_normalizedValue: {
              caseId,
              entityType: ent.type,
              normalizedValue: ent.normalizedValue,
            },
          },
          update: {},
          create: {
            caseId,
            entityType: ent.type,
            rawValue: ent.rawValue,
            normalizedValue: ent.normalizedValue,
          },
        })
        .catch(() => {
          /* concurrent upsert guard */
        });
    }
  }

  // 9. Update Evidence.metadata with OCR telemetry
  let currentMeta: Record<string, any> = {};
  try {
    if (evidence.metadata) {
      currentMeta = JSON.parse(evidence.metadata);
    }
  } catch {
    currentMeta = {};
  }

  currentMeta.ocr = {
    status: ocr.status,
    engine: ocr.engine,
    engineVersion: ocr.engineVersion,
    confidence: ocr.confidence,
    charCount: ocr.charCount,
    lineCount: ocr.lineCount,
    pageCount: ocr.pageCount,
    processingTimeMs: ocr.processingTimeMs,
    extractedAt: ocr.extractedAt,
    error: ocr.error,
    textPreview: ocr.rawText.substring(0, 300),
  };

  await p.evidence.update({
    where: { id: evidence.id },
    data: { metadata: JSON.stringify(currentMeta) },
  });

  // 10. Record Chain of Custody event
  await p.custodyEvent
    .create({
      data: {
        evidenceId: evidence.id,
        eventType: "OCR_EXTRACTION",
        actor: `${ocr.engine} Forensic Subsystem`,
        action:
          ocr.status === "SUCCESS"
            ? `Forensic OCR extraction succeeded (${ocr.charCount} chars, ${entities.length} entities)`
            : `Forensic OCR concluded with status ${ocr.status}: ${ocr.error || "No text detected"}`,
        result: ocr.status === "SUCCESS" ? "SUCCESS" : ocr.status === "EMPTY" ? "EMPTY" : "FAILED",
        details: JSON.stringify({
          engine: ocr.engine,
          confidence: ocr.confidence,
          charCount: ocr.charCount,
          entityCount: entities.length,
          types: Array.from(new Set(entities.map((e) => e.type))),
          processingTimeMs: ocr.processingTimeMs,
        }),
      },
    })
    .catch((err: unknown) => console.error("[CustodyEvent] Failed to record OCR event:", err));

  return { ocr, entities };
}
