// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/links/[id]/review/route.ts
// POST /api/entities/links/[id]/review
//
// Controlled human review endpoint for candidate links.
// Enforces role authority, state machine rules, rationale capture,
// optimistic concurrency, and audit trail preservation.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { submitEntityLinkReview } from "@/lib/entityReview";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ error: "Bad Request: JSON body required." }, { status: 400 });
    }

    const { toStatus, rationale, expectedVersion } = body;
    if (!toStatus || !rationale) {
      return Response.json(
        { error: "Bad Request: 'toStatus' and 'rationale' are required." },
        { status: 400 }
      );
    }

    const result = await submitEntityLinkReview(prisma, {
      linkId: id,
      toStatus,
      rationale,
      expectedVersion,
      officer,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: result.statusCode || 400 });
    }

    // Write audit event
    const p = prisma as any;
    if (p.auditLog) {
      await p.auditLog.create({
        data: {
          officerId: officer.id,
          officerName: officer.name,
          officerBadge: officer.badgeNumber || null,
          action: "REVIEW_ENTITY_LINK",
          module: "Syndicate",
          targetType: "EntityLink",
          targetId: id,
          details: `Officer transitioned entity link '${id}' to '${toStatus}'. Rationale: ${rationale}`,
          result: "SUCCESS",
        },
      }).catch(() => {});
    }

    return Response.json(
      {
        message: `Entity link transitioned to '${toStatus}'.`,
        link: result.link,
        review: result.review,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/entities/links/[id]/review] Error:", err);
    return Response.json(
      { error: "Failed to submit entity link review.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
