"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface HashDisplayProps {
  hash: string;
  truncate?: boolean;
  className?: string;
}

export default function HashDisplay({ hash, truncate = true, className }: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const display = truncate
    ? `${hash.slice(0, 8)}…${hash.slice(-6)}`
    : hash;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        color: "var(--text-secondary)",
      }}
      className={className}
    >
      <span style={{ letterSpacing: "0.03em" }}>{display}</span>
      <button
        onClick={copy}
        title="Copy SHA-256 hash"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: copied ? "#10b981" : "var(--text-muted)",
          display: "flex", alignItems: "center",
          padding: 0, transition: "color 0.1s",
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}
