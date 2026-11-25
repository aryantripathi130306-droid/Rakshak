// ─────────────────────────────────────────────────────────────────────────────
// app/api/evidence/[id]/custody/route.ts
// GET  /api/evidence/:id/custody — Fetch chronological chain of custody log with verifier proof
// POST /api/evidence/:id/custody — Append a new authenticated, cryptographically chained custody event
// PUT / PATCH / DELETE           — 405 Method Not Allowed (Immutable ledger protection)
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import {
  appendCustodyEventAsync,
  verifyCustodyChainEvents,
} from "@/lib/custodyChain";

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
      orderBy: { sequenceNumber: "asc" },
    })) || []) as any[];

    const chainVerification = verifyCustodyChainEvents(events);

    return Response.json(
      {
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        caseNumber: evidence.case?.caseNumber || "",
        sha256Hash: evidence.sha256Hash,
        chainVerification,
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
            prevEventHash: ev.prevEventHash || null,
            eventHash: ev.eventHash || null,
            sequenceNumber: ev.sequenceNumber || null,
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

    // Authentication & authorization requirement: Workstream D
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json(
        { error: "Authentication required to log chain of custody events." },
        { status: 401 }
      );
    }

    if (auth.officer.status !== "ACTIVE") {
      return Response.json(
        { error: "Inactive accounts cannot record chain of custody events." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { eventType = "OFFICER_NOTE", action, result = "SUCCESS", details } = body;

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

    // Always attribute actor from authenticated server-side identity (reject spoofed client strings)
    const authoritativeActor = `${auth.officer.name} (${auth.officer.badgeNumber})`;

    const newEvent = await appendCustodyEventAsync({
      evidenceId: evidence.id,
      eventType,
      actor: authoritativeActor,
      action,
      result: ["SUCCESS", "VERIFIED", "FAILED", "WARNING"].includes(result) ? result : "SUCCESS",
      details: {
        ...(typeof details === "object" && details !== null ? details : { note: details }),
        officerId: auth.officer.id,
        officerBadge: auth.officer.badgeNumber,
        departmentId: auth.officer.departmentId,
      },
    });

    return Response.json(
      {
        message: "Custody event logged successfully with cryptographic hash chaining.",
        event: {
          id: newEvent.id,
          eventType: newEvent.eventType,
          actor: newEvent.actor,
          action: newEvent.action,
          result: newEvent.result,
          prevEventHash: newEvent.prevEventHash,
          eventHash: newEvent.eventHash,
          sequenceNumber: newEvent.sequenceNumber,
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

// ── Immutability Enforcement: Reject Mutation Attempts ──────────────────────────
export async function PUT() {
  return Response.json(
    { error: "Method Not Allowed: Chain of Custody records are immutable and cannot be updated." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}

export async function PATCH() {
  return Response.json(
    { error: "Method Not Allowed: Chain of Custody records are immutable and cannot be patched." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}

export async function DELETE() {
  return Response.json(
    { error: "Method Not Allowed: Chain of Custody records are append-only and cannot be deleted." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}
