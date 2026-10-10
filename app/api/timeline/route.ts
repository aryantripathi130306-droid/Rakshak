// ─────────────────────────────────────────────────────────────────────────────
// app/api/timeline/route.ts
// GET  /api/timeline — Forensic Chronology & Event Intelligence
// POST /api/timeline — Ingest and normalise new forensic timeline events
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { normalizeTimeline, classifyPhase, formatIST, parseTimestamp } from "@/services/timelineService";
import { RawEventInputSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const phase = searchParams.get("phase");
    const sourceType = searchParams.get("sourceType");
    const evidenceId = searchParams.get("evidenceId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const q = searchParams.get("q");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (caseId && caseId !== "ALL") {
      const caseRec = await prisma.case.findFirst({
        where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
        select: { id: true },
      });
      if (caseRec) {
        where.caseId = caseRec.id;
      } else {
        where.caseId = caseId;
      }
    }

    if (phase && phase !== "ALL") {
      where.phase = phase.toUpperCase();
    }

    if (sourceType && sourceType !== "ALL") {
      where.sourceType = sourceType.toUpperCase();
    }

    if (evidenceId && evidenceId !== "ALL") {
      where.evidenceId = evidenceId;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        try { dateFilter.gte = new Date(startDate); } catch {}
      }
      if (endDate) {
        try { dateFilter.lte = new Date(endDate); } catch {}
      }
      if (Object.keys(dateFilter).length > 0) {
        where.timestamp = dateFilter;
      }
    }

    if (q) {
      where.description = { contains: q };
    }

    // Query events with related evidence, facts, and case
    const events = await prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: "asc" },
      include: {
        evidence: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            mimeType: true,
            fileSize: true,
            sha256Hash: true,
            evidenceCategory: true,
            facts: {
              select: {
                id: true,
                entityType: true,
                rawValue: true,
                normalizedValue: true,
                confidence: true,
                factAssertion: true,
              },
            },
          },
        },
        case: {
          select: {
            id: true,
            caseNumber: true,
            incidentType: true,
            complainantName: true,
            jurisdiction: true,
            status: true,
            amountDefrauded: true,
          },
        },
      },
    });

    // Compute metrics
    const totalEvents = events.length;
    const phaseCounts: Record<string, number> = {
      CONTACT: 0,
      TRUST: 0,
      PAYMENT: 0,
      SEVERED: 0,
      UNKNOWN: 0,
    };
    const sourceCounts: Record<string, number> = {};
    const evidenceSet = new Set<string>();
    const caseSet = new Set<string>();

    // Collect normalized values to find cross-case linkages
    const allNormalizedEntities = new Set<string>();

    for (const ev of events) {
      const p = ev.phase || "UNKNOWN";
      phaseCounts[p] = (phaseCounts[p] || 0) + 1;

      const s = ev.sourceType || "UNKNOWN";
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;

      if (ev.evidenceId) evidenceSet.add(ev.evidenceId);
      if (ev.caseId) caseSet.add(ev.caseId);

      if (ev.evidence?.facts) {
        for (const f of ev.evidence.facts) {
          if (f.normalizedValue) allNormalizedEntities.add(f.normalizedValue);
        }
      }
    }

    // Find cross-case matches for any extracted entities present in these events
    let crossCaseMatches: Array<{
      normalizedValue: string;
      entityType: string;
      caseId: string;
      caseNumber: string;
      incidentType: string;
      jurisdiction: string;
    }> = [];

    if (allNormalizedEntities.size > 0) {
      const otherCaseEntities = await prisma.caseEntity.findMany({
        where: {
          normalizedValue: { in: Array.from(allNormalizedEntities) },
        },
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              incidentType: true,
              jurisdiction: true,
            },
          },
        },
      });

      crossCaseMatches = otherCaseEntities.map((ce) => ({
        normalizedValue: ce.normalizedValue,
        entityType: ce.entityType,
        caseId: ce.case.id,
        caseNumber: ce.case.caseNumber,
        incidentType: ce.case.incidentType,
        jurisdiction: ce.case.jurisdiction || "Cyber Cell",
      }));
    }

    // Format events with IST representation and enriched details
    const formattedEvents = events.map((ev) => {
      const dateObj = new Date(ev.timestamp);
      const istString = formatIST(dateObj);

      // Extract transaction amounts or destinations from description if present
      const amountMatch = ev.description.match(/(?:₹|rs\.?|inr\s*)([0-9,]+)/i);
      const amount = amountMatch ? `₹${amountMatch[1]}` : null;

      // Extract UPI/Phone/Account hints from related facts
      const facts = ev.evidence?.facts || [];
      const upiFact = facts.find((f) => f.entityType === "UPI");
      const phoneFact = facts.find((f) => f.entityType === "PHONE");
      const utrFact = facts.find((f) => f.entityType === "UTR");
      const accountFact = facts.find((f) => f.entityType === "ACCOUNT");

      // Cross-case matches specifically relevant to this event's entities
      const eventNorms = new Set(facts.map((f) => f.normalizedValue));
      const relevantCrossMatches = crossCaseMatches.filter(
        (cm) => eventNorms.has(cm.normalizedValue) && cm.caseId !== ev.caseId
      );

      return {
        id: ev.id,
        caseId: ev.caseId,
        caseNumber: ev.case?.caseNumber || "—",
        evidenceId: ev.evidenceId,
        evidenceFileName: ev.evidence?.fileName || "—",
        evidenceCategory: ev.evidence?.evidenceCategory || "OTHER",
        timestamp: ev.timestamp.toISOString(),
        timestampIST: istString,
        description: ev.description,
        sourceType: ev.sourceType,
        phase: ev.phase,
        createdAt: ev.createdAt.toISOString(),
        evidence: ev.evidence,
        case: ev.case,
        facts,
        extractedEntities: facts.map((f) => ({
          type: f.entityType,
          value: f.normalizedValue,
          rawValue: f.rawValue,
          confidence: f.confidence,
          assertion: f.factAssertion,
        })),
        details: {
          amount,
          destination: upiFact?.normalizedValue || accountFact?.normalizedValue || null,
          utrNumber: utrFact?.normalizedValue || null,
          contact: phoneFact?.normalizedValue || null,
        },
        crossCaseMatches: relevantCrossMatches,
      };
    });

    // Modus Operandi Narrative Synthesis
    const modusOperandi = [
      {
        phase: "CONTACT",
        label: "Contact",
        count: phaseCounts.CONTACT || 0,
        description: "Initial approach via WhatsApp/SMS advertising part-time review or task opportunities.",
      },
      {
        phase: "TRUST",
        label: "Trust Building",
        count: phaseCounts.TRUST || 0,
        description: "Small payout or demo commission credited to establish credibility and lower suspicion.",
      },
      {
        phase: "PAYMENT",
        label: "Fraudulent Transfers",
        count: phaseCounts.PAYMENT || 0,
        description: "Multiple escalating transfers requested under upgrade, tax, or account unfreeze pretexts.",
      },
      {
        phase: "SEVERED",
        label: "Severed Communication",
        count: phaseCounts.SEVERED || 0,
        description: "Demands for large penalty, subsequent victim blocking, and suspect channels deleted.",
      },
    ];

    const uniqueLinkedCases = new Set(crossCaseMatches.map((cm) => cm.caseNumber)).size;

    return Response.json(
      {
        events: formattedEvents,
        metrics: {
          totalEvents,
          phaseCounts,
          sourceCounts,
          evidenceCount: evidenceSet.size,
          linkedCasesCount: uniqueLinkedCases || caseSet.size,
          activeInvestigation: 1,
        },
        modusOperandi,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/timeline] Error:", err);
    return Response.json(
      { error: "Failed to fetch forensic timeline.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

const IngestTimelineSchema = z.object({
  caseId: z.string().min(1),
  events: z.array(
    z.object({
      rawTimestamp: z.string(),
      description: z.string().min(5),
      sourceType: z.enum([
        "WHATSAPP",
        "BANK_SMS",
        "RECEIPT",
        "CALL_LOG",
        "SCREENSHOT",
        "EMAIL",
        "AUDIO",
        "DOMAIN",
        "OTHER",
      ]).default("WHATSAPP"),
      evidenceId: z.string(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = IngestTimelineSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { caseId, events } = parsed.data;

    const caseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });
    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    const rawInputs = events.map((ev) =>
      RawEventInputSchema.parse({
        ...ev,
        caseId: caseRecord.id,
      })
    );

    const normalised = normalizeTimeline(rawInputs);

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
    console.error("[POST /api/timeline] Error:", err);
    return Response.json(
      { error: "Failed to ingest timeline events.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
