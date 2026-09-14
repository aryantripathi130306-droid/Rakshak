"use client";
import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, X, TrendingUp, MapPin, DollarSign, Hash, Network, Layers } from "lucide-react";
import { GRAPH_NODES, GRAPH_EDGES, GraphNode } from "@/lib/mock-data";
import EntityChip from "@/components/ui/EntityChip";
import CaseClusterView from "@/components/tabs/CaseClusterView";

// ─── Custom Node Components ──────────────────────────────────────────────────

function CaseNodeComponent({ data, selected }: { data: GraphNode["data"]; selected: boolean }) {
  const isCurrent = data.label === "CASE-2026-0891";
  return (
    <div
      className={isCurrent ? "naya-node naya-node-case current" : "naya-node naya-node-case"}
      style={{
        minWidth: 130,
        boxShadow: selected ? "0 0 0 2px #3b82f6" : undefined,
        transition: "box-shadow 0.1s",
      }}
    >
      <div style={{ fontSize: 8, color: isCurrent ? "#93c5fd" : "#64748b", letterSpacing: "0.06em", marginBottom: 2 }}>
        {isCurrent ? "▶ ACTIVE CASE" : "LINKED CASE"}
      </div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>#{data.label}</div>
      {data.incidentType && (
        <div style={{ fontSize: 9, color: isCurrent ? "#60a5fa" : "#4a5568", marginTop: 2 }}>
          {data.incidentType}
        </div>
      )}
    </div>
  );
}

