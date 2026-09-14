"use client";
import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Smartphone, CreditCard, Phone, Activity,
  ExternalLink, ChevronDown, ChevronUp, Filter, Mail, Camera,
} from "lucide-react";
import { TIMELINE_EVENTS, TimelineEvent, SourceType } from "@/lib/mock-data";
import EntityChip from "@/components/ui/EntityChip";

interface TimelineViewProps {
  onInspect: (evidenceId: string) => void;
}

const SOURCE_CONFIG: Record<SourceType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  WHATSAPP:   { icon: MessageSquare, label: "WhatsApp Chat", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  BANK_SMS:   { icon: Smartphone,    label: "Bank SMS",      color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  RECEIPT:    { icon: CreditCard,    label: "Payment Receipt",color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  CALL_LOG:   { icon: Phone,         label: "Call Log",      color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  SCREENSHOT: { icon: Activity,      label: "Screenshot",    color: "#f472b6", bg: "rgba(244,114,182,0.1)"  },
  EMAIL:      { icon: Mail,          label: "Email Event",   color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
  CCTV:       { icon: Camera,        label: "CCTV Footages", color: "#38bdf8", bg: "rgba(56,189,248,0.1)"  },
};

const SEVERITY_COLORS: Record<string, { dot: string; border: string }> = {
  CRITICAL: { dot: "#ef4444", border: "rgba(239,68,68,0.4)"  },
  HIGH:     { dot: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  MEDIUM:   { dot: "#60a5fa", border: "rgba(96,165,250,0.25)"},
  LOW:      { dot: "#10b981", border: "rgba(16,185,129,0.2)" },
};

function TimelineCard({ event, onInspect }: { event: TimelineEvent; onInspect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const source = SOURCE_CONFIG[event.sourceType] || SOURCE_CONFIG.WHATSAPP;
  const SourceIcon = source.icon;
  const severity = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.LOW;

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        position: "relative",
      }}
      className="animate-fade-in"
    >
      {/* Timeline spine dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 24 }}>
        <div
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: severity.dot,
            border: `2px solid ${severity.border}`,
            boxShadow: `0 0 8px ${severity.dot}55`,
            flexShrink: 0, zIndex: 1,
            marginTop: 4,
          }}
        />
        <div style={{ width: 1, flex: 1, background: "var(--border-subtle)", marginTop: 2 }} />
      </div>

      {/* Card */}
      <div
        style={{
          flex: 1,
          marginBottom: 14,
          background: "var(--bg-elevated)",
          border: `1px solid ${expanded ? "var(--border-default)" : "var(--border-subtle)"}`,
          borderLeft: `3px solid ${severity.dot}`,
          borderRadius: "0 6px 6px 0",
          overflow: "hidden",
          transition: "border-color 0.15s",
        }}
      >
        {/* Card Header */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Timestamp */}
          <div style={{ flexShrink: 0, minWidth: 140 }}>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10, color: "var(--text-secondary)", fontWeight: 500,
                marginBottom: 2,
              }}
            >
              {event.timestampIST}
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, color: "var(--text-muted)",
              }}
            >
              {new Date(event.timestamp).toISOString().replace("T", " ").slice(0, 19)}Z
            </div>
          </div>

          {/* Source Badge */}
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 3,
              background: source.bg,
              border: `1px solid ${source.color}44`,
              fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
              color: source.color, flexShrink: 0,
            }}
          >
            <SourceIcon size={9} />
            {source.label}
          </span>

          {/* Severity */}
          <span
            style={{
              padding: "2px 6px", borderRadius: 3, fontSize: 9,
              fontWeight: 600, letterSpacing: "0.05em",
              color: severity.dot,
              background: `${severity.dot}14`,
              border: `1px solid ${severity.dot}44`,
              flexShrink: 0,
            }}
          >
            {event.severity}
          </span>

          <div style={{ flex: 1 }} />

          {/* Expand Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
              padding: 2,
            }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Narrative */}
        <div style={{ padding: "0 14px 10px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            {event.narrative}
          </p>
        </div>

        {/* Entity Chips */}
        {event.extractedEntities.length > 0 && (
          <div
            style={{
              padding: "8px 14px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: 9, letterSpacing: "0.06em", marginRight: 2 }}>
              EXTRACTED:
            </span>
            {event.extractedEntities.map((ent, i) => (
              <EntityChip key={i} type={ent.type} value={ent.value} compact />
            ))}
          </div>
        )}

        {/* Source Traceability Footer */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9, color: "var(--text-muted)",
            }}
          >
            SOURCE: {event.evidenceId} · EVENT_ID: {event.id}
          </span>
          <button
            onClick={() => onInspect(event.evidenceId)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 3,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "#60a5fa", fontSize: 10, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.03em",
              transition: "all 0.1s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
          >
            <ExternalLink size={10} />
            Verify Source [{event.evidenceId}]
          </button>
        </div>

        {/* Expanded: confidence details */}
        {expanded && (
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border-subtle)",
              background: "var(--bg-base)",
            }}
            className="animate-fade-in"
          >
            <div style={{ color: "var(--text-muted)", fontSize: 9, letterSpacing: "0.07em", marginBottom: 8 }}>
              ENTITY EXTRACTION DETAILS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {event.extractedEntities.map((ent, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 4,
                  }}
                >
                  <EntityChip type={ent.type} value={ent.value} compact />
                  <div style={{ flex: 1, height: 3, background: "var(--bg-overlay)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%", borderRadius: 2,
                        background: ent.confidence > 0.95 ? "#10b981" : ent.confidence > 0.8 ? "#f59e0b" : "#ef4444",
                        width: `${(ent.confidence * 100).toFixed(0)}%`,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", flexShrink: 0 }}>
                    {(ent.confidence * 100).toFixed(1)}% conf.
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>
                    → {ent.evidenceId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelineView({ onInspect }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(TIMELINE_EVENTS);
  const [isLive, setIsLive] = useState(false);
  const [filterSource, setFilterSource] = useState<SourceType | "ALL">("ALL");

  const fetchLiveTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/cases/CASE-2026-0891/timeline");
      if (res.ok) {
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          const liveList: TimelineEvent[] = data.events.map((ev: any, idx: number) => {
            const mockMatch = TIMELINE_EVENTS.find(
              (m) => m.evidenceId === ev.evidenceId || m.id === ev.id
            );
            const severity =
              ev.phase === "SEVERED" ? "CRITICAL" :
              ev.phase === "PAYMENT" ? "HIGH" :
              ev.phase === "CONTACT" ? "MEDIUM" : "LOW";

            return {
              id: ev.id.startsWith("EVT-") ? ev.id : `EVT-00${idx + 1}`,
              timestamp: ev.timestamp,
              timestampIST: new Date(ev.timestamp).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }) + " IST",
              sourceType: ev.sourceType,
              narrative: ev.description,
              evidenceId: ev.evidenceId,
              extractedEntities: mockMatch?.extractedEntities || [],
              severity,
            };
          });
          setEvents(liveList);
          setIsLive(true);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live timeline, using mock data", err);
    }
  }, []);

  useEffect(() => {
    fetchLiveTimeline();
  }, [fetchLiveTimeline]);

  const filtered = filterSource === "ALL"
    ? events
    : events.filter((e) => e.sourceType === filterSource);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          background: "var(--bg-surface)",
        }}
      >
        <Filter size={12} style={{ color: "var(--text-muted)" }} />
        <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.07em", marginRight: 4 }}>
          FILTER BY SOURCE:
        </span>
        {(["ALL", "WHATSAPP", "BANK_SMS", "RECEIPT", "CALL_LOG", "EMAIL", "CCTV"] as const).map((src) => (
          <button
            key={src}
            onClick={() => setFilterSource(src as any)}
            style={{
              padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 500,
              border: "1px solid",
              cursor: "pointer", transition: "all 0.1s",
              background: filterSource === src ? "rgba(59,130,246,0.12)" : "transparent",
              borderColor: filterSource === src ? "rgba(59,130,246,0.4)" : "var(--border-subtle)",
              color: filterSource === src ? "#60a5fa" : "var(--text-muted)",
            }}
          >
            {src === "ALL" ? "All Sources" : src.replace("_", " ")}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {isLive && (
          <span
            style={{
              padding: "2px 7px", borderRadius: 3,
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
              color: "#34d399", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            LIVE SQLITE FORENSIC TIMELINE
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          {filtered.length} events · Sorted: Chronological ASC
        </span>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 20px 16px" }}>
        {/* Start Cap */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginLeft: 24,
          }}
        >
          <span
            style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 600,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
              color: "#6ee7b7", letterSpacing: "0.07em",
            }}
          >
            ▶ INCIDENT TIMELINE · CASE-2026-0891 · ISO-8601 UTC
          </span>
        </div>

        {filtered.map((event) => (
          <TimelineCard key={event.id} event={event} onInspect={onInspect} />
        ))}

        {/* End Cap */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: 0 }}>
          <div style={{ width: 24, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border-strong)" }} />
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
            ■ END OF RECORDED EVENTS — Case file open for new evidence
          </span>
        </div>
      </div>
    </div>
  );
}
