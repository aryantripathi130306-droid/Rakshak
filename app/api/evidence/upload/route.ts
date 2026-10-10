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
  extractEntities,
  bufferToText,
  extractEmailMetadata,
  extractImageMetadata,
} from "@/services/extractionService";

export const runtime = "nodejs";
// File uploads can be large — allow up to 50 MB
export const maxDuration = 30;

// Ensure uploads directory exists at startup (idempotent)
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "raw");

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

    // ── 2. Verify case exists ──────────────────────────────────────────────
    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
    });
    if (!caseRecord) {
      return Response.json(
        { error: `Case not found: ${caseId}` },
        { status: 404 }
      );
    }

    // ── 3. Stream file into buffer (immutable copy) ────────────────────────
    const fileBuffer = await webReadableToBuffer(file.stream());

    // ── 4. Server-side SHA-256 integrity verification ──────────────────────
    const serverHash = sha256OfBuffer(fileBuffer);
    assertHashIntegrity(serverHash, clientHash); // throws HashMismatchError on fail

    // ── 5. Write to immutable cold storage ────────────────────────────────
    await mkdir(UPLOAD_DIR, { recursive: true });
    const storagePath = path.join(UPLOAD_DIR, `${serverHash}.bin`);
    await writeFile(storagePath, fileBuffer);
    const relativeStoragePath = `/uploads/raw/${serverHash}.bin`;

    // ── 6. Determine Category & Persist Evidence row ────────────────────────
    const mimeType = file.type || "application/octet-stream";
    const fileExt = file.name.split(".").pop()?.toUpperCase() ?? "BIN";
    const category = requestedCategory || inferEvidenceCategory(file.name, mimeType);

    const evidence = await prisma.evidence.create({
      data: {
        caseId: caseRecord.id,
        fileName: file.name,
        fileType: fileExt,
        mimeType,
        fileSize: fileBuffer.length,
        sha256Hash: serverHash,
        clientHash,
        storagePath: relativeStoragePath,
        evidenceCategory: category,
      },
    });

    // ── 7. Record initial custody audit events ─────────────────────────────
    await (prisma as any).custodyEvent.createMany({
      data: [
        {
          evidenceId: evidence.id,
          eventType: "INTAKE_UPLOAD",
          actor: "Evidence Ingestion Gateway",
          action: `Raw evidence ingested: ${file.name} (${fileBuffer.length} bytes)`,
          result: "SUCCESS",
          details: JSON.stringify({
            fileName: file.name,
            mimeType,
            clientHash,
            caseNumber: caseRecord.caseNumber,
          }),
        },
        {
          evidenceId: evidence.id,
          eventType: "HASH_VERIFIED",
          actor: "Cryptographic Verification Subsystem",
          action: `Dual SHA-256 integrity match confirmed. Server digest: ${serverHash}`,
          result: "VERIFIED",
          details: JSON.stringify({
            algorithm: "SHA-256",
            serverHash,
            clientHash,
            storagePath: relativeStoragePath,
          }),
        },
      ],
    }).catch((e: unknown) => console.error("[Upload] Error logging intake custody events:", e));

    // ── 8. Async extraction worker (fire-and-forget, non-blocking) ─────────
    runExtractionWorker(fileBuffer, mimeType, file.name, category, evidence.id, caseRecord.id, serverHash).catch(
      (err) => console.error("[ExtractionWorker] Failed:", err)
    );

    // ── 8. Return success payload ──────────────────────────────────────────
    const responsePayload = {
      evidenceId: evidence.id,
      sha256Hash: serverHash,
      verified: true as const,
      storagePath: relativeStoragePath,
      evidenceCategory: category,
      uploadedAt: evidence.uploadedAt.toISOString(),
      fileName: evidence.fileName,
      fileSize: evidence.fileSize,
      caseId: caseRecord.caseNumber,
    };

    return Response.json(responsePayload, { status: 201 });
  } catch (err) {
    if (err instanceof HashMismatchError) {
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
  const text = bufferToText(buffer, mimeType, fileName);
  const payload = await extractEntities(text, evidenceId, sourceHash);

  // Category-specific metadata parsing
  let metadataBlob: Record<string, unknown> = {};
  if (category === "EMAIL" || category === "PHISHING_EMAIL") {
    metadataBlob = extractEmailMetadata(text) as unknown as Record<string, unknown>;
  } else if (category === "CRIME_SCENE_PHOTO") {
    metadataBlob = extractImageMetadata(buffer, mimeType) as unknown as Record<string, unknown>;
  }

  if (Object.keys(metadataBlob).length > 0) {
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { metadata: JSON.stringify(metadataBlob) },
    });
  }

  if (payload.entities.length === 0) return;

  // Persist ExtractedFact rows
  await prisma.extractedFact.createMany({
    data: payload.entities.map((ent) => ({
      evidenceId,
      caseId,
      factAssertion: `${ent.type} identifier detected: ${ent.normalizedValue}`,
      entityType: ent.type,
      rawValue: ent.rawValue,
      normalizedValue: ent.normalizedValue,
      confidence: ent.confidence,
      sourceHash: ent.sourceHash,
      verificationStatus: ent.verificationStatus || "UNVERIFIED",
      verifiedBy: ent.verifiedBy || null,
      boundingBox: ent.boundingBox ? JSON.stringify(ent.boundingBox) : null,
    })),
  });

  // Upsert into CaseEntity for cross-case graph resolution
  for (const ent of payload.entities) {
    if (!["UPI", "PHONE", "ACCOUNT", "IFSC", "DOMAIN", "EMAIL", "NAME", "IP", "GPS_COORD"].includes(ent.type))
      continue;
    await prisma.caseEntity
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
        /* ignore unique constraint on concurrent uploads */
      });
  }

  // Record extraction completion custody audit event
  await (prisma as any).custodyEvent.create({
    data: {
      evidenceId,
      eventType: "EXTRACTION_COMPLETED",
      actor: "Forensic Intelligence Extractor",
      action: `Deterministic entity extraction completed: ${payload.entities.length} entities extracted`,
      result: "SUCCESS",
      details: JSON.stringify({
        entityCount: payload.entities.length,
        types: Array.from(new Set(payload.entities.map((e: any) => e.type))),
      }),
    },
  }).catch((e: unknown) => console.error("[ExtractionWorker] Error logging extraction custody event:", e));
}

