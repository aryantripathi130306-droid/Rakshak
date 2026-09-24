"use client";
import { useCallback, useState, useEffect, useMemo } from "react";
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
import {
  AlertTriangle,
  X,
  TrendingUp,
  MapPin,
  DollarSign,
  Hash,
  Network,
  Layers,
  FileText,
  Shield,
  Search,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity,
  Phone,
  CreditCard,
  Globe,
  User,
  CheckCircle2,
  Filter,
  Hexagon,
  Boxes,
} from "lucide-react";
import { GRAPH_NODES, GRAPH_EDGES, GraphNode, MOCK_CLUSTER } from "@/lib/mock-data";
import EntityChip from "@/components/ui/EntityChip";
import CaseClusterView from "@/components/tabs/CaseClusterView";

// ─── Custom Honeycomb Node Components ────────────────────────────────────────

function CaseNodeComponent({ data, selected }: { data: GraphNode["data"]; selected: boolean }) {
  const isCurrent = data.label === "CASE-2026-0891";

  return (
    <div
      style={{
        minWidth: 210,
        maxWidth: 240,
        padding: "10px 14px",
        borderRadius: 10,
        background: isCurrent ? "rgba(10, 25, 48, 0.96)" : "rgba(13, 20, 36, 0.96)",
        border: isCurrent
          ? selected
            ? "2px solid #38bdf8"
            : "2px solid #0284c7"
          : selected
          ? "2px solid #60a5fa"
          : "1.5px solid rgba(148, 163, 184, 0.3)",
        boxShadow: isCurrent
          ? "0 0 25px rgba(2, 132, 199, 0.35), inset 0 0 15px rgba(56, 189, 248, 0.1)"
          : "0 4px 15px rgba(0, 0, 0, 0.5)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
      }}
    >
      {/* Top Honeycomb Cell Identifier */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "1.5px 6px",
              borderRadius: 4,
              background: isCurrent ? "rgba(56, 189, 248, 0.2)" : "rgba(148, 163, 184, 0.15)",
              border: isCurrent ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid rgba(148, 163, 184, 0.25)",
              color: isCurrent ? "#38bdf8" : "#94a3b8",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.06em",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <span>⬡</span>
            <span>{isCurrent ? "HEX-NUCLEUS" : "HEX-CELL"}</span>
          </div>

          {isCurrent && (
            <span
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}
              className="animate-pulse-dot"
            />
          )}
        </div>

        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: "#34d399",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ₹{((data.amountDefrauded || 50000) / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Case Number */}
      <div style={{ fontWeight: 800, fontSize: 12.5, color: "#fff", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.02em" }}>
        #{data.label}
      </div>

      {/* Incident / Crime Report Type */}
      {data.incidentType && (
        <div
          style={{
            fontSize: 9.5,
            color: isCurrent ? "#7dd3fc" : "#cbd5e1",
            marginTop: 3,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.incidentType}
        </div>
      )}

      {/* Complainant & Jurisdiction */}
      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(148, 163, 184, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{data.victimName || "Complainant"}</span>
        <span style={{ color: "#94a3b8", fontSize: 8.5 }}>
          {data.jurisdiction?.split("—")[1] || data.jurisdiction?.split("—")[0] || "Police Unit"}
        </span>
      </div>

      {/* Honeycomb Interconnection Badge */}
      {data.connectedCases && data.connectedCases.length > 0 && (
        <div
          style={{
            marginTop: 6,
            padding: "2.5px 6px",
            borderRadius: 4,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            fontSize: 8.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontWeight: 600,
          }}
        >
          <span>⬡ {data.connectedCases.length} Interlocking FIRs</span>
          <span style={{ color: "#ef4444" }}>LATTICE</span>
        </div>
      )}
    </div>
  );
}

function EntityNodeComponent({ data, selected }: { data: GraphNode["data"]; selected: boolean }) {
  const isHigh = data.riskLevel === "HIGH";
  const isUpiApex = data.label?.includes("mule88");

  return (
    <div
      style={{
        minWidth: 180,
        maxWidth: 215,
        padding: "9px 12px",
        borderRadius: 10,
        background: isHigh
          ? isUpiApex
            ? "rgba(45, 10, 20, 0.98)"
            : "rgba(35, 12, 18, 0.96)"
          : "rgba(35, 24, 10, 0.96)",
        border: selected
          ? `2px solid ${isHigh ? "#ef4444" : "#f59e0b"}`
          : `1.5px solid ${isHigh ? "rgba(239, 68, 68, 0.5)" : "rgba(245, 158, 11, 0.45)"}`,
        boxShadow: selected
          ? `0 0 16px ${isHigh ? "rgba(239, 68, 68, 0.5)" : "rgba(245, 158, 11, 0.4)"}`
          : isUpiApex
          ? "0 0 20px rgba(239, 68, 68, 0.3)"
          : "0 4px 12px rgba(0, 0, 0, 0.4)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span
          style={{
            fontSize: 8,
            letterSpacing: "0.07em",
            fontWeight: 800,
            padding: "1.5px 5px",
            borderRadius: 3,
            background: isHigh ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)",
            color: isHigh ? "#fca5a5" : "#fcd34d",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ⬡ {isUpiApex ? "HEX-APEX" : `${data.riskLevel} RISK`}
        </span>
        <span style={{ fontSize: 8.5, color: "var(--text-muted)", fontWeight: 600 }}>
          {data.caseCount || 2} FIR Hubs
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 10.5, color: "#fff", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
        {data.label}
      </div>

      {data.amountLinked && (
        <div style={{ fontSize: 9, color: isHigh ? "#f87171" : "#fbbf24", marginTop: 4, fontWeight: 600 }}>
          ₹{(data.amountLinked / 100000).toFixed(2)}L routed
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

// Convert mock data to React Flow nodes with honeycomb lattice positions
const initialNodes: Node[] = GRAPH_NODES.map((n) => ({
  id: n.id,
  type: n.type,
  data: n.data,
  position: n.position,
}));

const initialEdges: Edge[] = GRAPH_EDGES.map((e) => {
  const isHexPerimeter = e.id.startsWith("e-hex");
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    style: {
      stroke: isHexPerimeter ? "#ec4899" : e.animated ? "#ef4444" : "#2563eb",
      strokeWidth: isHexPerimeter ? 2.5 : e.animated ? 2 : 1.2,
      strokeDasharray: isHexPerimeter ? "4 2" : undefined,
    },
    labelStyle: { fill: isHexPerimeter ? "#f472b6" : "#94a3b8", fontSize: 8, fontWeight: 600 },
    labelBgStyle: { fill: "#080d14", fillOpacity: 0.92 },
  };
});

interface GraphViewProps {
  onInspect: (evidenceId: string) => void;
}

export default function GraphView({ onInspect }: GraphViewProps) {
  const [viewMode, setViewMode] = useState<"graph" | "clusters">("graph");
  const [layoutMode, setLayoutMode] = useState<"HONEYCOMB" | "RADIAL" | "CROSS_ONLY">("HONEYCOMB");
  const [showHexPerimeter, setShowHexPerimeter] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEntity, setSelectedEntity] = useState<GraphNode["data"] | null>(null);
  const [selectedType, setSelectedType] = useState<"case" | "entity" | "">("");

  // Select primary case on initial mount
  useEffect(() => {
    const primary = GRAPH_NODES.find((n) => n.id === "case-2026-0891");
    if (primary) {
      setSelectedEntity(primary.data);
      setSelectedType("case");
    }
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "entity") {
      setSelectedEntity(node.data as GraphNode["data"]);
      setSelectedType("entity");
    } else if (node.type === "case") {
      setSelectedEntity(node.data as GraphNode["data"]);
      setSelectedType("case");
    }
  }, []);

  // Filter nodes based on filter selection or search query
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data as GraphNode["data"];
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        matchesSearch = Boolean(
          (data.label && data.label.toLowerCase().includes(q)) ||
          (data.incidentType && data.incidentType.toLowerCase().includes(q)) ||
          (data.victimName && data.victimName.toLowerCase().includes(q)) ||
          (data.jurisdiction && data.jurisdiction.toLowerCase().includes(q))
        );
      }

      let matchesMode = true;
      if (layoutMode === "CROSS_ONLY") {
        matchesMode = node.type === "case";
      }

      const isDimmed = !matchesSearch || !matchesMode;
      return {
        ...node,
        style: {
          ...node.style,
          opacity: isDimmed ? 0.2 : 1,
          transition: "opacity 0.2s ease",
        },
      };
    });
  }, [nodes, layoutMode, searchQuery]);

  // Filter edges based on perimeter toggle
  const displayEdges = useMemo(() => {
    if (!showHexPerimeter) {
      return edges.filter((e) => !e.id.startsWith("e-hex"));
    }
    return edges;
  }, [edges, showHexPerimeter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 8 }}>
      {/* Top Controls Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Hexagon size={16} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Honeycomb Syndicate Intelligence Lattice</span>
              <span
                style={{
                  fontSize: 8.5,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: "rgba(236, 72, 153, 0.15)",
                  color: "#f472b6",
                  border: "1px solid rgba(236, 72, 153, 0.3)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 700,
                }}
              >
                ⬡ HONEYCOMB MESH ACTIVE
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Hexagonally tessellated inter-state FIR linkages, shared mule infrastructure & Modus Operandi
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search Box */}
          <div style={{ position: "relative", width: 170 }}>
            <Search
              size={12}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Filter hex cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 8px 4px 26px",
                borderRadius: 4,
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: 10,
                outline: "none",
              }}
            />
          </div>

          {/* Honeycomb Perimeter Toggle */}
          {viewMode === "graph" && (
            <button
              onClick={() => setShowHexPerimeter(!showHexPerimeter)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 9.5,
                fontWeight: 600,
                border: "1px solid rgba(236, 72, 153, 0.35)",
                cursor: "pointer",
                background: showHexPerimeter ? "rgba(236, 72, 153, 0.18)" : "transparent",
                color: showHexPerimeter ? "#f472b6" : "var(--text-muted)",
              }}
              title="Toggle outer hexagonal cross-FIR perimeter connection ring"
            >
              <span>⬡</span>
              <span>Hex Perimeter Ring</span>
            </button>
          )}

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
              <Boxes size={12} />
              Honeycomb Lattice View
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
              Syndicate Comparison
            </button>
          </div>
        </div>
      </div>

      {/* Render Content */}
      {viewMode === "clusters" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CaseClusterView onSwitchToGraph={() => setViewMode("graph")} onInspect={onInspect} />
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Honeycomb Canvas */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Alert Header Banner */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 8,
                background: "rgba(15, 23, 42, 0.88)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              }}
            >
              <Hexagon size={13} style={{ color: "#38bdf8" }} />
              <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700 }}>
                HONEYCOMB SYNDICATE TOPOLOGY
              </span>
              <span style={{ color: "#e2e8f0", fontSize: 10 }}>
                &bull; Primary Inquest (Nucleus) linked to 5 Interlocking State FIRs via Central Mule <code style={{ color: "#fca5a5", background: "rgba(239,68,68,0.2)", padding: "1px 4px", borderRadius: 3 }}>mule88@oksbi</code>
              </span>
              <span
                style={{
                  marginLeft: 4,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#34d399",
                  fontSize: 9,
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 600,
                }}
              >
                ● LATTICE STABLE
              </span>
            </div>

            {/* Legend */}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 12,
                zIndex: 10,
                padding: "10px 14px",
                background: "rgba(8,13,20,0.94)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6, fontWeight: 700 }}>
                HONEYCOMB STRUCTURE
              </div>
              {[
                { color: "#0284c7", label: "⬡ Primary Nucleus (CASE-0891)" },
                { color: "#1e293b", label: "⬡ Hexagonal Cross-FIR Cell" },
                { color: "#7f1d1d", label: "⬡ Apex Money Mule Node" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background: color,
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                  <span style={{ color: "var(--text-secondary)", fontSize: 9 }}>{label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                <div style={{ width: 16, height: 2, background: "#ec4899", borderBottom: "1px dashed #f472b6" }} />
                <span style={{ color: "#f472b6", fontSize: 8.5, fontWeight: 600 }}>Cross-Case Hex Perimeter Ring</span>
              </div>
            </div>

            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.3}
              maxZoom={2}
              style={{ background: "var(--bg-surface)" }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a2438" />
              <Controls
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                }}
              />
              <MiniMap
                nodeColor={(n) => {
                  if (n.id === "case-2026-0891") return "#0284c7";
                  if (n.type === "case") return "#334155";
                  return "#991b1b";
                }}
                style={{ bottom: 20, right: 12 }}
              />
            </ReactFlow>
          </div>

          {/* Interactive Crime Report & Modus Operandi Intelligence Panel */}
          {selectedEntity && (
            <div
              className="animate-slide-right"
              style={{
                width: 360,
                background: "var(--bg-surface)",
                borderLeft: "1px solid var(--border-default)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                zIndex: 20,
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-elevated)",
                }}
              >
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>⬡</span>
                    <span>{selectedType === "case" ? "CRIME REPORT & MODUS OPERANDI" : "SHARED SYNDICATE ASSET"}</span>
                  </div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span>{selectedEntity.label}</span>
                    {selectedType === "case" && selectedEntity.status && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: "rgba(59,130,246,0.15)",
                          color: "#60a5fa",
                          border: "1px solid rgba(59,130,246,0.3)",
                        }}
                      >
                        {selectedEntity.status}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 4,
                    borderRadius: 4,
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                {selectedType === "case" ? (
                  <>
                    {/* Crime Details Banner */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: "rgba(56, 189, 248, 0.08)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                      }}
                    >
                      <div style={{ fontSize: 9, color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                        INCIDENT CLASSIFICATION
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                        {selectedEntity.incidentType || "Task Scam"}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(56, 189, 248, 0.15)", fontSize: 10 }}>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 8.5 }}>COMPLAINANT</div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedEntity.victimName || "Priya Nair"}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 8.5 }}>DEFRAUDED AMOUNT</div>
                          <div style={{ fontWeight: 700, color: "#34d399", fontFamily: "JetBrains Mono, monospace" }}>
                            ₹{(selectedEntity.amountDefrauded || 49499).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 8.5 }}>JURISDICTION</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 9.5 }}>{selectedEntity.jurisdiction}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 8.5 }}>REGISTRATION DATE</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 9.5 }}>{selectedEntity.registeredDate || "Aug 2026"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Modus Operandi (MO) Breakdown */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 700 }}>
                          MODUS OPERANDI (MO) FUNNEL
                        </span>
                        <span style={{ fontSize: 8.5, color: "#38bdf8", fontWeight: 600 }}>4 STAGES</span>
                      </div>

                      <p style={{ fontSize: 10.5, color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 8 }}>
                        {selectedEntity.modusOperandi}
                      </p>

                      {/* MO Steps */}
                      {selectedEntity.moSteps && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selectedEntity.moSteps.map((step) => (
                            <div
                              key={step.step}
                              style={{
                                display: "flex",
                                gap: 8,
                                padding: "6px 8px",
                                borderRadius: 4,
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-subtle)",
                                fontSize: 9.5,
                              }}
                            >
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: step.phase === "PAYMENT" ? "#ef4444" : "#0284c7",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: 8.5,
                                  flexShrink: 0,
                                }}
                              >
                                {step.step}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{step.title}</div>
                                <div style={{ color: "var(--text-muted)", fontSize: 9, marginTop: 1 }}>{step.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Connected Cross-Cases */}
                    {selectedEntity.connectedCases && selectedEntity.connectedCases.length > 0 && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 700 }}>
                            HONEYCOMB CONNECTED CROSS-FIRs ({selectedEntity.connectedCases.length})
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selectedEntity.connectedCases.map((cc, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                background: "rgba(15, 23, 42, 0.8)",
                                border: "1px solid rgba(148, 163, 184, 0.2)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 700, fontSize: 10.5, color: "#60a5fa", fontFamily: "JetBrains Mono, monospace" }}>
                                  #{cc.caseNumber}
                                </span>
                                <span
                                  style={{
                                    fontSize: 8.5,
                                    fontWeight: 700,
                                    padding: "1px 4px",
                                    borderRadius: 2,
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "#34d399",
                                  }}
                                >
                                  {cc.similarityScore}% LINKAGE
                                </span>
                              </div>

                              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                                {cc.jurisdiction} &bull; {cc.incidentType}
                              </div>

                              <div style={{ fontSize: 9, color: "#e2e8f0", marginTop: 4, lineHeight: 1.3 }}>
                                <strong style={{ color: "#94a3b8" }}>Linkage Rationale: </strong>
                                {cc.reason}
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                                {cc.sharedEntities.map((se, sIdx) => (
                                  <span
                                    key={sIdx}
                                    style={{
                                      fontSize: 8,
                                      fontFamily: "JetBrains Mono, monospace",
                                      padding: "1px 4px",
                                      borderRadius: 2,
                                      background: "rgba(239, 68, 68, 0.15)",
                                      color: "#fca5a5",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                    }}
                                  >
                                    {se}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Entity Identifier */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 6, fontWeight: 700 }}>
                        SYNDICATE IDENTIFIER
                      </div>
                      {selectedEntity.entityType && (
                        <EntityChip type={selectedEntity.entityType} value={selectedEntity.value || ""} />
                      )}
                    </div>

                    {/* Risk Rating Card */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={15} style={{ color: "#f87171" }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>
                          Multi-Jurisdiction Money Mule Node
                        </div>
                        <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1 }}>
                          Observed across {selectedEntity.caseCount || 5} independent police inquests
                        </div>
                      </div>
                    </div>

                    {/* Linked FIRs Breakdown */}
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                        INTERCONNECTED CRIME REPORTS ({selectedEntity.caseCount || 5})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {[
                          { caseNo: "CASE-2026-0891", unit: "Cyber Crime Branch — Chandigarh", victim: "Priya Nair", loss: 49499, role: "Primary Payout VPA" },
                          { caseNo: "CASE-2026-0741", unit: "Cyber Cell — Rohini, Delhi", victim: "Rahul Verma", loss: 72000, role: "VIP Crypto Pool Deposit" },
                          { caseNo: "CASE-2026-0655", unit: "Cyber Crime Haryana — Gurugram", victim: "Sunita Devi", loss: 58500, role: "Hotel Review Escrow" },
                          { caseNo: "CASE-2026-0488", unit: "Cyber Cell — Ludhiana, Punjab", victim: "Arjun Mehta", loss: 165000, role: "Trading Liquidity Route" },
                          { caseNo: "CASE-2026-0312", unit: "Cyber Crime Branch — Jaipur", victim: "Meena Agarwal", loss: 85000, role: "Merchant Rating Mule" },
                        ].map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 4,
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--border-subtle)",
                              fontSize: 9.5,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontWeight: 700, color: "#60a5fa", fontFamily: "JetBrains Mono, monospace" }}>
                                #{item.caseNo}
                              </span>
                              <span style={{ fontWeight: 600, color: "#34d399", fontFamily: "JetBrains Mono, monospace" }}>
                                ₹{item.loss.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: 8.5, marginTop: 1 }}>
                              {item.unit} &bull; {item.victim}
                            </div>
                            <div style={{ color: "#cbd5e1", fontSize: 8.5, marginTop: 2 }}>
                              <strong style={{ color: "#94a3b8" }}>Role: </strong>{item.role}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 111 BNS Note */}
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 4,
                        background: "rgba(168, 85, 247, 0.08)",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        fontSize: 9.5,
                        color: "#d8b4fe",
                      }}
                    >
                      <strong>BNS §111 (Organised Crime): </strong>
                      Evidence establishes continuous unlawful syndicate activity causing aggregate financial damage exceeding ₹4.57 Lakhs across 5 states.
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
