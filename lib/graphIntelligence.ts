// ─────────────────────────────────────────────────────────────────────────────
// lib/graphIntelligence.ts
// Rakshak v3.0 — Phase 37 Cross-Case Intelligence Graph Traversal & Scoping
//
// Features:
// 1. Multi-hop bounded graph expansion (cases, entities, evidence items, links).
// 2. Strict authorization & department scoping (zero information leakage).
// 3. Cycle prevention & configurable depth/limit boundaries.
// 4. Candidate vs Analyst-Confirmed status discrimination.
// 5. Shortest explainable path exploration across authorized nodes.
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from "@prisma/client";
import { canAccessCase, canAccessCaseAsync, type OfficerProfile } from "./accessControl.ts";
import { maskIdentifier } from "./entityResolution.ts";

export const MAX_TRAVERSAL_DEPTH = 3;
export const DEFAULT_TRAVERSAL_DEPTH = 2;
export const MAX_RESULT_LIMIT = 100;
export const DEFAULT_RESULT_LIMIT = 50;

export interface GraphQueryOptions {
  depth?: number;
  limit?: number;
  entityType?: string;
  linkType?: string;
  status?: string; // "CANDIDATE" | "CONFIRMED" | "ALL"
  search?: string;
  includeEvidenceNodes?: boolean;
}

export interface IntelligenceNode {
  id: string;
  label: string;
  type: "CURRENT_CASE" | "LINKED_CASE" | "ENTITY" | "PERSON" | "EVIDENCE";
  entityType?: string | null;
  status?: string;
  incidentType?: string;
  jurisdiction?: string;
  amountDefrauded?: number;
  caseCount?: number;
  flags?: string[];
  rawValue?: string;
  normalizedValue?: string;
  isGeneric?: boolean;
  limitations?: string;
}

export interface IntelligenceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relationshipType: string;
  linkType?: string;
  status?: string; // "CANDIDATE" | "CONFIRMED" | "UNDER_REVIEW" | "REJECTED" | "REVOKED"
  confidenceCategory?: string;
  matchRule?: string;
  explanation: string;
  isGeneric?: boolean;
  limitations?: string;
  sourceCaseId?: string;
  targetCaseId?: string;
  supportingEvidenceIds?: string[];
}

export interface IntelligenceGraphPayload {
  caseId: string;
  generatedAt: string;
  nodes: IntelligenceNode[];
  edges: IntelligenceEdge[];
  summary: {
    authorizedLinkedCaseCount: number;
    authorizedEntityCount: number;
    candidateLinkCount: number;
    confirmedLinkCount: number;
    totalFraudAmountLinked: number;
    traversalDepthApplied: number;
  };
}

/**
 * Resolves an authorization-filtered, bounded intelligence graph centered on an authorized case.
 */
