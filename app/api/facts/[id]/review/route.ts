// ─────────────────────────────────────────────────────────────────────────────
// app/api/facts/[id]/review/route.ts
// POST /api/facts/:id/review — Submit human review/correction decision
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";
import { submitFactReviewAsync, type FactReviewDecision } from "@/lib/factReview";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateOfficer(request);

    if (!auth || !auth.officer) {
      return Response.json(
        { error: "Authentication required to review extracted facts." },
        { status: 401 }
      );
    }

    if (auth.officer.status === "SUSPENDED") {
      return Response.json(
        { error: "Access denied: Officer account is SUSPENDED. Active account required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { decision, correctedValue, rationale } = body;

    if (!decision) {
      return Response.json(
        { error: "Validation failed: 'decision' is required (ACCEPT, CORRECT, REJECT, SUPERSEDE, REOPEN)." },
        { status: 400 }
      );
    }

    const reviewResult = await submitFactReviewAsync(
      id,
      {
        reviewerId: auth.officer.id,
        reviewerName: auth.officer.name,
        reviewerBadge: auth.officer.badgeNumber,
        reviewerRole: auth.officer.role,
        reviewerDeptId: auth.officer.departmentId || "dept_default",
        isReviewerSuspended: auth.officer.status === "SUSPENDED",
        decision: decision as FactReviewDecision,
        correctedValue,
        rationale: rationale || "",
      },
      prisma
    );

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: `FACT_REVIEW_${decision.toUpperCase()}`,
      module: "Evidence",
      targetType: "ExtractedFact",
      targetId: id,
      details: `Fact ${id} (${reviewResult.fact.entityType}) review decision '${decision}' by ${auth.officer.name}: ${rationale}`,
      result: "SUCCESS",
      ipAddress,
    }).catch(() => {});

    return Response.json(
      {
        success: true,
        fact: reviewResult.fact,
        historyRecord: reviewResult.historyRecord,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/facts/[id]/review] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("Access denied")
      ? 403
      : msg.includes("Authentication required")
      ? 401
      : msg.includes("not found")
      ? 404
      : msg.includes("Validation failed") || msg.includes("Invalid state transition")
      ? 400
      : 500;

    return Response.json(
      { error: "Fact review submission failed", details: msg },
      { status }
    );
  }
}
