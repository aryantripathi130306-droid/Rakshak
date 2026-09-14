"use client";
import { useState, useEffect } from "react";
import {
  Layers, Shield, AlertTriangle, CheckCircle, Network, ArrowRight,
  Clock, Landmark, Phone, Globe, CreditCard, ChevronRight, FileText,
  Download, Share2, Sparkles, RefreshCw, Eye, Check,
} from "lucide-react";
import {
  MOCK_CLUSTER,
  MOCK_CLUSTER_COMPARISON,
  MOCK_CLUSTER_TIMELINE,
  CaseClusterData,
  ComparisonRow,
  ClusterTimelineEvent,
} from "@/lib/mock-data";
import EntityChip from "@/components/ui/EntityChip";

interface CaseClusterViewProps {
  onSwitchToGraph?: () => void;
  onInspect?: (evidenceId: string) => void;
}

export default function CaseClusterView({ onSwitchToGraph, onInspect }: CaseClusterViewProps) {
  const [clusters, setClusters] = useState<CaseClusterData[]>([MOCK_CLUSTER]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>(MOCK_CLUSTER.id);
  const [comparisonData, setComparisonData] = useState<ComparisonRow[]>(MOCK_CLUSTER_COMPARISON);
  const [timelineData, setTimelineData] = useState<ClusterTimelineEvent[]>(MOCK_CLUSTER_TIMELINE);
  const [activeTabSection, setActiveTabSection] = useState<"COMPARISON" | "TIMELINE" | "RELATIONSHIPS">("COMPARISON");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadClusterData() {
      try {
        setLoading(true);
        const res = await fetch("/api/clusters");
        if (res.ok) {
          const data = await res.json();
          if (data.clusters && data.clusters.length > 0) {
            setClusters(data.clusters);
            setSelectedClusterId(data.clusters[0].id);
          }
        }
      } catch (err) {
        console.warn("Using local case cluster dataset", err);
      } finally {
        setLoading(false);
      }
    }
    loadClusterData();
  }, []);

  const currentCluster = clusters.find((c) => c.id === selectedClusterId) || clusters[0] || MOCK_CLUSTER;

  return (
    <div style={{ display: "flex", height: "100%", gap: 12, overflow: "hidden" }}>
      {/* ── Left Sidebar: Cluster Navigation ── */}
      <div
        style={{
          width: 280,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "12px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={14} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>
              Syndicate Clusters
            </span>
          </div>
          <span
            style={{
              fontSize: 9,
              fontFamily: "JetBrains Mono, monospace",
              padding: "1px 6px",
              borderRadius: 3,
              background: "rgba(56,189,248,0.15)",
              color: "#38bdf8",
              fontWeight: 700,
            }}
          >
            {clusters.length} DETECTED
          </span>
        </div>

        {/* Cluster List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: 6 }}>
          {clusters.map((cl) => {
            const isSelected = cl.id === selectedClusterId;
            return (
              <div
                key={cl.id}
                onClick={() => setSelectedClusterId(cl.id)}
                style={{
                  padding: "10px",
                  borderRadius: 5,
                  cursor: "pointer",
                  background: isSelected ? "rgba(59,130,246,0.12)" : "var(--bg-elevated)",
                  border: isSelected ? "1px solid #3b82f6" : "1px solid var(--border-subtle)",
                  transition: "all 0.1s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 2,
                      background: "rgba(239,68,68,0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {cl.confidence}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                    {cl.cases?.length || 5} CASES
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#93c5fd" : "var(--text-primary)", lineHeight: 1.3 }}>
                  {cl.name}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                  Total Fraud: ₹{(cl.totalFraudAmount || 411199).toLocaleString("en-IN")}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "8px", borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => {
              // Simulated auto-detect refresh
              setClusters([MOCK_CLUSTER]);
            }}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: 4,
              border: "1px solid var(--border-default)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <RefreshCw size={11} />
            Re-run Cluster Detection
          </button>
        </div>
      </div>

      {/* ── Main Workspace Area: Selected Cluster ── */}
      <div
        style={{
          flex: 1,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Section 1: Cluster Header & Metrics Bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: "rgba(239,68,68,0.18)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#f87171",
                    letterSpacing: "0.05em",
                  }}
                >
                  SYNDICATE CLUSTER · {currentCluster.confidence}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                  THEME: {currentCluster.theme}
                </span>
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                {currentCluster.name}
              </h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {onSwitchToGraph && (
                <button
                  onClick={onSwitchToGraph}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(59,130,246,0.15)",
                    border: "1px solid #3b82f6",
                    color: "#93c5fd",
                    cursor: "pointer",
                  }}
                >
                  <Network size={12} />
                  View in Graph
                </button>
              )}
            </div>
          </div>

          {/* Key Metric Counters */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "MEMBER CASES", value: `${currentCluster.cases?.length || 5} Linked FIRs`, color: "#38bdf8" },
              { label: "AGGREGATE FRAUD", value: `₹${(currentCluster.totalFraudAmount || 411199).toLocaleString("en-IN")}`, color: "#f87171" },
              { label: "JURISDICTIONS", value: `${currentCluster.jurisdictions?.length || 5} States / Units`, color: "#fbbf24" },
              { label: "SHARED MULES", value: "3 Primary Accounts", color: "#34d399" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  padding: "6px 10px",
                  borderRadius: 4,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.07em", fontWeight: 600 }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: "JetBrains Mono, monospace" }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Shared Common Entities Strip */}
        <div
          style={{
            padding: "8px 14px",
            background: "rgba(0,0,0,0.15)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
            COMMON INFRASTRUCTURE:
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {(currentCluster.commonEntities || []).map((ce, i) => (
              <div
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <EntityChip type={ce.type} value={ce.value} compact />
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: "0 4px",
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  {ce.caseCount} cases
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            padding: "0 12px",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {[
            { id: "COMPARISON", label: "Side-by-Side Case Comparison Matrix" },
            { id: "TIMELINE", label: "Combined Chronological Timeline" },
            { id: "RELATIONSHIPS", label: "Cross-Case Relationship Explanations" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTabSection(t.id as any)}
              style={{
                padding: "8px 12px",
                fontSize: 10,
                fontWeight: 600,
                border: "none",
                borderBottom: activeTabSection === t.id ? "2px solid #38bdf8" : "2px solid transparent",
                background: "transparent",
                color: activeTabSection === t.id ? "#38bdf8" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.1s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Section 3, 4, 5 Body Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {/* TAB 1: Comparison Table */}
          {activeTabSection === "COMPARISON" && (
            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--bg-base)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 140px 180px 180px 180px 180px 180px",
                  padding: "8px 12px",
                  background: "var(--bg-elevated)",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                <div>CATEGORY</div>
                <div>FIELD</div>
                <div>CASE-2026-0891 (Chandigarh)</div>
                <div>CASE-2026-1021 (Delhi)</div>
                <div>CASE-2026-1078 (Bengaluru)</div>
                <div>CASE-2026-1134 (Haryana)</div>
                <div>CASE-2026-1150 (Punjab)</div>
              </div>

              {comparisonData.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 140px 180px 180px 180px 180px 180px",
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
                    fontSize: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>{row.category}</div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.field}</div>
                  {["CASE-2026-0891", "CASE-2026-1021", "CASE-2026-1078", "CASE-2026-1134", "CASE-2026-1150"].map((cId) => {
                    const val = row.caseValues[cId] || "—";
                    const isMatch = val.includes("[MATCH]");
                    return (
                      <div key={cId} style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {isMatch ? (
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 3,
                              background: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.35)",
                              color: "#f87171",
                              fontWeight: 700,
                              fontSize: 9,
                            }}
                          >
                            {val}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-secondary)" }}>{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Combined Interleaved Timeline */}
          {activeTabSection === "TIMELINE" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {timelineData.map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    borderLeft: `4px solid ${evt.caseColor || "#3b82f6"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: "var(--bg-surface)",
                          border: `1px solid ${evt.caseColor}`,
                          color: evt.caseColor,
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {evt.caseNumber}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: 2,
                          background: evt.phase === "PAYMENT" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                          color: evt.phase === "PAYMENT" ? "#f87171" : "#93c5fd",
                        }}
                      >
                        {evt.phase}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                      {evt.timestampIST}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {evt.narrative}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Relationship Explanations */}
          {activeTabSection === "RELATIONSHIPS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(currentCluster.relationships || []).map((rel, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    borderRadius: 6,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                      <span style={{ color: "#60a5fa" }}>{rel.caseA}</span>
                      <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                      <span style={{ color: "#34d399" }}>{rel.caseB}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(245,158,11,0.15)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        color: "#fbbf24",
                      }}
                    >
                      POTENTIAL CONNECTION · VERIFICATION REQUIRED
                    </span>
                  </div>

                  {/* Shared Entity Badges */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {rel.sharedEntities.map((se, sIdx) => (
                      <EntityChip key={sIdx} type={se.type} value={se.value} compact />
                    ))}
                  </div>

                  {/* Reasons bullet list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                    {rel.reasons.map((r, rIdx) => (
                      <div key={rIdx} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10, color: "var(--text-secondary)" }}>
                        <Check size={11} style={{ color: "#10b981", marginTop: 2, flexShrink: 0 }} />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Caution Footer */}
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(245,158,11,0.06)",
            borderTop: "1px solid rgba(245,158,11,0.2)",
            fontSize: 9,
            color: "#fbbf24",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span>
            Clustered relationships are algorithmic intelligence leads. Cross-jurisdiction joint investigation teams must independently verify KYC records under Section 91 CrPC before unified chargesheeting.
          </span>
        </div>
      </div>
    </div>
  );
}
