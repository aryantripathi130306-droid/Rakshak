// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/download/route.ts
// GET /api/evidence/:id/download
//
// Streams original immutable raw evidence from cold storage (/uploads/raw/<sha256>.bin).
// Enforces resource-aware authorization: distinguishes metadata access from binary access.
// Records an append-only CustodyEvent on each access.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { isValidSha256 } from "@/lib/crypto";
import {
  authenticateOfficer,
  canAccessEvidenceAsync,
  logAuditEvent,
} from "@/services/authService";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get("preview") === "1";

    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to access evidence." },
        { status: 401 }
      );
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
      include: {
        case: true,
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    // Phase 32/34: Resource-aware authorization — downloading/streaming raw binary bytes
    // strictly requires binary read permissions and verified case/department scope via fresh DB state
    const accessCheck = await canAccessEvidenceAsync(auth.officer, evidence, "read:binary");
    if (!accessCheck.allowed) {
      return Response.json(
        { error: accessCheck.reason || "Access denied: unauthorized binary exhibit retrieval." },
        { status: 403 }
      );
    }

    // Phase 36: Lifecycle status checks — quarantine, rejection, and sealed exhibits
    const evStatus = (evidence as any).status || "ACCEPTED";
    if (evStatus === "QUARANTINED") {
      return Response.json(
        {
          error: "Access denied: evidence exhibit is in QUARANTINED status due to suspected tampering or integrity failure.",
          code: "EXHIBIT_QUARANTINED",
          quarantineReason: (evidence as any).quarantineReason || null,
        },
        { status: 403 }
      );
    }

    if (evStatus === "REJECTED") {
      return Response.json(
        {
          error: "Access denied: evidence exhibit was REJECTED during intake.",
          code: "EXHIBIT_REJECTED",
        },
        { status: 403 }
      );
    }

    if (evStatus === "SEALED") {
      const isSupervisor =
        auth.officer.role === "SUPERVISOR" ||
        auth.officer.role === "ADMIN" ||
        auth.officer.role === "SYS_ADMIN";
      if (!isSupervisor) {
        return Response.json(
          {
            error: "Access denied: evidence exhibit is SEALED. Access requires formal SUPERVISOR authorization.",
            code: "EXHIBIT_SEALED",
          },
          { status: 403 }
        );
      }
    }

    // Enforce strict path security: use only verified SHA-256 hex string
    if (!isValidSha256(evidence.sha256Hash)) {
      return Response.json({ error: "Invalid cryptographic reference in evidence record." }, { status: 500 });
    }

    let fileBuffer: Buffer;
    try {
      const storageAdapter = (await import("@/services/storageAdapter")).getEvidenceStorageAdapter();
      const readResult = await storageAdapter.retrieveEvidence(evidence.sha256Hash, true);
      fileBuffer = readResult.buffer;
    } catch (readErr: any) {
      // If cryptographic verification on read failed, quarantine exhibit
      if (readErr?.name === "HashMismatchError" || String(readErr?.message).includes("Bit-Rot")) {
        const { appendCustodyEventAsync } = await import("@/lib/custodyChain");
        await appendCustodyEventAsync({
          evidenceId: evidence.id,
          eventType: "INTEGRITY_FAILURE",
          actor: "Storage Integrity Subsystem",
          action: `Read-time cryptographic failure: ${readErr.message}`,
          result: "FAILED",
          details: { error: readErr.message, canonicalHash: evidence.sha256Hash },
        }).catch(() => {});

        await prisma.evidence.update({
          where: { id: evidence.id },
          data: {
            status: "QUARANTINED",
            quarantineReason: `Storage verification failed upon download: ${readErr.message}`,
          } as any,
        }).catch(() => {});

        return Response.json(
          { error: "Cryptographic verification failed: physical bytes do not match canonical hash.", code: "INTEGRITY_FAILURE" },
          { status: 422 }
        );
      }

      return Response.json({ error: "Original evidence file not found in cold storage or failed cryptographic verification." }, { status: 404 });
    }

    // Append-only cryptographically chained chain-of-custody audit record
    try {
      const { appendCustodyEventAsync } = await import("@/lib/custodyChain");
      await appendCustodyEventAsync({
        evidenceId: evidence.id,
        eventType: isPreview ? "EVIDENCE_ACCESSED" : "EVIDENCE_DOWNLOADED",
        actor: `${auth.officer.name} (${auth.officer.badgeNumber})`,
        action: isPreview ? "Streamed inline preview" : "Downloaded full binary exhibit",
        result: "SUCCESS",
        details: {
          officerId: auth.officer.id,
          officerRole: auth.officer.role,
          officerBadge: auth.officer.badgeNumber,
          departmentId: auth.officer.departmentId,
          fileName: evidence.fileName,
          sha256Hash: evidence.sha256Hash,
          isPreview,
        },
      });
    } catch (custodyErr) {
      console.warn("Could not log custody event:", custodyErr);
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: isPreview ? "VIEW_EVIDENCE_PREVIEW" : "DOWNLOAD_EVIDENCE_BINARY",
      module: "Evidence",
      targetType: "Evidence",
      targetId: evidence.id,
      details: `${isPreview ? "Streamed preview" : "Downloaded exhibit"} ${evidence.fileName} (SHA-256: ${evidence.sha256Hash.substring(0, 16)}...)`,
      result: "SUCCESS",
      ipAddress,
    });

    const uint8Array = new Uint8Array(fileBuffer);

    // Sanitized filename for Content-Disposition
    const safeFileName = evidence.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const disposition = isPreview
      ? `inline; filename="${safeFileName}"`
      : `attachment; filename="${safeFileName}"`;

    return new Response(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": evidence.mimeType || "application/octet-stream",
        "Content-Disposition": disposition,
        "Content-Length": String(fileBuffer.length),
        "X-Evidence-SHA256": evidence.sha256Hash,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/evidence/:id/download] Error:", err);
    return Response.json(
      { error: "Failed to download evidence.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