export async function resolveAuthorizedGraph(
  prisma: any,
  caseId: string,
  officer: OfficerProfile,
  options: GraphQueryOptions = {}
): Promise<IntelligenceGraphPayload> {
  // 1. Authorize active officer
  if (!officer || officer.status !== "ACTIVE") {
    throw new Error("Access Denied: Officer account is inactive or suspended.");
  }

  // 2. Fetch and authorize root anchor case
  const anchorCase = await prisma.case.findFirst({
    where: {
      OR: [{ id: caseId }, { caseNumber: caseId }],
    },
    include: { department: true },
  });

  if (!anchorCase) {
    throw new Error(`Case '${caseId}' not found.`);
  }

  const anchorAuth = canAccessCase(officer, anchorCase, "read:metadata");
  if (!anchorAuth.allowed) {
    throw new Error("Access Denied: Officer lacks authorized access to this case.");
  }

  // 3. Normalize limits and traversal options
  const maxDepth = Math.max(1, Math.min(MAX_TRAVERSAL_DEPTH, options.depth ?? DEFAULT_TRAVERSAL_DEPTH));
  const resultLimit = Math.max(1, Math.min(MAX_RESULT_LIMIT, options.limit ?? DEFAULT_RESULT_LIMIT));
  const statusFilter = (options.status || "ALL").toUpperCase();

  const nodesMap = new Map<string, IntelligenceNode>();
  const edgesMap = new Map<string, IntelligenceEdge>();

  // Add root case node
  nodesMap.set(anchorCase.id, {
    id: anchorCase.id,
    label: anchorCase.caseNumber,
    type: "CURRENT_CASE",
    incidentType: anchorCase.incidentType,
    jurisdiction: anchorCase.jurisdiction || "Cyber Cell",
    amountDefrauded: anchorCase.amountDefrauded || 0,
    status: anchorCase.status,
    caseCount: 1,
  });

  // Visited tracking to prevent infinite expansion / cycles
  const visitedCaseIds = new Set<string>([anchorCase.id]);
  const queue: Array<{ caseId: string; depth: number }> = [{ caseId: anchorCase.id, depth: 0 }];

  // 4. Bounded BFS Graph Expansion
  while (queue.length > 0 && nodesMap.size < resultLimit) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    // Load CaseEntity records for current case
    const caseEntities = await prisma.caseEntity.findMany({
      where: { caseId: current.caseId },
    });

    for (const ce of caseEntities) {
      if (nodesMap.size >= resultLimit) break;
      if (options.entityType && options.entityType !== "ALL" && ce.entityType !== options.entityType) {
        continue;
      }

      const entityNodeId = `entity::${ce.entityType}::${ce.normalizedValue}`;
      const maskedVal = maskIdentifier(ce.normalizedValue, ce.entityType);

      if (!nodesMap.has(entityNodeId)) {
        nodesMap.set(entityNodeId, {
          id: entityNodeId,
          label: `${ce.entityType}: ${maskedVal}`,
          type: ce.entityType === "NAME" ? "PERSON" : "ENTITY",
          entityType: ce.entityType,
          normalizedValue: ce.normalizedValue,
          rawValue: ce.rawValue,
        });
      }

      // Edge from Case to Entity
      const caseEntityEdgeId = `edge::${current.caseId}::${entityNodeId}`;
      if (!edgesMap.has(caseEntityEdgeId)) {
        edgesMap.set(caseEntityEdgeId, {
          id: caseEntityEdgeId,
          source: current.caseId,
          target: entityNodeId,
          label: ce.entityType,
          relationshipType: "OBSERVED_IN_CASE",
          explanation: `Entity observed in verified evidence of case ${nodesMap.get(current.caseId)?.label || current.caseId}.`,
        });
      }

      // Discover cross-case links via EntityLink table
      const linkWhere: any = {
        normalizedValue: ce.normalizedValue,
        OR: [{ sourceCaseId: current.caseId }, { targetCaseId: current.caseId }],
      };

      if (statusFilter !== "ALL") {
        linkWhere.status = statusFilter;
      }

      const crossLinks = await prisma.entityLink.findMany({
        where: linkWhere,
        include: {
          sourceCase: true,
          targetCase: true,
        },
      });

      for (const link of crossLinks) {
        const otherCase = link.sourceCaseId === current.caseId ? link.targetCase : link.sourceCase;
        if (!otherCase) continue;

        // CRITICAL AUTHORIZATION CHECK: Check if caller can access the other case
        const otherAuth = canAccessCase(officer, otherCase, "read:metadata");
        if (!otherAuth.allowed) {
          // Zero Information Leakage: Prune inaccessible case completely!
          continue;
        }

        // Add authorized linked case node
        if (!nodesMap.has(otherCase.id)) {
          nodesMap.set(otherCase.id, {
            id: otherCase.id,
            label: otherCase.caseNumber,
            type: "LINKED_CASE",
            incidentType: otherCase.incidentType,
            jurisdiction: otherCase.jurisdiction || "Cyber Cell",
            amountDefrauded: otherCase.amountDefrauded || 0,
            status: otherCase.status,
            caseCount: 1,
          });
        }

        // Add cross-case EntityLink edge
        const linkEdgeId = `link::${link.id}`;
        if (!edgesMap.has(linkEdgeId)) {
          const supEvidence = [link.sourceEvidenceId, link.targetEvidenceId].filter(Boolean) as string[];

          edgesMap.set(linkEdgeId, {
            id: linkEdgeId,
            source: link.sourceCaseId,
            target: link.targetCaseId,
            label: link.status === "CONFIRMED" ? "CONFIRMED LINK" : "CANDIDATE LINK",
            relationshipType: link.linkType,
            linkType: link.linkType,
            status: link.status,
            confidenceCategory: link.confidenceCategory,
            matchRule: link.matchRule,
            explanation: link.explanation,
            isGeneric: link.isGeneric,
            limitations: link.limitations || undefined,
            sourceCaseId: link.sourceCaseId,
            targetCaseId: link.targetCaseId,
            supportingEvidenceIds: supEvidence,
          });
        }

        // Continue expansion if within depth limit and not yet visited
        if (!visitedCaseIds.has(otherCase.id) && current.depth + 1 < maxDepth) {
          visitedCaseIds.add(otherCase.id);
          queue.push({ caseId: otherCase.id, depth: current.depth + 1 });
        }
      }
    }
  }

  // 5. Summary calculations and strict result limits enforcement
  const nodes = Array.from(nodesMap.values()).slice(0, resultLimit);
  const activeNodeIds = new Set(nodes.map((n) => n.id));
  const edges = Array.from(edgesMap.values()).filter(
    (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
  );

  const linkedCases = nodes.filter((n) => n.type === "LINKED_CASE");
  const entities = nodes.filter((n) => n.type === "ENTITY" || n.type === "PERSON");
  const candidateEdges = edges.filter((e) => e.status === "CANDIDATE");
  const confirmedEdges = edges.filter((e) => e.status === "CONFIRMED");

  let totalFraud = 0;
  for (const n of nodes) {
    if ((n.type === "CURRENT_CASE" || n.type === "LINKED_CASE") && n.amountDefrauded) {
      totalFraud += n.amountDefrauded;
    }
  }

  return {
    caseId: anchorCase.id,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    summary: {
      authorizedLinkedCaseCount: linkedCases.length,
      authorizedEntityCount: entities.length,
      candidateLinkCount: candidateEdges.length,
      confirmedLinkCount: confirmedEdges.length,
      totalFraudAmountLinked: totalFraud,
      traversalDepthApplied: maxDepth,
    },
  };
}

