// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/upload/route.ts
// POST /api/evidence/upload
//
// Multipart FormData: file (Blob) + clientHash (string) + optional evidenceCategory
// 1. Stream file into buffer
// 2. Server-side SHA-256 verification vs clientHash
// 3. Write immutable .bin to /uploads/raw/<hash>.bin
// 4. Insert Evidence row in DB with inferred/selected category
// 5. Trigger async extraction worker with category-aware metadata extraction
// 6. Return UploadResponse
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  sha256OfBuffer,
  assertHashIntegrity,
  HashMismatchError,
  webReadableToBuffer,
} from "@/lib/crypto";
import { isValidSha256 } from "@/lib/crypto";
import prisma from "@/lib/prisma";
import {
  extractEmailMetadata,
  extractImageMetadata,
} from "@/services/extractionService";
import { executeOcrAndEntityExtraction } from "@/services/ocrService";
import { authenticateOfficer, hasPermission, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";
// File uploads can be large — allow up to 50 MB
export const maxDuration = 30;

// Ensure uploads directory exists at startup (idempotent)
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "raw");
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || "104857600", 10); // 100 MB default hard limit

/**
 * Infer evidence category from file name and MIME type when not explicitly supplied.
 */
function inferEvidenceCategory(fileName: string, mimeType: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".eml") || mimeType === "message/rfc822") {
    if (lowerName.includes("phish") || lowerName.includes("fraud") || lowerName.includes("scam")) {
      return "PHISHING_EMAIL";
    }
    return "EMAIL";
  }
  if (lowerName.includes("id") || lowerName.includes("aadhar") || lowerName.includes("pan") || lowerName.includes("passport") || lowerName.includes("card")) {
    return "IDENTITY_DATA";
  }
  if (lowerName.includes("scene") || lowerName.includes("cctv") || lowerName.includes("atm_cam") || lowerName.includes("photo")) {
    return "CRIME_SCENE_PHOTO";
  }
  if (lowerName.includes("pay") || lowerName.includes("gpay") || lowerName.includes("upi") || lowerName.includes("slip") || lowerName.includes("statement")) {
    return "UPI_FINANCIAL";
  }
  if (lowerName.includes("chat") || lowerName.includes("whatsapp") || lowerName.includes("telegram")) {
    return "CHAT";
  }
  if (mimeType.startsWith("audio/") || lowerName.endsWith(".wav") || lowerName.endsWith(".mp3")) {
    return "CALL_LOG";
  }
  if (mimeType.startsWith("video/") || lowerName.endsWith(".mp4")) {
    return "VIDEO";
  }
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf") || lowerName.endsWith(".docx")) {
    return "DOCUMENT";
  }
  return "OTHER";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to upload evidence." },
        { status: 401 }
      );
    }
    if (!hasPermission(auth.officer.role, "evidence:upload")) {
      return Response.json(
        { error: "Access denied: requires evidence:upload permission." },
        { status: 403 }
      );
    }

    // ── 1. Parse FormData ──────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const caseId = formData.get("caseId") as string | null;
    const clientHash = formData.get("clientHash") as string | null;
    const requestedCategory = formData.get("evidenceCategory") as string | null;

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: "Missing or invalid field: file" },
        { status: 400 }
      );
    }
    if (file.size <= 0) {
      return Response.json(
        { error: "Invalid upload: file cannot be empty (0 bytes)." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return Response.json(
        { error: `File exceeds maximum upload limit of 100 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB supplied).` },
        { status: 413 }
      );
    }

    // Security: Strict path traversal and filename sanitization
    const rawFileName = file.name || "unnamed.bin";
    if (
      rawFileName.includes("..") ||
      rawFileName.includes("/") ||
      rawFileName.includes("\\") ||
      rawFileName.includes("\0") ||
      /[\x00-\x1f\x7f]/.test(rawFileName)
    ) {
      return Response.json(
        { error: "Malicious or invalid filename detected: path traversal patterns and control characters are strictly rejected." },
        { status: 400 }
      );
    }

    const safeBaseName = path.basename(rawFileName);
    const fileExt = safeBaseName.split(".").pop()?.toUpperCase() ?? "BIN";
    const ALLOWED_EXTENSIONS = [
      "PNG", "JPG", "JPEG", "PDF", "TXT", "EML", "CSV", "JSON",
      "WAV", "MP3", "MP4", "BIN", "DOCX", "XLSX"
    ];
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return Response.json(
        { error: `File type .${fileExt} is not permitted for digital evidence intake.` },
        { status: 400 }
      );
    }

    if (!caseId || typeof caseId !== "string") {
      return Response.json(
        { error: "Missing required field: caseId" },
        { status: 400 }
      );
    }
    if (!clientHash || !isValidSha256(clientHash)) {
      return Response.json(
        {
          error:
            "Missing or malformed field: clientHash. Must be a 64-char hex SHA-256.",
        },
        { status: 400 }
      );
    }

    // ── 2. Verify case exists and officer has case access ──────────────────
    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      select: {
        id: true,
        caseNumber: true,
        departmentId: true,
        officerBadge: true,
      },
    });
    if (!caseRecord) {
      return Response.json(
        { error: `Case not found: ${caseId}` },
        { status: 404 }
      );
    }

    // Verify case access via fresh database checks
    const { canAccessCaseAsync } = await import("@/lib/accessControl");
    const caseAccess = await canAccessCaseAsync(auth.officer, caseRecord, "read:content");
    if (!caseAccess.allowed) {
      return Response.json(
        { error: caseAccess.reason || "Access denied: unauthorized case exhibit intake." },
        { status: 403 }
      );
    }

    // ── 3. Stream file into buffer (immutable copy) ────────────────────────
    const fileBuffer = await webReadableToBuffer(file.stream());

    // ── 4. Server-side SHA-256 integrity verification ──────────────────────
    const serverHash = sha256OfBuffer(fileBuffer);
    assertHashIntegrity(serverHash, clientHash); // throws HashMismatchError on fail

    // ── 5. Write to immutable cold storage ────────────────────────────────
    const storageAdapter = (await import("@/services/storageAdapter")).getEvidenceStorageAdapter();
    const writeResult = await storageAdapter.storeEvidence(fileBuffer, clientHash);
    const relativeStoragePath = writeResult.storagePath;

    // ── 6. Determine Category & Persist Evidence row ────────────────────────
    const mimeType = file.type || "application/octet-stream";
    const category = requestedCategory || inferEvidenceCategory(safeBaseName, mimeType);

    const evidence = await prisma.evidence.create({
      data: {
        caseId: caseRecord.id,
        fileName: safeBaseName,
        fileType: fileExt,
        mimeType,
        fileSize: fileBuffer.length,
        sha256Hash: serverHash,
        clientHash,
        storagePath: relativeStoragePath,
        evidenceCategory: category,
        status: "ACCEPTED",
        currentCustodianId: auth.officer.id,
        version: 1,
      } as any,
    });

    // ── 7. Record initial chained custody events ───────────────────────────
    const { appendCustodyEventAsync } = await import("@/lib/custodyChain");
    await appendCustodyEventAsync({
      evidenceId: evidence.id,
      eventType: "INTAKE_UPLOAD",
      actor: `${auth.officer.name} (${auth.officer.badgeNumber})`,
      action: `Raw evidence ingested: ${safeBaseName} (${fileBuffer.length} bytes)`,
      result: "SUCCESS",
      details: {
        fileName: safeBaseName,
        mimeType,
        clientHash,
        caseNumber: caseRecord.caseNumber,
      },
    }).catch((e: unknown) => console.error("[Upload] Error logging intake event:", e));

    await appendCustodyEventAsync({
      evidenceId: evidence.id,
      eventType: "HASH_VERIFIED",
      actor: "Cryptographic Verification Subsystem",
      action: `Dual SHA-256 integrity match confirmed. Server digest: ${serverHash}`,
      result: "VERIFIED",
      details: {
        algorithm: "SHA-256",
        serverHash,
        clientHash,
        storagePath: relativeStoragePath,
      },
    }).catch((e: unknown) => console.error("[Upload] Error logging hash verification event:", e));

    await appendCustodyEventAsync({
      evidenceId: evidence.id,
      eventType: "EVIDENCE_ACCEPTED",
      actor: `${auth.officer.name} (${auth.officer.badgeNumber})`,
      action: `Evidence accepted into case ${caseRecord.caseNumber}. Initial custodian assigned.`,
      result: "SUCCESS",
      details: {
        custodianId: auth.officer.id,
        custodianBadge: auth.officer.badgeNumber,
        departmentId: auth.officer.departmentId,
        status: "ACCEPTED",
      },
    }).catch((e: unknown) => console.error("[Upload] Error logging acceptance event:", e));

    // Also register in centralized audit trail
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "UPLOAD_EVIDENCE",
      module: "Evidence",
      targetType: "Evidence",
      targetId: evidence.id,
      details: `Ingested ${safeBaseName} (${fileBuffer.length} bytes) with verified SHA-256 for case ${caseRecord.caseNumber}`,
      result: "SUCCESS",
      ipAddress: ip,
    });

    // ── 8. Async extraction worker (fire-and-forget, non-blocking) ─────────
    runExtractionWorker(fileBuffer, mimeType, safeBaseName, category, evidence.id, caseRecord.id, serverHash).catch(
      (err) => console.error("[ExtractionWorker] Failed:", err)
    );

    // ── 9. Return success payload ──────────────────────────────────────────
    const responsePayload = {
      evidenceId: evidence.id,
      sha256Hash: serverHash,
      verified: true as const,
      storagePath: relativeStoragePath,
      evidenceCategory: category,
      status: "ACCEPTED",
      currentCustodianId: auth.officer.id,
      uploadedAt: evidence.uploadedAt.toISOString(),
      fileName: evidence.fileName,
      fileSize: evidence.fileSize,
      caseId: caseRecord.caseNumber,
    };

    return Response.json(responsePayload, { status: 201 });
  } catch (err: any) {
    if (err instanceof HashMismatchError || err?.name === "HashMismatchError" || err?.statusCode === 422) {
      return Response.json(
        { error: err.message, code: "INTEGRITY_VIOLATION" },
        { status: 422 }
      );
    }

    console.error("[POST /api/evidence/upload] Unexpected error:", err);
    return Response.json(
      {
        error: "Internal server error during evidence ingestion.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Extraction worker — runs asynchronously after upload response is sent
// ─────────────────────────────────────────────────────────────────────────────
async function runExtractionWorker(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  category: string,
  evidenceId: string,
  caseId: string,
  sourceHash: string
): Promise<void> {
  // Execute full OCR and deterministic entity extraction
  const { ocr, entities } = await executeOcrAndEntityExtraction(evidenceId, caseId, buffer);

  // Category-specific metadata parsing
  let metadataBlob: Record<string, unknown> = {};
  if (category === "EMAIL" || category === "PHISHING_EMAIL") {
    metadataBlob = extractEmailMetadata(ocr.rawText) as unknown as Record<string, unknown>;
  } else if (category === "CRIME_SCENE_PHOTO") {
    metadataBlob = extractImageMetadata(buffer, mimeType) as unknown as Record<string, unknown>;
  }

  if (Object.keys(metadataBlob).length > 0) {
    try {
      const existing = await prisma.evidence.findUnique({ where: { id: evidenceId }, select: { metadata: true } });
      const merged = { ...(existing?.metadata ? JSON.parse(existing.metadata) : {}), ...metadataBlob };
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: { metadata: JSON.stringify(merged) },
      });
    } catch (e) {
      console.warn("[ExtractionWorker] Error updating category metadata:", e);
    }
  }
}

