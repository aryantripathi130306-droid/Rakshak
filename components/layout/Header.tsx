"use client";
import { useState } from "react";
import { Download, AlertTriangle, Database, Cpu, Copy, Check, ShieldCheck, Layers } from "lucide-react";
import { ACTIVE_CASE, CASE_METRICS } from "@/lib/mock-data";

interface HeaderProps {
  onExportPDF: () => void;
  onDownloadBSA63?: () => void;
}

function MetricPill({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: alert ? "rgba(239,68,68,0.06)" : "var(--bg-elevated)",
        border: `1px solid ${alert ? "rgba(239,68,68,0.25)" : "var(--border-default)"}`,
        borderRadius: 4,
      }}
    >
      <div>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 8,
            letterSpacing: "0.08em",
            lineHeight: 1,
            marginBottom: 2,
            fontWeight: 600,
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: alert ? "#f87171" : "var(--text-primary)",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {alert && <AlertTriangle size={10} style={{ color: "#f87171" }} />}
          {value}
          {alert && (
            <span
              style={{
                fontSize: 7,
                padding: "1px 3px",
                borderRadius: 2,
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                letterSpacing: "0.05em",
              }}
            >
              ALERT
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Header({ onExportPDF, onDownloadBSA63 }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyCase = () => {
    navigator.clipboard.writeText(ACTIVE_CASE.caseNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* LEFT: Case Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* Case Number */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={copyCase}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--bg-overlay)", border: "1px solid var(--border-default)",
              borderRadius: 4, padding: "4px 8px", cursor: "pointer",
              color: "#60a5fa", fontFamily: "JetBrains Mono, monospace",
              fontSize: 12, fontWeight: 600,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-overlay)"; }}
            title="Copy case number"
          >
            #{ACTIVE_CASE.caseNumber}
            {copied ? (
              <Check size={11} style={{ color: "#10b981" }} />
            ) : (
              <Copy size={11} style={{ opacity: 0.5 }} />
            )}
          </button>

          {/* Status Badge */}
          <span
            style={{
              padding: "3px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
              letterSpacing: "0.07em",
              color: "#93c5fd",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span
              className="animate-pulse-dot"
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#60a5fa", display: "inline-block",
              }}
            />
            ACTIVE INQUIRY
          </span>
        </div>

        {/* Vertical Separator */}
        <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />

        {/* Incident Details */}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Part-Time Task Scam{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              · Multi-Jurisdiction Mule Syndicate
            </span>
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 10 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              Cyber Crime Branch — Sector 17, Chandigarh
            </span>{" "}
            · SI R.S. Meena (CCB-1147)
          </div>
        </div>
      </div>

      {/* RIGHT: Metrics + Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <MetricPill
          label="EVIDENCE ITEMS"
          value={CASE_METRICS.evidenceItems}
        />
        <MetricPill
          label="CATEGORIES"
          value={`${CASE_METRICS.evidenceCategories || 6} Types`}
        />
        <MetricPill
          label="CLUSTERS"
          value="1 Syndicate"
        />
        <MetricPill
          label="LINKED FIRs"
          value={`${CASE_METRICS.linkedCases + 1} Cases`}
          alert
        />

        {/* Vertical Separator */}
        <div style={{ width: 1, height: 28, background: "var(--border-subtle)", margin: "0 2px" }} />

        {/* BSA §63 Electronic Evidence Certificate */}
        {onDownloadBSA63 && (
          <button
            onClick={onDownloadBSA63}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px", borderRadius: 4,
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#34d399", cursor: "pointer",
              fontSize: 10, fontWeight: 600,
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.16)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.08)";
            }}
            title="Download Statutory Section 63 BSA Electronic Evidence Certificate (Signed JSON Hash Manifest)"
          >
            <ShieldCheck size={12} style={{ color: "#10b981" }} />
            BSA §63 Cert (JSON)
          </button>
        )}

        {/* Export Button */}
        <button
          onClick={onExportPDF}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 4,
            background: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 10, fontWeight: 500,
            transition: "all 0.12s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
          }}
        >
          <Download size={12} />
          Export Dossier (PDF)
        </button>
      </div>
    </header>
  );
}