/**
 * Finds the shortest explainable path between two authorized nodes in the graph.
 */
export async function findExplainablePath(
  prisma: any,
  fromId: string,
  toId: string,
  officer: OfficerProfile
): Promise<{ pathFound: boolean; nodes: IntelligenceNode[]; edges: IntelligenceEdge[]; explanation?: string }> {
  // Build a 2-hop graph around fromId
  let startCaseId = fromId;
  if (fromId.startsWith("entity::")) {
    // If starting from entity, find a case that references it
    const parts = fromId.split("::");
    const normVal = parts[2];
    const ce = await prisma.caseEntity.findFirst({ where: { normalizedValue: normVal } });
    if (!ce) return { pathFound: false, nodes: [], edges: [], explanation: "Starting entity not found." };
    startCaseId = ce.caseId;
  }

  const graph = await resolveAuthorizedGraph(prisma, startCaseId, officer, { depth: 3, limit: 100 });

  // BFS on graph nodes and edges
  const adj = new Map<string, Array<{ to: string; edge: IntelligenceEdge }>>();
  for (const n of graph.nodes) adj.set(n.id, []);

  for (const e of graph.edges) {
    adj.get(e.source)?.push({ to: e.target, edge: e });
    adj.get(e.target)?.push({ to: e.source, edge: e });
  }

  const prev = new Map<string, { from: string; edge: IntelligenceEdge }>();
  const visited = new Set<string>([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === toId) break;

    const neighbors = adj.get(curr) || [];
    for (const { to, edge } of neighbors) {
      if (!visited.has(to)) {
        visited.add(to);
        prev.set(to, { from: curr, edge });
        queue.push(to);
      }
    }
  }

  if (!visited.has(toId)) {
    return {
      pathFound: false,
      nodes: [],
      edges: [],
      explanation: "No authorized connection found between the specified nodes within traversal limits.",
    };
  }

  // Reconstruct path
  const pathNodes: IntelligenceNode[] = [];
  const pathEdges: IntelligenceEdge[] = [];
  let curr = toId;

  while (curr !== fromId) {
    const nodeObj = graph.nodes.find((n) => n.id === curr);
    if (nodeObj) pathNodes.unshift(nodeObj);

    const step = prev.get(curr)!;
    pathEdges.unshift(step.edge);
    curr = step.from;
  }

  const startNode = graph.nodes.find((n) => n.id === fromId);
  if (startNode) pathNodes.unshift(startNode);

  return {
    pathFound: true,
    nodes: pathNodes,
    edges: pathEdges,
    explanation: `Found path of ${pathEdges.length} step(s) connecting ${startNode?.label || fromId} to ${pathNodes[pathNodes.length - 1]?.label || toId}.`,
  };
}

