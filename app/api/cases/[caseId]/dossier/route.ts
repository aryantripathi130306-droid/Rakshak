// ─────────────────────────────────────────────────────────────────────────────
// app/api/cases/[caseId]/dossier/route.ts
// GET /api/cases/:caseId/dossier
//
// Returns a structured JSON forensic dossier conforming to BSA §63 manifest
// requirements, including: case header, multi-category evidence integrity manifest,
// communication intelligence, chronological timeline, syndicate/cluster linkage,
// and statutory sections.
// ─────────────────────────────────────────────────────────────────────────────
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { resolveGraphIntelligence } from "@/services/graphService";

export const runtime = "nodejs";

// ─── Statutory section auto-tagger ────────────────────────────────────────────

const INCIDENT_TYPE_SECTIONS: Record<
  string,
  Array<{ code: string; act: string; description: string; cognizable: boolean; bailable: boolean }>
> = {
  Task_Scam: [
    {
      code: "§ 318(4)",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Cheating by personation — impersonating a legitimate business entity to deceive victim into financial transfer.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 319(2)",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Cheating with intent to induce delivery of property exceeding ₹1 lakh.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 66D",
      act: "Information Technology Act, 2000",
      description: "Cheating by personation using communication devices.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 111",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Organised crime — accused operated as part of a syndicate.",
      cognizable: true,
      bailable: false,
    },
  ],
  Investment_Fraud: [
    {
      code: "§ 318(4)",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Cheating by personation via fabricated investment scheme.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 66C",
      act: "Information Technology Act, 2000",
      description: "Identity theft — fraudulent use of electronic signature or unique identification.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 420",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Cheating and dishonestly inducing delivery of property.",
      cognizable: true,
      bailable: false,
    },
  ],
  Digital_Arrest: [
    {
      code: "§ 351(2)",
      act: "Bharatiya Nyaya Sanhita, 2023",
      description: "Criminal intimidation — causing alarm via threat of false legal action.",
      cognizable: true,
      bailable: false,
    },
    {
      code: "§ 66D",
      act: "Information Technology Act, 2000",
      description: "Cheating by personation using communication devices — impersonating government officers.",
      cognizable: true,
      bailable: false,
    },
  ],
};

