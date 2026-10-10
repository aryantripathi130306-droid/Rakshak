// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/custody/route.ts
// GET  /api/evidence/:id/custody — Fetch chronological chain of custody log
// POST /api/evidence/:id/custody — Append a new custody/audit event
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidence = (await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
      include: {
        case: { select: { caseNumber: true } },
      },
    })) as any;

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    const events = ((await (prisma as any).custodyEvent.findMany({
      where: { evidenceId: evidence.id },
      orderBy: { timestamp: "asc" },
    })) || []) as any[];

    return Response.json(
      {
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        caseNumber: evidence.case?.caseNumber || "",
        sha256Hash: evidence.sha256Hash,
        custodyLog: events.map((ev: any) => {
          let parsedDetails: unknown = null;
          if (ev.details) {
            try {
              parsedDetails = JSON.parse(ev.details);
            } catch {
              parsedDetails = ev.details;
            }
          }
          return {
            id: ev.id,
            eventType: ev.eventType,
            actor: ev.actor,
            action: ev.action,
            result: ev.result,
            details: parsedDetails,
            timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : "",
          };
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/evidence/[id]/custody] Error:", err);
    return Response.json(
      { error: "Failed to fetch custody log.", details: err instanceof Error ? err.message : String(err) },
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
    const body = await request.json();

    const { eventType, actor, action, result = "SUCCESS", details } = body;

    if (!action || typeof action !== "string") {
      return Response.json({ error: "Missing required field: action" }, { status: 400 });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        OR: [{ id }, { sha256Hash: id }],
      },
    });

    if (!evidence) {
      return Response.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }

    const newEvent = await (prisma as any).custodyEvent.create({
      data: {
        evidenceId: evidence.id,
        eventType: eventType || "OFFICER_NOTE",
        actor: actor || "Investigating Officer",
        action,
        result: ["SUCCESS", "VERIFIED", "FAILED", "WARNING"].includes(result) ? result : "SUCCESS",
        details: typeof details === "object" ? JSON.stringify(details) : details ? String(details) : null,
      },
    });

    return Response.json(
      {
        message: "Custody event logged successfully.",
        event: {
          id: newEvent.id,
          eventType: newEvent.eventType,
          actor: newEvent.actor,
          action: newEvent.action,
          result: newEvent.result,
          timestamp: newEvent.timestamp.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/evidence/[id]/custody] Error:", err);
    return Response.json(
      { error: "Failed to record custody event.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
