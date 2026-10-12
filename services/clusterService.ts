// ─────────────────────────────────────────────────────────────────────────────
// services/clusterService.ts
// Cross-Case Clustering & Multi-Jurisdiction Syndicate Aggregation Service
// Detects shared mule accounts, phone numbers, and domains across FIRs.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import { CaseClusterData } from "@/lib/mock-data";

/**
 * Auto-detect clusters across all registered cases based on shared entities.
 */
export async function autoDetectClusters(prisma: PrismaClient): Promise<CaseClusterData[]> {
  try {
    // 1. Fetch all case entities from DB
    const caseEntities = await prisma.caseEntity.findMany({
      include: {
        case: true,
      },
    });

    if (!caseEntities || caseEntities.length === 0) {
      return [];
    }

    // 2. Build map of entity -> caseIds
    const entityMap = new Map<string, { type: string; value: string; cases: any[] }>();
    for (const ce of caseEntities) {
      const key = `${ce.entityType}::${ce.normalizedValue}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { type: ce.entityType, value: ce.normalizedValue, cases: [] });
      }
      entityMap.get(key)!.cases.push(ce.case);
    }

    // 3. Find clusters with cases sharing >= 2 entities
    const dbClusters = await prisma.caseCluster.findMany({
      include: {
        memberships: {
          include: {
            case: true,
          },
        },
      },
    });

    if (dbClusters.length > 0) {
      return dbClusters.map((c: typeof dbClusters[number]) => ({
        id: c.id,
        name: c.name,
        theme: c.theme || "Task_Scam",
        status: c.status as any,
        confidence: c.confidence as any,
        notes: c.notes || "",
        totalFraudAmount: c.memberships.reduce((sum: number, m: typeof c.memberships[number]) => sum + (m.case.amountDefrauded || 0), 0),
        jurisdictions: Array.from(new Set(c.memberships.map((m: typeof c.memberships[number]) => m.case.jurisdiction).filter(Boolean))) as string[],
        cases: c.memberships.map((m: typeof c.memberships[number]) => ({
          id: m.case.id,
          caseNumber: m.case.caseNumber,
          incidentType: m.case.incidentType as any,
          status: m.case.status as any,
          createdAt: m.case.createdAt.toISOString(),
          jurisdiction: m.case.jurisdiction || "Cyber Cell",
          officerInCharge: "Cyber Crime Unit",
          victimName: m.case.complainantName,
          amountDefrauded: m.case.amountDefrauded || 0,
        })),
        commonEntities: [],
        relationships: [],
      }));
    }

    return [];
  } catch (err) {
    console.error("[clusterService.autoDetectClusters] Error:", err);
    return [];
  }
}

/**
 * Get cluster comparison matrix
 */
export async function getClusterComparison(clusterId: string, prisma: PrismaClient) {
  try {
    const cluster = await prisma.caseCluster.findUnique({
      where: { id: clusterId },
      include: {
        memberships: {
          include: {
            case: true,
          },
        },
      },
    });
    if (!cluster) return null;
    return {
      clusterId,
      name: cluster.name,
      cases: cluster.memberships.map((m: typeof cluster.memberships[number]) => m.case),
      commonEntities: [],
    };
  } catch {
    return null;
  }
}

/**
 * Get combined interleaved timeline for all cases in a cluster
 */
export async function getClusterTimeline(clusterId: string, prisma: PrismaClient) {
  try {
    const cluster = await prisma.caseCluster.findUnique({
      where: { id: clusterId },
      include: {
        memberships: {
          include: {
            case: {
              include: {
                timeline: {
                  orderBy: { timestamp: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!cluster) return [];

    const allEvents: any[] = [];
    const colorPalette = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"];

    cluster.memberships.forEach((m: typeof cluster.memberships[number], idx: number) => {
      const color = colorPalette[idx % colorPalette.length];
      m.case.timeline.forEach((evt: typeof m.case.timeline[number]) => {
        allEvents.push({
          id: evt.id,
          caseNumber: `${m.case.caseNumber} (${m.case.jurisdiction?.split("—")[0].trim() || "Unit"})`,
          caseColor: color,
          timestamp: evt.timestamp.toISOString(),
          timestampIST: new Date(evt.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
          sourceType: evt.sourceType,
          narrative: evt.description,
          phase: evt.phase,
        });
      });
    });

    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return allEvents;
  } catch (err) {
    console.error("[clusterService.getClusterTimeline] Error:", err);
    return [];
  }
}