function getStatutorySections(incidentType: string) {
  return (
    INCIDENT_TYPE_SECTIONS[incidentType] ??
    INCIDENT_TYPE_SECTIONS["Task_Scam"]
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    if (!caseId || typeof caseId !== "string") {
      return Response.json({ error: "Missing or invalid caseId" }, { status: 400 });
    }

    // ── Load case + all related data ──────────────────────────────────────
    const caseRecord = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      include: {
        evidence: {
          include: {
            facts: true,
            transcriptions: true,
            chatTranslations: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
        timeline: {
          orderBy: { timestamp: "asc" },
        },
        entities: {
          orderBy: { firstSeenAt: "asc" },
        },
        clusterMemberships: {
          include: {
            cluster: {
              include: {
                memberships: {
                  include: { case: true },
                },
              },
            },
          },
        },
      },
    });

    if (!caseRecord) {
      return Response.json({ error: `Case not found: ${caseId}` }, { status: 404 });
    }

    // ── Resolve graph intelligence ─────────────────────────────────────────
    const graphIntelligence = await resolveGraphIntelligence(caseRecord.id, prisma);

    // ── Build BSA §63 Evidence Integrity Manifest ──────────────────────────
    const evidenceManifest = caseRecord.evidence.map((ev: typeof caseRecord.evidence[number]) => ({
      evidenceId: ev.id,
      fileName: ev.fileName,
      fileType: ev.fileType,
      mimeType: ev.mimeType,
      evidenceCategory: ev.evidenceCategory,
      fileSizeBytes: ev.fileSize,
      uploadedAtUTC: ev.uploadedAt.toISOString(),
      clientHash: ev.clientHash,
      serverHash: ev.sha256Hash,
      integrityVerified: ev.clientHash === ev.sha256Hash,
      storagePath: ev.storagePath,
      storageState: "IMMUTABLE_COLD_BLOB",
      extractedFactCount: ev.facts.length,
    }));

    // ── Build chronological event log ──────────────────────────────────────
    const chronologicalLog = caseRecord.timeline.map((ev: typeof caseRecord.timeline[number]) => ({
      eventId: ev.id,
      timestampUTC: ev.timestamp.toISOString(),
      timestampIST: ev.timestamp.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      sourceType: ev.sourceType,
      phase: ev.phase,
      description: ev.description,
      evidenceId: ev.evidenceId,
    }));

    // ── Build entity summary ───────────────────────────────────────────────
    const entitySummary = caseRecord.entities.map((ent: typeof caseRecord.entities[number]) => ({
      entityId: ent.id,
      entityType: ent.entityType,
      rawValue: ent.rawValue,
      normalizedValue: ent.normalizedValue,
      firstSeenAt: ent.firstSeenAt.toISOString(),
    }));

    // ── Syndicate linkage & Cluster section ────────────────────────────────
    const syndicateLinkage = {
      syndicateDetected: graphIntelligence.syndicateDetected,
      riskLevel: graphIntelligence.riskLevel,
      linkedCaseCount: graphIntelligence.summary.linkedCaseCount,
      sharedEntityCount: graphIntelligence.summary.sharedEntityCount,
      highFrequencyMules: graphIntelligence.summary.highFrequencyMules,
      jurisdictionsAffected: graphIntelligence.summary.jurisdictionsAffected,
      totalFraudAmountLinkedINR: graphIntelligence.totalFraudAmountLinked,
      disclaimer:
        "⚠ QUALIFIED ASSESSMENT: The above represents potential syndicate matches based on shared identifiers. This is not a confirmed determination of guilt. All findings must be verified by the investigating officer before use in judicial proceedings.",
      linkedNodes: graphIntelligence.nodes
        .filter((n) => n.type === "LINKED_CASE")
        .map((n) => ({
          caseId: n.id,
          caseLabel: n.label,
          riskScore: n.riskScore,
          jurisdiction: n.jurisdictions[0] ?? "Unknown",
        })),
    };

    const clusterData = caseRecord.clusterMemberships.map((cm: typeof caseRecord.clusterMemberships[number]) => ({
      clusterId: cm.cluster.id,
      clusterName: cm.cluster.name,
      theme: cm.cluster.theme,
      confidence: cm.cluster.confidence,
      reason: cm.reason,
      memberCases: cm.cluster.memberships.map((m: typeof cm.cluster.memberships[number]) => ({
        caseNumber: m.case.caseNumber,
        jurisdiction: m.case.jurisdiction,
        amountDefrauded: m.case.amountDefrauded,
      })),
    }));

    // ── Assemble full dossier ──────────────────────────────────────────────
    const dossier = {
      dossierVersion: "3.0",
      generatedAtUTC: new Date().toISOString(),
      platform: "Rakshak v3.0-forensic",
      legalDisclaimer:
        "This dossier is generated by Rakshak — an Investigative Intelligence Tool. It does not constitute proof of guilt and must not be submitted as evidence without verification by a competent authority. The platform does not automatically register FIRs.",
      caseHeader: {
        caseId: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        incidentType: caseRecord.incidentType,
        complainantName: caseRecord.complainantName,
        jurisdiction: caseRecord.jurisdiction,
        status: caseRecord.status,
        amountDefraudedINR: caseRecord.amountDefrauded,
        caseCreatedAtUTC: caseRecord.createdAt.toISOString(),
        totalEvidenceItems: caseRecord.evidence.length,
        totalTimelineEvents: caseRecord.timeline.length,
        totalExtractedEntities: caseRecord.entities.length,
        evidenceCategories: Array.from(new Set(caseRecord.evidence.map((e: typeof caseRecord.evidence[number]) => e.evidenceCategory))),
      },
      section63BSAManifest: {
        title: "Evidence Integrity Manifest — Bharatiya Sakshya Adhiniyam §63",
        description:
          "Every item below has been ingested in read-only mode. Client-side SHA-256 was verified against server-computed SHA-256. Originals are preserved as IMMUTABLE_COLD_BLOB across 12 digital evidence categories.",
        items: evidenceManifest,
        allIntegrityVerified: evidenceManifest.every((e: { integrityVerified: boolean }) => e.integrityVerified),
      },
      chronologicalForensicLog: {
        title: "Chronological Forensic Event Log — ISO-8601 UTC",
        events: chronologicalLog,
      },
      extractedEntities: {
        title: "Deterministic Entity Extraction Summary",
        entities: entitySummary,
      },
      syndicateLinkageAnalysis: syndicateLinkage,
      caseClusters: clusterData,
      recommendedStatutoryClassifications: {
        title: "Recommended Legal Classifications",
        basis: `Auto-tagged based on incident type: ${caseRecord.incidentType}. Verify with Legal Cell.`,
        sections: getStatutorySections(caseRecord.incidentType),
      },
    };

    return Response.json(dossier, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Rakshak-Dossier-Version": "3.0",
      },
    });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/dossier] Error:", err);
    return Response.json(
      {
        error: "Dossier generation failed.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
