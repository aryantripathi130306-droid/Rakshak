// ─────────────────────────────────────────────────────────────────────────────
// app/api/feedback/route.ts
// GET & POST /api/feedback — Pilot Feedback & Defect Management Engine
//
// Allows authorized pilot testers to submit, search, and track issues, defects,
// and workflow feedback during controlled internal evaluation.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authenticateOfficer, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

const CreateFeedbackSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  module: z.enum([
    "EVIDENCE_VAULT",
    "OCR_EXTRACTION",
    "TIMELINE",
    "SYNDICATE_GRAPH",
    "LEGAL_DOSSIER",
    "REPORTS",
    "RBAC_AUTH",
    "INFRASTRUCTURE",
  ]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  stepsToReproduce: z.string().optional().nullable(),
  expectedBehavior: z.string().optional().nullable(),
  actualBehavior: z.string().optional().nullable(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  environment: z.string().default("Staging Sandbox v3.0"),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required to view feedback" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const module = searchParams.get("module")?.trim() || "";
    const severity = searchParams.get("severity")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where: any = {};
    if (module) where.module = module;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { feedbackNumber: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { reporterName: { contains: q } },
      ];
    }

    const p = prisma as any;
    const [items, totalCount, countsByStatus, countsBySeverity] = await Promise.all([
      p.pilotFeedback.findMany({
        where,
        orderBy: { createdAt: sortOrder },
      }),
      p.pilotFeedback.count({ where }),
      p.pilotFeedback.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      p.pilotFeedback.groupBy({
        by: ["severity"],
        _count: { severity: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      OPEN: 0,
      TRIAGED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    for (const c of countsByStatus) {
      statusCounts[c.status] = c._count.status;
    }

    const severityCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    for (const c of countsBySeverity) {
      severityCounts[c.severity] = c._count.severity;
    }

    return Response.json({
      items,
      totalCount,
      statusCounts,
      severityCounts,
      userRole: auth.officer.role,
    });
  } catch (err: any) {
    console.error("[GET /api/feedback] Error:", err);
    return Response.json({ error: err.message || "Failed to fetch feedback items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth) {
      return Response.json({ error: "Authentication required to submit feedback" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Reject raw credentials/tokens/leak patterns
    const forbiddenPatterns = [/password/i, /secret/i, /bearer\s+[a-z0-9]/i, /session=/i];
    const combinedText = `${data.title} ${data.description} ${data.stepsToReproduce || ""} ${data.expectedBehavior || ""}`;
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(combinedText) && /api_key|token=|private_key/i.test(combinedText)) {
        return Response.json(
          { error: "Submission rejected: Suspected credential or token exposure detected in text." },
          { status: 400 }
        );
      }
    }

    const p = prisma as any;
    const count = await p.pilotFeedback.count();
    const feedbackNumber = `FDB-2026-${(count + 1).toString().padStart(3, "0")}`;

    const created = await p.pilotFeedback.create({
      data: {
        feedbackNumber,
        title: data.title,
        module: data.module,
        description: data.description,
        stepsToReproduce: data.stepsToReproduce || null,
        expectedBehavior: data.expectedBehavior || null,
        actualBehavior: data.actualBehavior || null,
        severity: data.severity,
        environment: data.environment,
        status: "OPEN",
        reporterBadge: auth.officer.badgeNumber,
        reporterName: `${auth.officer.name} (${auth.officer.role})`,
        assignedReviewer: "QA Lead",
      },
    });

    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "FEEDBACK_SUBMITTED",
      module: "PILOT_OPERATIONS",
      targetType: "PILOT_FEEDBACK",
      targetId: created.id,
      details: `Pilot feedback ${created.feedbackNumber} (${created.severity}) submitted for module ${created.module}`,
      result: "SUCCESS",
      metadata: { feedbackNumber: created.feedbackNumber, module: created.module, severity: created.severity },
    });

    return Response.json({ success: true, item: created }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/feedback] Error:", err);
    return Response.json({ error: err.message || "Failed to record feedback" }, { status: 500 });
  }
}
