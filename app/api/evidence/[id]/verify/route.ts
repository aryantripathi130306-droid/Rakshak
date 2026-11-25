// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/verify/route.ts
// POST /api/evidence/:id/verify
//
// Performs on-demand cryptographic verification of the stored raw evidence.
// 1. Reads physical bytes from /uploads/raw/<sha256>.bin
// 2. Independently computes SHA-256 using Node.js crypto
// 3. Compares disk hash against database sha256Hash and clientHash
// 4. Appends an immutable CustodyEvent audit record
// 5. Returns verification proof report
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { sha256OfBuffer, isValidSha256 } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
      include: {
        case: { select: { caseNumber: true, complainantName: true } },
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    if (!isValidSha256(evidence.sha256Hash)) {
      return Response.json({ error: "Corrupted hash format in evidence record." }, { status: 400 });
    }

    const storagePath = path.join(process.cwd(), "uploads", "raw", `${evidence.sha256Hash}.bin`);
    const { verifyEvidenceIntegrityAsync } = await import("@/lib/evidenceOperations");
    const auditor = body.auditor || "Forensic Workstation Integrity Daemon";

    const verifyResult = await verifyEvidenceIntegrityAsync(evidence.id, auditor);

    return Response.json(
      {
        verified: verifyResult.verified,
        status: verifyResult.verified ? "VERIFIED" : "TAMPERED",
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        caseNumber: evidence.case?.caseNumber,
        algorithm: "SHA-256",
        clientHash: evidence.clientHash,
        databaseHash: evidence.sha256Hash,
        computedDiskHash: verifyResult.diskHash,
        hashMatch: verifyResult.verified,
        fileExists: verifyResult.diskHash !== null,
        quarantined: verifyResult.quarantined,
        storagePath: evidence.storagePath,
        fileSizeBytes: evidence.fileSize,
        verifiedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/evidence/[id]/verify] Error:", err);
    return Response.json(
      {
        error: "Internal server error during verification audit.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
