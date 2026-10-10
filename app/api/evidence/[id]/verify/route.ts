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
    let fileExists = false;
    let computedDiskHash = "";
    let diskFileSize = 0;
    let verificationStatus: "VERIFIED" | "TAMPERED" | "MISSING_STORAGE" = "VERIFIED";

    try {
      const fileBuffer = await fs.readFile(storagePath);
      fileExists = true;
      diskFileSize = fileBuffer.length;
      computedDiskHash = sha256OfBuffer(fileBuffer);

      const dbMatch = computedDiskHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
      const clientMatch = evidence.clientHash.toLowerCase() === evidence.sha256Hash.toLowerCase();

      if (dbMatch && clientMatch) {
        verificationStatus = "VERIFIED";
      } else {
        verificationStatus = "TAMPERED";
      }
    } catch {
      fileExists = false;
      verificationStatus = "MISSING_STORAGE";
    }

    const verificationTimestamp = new Date();
    const auditor = body.auditor || "Forensic Workstation Integrity Daemon";
    const auditAction = verificationStatus === "VERIFIED"
      ? `Cryptographic dual-hash audit passed. Computed disk digest: ${computedDiskHash}`
      : verificationStatus === "TAMPERED"
      ? `CRITICAL INTEGRITY FAILURE: Disk digest (${computedDiskHash}) differs from recorded canonical hash (${evidence.sha256Hash})`
      : `CRITICAL STORAGE FAILURE: Physical evidence file missing from storage path ${evidence.storagePath}`;

    // Append to Custody Log
    const custodyRecord = await (prisma as any).custodyEvent.create({
      data: {
        evidenceId: evidence.id,
        eventType: "INTEGRITY_AUDIT",
        actor: auditor,
        action: auditAction,
        result: verificationStatus === "VERIFIED" ? "VERIFIED" : "FAILED",
        details: JSON.stringify({
          algorithm: "SHA-256",
          clientHash: evidence.clientHash,
          databaseHash: evidence.sha256Hash,
          computedDiskHash: computedDiskHash || null,
          diskFileSize,
          expectedFileSize: evidence.fileSize,
          storagePath: evidence.storagePath,
          timestamp: verificationTimestamp.toISOString(),
        }),
      },
    });

    return Response.json(
      {
        verified: verificationStatus === "VERIFIED",
        status: verificationStatus,
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        caseNumber: evidence.case.caseNumber,
        algorithm: "SHA-256",
        clientHash: evidence.clientHash,
        databaseHash: evidence.sha256Hash,
        computedDiskHash: computedDiskHash || null,
        hashMatch: verificationStatus === "VERIFIED",
        fileExists,
        storagePath: evidence.storagePath,
        fileSizeBytes: diskFileSize || evidence.fileSize,
        verifiedAt: verificationTimestamp.toISOString(),
        custodyEventId: custodyRecord.id,
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
