// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/timeline/route.ts
// GET  /api/cases/:caseId/timeline — return normalised timeline for a case
// POST /api/cases/:caseId/timeline — ingest raw events and normalise them
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { normalizeTimeline, classifyPhase } from "@/services/timelineService";
import { RawEventInputSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
    });
    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    const events = await prisma.timelineEvent.findMany({
      where: { caseId: caseRecord.id },
      orderBy: { timestamp: "asc" },
      include: {
        evidence: { select: { id: true, fileName: true, sha256Hash: true } },
      },
    });

    return Response.json({ caseId, events }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/timeline] Error:", err);
    return Response.json({ error: "Failed to fetch timeline." }, { status: 500 });
  }
}

const IngestEventsSchema = z.object({
  events: z.array(
    z.object({
      rawTimestamp: z.string(),
      description: z.string().min(5),
      sourceType: z
        .enum(["WHATSAPP", "BANK_SMS", "RECEIPT", "CALL_LOG", "SCREENSHOT"])
        .default("WHATSAPP"),
      evidenceId: z.string().uuid(),
    })
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
    });
    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    const body = await request.json();
    const parsed = IngestEventsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rawInputs = parsed.data.events.map((ev) =>
      RawEventInputSchema.parse({ ...ev, caseId })
    );

    const normalised = normalizeTimeline(rawInputs);

    // Persist normalised events
    const created = await prisma.timelineEvent.createMany({
      data: normalised.map((ev) => ({
        id: ev.id,
        caseId: ev.caseId,
        evidenceId: ev.evidenceId,
        timestamp: ev.timestamp,
        description: ev.description,
        sourceType: ev.sourceType,
        phase: ev.phase,
      })),
    });

    return Response.json(
      {
        message: `${created.count} timeline events ingested and normalised.`,
        events: normalised.map((ev) => ({
          id: ev.id,
          isoTimestamp: ev.isoTimestamp,
          phase: ev.phase,
          description: ev.description,
          sourceType: ev.sourceType,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unable to parse timestamp")) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    console.error("[POST /api/cases/[caseId]/timeline] Error:", err);
    return Response.json(
      { error: "Timeline ingestion failed.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
