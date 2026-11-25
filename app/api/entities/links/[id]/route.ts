// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/links/[id]/route.ts
// GET /api/entities/links/[id]
//
// Fetches entity link details, match explanation, source provenance,
// and complete immutable review decision history.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { canAccessCase, hasPermission } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;

    if (!hasPermission(officer.role, "syndicate:view") && !hasPermission(officer.role, "syndicate:read")) {
      return Response.json(
        { error: "Forbidden: Lacks intelligence link viewing authority." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const p = prisma as any;

    const link = await p.entityLink.findUnique({
      where: { id },
      include: {
        sourceCase: {
          select: {
            id: true,
            caseNumber: true,
            incidentType: true,
            jurisdiction: true,
            status: true,
            departmentId: true,
          },
        },
        targetCase: {
          select: {
            id: true,
            caseNumber: true,
            incidentType: true,
            jurisdiction: true,
            status: true,
            departmentId: true,
          },
        },
        reviews: {
          orderBy: { reviewedAt: "desc" },
        },
      },
    });

    if (!link) {
      return Response.json({ error: `Entity link '${id}' not found.` }, { status: 404 });
    }

    // Must have access to at least one of the linked cases to view link details
    const sourceAccess = canAccessCase(officer, link.sourceCase, "read:metadata");
    const targetAccess = canAccessCase(officer, link.targetCase, "read:metadata");

    if (!sourceAccess.allowed && !targetAccess.allowed) {
      return Response.json(
        { error: "Access Denied: Officer lacks authorized access to linked case records." },
        { status: 403 }
      );
    }

    // Mask case details if one of the cases is inaccessible
    const sanitizedLink = {
      ...link,
      sourceCase: sourceAccess.allowed ? link.sourceCase : { id: link.sourceCase.id, caseNumber: "[RESTRICTED]" },
      targetCase: targetAccess.allowed ? link.targetCase : { id: link.targetCase.id, caseNumber: "[RESTRICTED]" },
    };

    return Response.json(sanitizedLink, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/entities/links/[id]] Error:", err);
    return Response.json(
      { error: "Failed to fetch entity link details.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
