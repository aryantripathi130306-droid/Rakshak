"use client";
import { useState } from "react";
import {
  Scale, CheckCircle, AlertCircle, MinusCircle,
  FileText, BookOpen, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import {
  STATUTORY_SECTIONS,
  EVIDENCE_CHECKLIST,
  CASE_METRICS,
  EvidenceChecklistItem,
} from "@/lib/mock-data";

interface LegalMatrixProps {
  onInspect: (evidenceId: string) => void;
}

function ChecklistItem({ item, onInspect }: { item: EvidenceChecklistItem; onInspect: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  const statusConfig = {
    CONFIRMED:       { icon: CheckCircle,  color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)", label: "CONFIRMED" },
    PENDING:         { icon: AlertCircle,  color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)", label: "PENDING"   },
    NOT_APPLICABLE:  { icon: MinusCircle,  color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.25)",label: "N/A"       },
  };
  const cfg = statusConfig[item.status];
  const Icon = cfg.icon;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${item.status === "PENDING" ? "rgba(245,158,11,0.2)" : "var(--border-subtle)"}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: "0 4px 4px 0",
        overflow: "hidden",
        marginBottom: 6,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: item.note ? "pointer" : "default",
        }}
        onClick={() => item.note && setOpen(!open)}
      >
        <Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
        <span
          style={{
            flex: 1, fontSize: 12, fontWeight: item.status === "PENDING" ? 500 : 400,
            color: item.status === "CONFIRMED" ? "var(--text-secondary)" : "var(--text-primary)",
          }}
        >
          {item.label}
        </span>
        <span
          style={{
            padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
            letterSpacing: "0.05em",
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>
        {item.evidenceId && (
          <button
            onClick={(e) => { e.stopPropagation(); onInspect(item.evidenceId!); }}
            style={{
              padding: "2px 7px", borderRadius: 3, fontSize: 9,
              background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
              color: "#60a5fa", cursor: "pointer",
            }}
          >
            {item.evidenceId}
          </button>
        )}
        {item.note && (
          open ? <ChevronUp size={12} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
        )}
      </div>
      {open && item.note && (
        <div
          style={{
            padding: "8px 14px 10px 37px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6,
          }}
        >
          {item.note}
        </div>
      )}
    </div>
  );
}

export default function LegalMatrix({ onInspect }: LegalMatrixProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("318");
  const confirmed = EVIDENCE_CHECKLIST.filter((i) => i.status === "CONFIRMED").length;
  const total = EVIDENCE_CHECKLIST.length;
  const pct = Math.round((confirmed / total) * 100);

  return (
    <div style={{ display: "flex", height: "100%", gap: 16, overflow: "hidden" }}>
      {/* LEFT: Checklist */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <Shield size={13} style={{ color: "#60a5fa" }} />
          <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 12 }}>
            Pre-FIR Evidence Checklist
          </span>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "4px 10px",
              background: pct === 100 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${pct === 100 ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: 4,
            }}
          >
            <div style={{ width: 80, height: 4, background: "var(--bg-overlay)", borderRadius: 2 }}>
              <div
                style={{
                  height: "100%", borderRadius: 2,
                  background: pct === 100 ? "#10b981" : "#f59e0b",
                  width: `${pct}%`, transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? "#10b981" : "#f59e0b", fontFamily: "JetBrains Mono, monospace" }}>
              {confirmed}/{total} items ({pct}%)
            </span>
          </div>
        </div>

        {/* MO Classification Banner */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em" }}>
              AUTO-CLASSIFIED MO:
            </span>
            <span
              style={{
                padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)",
                color: "#c4b5fd",
              }}
            >
              Part-Time Review / Task Scam
            </span>
            <span
              style={{
                padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
              }}
            >
              Layer-3 Mule Network
            </span>
            <span
              style={{
                padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                color: "#fbbf24",
              }}
            >
              Cross-Jurisdiction
            </span>
          </div>
        </div>

        {/* Checklist Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {EVIDENCE_CHECKLIST.map((item) => (
            <ChecklistItem key={item.id} item={item} onInspect={onInspect} />
          ))}
        </div>

        {/* Readiness Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>
            ⚠ This checklist is an <strong style={{ color: "var(--text-secondary)" }}>investigative aide</strong>. Complete all items before filing an FIR to avoid procedural defects. The platform does not automatically file FIRs.
          </div>
        </div>
      </div>

      {/* RIGHT: Statutory Sections */}
      <div
        style={{
          width: 340,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Scale size={13} style={{ color: "#a78bfa" }} />
            <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 12 }}>
              Applicable Statutory Provisions
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Auto-mapped to incident type. Verify with Legal Cell before chargesheeting.
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
          {STATUTORY_SECTIONS.map((section) => (
            <div
              key={section.code}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderLeft: `3px solid ${section.bailable ? "#64748b" : "#a78bfa"}`,
                borderRadius: "0 4px 4px 0",
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
                onClick={() =>
                  setExpandedSection(expandedSection === section.code ? null : section.code)
                }
              >
                <BookOpen size={11} style={{ color: "#a78bfa", flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12, fontWeight: 700, color: "#c4b5fd",
                  }}
                >
                  {section.code}
                </span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 4 }}>
                  <span
                    style={{
                      padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600,
                      background: section.severity === "COGNIZABLE" ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.1)",
                      border: `1px solid ${section.severity === "COGNIZABLE" ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.3)"}`,
                      color: section.severity === "COGNIZABLE" ? "#f87171" : "#94a3b8",
                    }}
                  >
                    {section.severity === "COGNIZABLE" ? "COG" : "NON-COG"}
                  </span>
                  <span
                    style={{
                      padding: "1px 5px", borderRadius: 3, fontSize: 9,
                      background: section.bailable ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${section.bailable ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                      color: section.bailable ? "#6ee7b7" : "#f87171",
                    }}
                  >
                    {section.bailable ? "BAIL" : "NON-BAIL"}
                  </span>
                </div>
                {expandedSection === section.code ? (
                  <ChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                ) : (
                  <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                )}
              </div>
              {/* Act Name */}
              <div style={{ padding: "0 12px 8px", fontSize: 10, color: "var(--text-muted)" }}>
                {section.act}
              </div>
              {/* Description */}
              {expandedSection === section.code && (
                <div
                  style={{
                    padding: "8px 12px 10px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "var(--bg-surface)",
                    fontSize: 11, color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {section.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