// ─── Global Cross-Case & Cross-Cluster Intelligence Graph ────────────────────

export interface GlobalGraphQueryOptions {
  limit?: number;
  clusterId?: string;
  departmentId?: string;
  incidentType?: string;
  caseStatus?: string;
  entityType?: string;
  statuses?: string[]; // e.g. ["CONFIRMED", "UNDER_REVIEW", "CANDIDATE"]
  confidenceCategory?: string;
  includeGeneric?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface GlobalCaseNode {
  id: string;
  caseNumber: string;
  incidentType: string;
  status: string;
  jurisdiction: string;
  amountDefrauded: number | null;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  clusterIds: string[];
  clusterNames: string[];
  entityCount: number;
  evidenceCount: number;
  sharedEntityTypes: string[];
  linkedCaseCount: number;
  createdAt: string;
  entitiesSummary: Array<{
    id: string;
    entityType: string;
    maskedValue: string;
    firstSeenAt: string;
  }>;
  evidenceSummary: Array<{
    id: string;
    fileName: string;
    evidenceCategory: string;
    status: string;
    uploadedAt: string;
  }>;
  timelineSummary: Array<{
    id: string;
    description: string;
    sourceType: string;
    phase: string;
    timestamp: string;
  }>;
}

export interface GlobalEntityLinkEdge {
  id: string;
  sourceCaseId: string;
  targetCaseId: string;
  sourceCaseNumber: string;
  targetCaseNumber: string;
  sourceEntityId: string | null;
  targetEntityId: string | null;
  sourceEvidenceId: string | null;
  targetEvidenceId: string | null;
  entityType: string;
  linkType: string;
  matchRule: string;
  maskedValue: string;
  explanation: string;
  status: string;
  confidenceCategory: string;
  limitations: string | null;
  isGeneric: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewRationale: string | null;
  version: number;
  createdAt: string;
  reviews: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    reviewerName: string;
    reviewerBadge: string | null;
    reviewerRole: string;
    rationale: string;
    reviewedAt: string;
  }>;
}

export interface GlobalClusterGroup {
  id: string;
  name: string;
  theme: string | null;
  status: string;
  confidence: string;
  notes: string | null;
  memberCaseIds: string[];
}

export interface GlobalCrossCaseGraphPayload {
  mode: "CASE_TO_CASE_CROSS_CLUSTER";
  generatedAt: string;
  nodes: GlobalCaseNode[];
  edges: GlobalEntityLinkEdge[];
  clusters: GlobalClusterGroup[];
  entityTypeCounts: Record<string, number>;
  departments: Array<{ id: string; code: string; name: string }>;
  summary: {
    totalCases: number;
    visibleCases: number;
    totalEntities: number;
    totalConnections: number;
    totalEntityLinksInScope: number;
    activeClusters: number;
    requiresReviewCount: number;
    confirmedLinkCount: number;
    underReviewLinkCount: number;
    candidateLinkCount: number;
  };
  diagnostics: {
    availableCasesCount: number;
    availableEntityLinksCount: number;
    activeClustersCount: number;
    clusterMembershipsCount: number;
    excludedByFiltersCount: number;
    excludedRejectedRevokedCount: number;
    excludedGenericCount: number;
  };
}

/**
 * Resolves the authorized Case-to-Case Cross-Cluster Intelligence Graph
 * backed by Case, EntityLink, EntityLinkReview, CaseCluster, ClusterMembership, and CaseEntity.
 */
