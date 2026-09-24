"use client";
import { useState } from "react";
import {
  Shield, FileText, GitBranch, Scale,
  ChevronRight, ChevronLeft, Activity,
  Folder, Settings, BarChart2, Radio,
  Layers,
} from "lucide-react";
import { ACTIVE_CASE, CASE_METRICS } from "@/lib/mock-data";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: "vault",    icon: Shield,    label: "Evidence Vault",       badge: CASE_METRICS.evidenceItems },
  { id: "timeline", icon: Activity,  label: "Forensic Timeline",    badge: CASE_METRICS.timelineEvents },
  { id: "graph",    icon: GitBranch, label: "Syndicate & Clusters", badge: CASE_METRICS.syndicateMatches, alert: true },
  { id: "legal",    icon: Scale,     label: "Legal Matrix",         badge: null },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? 52 : 220,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Logo / System Header */}
      <div
        style={{
          padding: collapsed ? "14px 0" : "14px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          style={{
            width: 28, height: 28, borderRadius: 4,
            background: "linear-gradient(135deg, #1e40af, #1d4ed8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>RK</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
              Rakshak
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
              v3.0-forensic
            </div>
          </div>
        )}
      </div>

      {/* Case Summary */}
      {!collapsed && (
        <div
          style={{
            margin: "10px 10px 4px",
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            borderRadius: 4,
            border: "1px solid var(--border-default)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>
            ACTIVE CASE
          </div>
          <div
            style={{
              color: "#60a5fa", fontSize: 11, fontWeight: 600,
              fontFamily: "JetBrains Mono, monospace", marginBottom: 6,
            }}
          >
            #{ACTIVE_CASE.caseNumber}
          </div>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 6px", borderRadius: 3,
              background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
              color: "#93c5fd", fontSize: 9, letterSpacing: "0.05em",
            }}
          >
            <span
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#60a5fa", display: "inline-block",
              }}
              className="animate-pulse-dot"
            />
            ACTIVE INQUIRY
          </div>
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 9, marginBottom: 2 }}>JURISDICTION</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 10, lineHeight: 1.4 }}>
              Cyber Crime Branch<br />Sector 17, Chandigarh
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 9, marginBottom: 2 }}>OFFICER I/C</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 10 }}>
              SI R.S. Meena · CCB-1147
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
        {!collapsed && (
          <div
            style={{
              color: "var(--text-muted)", fontSize: 9, letterSpacing: "0.1em",
              padding: "4px 8px 4px", marginBottom: 2,
            }}
          >
            INVESTIGATION MODULES
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "9px 0" : "9px 10px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? "var(--bg-overlay)" : "transparent",
                borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                transition: "all 0.12s ease",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon size={15} style={{ flexShrink: 0, color: isActive ? "#60a5fa" : "inherit" }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: isActive ? 500 : 400 }}>
                    {item.label}
                  </span>
                  {item.badge !== null && (
                    <span
                      style={{
                        fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                        background: item.alert ? "rgba(239,68,68,0.15)" : "var(--bg-overlay)",
                        color: item.alert ? "#f87171" : "var(--text-secondary)",
                        border: `1px solid ${item.alert ? "rgba(239,68,68,0.3)" : "var(--border-subtle)"}`,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {item.alert && "⚠ "}
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Divider */}
        {!collapsed && (
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              margin: "8px 4px",
            }}
          />
        )}

        {/* Secondary nav */}
        {[{ icon: BarChart2, label: "Case Analytics" }, { icon: Folder, label: "Case Archive" }, { icon: Settings, label: "System Settings" }].map(
          ({ icon: Icon, label }) => (
            <button
              key={label}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: collapsed ? "9px 0" : "9px 10px",
                borderRadius: 4, border: "none", cursor: "pointer",
                width: "100%", textAlign: "left",
                justifyContent: collapsed ? "center" : "flex-start",
                background: "transparent", color: "var(--text-muted)",
                transition: "all 0.12s ease", borderLeft: "2px solid transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
            >
              <Icon size={14} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ fontSize: 12 }}>{label}</span>}
            </button>
          )
        )}
      </nav>

      {/* System Status Footer */}
      {!collapsed && (
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Radio size={10} style={{ color: "#10b981" }} />
            <span style={{ color: "var(--text-muted)" }}>Syndicate Engine: </span>
            <span style={{ color: "#10b981", fontFamily: "JetBrains Mono, monospace" }}>ONLINE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#10b981",
              }}
              className="animate-pulse-dot"
            />
            <span style={{ color: "var(--text-muted)" }}>
              Extraction Engine v4.0
            </span>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          padding: "8px",
          borderTop: "1px solid var(--border-subtle)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          transition: "color 0.1s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
