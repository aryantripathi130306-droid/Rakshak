// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/communications/route.ts
// GET /api/cases/:caseId/communications
//
// Fetches transcriptions and chat translations for evidence in this case.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { MOCK_TRANSCRIPTION, MOCK_CHAT_TRANSLATION } from "@/lib/mock-data";

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

    // If no records in DB yet, fallback to mock data
    const finalTranscriptions = transcriptions.length > 0 ? transcriptions : [
      {
        id: "trans-104-01",
        evidenceId: "EV-104",
        fileName: "Call_Recording_Intercept.wav",
        fileType: "WAV",
        sha256Hash: "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f",
        originalLanguage: MOCK_TRANSCRIPTION.originalLanguage,
        targetLanguage: MOCK_TRANSCRIPTION.targetLanguage,
        speakerCount: MOCK_TRANSCRIPTION.speakerCount,
        transcriptionMethod: "WHISPER_AI (Indic Speech)",
        confidence: MOCK_TRANSCRIPTION.confidence,
        segments: MOCK_TRANSCRIPTION.segments,
        extractedEntities: [
          { type: "PHONE", value: "+919811122233", confidence: 0.999, evidenceId: "EV-104" },
          { type: "PHONE", value: "+918800912244", confidence: 0.985, evidenceId: "EV-104" },
        ],
      },
    ];

    const finalChatTranslations = chatTranslations.length > 0 ? chatTranslations : [
      {
        id: "chat-trans-102-01",
        evidenceId: "EV-102",
        fileName: "WhatsApp_Chat_Export.txt",
        fileType: "TXT",
        sha256Hash: "a3f2c819e4d72b06a1c0f5d8e9b3417c28e0f5a1b6c2d9e7f4a8b3c1d0e2f6a9",
        originalLanguage: MOCK_CHAT_TRANSLATION.originalLanguage,
        translationMethod: "INDIC_TRANS_AI (Forensic Corpus)",
        messages: MOCK_CHAT_TRANSLATION.messages,
        extractedEntities: [
          { type: "PHONE", value: "+919811122233", confidence: 0.999, evidenceId: "EV-102" },
          { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.981, evidenceId: "EV-102" },
          { type: "UPI", value: "mule88@oksbi", confidence: 0.994, evidenceId: "EV-102" },
        ],
      },
    ];

    return Response.json({
      caseId: caseRecord.caseNumber,
      transcriptions: finalTranscriptions,
      chatTranslations: finalChatTranslations,
    });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/communications] Error:", err);
    return Response.json(
      { error: "Failed to fetch communications.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
