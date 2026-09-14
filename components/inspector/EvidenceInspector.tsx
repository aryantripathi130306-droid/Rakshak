"use client";
import { X, Lock, CheckCircle, Shield, ZoomIn, ZoomOut, Activity, Scan, AlertTriangle, Radio, Mail, Camera, Info, Languages, Volume2, MessageSquare, Play, Pause } from "lucide-react";
import { useState } from "react";
import { EVIDENCE_ITEMS, MOCK_TRANSCRIPTION, MOCK_CHAT_TRANSLATION } from "@/lib/mock-data";
import HashDisplay from "@/components/ui/HashDisplay";
import EntityChip from "@/components/ui/EntityChip";
import { CATEGORY_CONFIG } from "@/components/tabs/EvidenceVault";

interface EvidenceInspectorProps {
  evidenceId: string | null;
  onClose: () => void;
}

// Mock image data URIs for demo — realistic-looking "screenshot" previews
const MOCK_PREVIEW_COLORS: Record<string, { bg: string; label: string; content: string[] }> = {
  "EV-101": {
    bg: "#f0fdf4",
    label: "Google Pay Receipt Screenshot",
    content: [
      "Google Pay",
      "Payment Successful",
      "₹24,999",
      "To: mule88@oksbi",
      "UTR: 262800412149",
      "28 Aug 2026, 19:48 IST",
    ],
  },
  "EV-102": {
    bg: "#f0f9ff",
    label: "WhatsApp Chat Export",
    content: [
      "+91-98111-22233",
      "[22 Aug] Join our task group",
      "Telegram: @task_rewards_official",
      "[23 Aug] Transfer via mule88@oksbi",
      "[25 Aug] Combo task unlocked!",
      "[26 Aug] Withdraw blocked",
    ],
  },
  "EV-103": {
    bg: "#fefce8",
    label: "SBI SMS Alert",
    content: [
      "SBI ALERT",
      "Ac XXXXXXXX2401 debited by",
      "Rs 24999 on 25-08-26",
      "IFSC: SBIN0002149",
      "UPI Ref: mule88@oksbi",
      "Avl Bal: Rs 1,202",
    ],
  },
  "EV-104": {
    bg: "#fdf4ff",
    label: "Call Recording / Voice Intercept",
    content: [
      "[Audio Stream: 1m 42s]",
      "Sample Rate: 44.1 kHz · 16-bit PCM",
      "Caller: +919811122233 (Task Coordinator)",
      "Recipient: Victim (Priya Nair)",
      "Channel 1: 'Immediately pay ₹24,999 to unlock...'",
      "[Synthesized Acoustic Pitch Detected]",
    ],
  },
  "EV-105": {
    bg: "#fff1f2",
    label: "Phishing Email (RFC822 MIME)",
    content: [
      "From: PayTM Task Rewards <rewards@paytm-verify-claim.in>",
      "To: priya.nair@gmail.com",
      "Subject: URGENT: Release your pending commission of ₹49,499",
      "Reply-To: mule-collection@sec-mail-relay.net",
      "Action: Click here to claim your task earnings before freeze",
      "Target URL: http://verify-job-portal.in/claim-fast",
    ],
  },
  "EV-106": {
    bg: "#fffbeb",
    label: "Identity Document (Scan)",
    content: [
      "IDENTITY PROOF CARD",
      "Name: SUMIT KUMAR (UNVERIFIED)",
      "DOB: 14/05/1994",
      "Address: Village Badli, Jhajjar, Haryana",
      "[NOTE: Document lacks micro-security fibers]",
      "Status: Suspected Synthetic / Mule Identity",
    ],
  },
  "EV-107": {
    bg: "#f0fdfa",
    label: "ATM CCTV Surveillance Frame",
    content: [
      "CCTV-DOME CAM 03 [Sector 17-B ATM]",
      "Timestamp: 2026-08-26 14:19:12 IST",
      "GPS: 30.7333° N, 76.7794° E",
      "Event: Cash Withdrawal ₹24,500",
      "Subject: Male, dark hood, masked",
      "Vehicle in BG: White Swift Dzire",
    ],
  },
};