export async function resolveGlobalCrossCaseGraph(
  prisma: any,
  officer: OfficerProfile,
  options: GlobalGraphQueryOptions = {}
): Promise<GlobalCrossCaseGraphPayload> {
  if (!officer || officer.status !== "ACTIVE") {
    throw new Error("Access Denied: Officer account is inactive or suspended.");
  }

  const limit = Math.max(1, Math.min(250, options.limit ?? 150));

  // 1. Load Cases with bounded nested metadata (no N+1 queries)
  const rawCases = await prisma.case.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { id: true, code: true, name: true } },
      clusterMemberships: {
        include: {
          cluster: {
            select: { id: true, name: true, theme: true, status: true, confidence: true, notes: true },
          },
        },
      },
      entities: {
        select: { id: true, entityType: true, normalizedValue: true, firstSeenAt: true },
      },
      evidence: {
        select: { id: true, fileName: true, evidenceCategory: true, status: true, uploadedAt: true },
        take: 15,
        orderBy: { uploadedAt: "desc" },
      },
      timeline: {
        select: { id: true, description: true, sourceType: true, phase: true, timestamp: true },
        take: 10,
        orderBy: { timestamp: "desc" },
      },
    },
  });

  // 2. Enforce strict authorization & department/AccessGrant scoping per case
  const authorizedCases: any[] = [];
  for (const c of rawCases) {
    const auth = await canAccessCaseAsync(officer, c, "read:metadata");
    if (auth.allowed) {
      authorizedCases.push(c);
    }
  }

  const authorizedCaseIds = new Set<string>(authorizedCases.map((c) => c.id));
  const caseById = new Map<string, any>(authorizedCases.map((c) => [c.id, c]));

  // 3. Load all EntityLinks between authorized cases (single query, zero N+1)
  const authCaseIdList = Array.from(authorizedCaseIds);
  const rawLinks =
    authCaseIdList.length > 0
      ? await prisma.entityLink.findMany({
          where: {
            sourceCaseId: { in: authCaseIdList },
            targetCaseId: { in: authCaseIdList },
          },
          include: {
            reviews: {
              orderBy: { reviewedAt: "desc" },
              take: 10,
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // 4. Build Cluster groups strictly from authorized memberships
  const clusterMap = new Map<string, GlobalClusterGroup>();
  let totalClusterMemberships = 0;

  for (const c of authorizedCases) {
    for (const cm of c.clusterMemberships || []) {
      totalClusterMemberships++;
      if (!cm.cluster) continue;
      if (!clusterMap.has(cm.cluster.id)) {
        clusterMap.set(cm.cluster.id, {
          id: cm.cluster.id,
          name: cm.cluster.name,
          theme: cm.cluster.theme || null,
          status: cm.cluster.status,
          confidence: cm.cluster.confidence,
          notes: cm.cluster.notes || null,
          memberCaseIds: [],
        });
      }
      clusterMap.get(cm.cluster.id)!.memberCaseIds.push(c.id);
    }
  }

  // 5. Entity type distribution across authorized CaseEntity records
  const entityTypeCounts: Record<string, number> = {};
  let totalEntitiesCount = 0;
  for (const c of authorizedCases) {
    for (const ent of c.entities || []) {
      totalEntitiesCount++;
      entityTypeCounts[ent.entityType] = (entityTypeCounts[ent.entityType] || 0) + 1;
    }
  }

  // 6. Apply Case-level filters
  const searchQ = (options.search || "").trim().toLowerCase();
  const startDateMs = options.startDate ? Date.parse(options.startDate) : NaN;
  const endDateMs = options.endDate ? Date.parse(options.endDate) : NaN;

  const filteredCases = authorizedCases.filter((c) => {
    if (options.departmentId && options.departmentId !== "ALL" && c.departmentId !== options.departmentId) {
      return false;
    }
    if (options.incidentType && options.incidentType !== "ALL" && c.incidentType !== options.incidentType) {
      return false;
    }
    if (options.caseStatus && options.caseStatus !== "ALL" && c.status !== options.caseStatus) {
      return false;
    }
    if (options.clusterId && options.clusterId !== "ALL") {
      const inCluster = (c.clusterMemberships || []).some((cm: any) => cm.clusterId === options.clusterId);
      if (!inCluster) return false;
    }
    if (!Number.isNaN(startDateMs) && new Date(c.createdAt).getTime() < startDateMs) {
      return false;
    }
    if (!Number.isNaN(endDateMs) && new Date(c.createdAt).getTime() > endDateMs + 86400000) {
      return false;
    }
    if (searchQ) {
      const caseHit =
        (c.caseNumber || "").toLowerCase().includes(searchQ) ||
        (c.incidentType || "").toLowerCase().includes(searchQ) ||
        (c.jurisdiction || "").toLowerCase().includes(searchQ);
      const entHit = (c.entities || []).some((e: any) =>
        (e.normalizedValue || "").toLowerCase().includes(searchQ)
      );
      if (!caseHit && !entHit) return false;
    }
    return true;
  });

  const filteredCaseIds = new Set<string>(filteredCases.map((c) => c.id));

  // 7. Apply EntityLink-level filters (respecting REJECTED/REVOKED and isGeneric defaults)
  const allowedStatuses =
    options.statuses && options.statuses.length > 0
      ? new Set(options.statuses.map((s) => s.toUpperCase()))
      : new Set(["CONFIRMED", "UNDER_REVIEW", "CANDIDATE"]);
  const includeGeneric = options.includeGeneric === true;

  let excludedRejectedRevokedCount = 0;
  let excludedGenericCount = 0;
  let excludedByFiltersCount = 0;

  const filteredLinks = rawLinks.filter((l: any) => {
    if (!includeGeneric && l.isGeneric) {
      excludedGenericCount++;
      excludedByFiltersCount++;
      return false;
    }
    if (!allowedStatuses.has((l.status || "").toUpperCase())) {
      if (l.status === "REJECTED" || l.status === "REVOKED") {
        excludedRejectedRevokedCount++;
      }
      excludedByFiltersCount++;
      return false;
    }
    if (!filteredCaseIds.has(l.sourceCaseId) || !filteredCaseIds.has(l.targetCaseId)) {
      excludedByFiltersCount++;
      return false;
    }
    if (options.entityType && options.entityType !== "ALL" && l.entityType !== options.entityType) {
      excludedByFiltersCount++;
      return false;
    }
    if (
      options.confidenceCategory &&
      options.confidenceCategory !== "ALL" &&
      l.confidenceCategory !== options.confidenceCategory
    ) {
      excludedByFiltersCount++;
      return false;
    }
    return true;
  });

  // 8. Compute per-case direct link counts & shared entity types from filteredLinks
  const linkedPeersByCase = new Map<string, Set<string>>();
  const sharedTypesByCase = new Map<string, Set<string>>();
  for (const l of filteredLinks) {
    if (!linkedPeersByCase.has(l.sourceCaseId)) linkedPeersByCase.set(l.sourceCaseId, new Set());
    if (!linkedPeersByCase.has(l.targetCaseId)) linkedPeersByCase.set(l.targetCaseId, new Set());
    linkedPeersByCase.get(l.sourceCaseId)!.add(l.targetCaseId);
    linkedPeersByCase.get(l.targetCaseId)!.add(l.sourceCaseId);

    if (!sharedTypesByCase.has(l.sourceCaseId)) sharedTypesByCase.set(l.sourceCaseId, new Set());
    if (!sharedTypesByCase.has(l.targetCaseId)) sharedTypesByCase.set(l.targetCaseId, new Set());
    sharedTypesByCase.get(l.sourceCaseId)!.add(l.entityType);
    sharedTypesByCase.get(l.targetCaseId)!.add(l.entityType);
  }

  // 9. Build deduplicated Case Nodes (with masked identifiers)
  const nodes: GlobalCaseNode[] = filteredCases.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    incidentType: c.incidentType,
    status: c.status,
    jurisdiction: c.jurisdiction || "Cyber Cell",
    amountDefrauded: c.amountDefrauded ?? null,
    departmentId: c.departmentId ?? null,
    departmentCode: c.department?.code ?? null,
    departmentName: c.department?.name ?? null,
    clusterIds: (c.clusterMemberships || []).map((cm: any) => cm.clusterId),
    clusterNames: (c.clusterMemberships || [])
      .map((cm: any) => cm.cluster?.name)
      .filter(Boolean),
    entityCount: (c.entities || []).length,
    evidenceCount: (c.evidence || []).length,
    sharedEntityTypes: Array.from(sharedTypesByCase.get(c.id) || []),
    linkedCaseCount: (linkedPeersByCase.get(c.id) || new Set()).size,
    createdAt: new Date(c.createdAt).toISOString(),
    entitiesSummary: (c.entities || []).map((e: any) => ({
      id: e.id,
      entityType: e.entityType,
      maskedValue: maskIdentifier(e.normalizedValue, e.entityType),
      firstSeenAt: new Date(e.firstSeenAt).toISOString(),
    })),
    evidenceSummary: (c.evidence || []).map((ev: any) => ({
      id: ev.id,
      fileName: ev.fileName,
      evidenceCategory: ev.evidenceCategory,
      status: ev.status,
      uploadedAt: new Date(ev.uploadedAt).toISOString(),
    })),
    timelineSummary: (c.timeline || []).map((t: any) => ({
      id: t.id,
      description: t.description,
      sourceType: t.sourceType,
      phase: t.phase,
      timestamp: new Date(t.timestamp).toISOString(),
    })),
  }));

  // 10. Build Edges (preserving every individual EntityLink record)
  const edges: GlobalEntityLinkEdge[] = filteredLinks.map((l: any) => ({
    id: l.id,
    sourceCaseId: l.sourceCaseId,
    targetCaseId: l.targetCaseId,
    sourceCaseNumber: caseById.get(l.sourceCaseId)?.caseNumber || l.sourceCaseId,
    targetCaseNumber: caseById.get(l.targetCaseId)?.caseNumber || l.targetCaseId,
    sourceEntityId: l.sourceEntityId ?? null,
    targetEntityId: l.targetEntityId ?? null,
    sourceEvidenceId: l.sourceEvidenceId ?? null,
    targetEvidenceId: l.targetEvidenceId ?? null,
    entityType: l.entityType,
    linkType: l.linkType,
    matchRule: l.matchRule,
    maskedValue: maskIdentifier(l.normalizedValue, l.entityType),
    explanation: l.explanation,
    status: l.status,
    confidenceCategory: l.confidenceCategory,
    limitations: l.limitations ?? null,
    isGeneric: Boolean(l.isGeneric),
    reviewedBy: l.reviewedBy ?? null,
    reviewedAt: l.reviewedAt ? new Date(l.reviewedAt).toISOString() : null,
    reviewRationale: l.reviewRationale ?? null,
    version: l.version,
    createdAt: new Date(l.createdAt).toISOString(),
    reviews: (l.reviews || []).map((r: any) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reviewerName: r.reviewerName,
      reviewerBadge: r.reviewerBadge ?? null,
      reviewerRole: r.reviewerRole,
      rationale: r.rationale,
      reviewedAt: new Date(r.reviewedAt).toISOString(),
    })),
  }));

  // 11. Authorized departments list for filter dropdown
  const deptMap = new Map<string, { id: string; code: string; name: string }>();
  for (const c of authorizedCases) {
    if (c.department && !deptMap.has(c.department.id)) {
      deptMap.set(c.department.id, c.department);
    }
  }

  const allClusters = Array.from(clusterMap.values());
  const activeClustersCount = allClusters.filter((cl) => cl.status === "ACTIVE").length;
  const confirmedCount = rawLinks.filter((l: any) => l.status === "CONFIRMED").length;
  const underReviewCount = rawLinks.filter((l: any) => l.status === "UNDER_REVIEW").length;
  const candidateCount = rawLinks.filter((l: any) => l.status === "CANDIDATE" && !l.isGeneric).length;

  return {
    mode: "CASE_TO_CASE_CROSS_CLUSTER",
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    clusters: allClusters,
    entityTypeCounts,
    departments: Array.from(deptMap.values()),
    summary: {
      totalCases: authorizedCases.length,
      visibleCases: nodes.length,
      totalEntities: totalEntitiesCount,
      totalConnections: edges.length,
      totalEntityLinksInScope: rawLinks.length,
      activeClusters: activeClustersCount,
      requiresReviewCount: candidateCount + underReviewCount,
      confirmedLinkCount: confirmedCount,
      underReviewLinkCount: underReviewCount,
      candidateLinkCount: candidateCount,
    },
    diagnostics: {
      availableCasesCount: authorizedCases.length,
      availableEntityLinksCount: rawLinks.length,
      activeClustersCount,
      clusterMembershipsCount: totalClusterMemberships,
      excludedByFiltersCount,
      excludedRejectedRevokedCount,
      excludedGenericCount,
    },
  };
}
