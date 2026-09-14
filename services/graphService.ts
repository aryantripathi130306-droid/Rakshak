// ─────────────────────────────────────────────────────────────────────────────
// services/graphService.ts
// In-memory cross-case syndicate graph resolver.
// Uses adjacency lists derived from CaseEntity records.
// Graph resolution is O(E · log E) — fast enough for real-time responses.
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from "@prisma/client";
import {
  type GraphNode,
  type GraphEdge,
  type GraphIntelligenceResponse,
  type RiskLevel,
  GraphIntelligenceResponseSchema,
} from "@/lib/validators";

// ─── Risk scoring ─────────────────────────────────────────────────────────────

/**
 * Assign a 0–100 risk score and label to an entity based on how many
 * independent cases it appears in.
 */
function computeEntityRisk(caseCount: number): {
  riskScore: number;
  riskLevel: RiskLevel;
  flags: string[];
} {
  const flags: string[] = [];
  let riskScore = 0;

  if (caseCount >= 5) {
    riskScore = 95;
    flags.push("HIGH_FREQUENCY_MULE", "SYNDICATE_INDICATOR");
  } else if (caseCount >= 3) {
    riskScore = 80;
    flags.push("HIGH_FREQUENCY_MULE");
  } else if (caseCount >= 2) {
    riskScore = 55;
    flags.push("MULTI_CASE_LINKAGE");
  } else {
    riskScore = 20;
  }

  const riskLevel: RiskLevel =
    riskScore >= 80 ? "HIGH" : riskScore >= 50 ? "MEDIUM" : "LOW";

  return { riskScore, riskLevel, flags };
}

// ─── Case risk aggregation ────────────────────────────────────────────────────

function computeCaseRisk(highEntityCount: number): {
  riskScore: number;
  riskLevel: RiskLevel;
} {
  if (highEntityCount >= 3) return { riskScore: 90, riskLevel: "HIGH" };
  if (highEntityCount >= 2) return { riskScore: 70, riskLevel: "HIGH" };
  if (highEntityCount >= 1) return { riskScore: 45, riskLevel: "MEDIUM" };
  return { riskScore: 10, riskLevel: "LOW" };
}

// ─── In-memory adjacency list resolver ───────────────────────────────────────

interface CaseEntityRecord {
  id: string;
  caseId: string;
  entityType: string;
  normalizedValue: string;
  case: {
    caseNumber: string;
    incidentType: string;
    jurisdiction?: string | null;
    amountDefrauded?: number | null;
  };
}

/**
 * Build the full graph intelligence payload for a given case.
 * Uses a Prisma client to load CaseEntity records and resolve cross-case links.
 */
