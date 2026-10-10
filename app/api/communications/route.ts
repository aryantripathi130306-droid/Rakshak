// ─────────────────────────────────────────────────────────────────────────────
// app/api/communications/route.ts
// GET /api/communications — General communications intelligence endpoint
// Supports query params: caseId, evidenceId, type (call/chat/email)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const evidenceId = searchParams.get("evidenceId");

    const where: Record<string, unknown> = {};

    if (caseId && caseId !== "ALL") {
      const caseRec = await prisma.case.findFirst({
        where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
        select: { id: true },
      });
      if (caseRec) {
        where.caseId = caseRec.id;
      }
    }

    if (evidenceId && evidenceId !== "ALL") {
      where.id = evidenceId;
    }

    const evidenceList = await prisma.evidence.findMany({
      where,
      include: {
        case: { select: { id: true, caseNumber: true, complainantName: true } },
        transcriptions: true,
        chatTranslations: true,
        facts: true,
      },
    });

    const transcriptions = [];
    const chatTranslations = [];

    for (const ev of evidenceList) {
      for (const t of ev.transcriptions) {
        let segments = [];
        try { segments = JSON.parse(t.segments); } catch {}
        transcriptions.push({
          id: t.id,
          evidenceId: ev.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          mimeType: ev.mimeType,
          sha256Hash: ev.sha256Hash,
          caseNumber: ev.case?.caseNumber || "—",
          originalLanguage: t.originalLanguage,
          targetLanguage: t.targetLanguage,
          speakerCount: t.speakerCount,
          transcriptionMethod: t.transcriptionMethod,
          confidence: t.confidence,
          segments,
          extractedEntities: ev.facts.map((f) => ({
            type: f.entityType,
            value: f.normalizedValue,
            confidence: f.confidence,
            evidenceId: f.evidenceId,
          })),
        });
      }

      for (const ct of ev.chatTranslations) {
        let messages = [];
        try { messages = JSON.parse(ct.messages); } catch {}
        chatTranslations.push({
          id: ct.id,
          evidenceId: ev.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          mimeType: ev.mimeType,
          sha256Hash: ev.sha256Hash,
          caseNumber: ev.case?.caseNumber || "—",
          originalLanguage: ct.originalLanguage,
          translationMethod: ct.translationMethod,
          messages,
          extractedEntities: ev.facts.map((f) => ({
            type: f.entityType,
            value: f.normalizedValue,
            confidence: f.confidence,
            evidenceId: f.evidenceId,
          })),
        });
      }
    }

    return Response.json({
      transcriptions,
      chatTranslations,
      totalCount: transcriptions.length + chatTranslations.length,
    });
  } catch (err) {
    console.error("[GET /api/communications] Error:", err);
    return Response.json(
      { error: "Failed to fetch communications.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