export default function EvidenceInspector({ evidenceId, onClose }: EvidenceInspectorProps) {
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"STANDARD" | "ELA" | "SPECTROGRAM">("STANDARD");
  const [transMode, setTransMode] = useState<"BOTH" | "ORIGINAL" | "TRANSLATED">("BOTH");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegIdx, setActiveSegIdx] = useState<number | null>(null);

  if (!evidenceId) return null;

  const evidence = EVIDENCE_ITEMS.find((ev) => ev.id === evidenceId);
  if (!evidence) return null;

  const preview = MOCK_PREVIEW_COLORS[evidenceId] || {
    bg: "#1a2438", label: "Evidence Document", content: ["Content preview unavailable"],
  };

  const isAudio = evidence.mimeType.startsWith("audio") || evidence.fileType === "WAV" || evidence.fileType === "MP3";
  const isImage = evidence.mimeType.startsWith("image") || evidence.fileType === "PNG" || evidence.fileType === "JPG";
  const isEmail = evidence.evidenceCategory === "EMAIL" || evidence.evidenceCategory === "PHISHING_EMAIL" || evidence.fileType === "EML";
  const isIdentity = evidence.evidenceCategory === "IDENTITY_DATA";
  const isScenePhoto = evidence.evidenceCategory === "CRIME_SCENE_PHOTO";

  const catCfg = CATEGORY_CONFIG[evidence.evidenceCategory || "OTHER"] || CATEGORY_CONFIG.OTHER;
  const CatIcon = catCfg.icon;

  const emailMeta = evidence.metadata as {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
    replyTo?: string;
    phishingIndicators?: string[];
    linksFound?: string[];
  } | undefined;

  const sceneMeta = evidence.metadata as {
    fileMetadata?: {
      resolution?: string;
      cameraMake?: string;
      cameraSerial?: string;
      timestampRecorded?: string;
      gpsCoordinates?: string;
    };
    aiObservations?: string[];
  } | undefined;

  return (
    <div
      className="animate-slide-right"
      style={{
        width: 380,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          background: "var(--bg-elevated)",
        }}
      >
        <Shield size={14} style={{ color: "#60a5fa" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em" }}>
              FORENSIC INSPECTOR
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 3,
                background: catCfg.bg,
                border: `1px solid ${catCfg.border}`,
                color: catCfg.color,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <CatIcon size={8} />
              {catCfg.label}
            </span>
          </div>
          <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {evidence.id} · {evidence.fileName}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 4,
            borderRadius: 3, transition: "background 0.1s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-overlay)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Mode Switcher Tabs for ELA / Spectrogram */}
      {(isImage || isAudio) && (
        <div
          style={{
            display: "flex",
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "4px 10px",
            gap: 6,
          }}
        >
          <button
            onClick={() => setViewMode("STANDARD")}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 3,
              border: viewMode === "STANDARD" ? "1px solid #3b82f6" : "1px solid transparent",
              background: viewMode === "STANDARD" ? "rgba(59,130,246,0.15)" : "transparent",
              color: viewMode === "STANDARD" ? "#93c5fd" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Raw Artifact
          </button>
          {isImage && (
            <button
              onClick={() => setViewMode("ELA")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 3,
                border: viewMode === "ELA" ? "1px solid #f59e0b" : "1px solid transparent",
                background: viewMode === "ELA" ? "rgba(245,158,11,0.15)" : "transparent",
                color: viewMode === "ELA" ? "#fcd34d" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              <Scan size={10} />
              ELA Splicing Heatmap
            </button>
          )}
          {isAudio && (
            <button
              onClick={() => setViewMode("SPECTROGRAM")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 3,
                border: viewMode === "SPECTROGRAM" ? "1px solid #ec4899" : "1px solid transparent",
                background: viewMode === "SPECTROGRAM" ? "rgba(236,72,153,0.15)" : "transparent",
                color: viewMode === "SPECTROGRAM" ? "#f472b6" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              <Radio size={10} />
              Audio Spectrogram
            </button>
          )}
        </div>
      )}

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {/* Document Preview with SVG Bounding Box or ELA / Spectrogram mode */}
        <div
          style={{
            marginBottom: "12px",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid var(--border-default)",
            background: viewMode === "ELA" ? "#0f172a" : viewMode === "SPECTROGRAM" ? "#09090b" : preview.bg,
            position: "relative",
          }}
        >
          {/* Zoom Controls */}
          <div
            style={{
              position: "absolute", top: 6, right: 6, zIndex: 10,
              display: "flex", gap: 4,
            }}
          >
            {[
              { icon: ZoomIn, action: () => setZoom((z) => Math.min(z + 0.25, 2.5)) },
              { icon: ZoomOut, action: () => setZoom((z) => Math.max(z - 0.25, 0.5)) },
            ].map(({ icon: Icon, action }, i) => (
              <button
                key={i}
                onClick={action}
                style={{
                  background: "rgba(0,0,0,0.4)", border: "none", borderRadius: 3,
                  padding: 4, cursor: "pointer", color: "#fff",
                  display: "flex", alignItems: "center",
                }}
              >
                <Icon size={11} />
              </button>
            ))}
          </div>

          {/* ELA Mode Overlay */}
          {viewMode === "ELA" ? (
            <div style={{ padding: 14, minHeight: 180, color: "#f59e0b", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#fbbf24", fontWeight: 700 }}>
                <Scan size={12} />
                <span>ERROR LEVEL ANALYSIS (ELA) — 95% RESAVE</span>
              </div>
              <div style={{ background: "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, rgba(15,23,42,0.95) 70%)", padding: 10, borderRadius: 4, border: "1px dashed rgba(245,158,11,0.4)" }}>
                <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 10 }}>Pixel Inconsistency Heatmap:</p>
                <div style={{ color: "#38bdf8", marginBottom: 4 }}>• Header: Baseline variance 3.8%</div>
                <div style={{ color: "#10b981", marginBottom: 4 }}>• Entity Fields: Uniform matrix [PASS]</div>
                <div style={{ marginTop: 8, fontSize: 10, color: "#10b981", fontWeight: 600 }}>
                  ✔ NO FORGERY / SPLICING DETECTED
                </div>
              </div>
            </div>
          ) : viewMode === "SPECTROGRAM" ? (
            <div style={{ padding: 14, minHeight: 180, color: "#f472b6", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#f472b6", fontWeight: 700 }}>
                <Activity size={12} />
                <span>VOICE SPECTROGRAM & FORMANT ANALYSIS</span>
              </div>
              <div style={{ background: "linear-gradient(180deg, rgba(236,72,153,0.15) 0%, rgba(9,9,11,0.9) 100%)", padding: 10, borderRadius: 4, border: "1px dashed rgba(236,72,153,0.4)" }}>
                <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 10 }}>Harmonic Cutoff & Synthesis Vector:</p>
                <div style={{ color: "#f87171", marginBottom: 4 }}>• High Freq Cutoff: 7,920 Hz (Vocoder Step)</div>
                <div style={{ color: "#fbbf24", marginBottom: 4 }}>• Deepfake Voice Model: Likely TTS Model</div>
                <div style={{ marginTop: 8, fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                  ⚠ SYNTHETIC VOICE DETECTED (88.4%)
                </div>
              </div>
            </div>
          ) : (
            /* Simulated Document */
            <div
              style={{
                padding: 14,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                position: "relative",
                minHeight: 180,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
              }}
            >
              <div style={{ color: "#1e293b", fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                {preview.label}
              </div>
              {preview.content.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: "#334155", marginBottom: 3, lineHeight: 1.4,
                    background: i === 3 ? "rgba(239,68,68,0.15)" : "transparent",
                    padding: i === 3 ? "2px 4px" : "0 4px",
                    borderRadius: i === 3 ? 3 : 0,
                    border: i === 3 ? "1px solid rgba(239,68,68,0.4)" : "none",
                  }}
                >
                  {line}
                </div>
              ))}

              {/* SVG Bounding Box Overlay */}
              {evidence.mockBoundingBox && (
                <svg
                  style={{
                    position: "absolute",
                    top: 0, left: 0, width: "100%", height: "100%",
                    pointerEvents: "none",
                  }}
                >
                  <rect
                    x={evidence.mockBoundingBox.x}
                    y={evidence.mockBoundingBox.y}
                    width={evidence.mockBoundingBox.width}
                    height={evidence.mockBoundingBox.height}
                    fill="rgba(239,68,68,0.1)"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    rx={2}
                  />
                  <text
                    x={evidence.mockBoundingBox.x}
                    y={evidence.mockBoundingBox.y - 4}
                    fontSize={8}
                    fill="#ef4444"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    EXTRACTED ENTITY
                  </text>
                </svg>
              )}
            </div>
          )}
        </div>

        {/* ── Category Specific Panel 1: Email Headers & Phishing Analysis ── */}
        {isEmail && (
          <div
            style={{
              marginBottom: "12px",
              background: "var(--bg-elevated)",
              border: evidence.evidenceCategory === "PHISHING_EMAIL" ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border-default)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {evidence.evidenceCategory === "PHISHING_EMAIL" && (
              <div
                style={{
                  padding: "6px 10px",
                  background: "rgba(239,68,68,0.18)",
                  borderBottom: "1px solid rgba(239,68,68,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#fca5a5",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                <AlertTriangle size={12} style={{ color: "#ef4444" }} />
                <span>⚠ POTENTIAL PHISHING / DECEPTIVE EMAIL ASSET</span>
              </div>
            )}
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <Mail size={11} style={{ color: "#c084fc" }} />
              RFC822 Email Headers & Anti-Spoofing Audit
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
              {emailMeta?.from && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>FROM: </span>
                  <span style={{ color: "#f87171", fontWeight: 600 }}>{emailMeta.from}</span>
                </div>
              )}
              {emailMeta?.replyTo && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>REPLY-TO: </span>
                  <span style={{ color: "#f59e0b" }}>{emailMeta.replyTo}</span>
                </div>
              )}
              {emailMeta?.subject && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>SUBJECT: </span>
                  <span style={{ color: "var(--text-primary)" }}>{emailMeta.subject}</span>
                </div>
              )}
              {emailMeta?.date && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>DATE: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{emailMeta.date}</span>
                </div>
              )}

              {emailMeta?.phishingIndicators && emailMeta.phishingIndicators.length > 0 && (
                <div style={{ marginTop: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
                  <div style={{ fontSize: 9, color: "#f87171", fontWeight: 700, marginBottom: 4 }}>
                    DECEPTIVE INDICATORS DETECTED:
                  </div>
                  {emailMeta.phishingIndicators.map((ind, i) => (
                    <div key={i} style={{ color: "#fca5a5", fontSize: 9, marginBottom: 2 }}>
                      • {ind}
                    </div>
                  ))}
                </div>
              )}

              {emailMeta?.linksFound && emailMeta.linksFound.length > 0 && (
                <div style={{ marginTop: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>
                    EMBEDDED HYPERLINKS:
                  </div>
                  {emailMeta.linksFound.map((l, i) => (
                    <div key={i} style={{ color: "#38bdf8", fontSize: 9, wordBreak: "break-all" }}>
                      🔗 {l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Category Specific Panel 2: Identity Data Warning ── */}
        {isIdentity && (
          <div
            style={{
              marginBottom: "12px",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: 4,
              padding: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontWeight: 700, fontSize: 11, marginBottom: 6 }}>
              <AlertTriangle size={13} />
              <span>⚠ UNVERIFIED IDENTITY INFORMATION</span>
            </div>
            <p style={{ margin: 0, fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Extracted name and address fields in identity scans require statutory cross-verification with UIDAI/ECI databases before inclusion in judicial charge-sheets.
            </p>
            <div style={{ marginTop: 6, padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: 3, fontSize: 9, color: "#fcd34d", fontFamily: "JetBrains Mono, monospace" }}>
              Status: UNVERIFIED · Suspected Identity Theft Front
            </div>
          </div>
        )}

        {/* ── Category Specific Panel 3: Crime Scene / CCTV Photo Metadata ── */}
        {isScenePhoto && (
          <div
            style={{
              marginBottom: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <Camera size={11} style={{ color: "#60a5fa" }} />
              Physical Scene & Surveillance Metadata
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: "JetBrains Mono, monospace" }}>
                <div><span style={{ color: "var(--text-muted)" }}>CAMERA: </span><span style={{ color: "var(--text-primary)" }}>{sceneMeta?.fileMetadata?.cameraMake || "HIKVISION DOME"}</span></div>
                <div><span style={{ color: "var(--text-muted)" }}>TIMESTAMP: </span><span style={{ color: "#34d399" }}>{sceneMeta?.fileMetadata?.timestampRecorded || "2026-08-26 14:19:12 IST"}</span></div>
                <div><span style={{ color: "var(--text-muted)" }}>GPS GEOLOCATION: </span><span style={{ color: "#60a5fa" }}>{sceneMeta?.fileMetadata?.gpsCoordinates || "30.7333° N, 76.7794° E"}</span></div>
              </div>

              {sceneMeta?.aiObservations && sceneMeta.aiObservations.length > 0 && (
                <div style={{ marginTop: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
                  <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <Info size={10} />
                    <span>AI OBSERVATIONS (MACHINE-GENERATED — REQUIRES IO REVIEW):</span>
                  </div>
                  {sceneMeta.aiObservations.map((obs, i) => (
                    <div key={i} style={{ color: "var(--text-secondary)", fontSize: 9, marginBottom: 2 }}>
                      • {obs}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Authenticity Verifier Card */}
        {evidence.authenticity && (
          <div
            style={{
              marginBottom: "12px",
              background: "var(--bg-elevated)",
              border: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border-default)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={11} style={{ color: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "#ef4444" : "#10b981" }} />
                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
                  Authenticity Verifier
                </span>
              </div>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                  color: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "#f87171" : "#34d399",
                  border: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.3)",
                }}
              >
                {evidence.authenticity.status}
              </span>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--text-primary)", lineHeight: 1.4 }}>
                {evidence.authenticity.finding}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, borderTop: "1px solid var(--border-subtle)", paddingTop: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>{evidence.authenticity.metricLabel}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: evidence.authenticity.status === "SUSPICIOUS_ANOMALY" ? "#f87171" : "#6ee7b7", fontWeight: 600 }}>
                  {evidence.authenticity.metricValue}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Metadata */}
        <div
          style={{
            marginBottom: "12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Lock size={11} style={{ color: "#10b981" }} />
            <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>
              Cryptographic Integrity Manifest
            </span>
          </div>
          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "SHA-256 HASH", value: <HashDisplay hash={evidence.sha256Hash} truncate={false} /> },
              {
                label: "STORAGE STATE",
                value: (
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                      color: "#6ee7b7",
                      background: "rgba(16,185,129,0.1)",
                      padding: "1px 5px", borderRadius: 3,
                      border: "1px solid rgba(16,185,129,0.25)",
                    }}
                  >
                    IMMUTABLE_COLD_BLOB
                  </span>
                ),
              },
              {
                label: "INTEGRITY STATUS",
                value: (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981", fontSize: 10 }}>
                    <CheckCircle size={10} />
                    Hash Verified · Original Unmodified
                  </span>
                ),
              },
              {
                label: "EXTRACTION PIPELINE",
                value: (
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#60a5fa" }}>
                    v4.0-expanded (Multi-Category Engine)
                  </span>
                ),
              },
              {
                label: "MIME TYPE & SIZE",
                value: (
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-secondary)" }}>
                    {evidence.mimeType} ({evidence.fileSize})
                  </span>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 2 }}>
                  {label}
                </div>
                <div>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Extracted Entities with Verification Status */}
        {evidence.extractedEntities.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize: 10, color: "var(--text-secondary)", fontWeight: 500,
              }}
            >
              Extracted Forensic Entities ({evidence.extractedEntities.length})
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              {evidence.extractedEntities.map((ent, i) => (
                <div
                  key={i}
                  style={{
                    padding: "5px 8px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <EntityChip type={ent.type} value={ent.value} />
                  <div style={{ flex: 1 }} />
                  {ent.verificationStatus === "UNVERIFIED" ? (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: "rgba(245,158,11,0.15)",
                        border: "1px solid rgba(245,158,11,0.4)",
                        color: "#fbbf24",
                      }}
                    >
                      UNVERIFIED
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#34d399",
                      }}
                    >
                      VERIFIED
                    </span>
                  )}
                  <span style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                    {(ent.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Communication Intelligence Panel (EV-102 WhatsApp / EV-104 Call) ── */}
        {(evidenceId === "EV-102" || evidenceId === "EV-104") && (() => {
          const isCall = evidenceId === "EV-104";
          const segments = isCall ? MOCK_TRANSCRIPTION.segments : null;
          const messages = !isCall ? MOCK_CHAT_TRANSLATION.messages : null;
          const origLang = isCall ? "Hindi (hi-IN)" : "Hinglish / Hindi (hi-Latn)";
          const pipeline = isCall ? "Whisper-Large-v3 (Indic Voice)" : "IndicTrans-2 Forensic";
          const confidence = isCall ? "94.2%" : "96.8%";

          return (
            <div
              style={{
                marginBottom: "12px",
                background: "var(--bg-elevated)",
                border: "1px solid rgba(56,189,248,0.35)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {/* Panel Header */}
              <div
                style={{
                  padding: "7px 10px",
                  borderBottom: "1px solid rgba(56,189,248,0.2)",
                  background: "rgba(56,189,248,0.07)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isCall
                    ? <Volume2 size={12} style={{ color: "#a78bfa" }} />
                    : <MessageSquare size={12} style={{ color: "#38bdf8" }} />}
                  <span style={{ fontSize: 10, fontWeight: 700, color: isCall ? "#c4b5fd" : "#38bdf8" }}>
                    {isCall ? "CALL INTERCEPT — TRANSCRIPT & TRANSLATION" : "WHATSAPP CHAT — TRANSLATION STREAM"}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: "JetBrains Mono, monospace",
                    padding: "1px 5px", borderRadius: 3,
                    background: "rgba(16,185,129,0.12)",
                    color: "#34d399",
                    border: "1px solid rgba(16,185,129,0.3)",
                  }}
                >
                  ORIGINAL PRESERVED
                </span>
              </div>

              {/* Meta strip */}
              <div
                style={{
                  padding: "5px 10px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 9,
                  color: "var(--text-muted)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                <span>LANG: <span style={{ color: "#f59e0b" }}>{origLang}</span></span>
                <span>→ ENGLISH</span>
                <span>PIPELINE: <span style={{ color: "var(--text-secondary)" }}>{pipeline}</span></span>
                <span style={{ marginLeft: "auto", color: "#34d399" }}>CONF: {confidence}</span>
              </div>

              {/* Language Toggle + Play (call only) */}
              <div
                style={{
                  padding: "5px 8px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Languages size={10} style={{ color: "var(--text-muted)" }} />
                <div
                  style={{
                    display: "flex",
                    background: "var(--bg-base)",
                    borderRadius: 3,
                    border: "1px solid var(--border-default)",
                    padding: 2,
                    gap: 2,
                    flex: 1,
                  }}
                >
                  {(["BOTH", "ORIGINAL", "TRANSLATED"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTransMode(m)}
                      style={{
                        flex: 1,
                        padding: "2px 4px",
                        borderRadius: 2,
                        fontSize: 9,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        background: transMode === m ? "rgba(56,189,248,0.2)" : "transparent",
                        color: transMode === m ? "#38bdf8" : "var(--text-muted)",
                        transition: "all 0.1s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m === "BOTH" ? "Side-by-Side" : m === "ORIGINAL" ? "Original" : "Translated"}
                    </button>
                  ))}
                </div>
                {isCall && (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "3px 7px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: isPlaying ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                      border: isPlaying ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.4)",
                      color: isPlaying ? "#f87171" : "#34d399",
                      flexShrink: 0,
                    }}
                  >
                    {isPlaying ? <Pause size={9} /> : <Play size={9} />}
                    {isPlaying ? "Pause" : "▶ Simulate"}
                  </button>
                )}
              </div>

              {/* Transcript / Chat Stream */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                {isCall && segments
                  ? segments.map((seg, idx) => {
                      const isSuspect = seg.speaker.includes("Suspect") || seg.speaker.includes("Speaker A");
                      return (
                        <div
                          key={idx}
                          onClick={() => setActiveSegIdx(activeSegIdx === idx ? null : idx)}
                          style={{
                            padding: "7px 9px",
                            borderRadius: 5,
                            background: activeSegIdx === idx
                              ? "rgba(59,130,246,0.12)"
                              : isSuspect ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.05)",
                            border: activeSegIdx === idx
                              ? "1px solid #3b82f6"
                              : isSuspect ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
                            cursor: "pointer",
                            transition: "all 0.1s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span
                                style={{
                                  fontSize: 8,
                                  fontFamily: "JetBrains Mono, monospace",
                                  padding: "1px 4px",
                                  borderRadius: 2,
                                  background: "var(--bg-overlay)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                [{seg.timestamp}]
                              </span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: isSuspect ? "#f87171" : "#34d399" }}>
                                {seg.speaker}
                              </span>
                            </div>
                            <span style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                              ALIGN: 100%
                            </span>
                          </div>

                          {(transMode === "BOTH" || transMode === "ORIGINAL") && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-primary)",
                                lineHeight: 1.5,
                                background: "rgba(0,0,0,0.18)",
                                padding: "5px 7px",
                                borderRadius: 3,
                                borderLeft: isSuspect ? "3px solid #ef4444" : "3px solid #10b981",
                                marginBottom: transMode === "BOTH" ? 4 : 0,
                                fontFamily: "system-ui, -apple-system, sans-serif",
                              }}
                            >
                              <span style={{ fontSize: 8, color: "var(--text-muted)", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                ORIGINAL (HINDI — देवनागरी):
                              </span>
                              {seg.originalText}
                            </div>
                          )}

                          {(transMode === "BOTH" || transMode === "TRANSLATED") && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#93c5fd",
                                lineHeight: 1.5,
                                background: "rgba(59,130,246,0.08)",
                                padding: "5px 7px",
                                borderRadius: 3,
                                borderLeft: "3px solid #3b82f6",
                              }}
                            >
                              <span style={{ fontSize: 8, color: "#60a5fa", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                CANONICAL TRANSLATION (ENGLISH):
                              </span>
                              {seg.translatedText}
                            </div>
                          )}
                        </div>
                      );
                    })
                  : messages
                  ? messages.map((msg, idx) => {
                      const isSuspect = msg.sender.includes("+919811") || msg.sender.includes("Suspect");
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "7px 9px",
                            borderRadius: 5,
                            background: isSuspect ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.05)",
                            border: isSuspect ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isSuspect ? "#f87171" : "#34d399" }}>
                              {msg.sender}
                            </span>
                            <span style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                              {new Date(msg.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          {(transMode === "BOTH" || transMode === "ORIGINAL") && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-primary)",
                                lineHeight: 1.5,
                                background: "rgba(0,0,0,0.18)",
                                padding: "5px 7px",
                                borderRadius: 3,
                                borderLeft: "3px solid #f59e0b",
                                marginBottom: transMode === "BOTH" ? 4 : 0,
                              }}
                            >
                              <span style={{ fontSize: 8, color: "#fbbf24", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                ORIGINAL ({(msg as any).language?.toUpperCase() || "HINGLISH"}):
                              </span>
                              {msg.originalText}
                            </div>
                          )}

                          {(transMode === "BOTH" || transMode === "TRANSLATED") && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#93c5fd",
                                lineHeight: 1.5,
                                background: "rgba(59,130,246,0.08)",
                                padding: "5px 7px",
                                borderRadius: 3,
                                borderLeft: "3px solid #3b82f6",
                              }}
                            >
                              <span style={{ fontSize: 8, color: "#60a5fa", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                FORENSIC ENGLISH INTERPRETATION:
                              </span>
                              {msg.translatedText}
                            </div>
                          )}
                        </div>
                      );
                    })
                  : null}
              </div>

              {/* BSA §63 Statutory Caution */}
              <div
                style={{
                  padding: "6px 10px",
                  background: "rgba(245,158,11,0.07)",
                  borderTop: "1px solid rgba(245,158,11,0.22)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  fontSize: 8,
                  color: "#fbbf24",
                  lineHeight: 1.4,
                }}
              >
                <AlertTriangle size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>BSA §63 PROTOCOL:</strong> Translations are machine-generated forensic aids. Original {isCall ? "audio stream" : "chat text"} remains the primary legal record under Bharatiya Sakshya Adhiniyam, 2023.
                </span>
              </div>
            </div>
          );
        })()}

        {/* Chain of Custody Note */}
        <div
          style={{
            padding: "6px 8px",
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 4,
            fontSize: 9, color: "var(--text-muted)", lineHeight: 1.5,
          }}
        >
          Chain of Custody: File ingested in read-only mode. Original binary preserved with identical SHA-256 signature. Access logged under Evidence ID {evidence.id}.
        </div>
      </div>
    </div>
  );
}