export async function resolveGraphIntelligence(
  caseId: string,
  prisma: PrismaClient
): Promise<GraphIntelligenceResponse> {
  // ── 1. Load entities for the requested case ──────────────────────────────
  const caseEntities = await prisma.caseEntity.findMany({
    where: { caseId },
    include: {
      case: {
        select: {
          caseNumber: true,
          incidentType: true,
        },
      },
    },
  });

  if (caseEntities.length === 0) {
    // Return a minimal graph — just the case node, no links
    return GraphIntelligenceResponseSchema.parse({
      caseId,
      generatedAt: new Date().toISOString(),
      syndicateDetected: false,
      riskLevel: "LOW",
      totalFraudAmountLinked: 0,
      nodes: [
        {
          id: caseId,
          label: caseEntities[0]?.case?.caseNumber ?? caseId,
          type: "CURRENT_CASE",
          entityType: null,
          riskScore: 0,
          riskLevel: "LOW",
          caseCount: 1,
          totalFraudAmount: 0,
          jurisdictions: [],
          flags: [],
        },
      ],
      edges: [],
      summary: {
        linkedCaseCount: 0,
        sharedEntityCount: 0,
        highFrequencyMules: [],
        jurisdictionsAffected: [],
      },
    });
  }

  // ── 2. For each entity value, find all other cases sharing it ─────────────
  const normalizedValues = caseEntities.map((e) => e.normalizedValue);

  const allSharedEntities = await prisma.caseEntity.findMany({
    where: {
      normalizedValue: { in: normalizedValues },
      caseId: { not: caseId }, // exclude the current case itself
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          incidentType: true,
        },
      },
    },
  });

  // ── 3. Build adjacency map: normalizedValue → Set<caseId> ─────────────────
  // Include current case
  const entityCaseMap = new Map<string, Set<string>>();
  for (const ent of caseEntities) {
    if (!entityCaseMap.has(ent.normalizedValue)) {
      entityCaseMap.set(ent.normalizedValue, new Set([caseId]));
    } else {
      entityCaseMap.get(ent.normalizedValue)!.add(caseId);
    }
  }
  for (const ent of allSharedEntities) {
    if (!entityCaseMap.has(ent.normalizedValue)) {
      entityCaseMap.set(ent.normalizedValue, new Set([ent.caseId]));
    } else {
      entityCaseMap.get(ent.normalizedValue)!.add(ent.caseId);
    }
  }

  // ── 4. Collect all unique linked case IDs ─────────────────────────────────
  const linkedCaseIds = new Set<string>();
  for (const caseSet of entityCaseMap.values()) {
    for (const id of caseSet) {
      if (id !== caseId) linkedCaseIds.add(id);
    }
  }

  // Load linked case details
  const linkedCases = await prisma.case.findMany({
    where: { id: { in: Array.from(linkedCaseIds) } },
  });
  const linkedCaseMap = new Map(linkedCases.map((c) => [c.id, c]));

  // ── 5. Build entity type map for the current case ─────────────────────────
  const entityTypeMap = new Map<string, string>(); // normalizedValue → entityType
  for (const ent of caseEntities) {
    entityTypeMap.set(ent.normalizedValue, ent.entityType);
  }
  for (const ent of allSharedEntities) {
    if (!entityTypeMap.has(ent.normalizedValue)) {
      entityTypeMap.set(ent.normalizedValue, ent.entityType);
    }
  }

  // ── 6. Build graph nodes ───────────────────────────────────────────────────
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Current case node
  const currentCaseData = caseEntities[0]?.case;
  nodes.push({
    id: caseId,
    label: currentCaseData?.caseNumber ?? caseId,
    type: "CURRENT_CASE",
    entityType: null,
    riskScore: 0, // computed below
    riskLevel: "LOW",
    caseCount: 1,
    totalFraudAmount: 0,
    jurisdictions: [],
    flags: [],
  });

  // Linked case nodes
  for (const [linkedId, linkedCase] of linkedCaseMap) {
    nodes.push({
      id: linkedId,
      label: linkedCase.caseNumber,
      type: "LINKED_CASE",
      entityType: null,
      riskScore: 0,
      riskLevel: "LOW",
      caseCount: 1,
      totalFraudAmount:
        "amountDefrauded" in linkedCase
          ? (linkedCase as { amountDefrauded?: number | null }).amountDefrauded ?? 0
          : 0,
      jurisdictions:
        "jurisdiction" in linkedCase && linkedCase.jurisdiction
          ? [linkedCase.jurisdiction as string]
          : [],
      flags: [],
    });
  }

  // Entity nodes + edges
  const highFrequencyMules: string[] = [];
  const jurisdictionsSet = new Set<string>();
  let totalFraud = 0;
  let highEntityCount = 0;

  for (const [entityValue, caseSet] of entityCaseMap) {
    const entityType = entityTypeMap.get(entityValue) ?? "UNKNOWN";
    const caseCount = caseSet.size;
    const { riskScore, riskLevel, flags } = computeEntityRisk(caseCount);

    if (caseCount < 2) continue; // Only show shared entities

    const entityNodeId = `entity::${entityType}::${entityValue}`;

    // Accumulate fraud across linked cases
    let entityFraudTotal = 0;
    const entityJurisdictions: string[] = [];
    for (const linkedId of caseSet) {
      if (linkedId === caseId) continue;
      const lc = linkedCaseMap.get(linkedId);
      if (lc) {
        const amount =
          "amountDefrauded" in lc
            ? (lc as { amountDefrauded?: number | null }).amountDefrauded ?? 0
            : 0;
        entityFraudTotal += amount;
        const jur =
          "jurisdiction" in lc && lc.jurisdiction
            ? (lc.jurisdiction as string)
            : null;
        if (jur) {
          entityJurisdictions.push(jur);
          jurisdictionsSet.add(jur);
        }
      }
    }
    totalFraud += entityFraudTotal;

    nodes.push({
      id: entityNodeId,
      label: `${entityType}: ${entityValue}`,
      type: "ENTITY",
      entityType: entityType as GraphNode["entityType"],
      riskScore,
      riskLevel,
      caseCount,
      totalFraudAmount: entityFraudTotal,
      jurisdictions: [...new Set(entityJurisdictions)],
      flags,
    });

    if (flags.includes("HIGH_FREQUENCY_MULE")) {
      highFrequencyMules.push(entityValue);
      highEntityCount++;
    }

    // Edges: current case → entity
    edges.push({
      id: `edge::${caseId}::${entityNodeId}`,
      source: caseId,
      target: entityNodeId,
      label: entityType,
      weight: riskScore / 100,
      animated: riskLevel === "HIGH",
    });

    // Edges: linked cases → entity
    for (const linkedId of caseSet) {
      if (linkedId === caseId) continue;
      edges.push({
        id: `edge::${linkedId}::${entityNodeId}`,
        source: linkedId,
        target: entityNodeId,
        label: entityType,
        weight: riskScore / 100,
        animated: riskLevel === "HIGH",
      });
    }
  }

  // Update current case risk based on entity counts
  const { riskScore: caseRiskScore, riskLevel: caseRiskLevel } =
    computeCaseRisk(highEntityCount);
  const currentCaseNode = nodes.find((n) => n.id === caseId);
  if (currentCaseNode) {
    currentCaseNode.riskScore = caseRiskScore;
    currentCaseNode.riskLevel = caseRiskLevel;
    currentCaseNode.totalFraudAmount = totalFraud;
  }

  const syndicateDetected =
    highFrequencyMules.length > 0 || linkedCaseIds.size >= 2;

  return GraphIntelligenceResponseSchema.parse({
    caseId,
    generatedAt: new Date().toISOString(),
    syndicateDetected,
    riskLevel: caseRiskLevel,
    totalFraudAmountLinked: totalFraud,
    nodes,
    edges,
    summary: {
      linkedCaseCount: linkedCaseIds.size,
      sharedEntityCount: entityCaseMap.size,
      highFrequencyMules,
      jurisdictionsAffected: Array.from(jurisdictionsSet),
    },
  });
}
