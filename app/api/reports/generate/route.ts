// ─────────────────────────────────────────────────────────────────────────────
// app/api/reports/generate/route.ts
// POST /api/reports/generate — Generate & persist investigation report
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer, hasPermission, logAuditEvent } from "@/services/authService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOfficer(request);
    if (!auth || !hasPermission(auth.officer.role, "reports:generate")) {
      return Response.json(
        { error: "Access denied: requires reports:generate permission" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      caseId,
      reportType = "INVESTIGATION_COMPLETE",
      outputFormat = "PDF",
      sections = ["Case Details", "Legal Matrix", "Timeline Events", "Evidence Manifest", "Syndicate Links"],
    } = body;

    const p = prisma as any;
    let targetCase: any = null;
    if (caseId) {
      targetCase = await p.case.findFirst({
        where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
        include: {
          evidence: true,
          timeline: true,
          entities: true,
          legalMappings: true,
        },
      });
    }

    const caseNumber = targetCase?.caseNumber || caseId || "GLOBAL";
    const reportSeq = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
    const reportNumber = `RPT-${new Date().getFullYear()}-${reportSeq}`;

    const reportTitle = targetCase
      ? `${(reportType || "INVESTIGATION").replace(/_/g, " ")} — #${caseNumber}`
      : `Forensic Platform Investigation Report — ${reportNumber}`;

    const reportPayload = {
      reportNumber,
      reportType,
      generatedAt: new Date().toISOString(),
      platform: "Rakshak v3.0 Forensic Digital Intelligence",
      officer: {
        name: auth.officer.name,
        badge: auth.officer.badgeNumber,
        designation: auth.officer.designation,
        jurisdiction: auth.officer.jurisdiction,
      },
      caseMetadata: targetCase
        ? {
            caseId: targetCase.id,
            caseNumber: targetCase.caseNumber,
            incidentType: targetCase.incidentType,
            jurisdiction: targetCase.jurisdiction,
            complainant: targetCase.complainantName,
            status: targetCase.status,
            amountDefrauded: targetCase.amountDefrauded,
            evidenceCount: targetCase.evidence?.length || 0,
            timelineEventCount: targetCase.timeline?.length || 0,
            entityCount: targetCase.entities?.length || 0,
          }
        : null,
      sectionsIncluded: sections,
    };

    const newReport = await p.generatedReport.create({
      data: {
        reportNumber,
        reportType,
        caseId: targetCase?.id || null,
        title: reportTitle,
        generatedBy: auth.officer.name,
        officerId: auth.officer.id,
        status: "COMPLETED",
        outputFormat: outputFormat.toUpperCase(),
        sectionsIncluded: JSON.stringify(sections),
        fileSizeBytes: 2150000,
        metadata: JSON.stringify(reportPayload),
      },
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.45.67.89";
    await logAuditEvent({
      officerId: auth.officer.id,
      officerName: auth.officer.name,
      officerBadge: auth.officer.badgeNumber,
      action: "GENERATE_REPORT",
      module: "Reports",
      targetType: "Report",
      targetId: newReport.id,
      details: `Generated ${reportType} report ${reportNumber} for case #${caseNumber}`,
      result: "SUCCESS",
      ipAddress,
    });

    return Response.json(
      {
        success: true,
        report: newReport,
        payload: reportPayload,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/reports/generate] Error:", err);
    return Response.json(
      { error: "Report generation failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
