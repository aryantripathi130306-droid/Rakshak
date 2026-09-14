"use client";
import { EntityType } from "@/lib/mock-data";

interface EntityChipProps {
  type: EntityType;
  value: string;
  compact?: boolean;
}

const ENTITY_COLORS: Record<EntityType, { bg: string; border: string; text: string; label: string }> = {
  UPI:       { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", text: "#c4b5fd", label: "UPI" },
  PHONE:     { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)", text: "#93c5fd", label: "PH"  },
  ACCOUNT:   { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", text: "#6ee7b7", label: "ACC" },
  IFSC:      { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#fcd34d", label: "IFSC"},
  DOMAIN:    { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "URL" },
  TELEGRAM:  { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.35)", text: "#7dd3fc", label: "TG"  },
  UTR:       { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#d8b4fe", label: "UTR" },
  EMAIL:     { bg: "rgba(192,132,252,0.12)",border: "rgba(192,132,252,0.35)",text: "#e9d5ff", label: "MAIL"},
  NAME:      { bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.35)", text: "#5eead4", label: "NAME"},
  ADDRESS:   { bg: "rgba(148,163,184,0.12)",border: "rgba(148,163,184,0.35)",text: "#cbd5e1", label: "ADDR"},
  IP:        { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fdba74", label: "IP"  },
  GPS_COORD: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: "#86efac", label: "GPS" },
};

export default function EntityChip({ type, value, compact = false }: EntityChipProps) {
  const colors = ENTITY_COLORS[type] || {
    bg: "rgba(100,116,139,0.12)",
    border: "rgba(100,116,139,0.35)",
    text: "#cbd5e1",
    label: type,
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "1px 5px" : "2px 7px",
        borderRadius: 3,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        fontSize: compact ? 9 : 10,
        fontFamily: "JetBrains Mono, monospace",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: colors.text, fontWeight: 600 }}>{colors.label}</span>
      <span style={{ color: "var(--text-secondary)" }}>{value}</span>
    </span>
  );
}
