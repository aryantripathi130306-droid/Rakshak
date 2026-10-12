// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/download/route.ts
// GET /api/evidence/:id/download
//
// Streams original immutable raw evidence from cold storage (/uploads/raw/<sha256>.bin).
// Supports query param ?preview=1 for inline viewing (images, audio, PDF, text).
// Records an append-only CustodyEvent on each access.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { isValidSha256 } from "@/lib/crypto";
import { authenticateOfficer, hasPermission, canAccessDepartment, logAuditEvent } from "@/services/authService";

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

    const requiredPerm = isPreview ? "evidence:view" : "evidence:download";
    if (!hasPermission(auth.officer.role, requiredPerm)) {
      return Response.json(
        { error: `Access denied: requires ${requiredPerm} permission.` },
        { status: 403 }
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

    // Phase 22: Enforce department scope on evidence access
    if (evidence.case && !canAccessDepartment(auth.officer, evidence.case.jurisdiction, (evidence.case as any).departmentId)) {
      return Response.json(
        { error: "Access denied: Evidence belongs to a case in another departmental jurisdiction." },
        { status: 403 }
      );
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
    } catch {
      return Response.json({ error: "Original evidence file not found in cold storage or failed cryptographic verification." }, { status: 404 });
    }

    // Log an append-only custody event for evidence access/download
    try {
      await (prisma as any).custodyEvent.create({
        data: {
          evidenceId: evidence.id,
          eventType: isPreview ? "EVIDENCE_ACCESSED" : "EVIDENCE_DOWNLOADED",
          actor: `${auth.officer.name} (${auth.officer.badgeNumber})`,
          action: isPreview
            ? `Forensic preview loaded for ${evidence.fileName} (${formatBytes(evidence.fileSize)})`
            : `Original evidence file downloaded: ${evidence.fileName} [SHA-256: ${evidence.sha256Hash.substring(0, 12)}...]`,
          result: "SUCCESS",
          details: JSON.stringify({
            userAgent: request.headers.get("user-agent") || "Unknown",
            ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
            preview: isPreview,
          }),
        },
      });

      // Also register in the centralized audit log
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
      await logAuditEvent({
        officerId: auth.officer.id,
        officerName: auth.officer.name,
        officerBadge: auth.officer.badgeNumber,
        action: isPreview ? "VIEW_EVIDENCE" : "DOWNLOAD_EVIDENCE",
        module: "Evidence",
        targetType: "Evidence",
        targetId: evidence.id,
        details: isPreview
          ? `Previewed evidence ${evidence.fileName} (${formatBytes(evidence.fileSize)})`
          : `Downloaded raw evidence ${evidence.fileName} [SHA-256: ${evidence.sha256Hash.substring(0, 16)}...]`,
        result: "SUCCESS",
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.error("[CustodyAudit] Error logging download event:", auditErr);
    }

    // Determine appropriate Content-Type
    const mimeType = evidence.mimeType || "application/octet-stream";
    const disposition = isPreview ? "inline" : `attachment; filename="${encodeURIComponent(evidence.fileName)}"`;

    return new Response(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Content-Length": String(fileBuffer.length),
        "X-Evidence-SHA256": evidence.sha256Hash,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/evidence/[id]/download] Error:", err);
    return Response.json(
      { error: "Internal server error streaming evidence." },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
