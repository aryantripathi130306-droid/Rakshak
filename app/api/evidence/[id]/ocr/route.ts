// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/ocr/route.ts
// POST /api/evidence/:id/ocr — Explicit forensic OCR trigger & candidate fact extraction
// GET  /api/evidence/:id/ocr — Fetch OCR processing status, artifact & telemetry
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { executeSecureOcrJob } from "@/lib/ocrPipeline";
import { extractCandidateFactsFromText, persistCandidateFactsAsync } from "@/lib/factExtraction";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);

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

    if (auth && auth.officer) {
      if (auth.officer.status === "SUSPENDED") {
        return Response.json(
          { error: "Access denied: Officer account is SUSPENDED." },
          { status: 403 }
        );
      }
    }

    // Fetch latest ExtractedTextArtifact
    const artifact = await (prisma as any).extractedTextArtifact.findFirst({
      where: { evidenceId: evidence.id },
      orderBy: { extractedAt: "desc" },
    });

    // Fetch associated candidate facts
    const facts = await (prisma as any).extractedFact.findMany({
      where: { evidenceId: evidence.id },
      orderBy: { extractedAt: "asc" },
    });

    let ocrTelemetry: any = null;
    if (artifact) {
      ocrTelemetry = {
        id: artifact.id,
        status: artifact.status,
        engine: artifact.engine,
        engineVersion: artifact.engineVersion,
        confidence: artifact.confidence,
        charCount: artifact.charCount,
        lineCount: artifact.lineCount,
        pageCount: artifact.pageCount,
        processingTimeMs: artifact.processingTimeMs,
        extractedAt: artifact.extractedAt,
        rawText: artifact.rawText,
        words: artifact.boundingBoxes ? JSON.parse(artifact.boundingBoxes) : [],
        isIntegrityVerified: artifact.isIntegrityVerified,
        integrityAlert: artifact.integrityAlert,
        error: artifact.errorMessage,
      };
    } else {
      // Legacy metadata fallback
      let meta: Record<string, any> = {};
      try {
        if (evidence.metadata) meta = JSON.parse(evidence.metadata);
      } catch {
        meta = {};
      }
      ocrTelemetry = meta.ocr || {
        status: "NOT_RUN",
        message: "OCR has not been run on this evidence artifact.",
      };
    }

    return Response.json(
      {
        evidenceId: evidence.id,
        caseId: evidence.caseId,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        sourceHash: evidence.sha256Hash,
        ocr: ocrTelemetry,
        factsCount: facts.length,
        facts,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]/ocr] Error:", err);
    return Response.json(
      { error: "Failed to fetch OCR status", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);

    let callerId = "system_officer";
    let callerRole = "INVESTIGATOR";
    let callerDeptId = "dept_default";
    let callerBadge = "DL-002";
    let isSuspended = false;

    if (auth && auth.officer) {
      callerId = auth.officer.id;
      callerRole = auth.officer.role;
      callerDeptId = auth.officer.departmentId || "dept_default";
      callerBadge = auth.officer.badgeNumber || "DL-002";
      isSuspended = auth.officer.status === "SUSPENDED";
    }

    if (isSuspended) {
      return Response.json(
        { error: "Access denied: Officer account is SUSPENDED. Active account required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const forceReprocess = Boolean(body.forceReprocess);

    // Execute secure OCR processing
    const ocrResult = await executeSecureOcrJob(
      id,
      {
        callerId,
        callerRole,
        callerDeptId,
        callerBadge,
        isCallerSuspended: isSuspended,
        forceReprocess,
      },
      undefined,
      prisma
    );

    // Extract structured candidate facts from text
    let candidateFacts: any[] = [];
    let insertedCount = 0;
    if (ocrResult.artifact.rawText && ocrResult.artifact.status === "COMPLETED") {
      const words = ocrResult.artifact.boundingBoxes
        ? JSON.parse(ocrResult.artifact.boundingBoxes)
        : [];
      candidateFacts = extractCandidateFactsFromText(
        ocrResult.artifact.rawText,
        ocrResult.artifact.id,
        ocrResult.artifact.evidenceId,
        ocrResult.artifact.caseId,
        ocrResult.artifact.sourceHash,
        words
      );
      insertedCount = await persistCandidateFactsAsync(candidateFacts, prisma);
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    await logAuditEvent({
      officerId: callerId,
      officerName: auth?.officer?.name || "Inspector Rajesh Kumar",
      officerBadge: callerBadge,
      action: "OCR_EXTRACTION",
      module: "Evidence",
      targetType: "Evidence",
      targetId: id,
      details: `Forensic OCR executed for ${ocrResult.artifact.fileName || id}: ${ocrResult.artifact.status} (${ocrResult.artifact.charCount} chars, ${insertedCount} candidate facts extracted)`,
      result: ocrResult.success ? "SUCCESS" : "FAILED",
      ipAddress,
    }).catch(() => {});

    return Response.json(
      {
        success: ocrResult.success,
        evidenceId: ocrResult.artifact.evidenceId,
        caseId: ocrResult.artifact.caseId,
        fileName: ocrResult.artifact.fileName,
        sourceHash: ocrResult.artifact.sourceHash,
        artifact: ocrResult.artifact,
        telemetry: ocrResult.telemetry,
        candidateFactsCount: candidateFacts.length,
        persistedFactsCount: insertedCount,
        facts: candidateFacts,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/evidence/[id]/ocr] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("Access denied")
      ? 403
      : msg.includes("Authentication required")
      ? 401
      : msg.includes("not found")
      ? 404
      : msg.includes("exceeds maximum") || msg.includes("Unsupported MIME")
      ? 400
      : 500;

    return Response.json(
      { error: "Forensic OCR execution failed", details: msg },
      { status }
    );
  }
}
