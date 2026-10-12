// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/communications/route.ts
// GET /api/cases/:caseId/communications
//
// Fetches transcriptions and chat translations for evidence in this case.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    if (!caseId || typeof caseId !== "string") {
      return Response.json({ error: "Missing or invalid caseId" }, { status: 400 });
    }

    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      select: { id: true, caseNumber: true },
    });

    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    // Query DB transcriptions and translations
    const evidenceWithComms = await prisma.evidence.findMany({
      where: { caseId: caseRecord.id },
      include: {
        transcriptions: true,
        chatTranslations: true,
        facts: true,
      },
    });

    const transcriptions = [];
    const chatTranslations = [];

    for (const ev of evidenceWithComms) {
      for (const t of ev.transcriptions) {
        let segments = [];
        try {
          segments = JSON.parse(t.segments);
        } catch {}
        transcriptions.push({
          id: t.id,
          evidenceId: ev.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          sha256Hash: ev.sha256Hash,
          originalLanguage: t.originalLanguage,
          targetLanguage: t.targetLanguage,
          speakerCount: t.speakerCount,
          transcriptionMethod: t.transcriptionMethod,
          confidence: t.confidence,
          segments,
          extractedEntities: ev.facts.map((f: typeof ev.facts[number]) => ({
            type: f.entityType,
            value: f.normalizedValue,
            confidence: f.confidence,
            evidenceId: f.evidenceId,
          })),
        });
      }

      for (const ct of ev.chatTranslations) {
        let messages = [];
        try {
          messages = JSON.parse(ct.messages);
        } catch {}
        chatTranslations.push({
          id: ct.id,
          evidenceId: ev.id,
          fileName: ev.fileName,
          fileType: ev.fileType,
          sha256Hash: ev.sha256Hash,
          originalLanguage: ct.originalLanguage,
          translationMethod: ct.translationMethod,
          messages,
          extractedEntities: ev.facts.map((f: typeof ev.facts[number]) => ({
            type: f.entityType,
            value: f.normalizedValue,
            confidence: f.confidence,
            evidenceId: f.evidenceId,
          })),
        });
      }
    }

    return Response.json({
      caseId: caseRecord.caseNumber,
      transcriptions,
      chatTranslations,
    });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/communications] Error:", err);
    return Response.json(
      { error: "Failed to fetch communications.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