function EntityNodeComponent({ data, selected }: { data: GraphNode["data"]; selected: boolean }) {
  const isHigh = data.riskLevel === "HIGH";
  return (
    <div
      className={`naya-node ${isHigh ? "naya-node-entity-high" : "naya-node-entity-medium"}`}
      style={{
        minWidth: 160,
        boxShadow: selected ? `0 0 0 2px ${isHigh ? "#ef4444" : "#f59e0b"}` : undefined,
        transition: "box-shadow 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        {isHigh && <AlertTriangle size={9} style={{ color: "#f87171" }} />}
        <span style={{ fontSize: 8, letterSpacing: "0.07em", color: isHigh ? "#fca5a5" : "#fcd34d" }}>
          {data.riskLevel} RISK · {data.caseCount} CASES
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 10 }}>{data.label}</div>
      {data.amountLinked && (
        <div style={{ fontSize: 9, color: isHigh ? "#f87171" : "#fbbf24", marginTop: 2 }}>
          ₹{(data.amountLinked / 100000).toFixed(2)}L defrauded
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = {
  case: CaseNodeComponent,
  entity: EntityNodeComponent,
  victim: ({ data }: { data: GraphNode["data"] }) => (
    <div className="naya-node naya-node-victim" style={{ minWidth: 100 }}>
      <div style={{ fontSize: 8, color: "#064e3b", letterSpacing: "0.06em", marginBottom: 2 }}>VICTIM</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</div>
    </div>
  ),
};

// Convert mock or API data to React Flow format
const initialNodes: Node[] = GRAPH_NODES.map((n) => ({
  id: n.id,
  type: n.type,
  data: n.data,
  position: n.position,
}));

const initialEdges: Edge[] = GRAPH_EDGES.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: e.label,
  animated: e.animated,
  style: {
    stroke: e.animated ? "#ef444488" : "#1e2d44",
    strokeWidth: e.animated ? 2 : 1,
  },
  labelStyle: { fill: "#64748b", fontSize: 9 },
  labelBgStyle: { fill: "#080d14", fillOpacity: 0.9 },
}));

function layoutLiveGraph(apiData: any): { nodes: Node[]; edges: Edge[] } {
  if (!apiData || !apiData.nodes || apiData.nodes.length === 0) {
    return { nodes: initialNodes, edges: initialEdges };
  }

  const currentCase = apiData.nodes.find((n: any) => n.type === "CURRENT_CASE");
  const linkedCases = apiData.nodes.filter((n: any) => n.type === "LINKED_CASE");
  const entities = apiData.nodes.filter((n: any) => n.type === "ENTITY");

  const nodes: Node[] = [];

  // Center: Active Case
  if (currentCase) {
    nodes.push({
      id: currentCase.id,
      type: "case",
      data: {
        label: currentCase.label,
        incidentType: "Task Scam (Active Inquest)",
        caseCount: 1,
      },
      position: { x: 380, y: 260 },
    });
  }

  // Inner ring: Entities
  entities.forEach((ent: any, idx: number) => {
    const angle = (idx / Math.max(1, entities.length)) * Math.PI * 2;
    const radius = 230;
    const x = 380 + Math.cos(angle) * radius;
    const y = 260 + Math.sin(angle) * (radius * 0.85);

    nodes.push({
      id: ent.id,
      type: "entity",
      data: {
        label: ent.label,
        entityType: ent.entityType,
        value: ent.label.replace(/^[A-Z]+:\s*/, ""),
        caseCount: ent.caseCount,
        riskLevel: ent.riskLevel,
        amountLinked: ent.totalFraudAmount,
        jurisdictions: ent.jurisdictions,
      },
      position: { x: Math.round(x), y: Math.round(y) },
    });
  });

  // Outer ring: Linked Cases
  linkedCases.forEach((lc: any, idx: number) => {
    const angle = (idx / Math.max(1, linkedCases.length)) * Math.PI * 2 + 0.35;
    const radius = 480;
    const x = 380 + Math.cos(angle) * radius;
    const y = 260 + Math.sin(angle) * (radius * 0.75);

    nodes.push({
      id: lc.id,
      type: "case",
      data: {
        label: lc.label,
        incidentType: lc.jurisdictions?.[0] || "Linked Scam Inquest",
        caseCount: 1,
        jurisdictions: lc.jurisdictions,
      },
      position: { x: Math.round(x), y: Math.round(y) },
    });
  });

  const edges: Edge[] = apiData.edges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    style: {
      stroke: e.animated ? "#ef4444" : "#2563eb",
      strokeWidth: e.animated ? 2 : 1.5,
    },
    labelStyle: { fill: "#94a3b8", fontSize: 9 },
    labelBgStyle: { fill: "#080d14", fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}

interface GraphViewProps {
  onInspect: (evidenceId: string) => void;
}

export default function GraphView({ onInspect }: GraphViewProps) {
  const [viewMode, setViewMode] = useState<"graph" | "clusters">("graph");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEntity, setSelectedEntity] = useState<GraphNode["data"] | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [isLive, setIsLive] = useState(false);
  const [liveSummary, setLiveSummary] = useState<any>(null);

  const fetchLiveGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/cases/CASE-2026-0891/graph");
      if (res.ok) {
        const data = await res.json();
        setLiveSummary(data);
        const { nodes: newNodes, edges: newEdges } = layoutLiveGraph(data);
        setNodes(newNodes);
        setEdges(newEdges);
        setIsLive(true);
      }
    } catch (err) {
      console.warn("Failed to load live graph, falling back to mock view", err);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchLiveGraph();
  }, [fetchLiveGraph]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "entity") {
      setSelectedEntity(node.data as GraphNode["data"]);
      setSelectedType("entity");
    } else if (node.type === "case") {
      setSelectedEntity(node.data as GraphNode["data"]);
      setSelectedType("case");
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 8 }}>
      {/* Top Mode Toggle Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Network size={14} style={{ color: "#38bdf8" }} />
          <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>
            Syndicate Intelligence Workspace
          </span>
        </div>

        {/* Dual Mode Switcher */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-base)",
            borderRadius: 4,
            border: "1px solid var(--border-default)",
            padding: 2,
            gap: 2,
          }}
        >
          <button
            onClick={() => setViewMode("graph")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: viewMode === "graph" ? "rgba(59,130,246,0.2)" : "transparent",
              color: viewMode === "graph" ? "#60a5fa" : "var(--text-muted)",
              transition: "all 0.1s ease",
            }}
          >
            <Network size={12} />
            Entity Graph View
          </button>
          <button
            onClick={() => setViewMode("clusters")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: viewMode === "clusters" ? "rgba(59,130,246,0.2)" : "transparent",
              color: viewMode === "clusters" ? "#60a5fa" : "var(--text-muted)",
              transition: "all 0.1s ease",
            }}
          >
            <Layers size={12} />
            Case Clusters & Comparison
          </button>
        </div>
      </div>

      {/* Render View Mode */}
      {viewMode === "clusters" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CaseClusterView onSwitchToGraph={() => setViewMode("graph")} onInspect={onInspect} />
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Graph Canvas */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Syndicate Alert Banner */}
            <div
              style={{
                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                zIndex: 10, display: "flex", alignItems: "center", gap: 8,
                padding: "6px 16px", borderRadius: 4,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.4)",
                backdropFilter: "blur(4px)",
              }}
            >
              <AlertTriangle size={12} style={{ color: "#f87171" }} />
              <span style={{ color: "#fca5a5", fontSize: 11, fontWeight: 600 }}>
                POTENTIAL SYNDICATE MATCH DETECTED
              </span>
              <span style={{ color: "#f87171", fontSize: 10 }}>
                · {liveSummary?.summary?.sharedEntityCount || 5} shared identifiers across {(liveSummary?.summary?.linkedCaseCount || 4) + 1} independent police inquests
              </span>
              {isLive && (
                <span
                  style={{
                    marginLeft: 4, padding: "1px 6px", borderRadius: 3,
                    background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
                    color: "#34d399", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 600,
                  }}
                >
                  ● LIVE SQLITE GRAPH
                </span>
              )}
            </div>

            {/* Legend */}
            <div
              style={{
                position: "absolute", bottom: 20, left: 12, zIndex: 10,
                padding: "8px 12px",
                background: "rgba(8,13,20,0.92)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                backdropFilter: "blur(4px)",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6 }}>
                LEGEND
              </div>
              {[
                { color: "#1e4080", label: "Case Node" },
                { color: "#3b82f6", label: "Active Case" },
                { color: "#7f1d1d", label: "High-Risk Entity" },
                { color: "#78350f", label: "Medium-Risk Entity" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div
                    style={{
                      width: 9, height: 9, borderRadius: 2,
                      background: color, border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)", fontSize: 9 }}>{label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <div style={{ width: 20, height: 2, background: "#ef444488" }} />
                <span style={{ color: "var(--text-muted)", fontSize: 9 }}>Shared Entity Link</span>
              </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.4}
              maxZoom={2}
              style={{ background: "var(--bg-surface)" }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                color="#1a2438"
              />
              <Controls
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                }}
              />
              <MiniMap
                nodeColor={(n) => {
                  if (n.id === "case-2026-0891") return "#3b82f6";
                  if (n.type === "case") return "#1e4080";
                  if ((n.data as GraphNode["data"]).riskLevel === "HIGH") return "#7f1d1d";
                  return "#78350f";
                }}
                style={{ bottom: 20, right: 12 }}
              />
            </ReactFlow>
          </div>

          {/* Entity Intelligence Drawer */}
          {selectedEntity && (
            <div
              className="animate-slide-right"
              style={{
                width: 300,
                background: "var(--bg-surface)",
                borderLeft: "1px solid var(--border-default)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 2 }}>
                    {selectedType === "entity" ? "ENTITY INTELLIGENCE" : "CASE DETAILS"}
                  </div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>
                    {selectedType === "entity" ? "High-Risk Identifier" : "Case Node"}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", padding: 4,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {selectedType === "entity" && selectedEntity.entityType && (
                  <>
                    {/* Entity Value */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6 }}>
                        IDENTIFIER
                      </div>
                      <EntityChip type={selectedEntity.entityType} value={selectedEntity.value || ""} />
                    </div>

                    {/* Risk Level */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 4,
                        marginBottom: 14,
                        background: selectedEntity.riskLevel === "HIGH" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                        border: `1px solid ${selectedEntity.riskLevel === "HIGH" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={13} style={{ color: selectedEntity.riskLevel === "HIGH" ? "#f87171" : "#fbbf24" }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: selectedEntity.riskLevel === "HIGH" ? "#f87171" : "#fbbf24" }}>
                          {selectedEntity.riskLevel === "HIGH" ? "High-Frequency Money Mule" : "Medium-Risk Common Identifier"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          Qualified assessment — not a confirmed determination
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        { icon: Hash, label: "OCCURRENCES", value: `${selectedEntity.caseCount} Cases` },
                        {
                          icon: DollarSign, label: "AGGREGATE FRAUD",
                          value: `₹${((selectedEntity.amountLinked || 0) / 100000).toFixed(2)}L`,
                        },
                        {
                          icon: MapPin, label: "JURISDICTIONS",
                          value: `${selectedEntity.jurisdictions?.length || 0} States`,
                        },
                        { icon: TrendingUp, label: "RISK SCORE", value: "91 / 100" },
                      ].map(({ icon: Icon, label, value }) => (
                        <div
                          key={label}
                          style={{
                            padding: "10px 12px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                            <Icon size={10} style={{ color: "var(--text-muted)" }} />
                            <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.07em" }}>
                              {label}
                            </span>
                          </div>
                          <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Jurisdictions */}
                    {selectedEntity.jurisdictions && selectedEntity.jurisdictions.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6 }}>
                          LINKED JURISDICTIONS
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {selectedEntity.jurisdictions.map((j) => (
                            <span
                              key={j}
                              style={{
                                padding: "2px 7px", borderRadius: 3, fontSize: 10,
                                background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {j}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "rgba(245,158,11,0.05)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: 4,
                        fontSize: 9,
                        color: "var(--text-muted)",
                        lineHeight: 1.6,
                      }}
                    >
                      ⚠ This platform is an <strong style={{ color: "var(--text-secondary)" }}>Investigative Intelligence Tool</strong>. Results indicate potential syndicate matches, not confirmed determinations. All findings require verification before FIR registration.
                    </div>
                  </>
                )}

                {selectedType === "case" && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6 }}>
                      CASE NUMBER
                    </div>
                    <div style={{ color: "#60a5fa", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, marginBottom: 14 }}>
                      #{selectedEntity.label}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      Incident Type: {selectedEntity.incidentType}
                    </div>
                    <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 11 }}>
                      Click an entity node (amber/red) to view cross-case syndicate intelligence.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
