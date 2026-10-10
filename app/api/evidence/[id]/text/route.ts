// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/text/route.ts
// GET /api/evidence/:id/text
//
// Returns extracted text content from evidence for safe display in the viewer.
// For text-based files (TXT, CSV, EML, JSON), returns UTF-8 text.
// For binary files, returns Latin-1 string extraction (best-effort).
// Never executes uploaded code or HTML.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { bufferToText } from "@/services/extractionService";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 500_000; // 500KB text limit for browser rendering

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    // Determine if this file type has meaningful text content
    const mimeType = evidence.mimeType || "application/octet-stream";
    const isTextBased =
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "message/rfc822" ||
      evidence.fileName.endsWith(".eml") ||
      evidence.fileName.endsWith(".txt") ||
      evidence.fileName.endsWith(".csv") ||
      evidence.fileName.endsWith(".log") ||
      evidence.fileName.endsWith(".md");

    const isImage = mimeType.startsWith("image/");
    const isPDF = mimeType === "application/pdf";
    const isAudio = mimeType.startsWith("audio/");
    const isVideo = mimeType.startsWith("video/");

    // Read file from cold storage
    const storagePath = path.join(process.cwd(), "uploads", "raw", `${evidence.sha256Hash}.bin`);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(storagePath);
    } catch {
      return Response.json(
        {
          available: false,
          reason: "FILE_NOT_FOUND",
          message: "Original evidence file not found in cold storage.",
          evidenceId: evidence.id,
          contentType: "none",
        },
        { status: 200 }
      );
    }

    if (isTextBased) {
      const text = bufferToText(fileBuffer, mimeType, evidence.fileName);
      const truncated = text.length > MAX_TEXT_LENGTH;
      const displayText = truncated ? text.substring(0, MAX_TEXT_LENGTH) : text;
      const lines = displayText.split(/\r?\n/);

      return Response.json(
        {
          available: true,
          contentType: "text",
          text: displayText,
          lineCount: lines.length,
          totalCharacters: text.length,
          truncated,
          mimeType,
          evidenceId: evidence.id,
          ocrPerformed: false,
        },
        { status: 200 }
      );
    }

    if (isImage) {
      return Response.json(
        {
          available: true,
          contentType: "image",
          previewUrl: `/api/evidence/${evidence.id}/download?preview=1`,
          mimeType,
          evidenceId: evidence.id,
          ocrPerformed: false,
          ocrNote: "Image OCR is not implemented. Text extraction from images is not available.",
        },
        { status: 200 }
      );
    }

    if (isPDF) {
      return Response.json(
        {
          available: true,
          contentType: "pdf",
          previewUrl: `/api/evidence/${evidence.id}/download?preview=1`,
          mimeType,
          evidenceId: evidence.id,
          ocrPerformed: false,
          ocrNote: "PDF text extraction and OCR are not implemented.",
        },
        { status: 200 }
      );
    }

    if (isAudio) {
      return Response.json(
        {
          available: true,
          contentType: "audio",
          previewUrl: `/api/evidence/${evidence.id}/download?preview=1`,
          mimeType,
          evidenceId: evidence.id,
        },
        { status: 200 }
      );
    }

    if (isVideo) {
      return Response.json(
        {
          available: true,
          contentType: "video",
          previewUrl: `/api/evidence/${evidence.id}/download?preview=1`,
          mimeType,
          evidenceId: evidence.id,
        },
        { status: 200 }
      );
    }

    // Attempt best-effort text extraction for unknown binary
    const text = bufferToText(fileBuffer, mimeType, evidence.fileName);
    const hasReadableContent = /[\x20-\x7E]{20,}/.test(text);

    if (hasReadableContent) {
      const truncated = text.length > MAX_TEXT_LENGTH;
      const displayText = truncated ? text.substring(0, MAX_TEXT_LENGTH) : text;
      return Response.json(
        {
          available: true,
          contentType: "text",
          text: displayText,
          lineCount: displayText.split(/\r?\n/).length,
          totalCharacters: text.length,
          truncated,
          mimeType,
          evidenceId: evidence.id,
          note: "Best-effort text extraction from binary file. Content may be incomplete.",
          ocrPerformed: false,
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        available: false,
        reason: "UNSUPPORTED_FORMAT",
        message: `Text extraction is not available for this file type (${mimeType}). Use the download action to access the original file.`,
        contentType: "binary",
        mimeType,
        evidenceId: evidence.id,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]/text] Error:", err);
    return Response.json(
      {
        error: "Failed to extract text content.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
