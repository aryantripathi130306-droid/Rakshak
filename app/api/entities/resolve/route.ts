// ─────────────────────────────────────────────────────────────────────────────
// app/api/entities/resolve/route.ts
// POST /api/entities/resolve
//
// Triggers deterministic entity normalization and candidate link evaluation
// for a specified authorized case.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOfficer } from "@/services/authService";
import { canAccessCase, hasPermission } from "@/lib/accessControl";
import { evaluateCandidateLink } from "@/lib/entityResolution";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateOfficer(request);
    if (!authResult) {
      return Response.json({ error: "Unauthorized: Active session required." }, { status: 401 });
    }
    const { officer } = authResult;

    if (!hasPermission(officer.role, "case:edit") && !hasPermission(officer.role, "syndicate:read")) {
      return Response.json(
        { error: "Forbidden: Lacks authority to trigger entity resolution." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.caseId) {
      return Response.json({ error: "Bad Request: 'caseId' is required." }, { status: 400 });
    }

    const p = prisma as any;
    const targetCase = await p.case.findFirst({
      where: { OR: [{ id: body.caseId }, { caseNumber: body.caseId }] },
    });

    if (!targetCase) {
      return Response.json({ error: `Case '${body.caseId}' not found.` }, { status: 404 });
    }

    const authCheck = canAccessCase(officer, targetCase, "read:metadata");
    if (!authCheck.allowed) {
      return Response.json({ error: "Access Denied: Officer lacks access to target case." }, { status: 403 });
    }

    // 1. Load entities for target case
    const targetEntities = await p.caseEntity.findMany({
      where: { caseId: targetCase.id },
    });

    if (targetEntities.length === 0) {
      return Response.json({ message: "No entities extracted for this case yet.", candidateCount: 0 });
    }

    const normValues = targetEntities.map((e: any) => e.normalizedValue);

    // 2. Find matching entities in other cases
    const potentialMatches = await p.caseEntity.findMany({
      where: {
        normalizedValue: { in: normValues },
        caseId: { not: targetCase.id },
      },
      include: {
        case: {
          select: { id: true, caseNumber: true, departmentId: true, jurisdiction: true, status: true },
        },
      },
    });

    let createdCount = 0;
    const candidatesCreated: any[] = [];

    for (const match of potentialMatches) {
      const sourceEnt = targetEntities.find((e: any) => e.normalizedValue === match.normalizedValue && e.entityType === match.entityType);
      if (!sourceEnt) continue;

      const evalRes = evaluateCandidateLink({
        sourceCaseId: targetCase.id,
        sourceCaseNumber: targetCase.caseNumber,
        targetCaseId: match.case.id,
        targetCaseNumber: match.case.caseNumber,
        sourceEntityId: sourceEnt.id,
        targetEntityId: match.id,
        entityType: sourceEnt.entityType,
        rawValueA: sourceEnt.rawValue,
        rawValueB: match.rawValue,
      });

      if (!evalRes.isMatch) continue;

      // Upsert candidate link
      try {
        const link = await p.entityLink.upsert({
          where: {
            sourceCaseId_targetCaseId_entityType_normalizedValue_linkType: {
              sourceCaseId: evalRes.sourceCaseId,
              targetCaseId: evalRes.targetCaseId,
              entityType: evalRes.entityType,
              normalizedValue: evalRes.normalizedValue!,
              linkType: evalRes.linkType!,
            },
          },
          update: {
            explanation: evalRes.explanation,
            confidenceCategory: evalRes.confidenceCategory!,
            limitations: evalRes.limitations || null,
            isGeneric: evalRes.isGeneric,
            updatedAt: new Date(),
          },
          create: {
            sourceEntityId: evalRes.sourceEntityId || null,
            targetEntityId: evalRes.targetEntityId || null,
            sourceCaseId: evalRes.sourceCaseId,
            targetCaseId: evalRes.targetCaseId,
            entityType: evalRes.entityType,
            normalizedValue: evalRes.normalizedValue!,
            linkType: evalRes.linkType!,
            matchRule: evalRes.matchRule!,
            normalizationVersion: evalRes.normalizationVersion,
            explanation: evalRes.explanation,
            status: "CANDIDATE",
            confidenceCategory: evalRes.confidenceCategory!,
            limitations: evalRes.limitations || null,
            isGeneric: evalRes.isGeneric,
            createdBy: `resolver::${officer.badgeNumber || officer.id}`,
            version: 1,
          },
        });

        candidatesCreated.push(link);
        createdCount++;
      } catch (upsertErr) {
        // Unique conflict or simultaneous creation handled safely
      }
    }

    return Response.json(
      {
        message: `Entity resolution completed for case '${targetCase.caseNumber}'.`,
        candidateCount: createdCount,
        candidates: candidatesCreated,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/entities/resolve] Error:", err);
    return Response.json(
      { error: "Entity resolution failed.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
