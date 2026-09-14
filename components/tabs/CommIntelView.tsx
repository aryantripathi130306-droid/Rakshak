"use client";
import { useState, useEffect } from "react";
import {
  Languages, Volume2, MessageSquare, Shield, CheckCircle, AlertTriangle,
  Play, Pause, ArrowRight, Eye, Sparkles, Filter, FileAudio, ExternalLink,
} from "lucide-react";
import { MOCK_TRANSCRIPTION, MOCK_CHAT_TRANSLATION, EVIDENCE_ITEMS } from "@/lib/mock-data";
import HashDisplay from "@/components/ui/HashDisplay";
import EntityChip from "@/components/ui/EntityChip";

interface CommIntelViewProps {
  onInspect?: (evidenceId: string) => void;
}

export default function CommIntelView({ onInspect }: CommIntelViewProps) {
  const [activeEvidenceId, setActiveEvidenceId] = useState<string>("EV-104");
  const [displayMode, setDisplayMode] = useState<"BOTH" | "ORIGINAL" | "TRANSLATED">("BOTH");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [commsData, setCommsData] = useState<{
    transcriptions: any[];
    chatTranslations: any[];
  }>({
    transcriptions: [],
    chatTranslations: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadComms() {
      try {
        setLoading(true);
        const res = await fetch("/api/cases/CASE-2026-0891/communications");
        if (res.ok) {
          const data = await res.json();
          setCommsData(data);
        }
      } catch (e) {
        console.warn("Using local communication intelligence data", e);
      } finally {
        setLoading(false);
      }
    }
    loadComms();
  }, []);

  const transcription = commsData.transcriptions?.find((t) => t.evidenceId === activeEvidenceId) || (
    activeEvidenceId === "EV-104" ? {
      id: "trans-104-01",
      evidenceId: "EV-104",
      fileName: "Call_Recording_Intercept.wav",
      sha256Hash: "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f",
      originalLanguage: "Hindi (hi-IN)",
      targetLanguage: "English (en-US)",
      speakerCount: 2,
      confidence: 0.94,
      transcriptionMethod: "Whisper AI (Indic Forensic Pipeline)",
      segments: MOCK_TRANSCRIPTION.segments,
      extractedEntities: [
        { type: "PHONE", value: "+919811122233", confidence: 0.999 },
        { type: "PHONE", value: "+918800912244", confidence: 0.985 },
        { type: "ACCOUNT", value: "919876543210", confidence: 0.975 },
        { type: "UPI", value: "mule88@oksbi", confidence: 0.994 },
      ],
    } : null
  );

  const chatTranslation = commsData.chatTranslations?.find((ct) => ct.evidenceId === activeEvidenceId) || (
    activeEvidenceId === "EV-102" ? {
      id: "chat-trans-102-01",
      evidenceId: "EV-102",
      fileName: "WhatsApp_Chat_Export.txt",
      sha256Hash: "a3f2c819e4d72b06a1c0f5d8e9b3417c28e0f5a1b6c2d9e7f4a8b3c1d0e2f6a9",
      originalLanguage: "Hinglish (hi-Latn)",
      translationMethod: "IndicTrans-2 (Forensic Dialect Model)",
      messages: MOCK_CHAT_TRANSLATION.messages,
      extractedEntities: [
        { type: "PHONE", value: "+919811122233", confidence: 0.999 },
        { type: "TELEGRAM", value: "@task_rewards_official", confidence: 0.981 },
        { type: "UPI", value: "mule88@oksbi", confidence: 0.994 },
      ],
    } : null
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12, overflow: "hidden" }}>
      {/* Top Toolbar */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Source Evidence Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Languages size={15} style={{ color: "#38bdf8" }} />
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
            Communication Intelligence
          </span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            <button
              onClick={() => setActiveEvidenceId("EV-104")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                border: activeEvidenceId === "EV-104" ? "1px solid #38bdf8" : "1px solid var(--border-default)",
                background: activeEvidenceId === "EV-104" ? "rgba(56,189,248,0.15)" : "var(--bg-surface)",
                color: activeEvidenceId === "EV-104" ? "#38bdf8" : "var(--text-secondary)",
                transition: "all 0.1s ease",
              }}
            >
              <FileAudio size={12} />
              EV-104 · Audio Intercept (Hindi)
            </button>
            <button
              onClick={() => setActiveEvidenceId("EV-102")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                border: activeEvidenceId === "EV-102" ? "1px solid #38bdf8" : "1px solid var(--border-default)",
                background: activeEvidenceId === "EV-102" ? "rgba(56,189,248,0.15)" : "var(--bg-surface)",
                color: activeEvidenceId === "EV-102" ? "#38bdf8" : "var(--text-secondary)",
                transition: "all 0.1s ease",
              }}
            >
              <MessageSquare size={12} />
              EV-102 · WhatsApp Chat (Hinglish)
            </button>
          </div>
        </div>

        {/* Display Mode Switcher (Both / Original / Translated) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>
            VIEW MODE:
          </span>
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
            {[
              { id: "BOTH", label: "Side-by-Side (Dual)" },
              { id: "ORIGINAL", label: "Original Script Only" },
              { id: "TRANSLATED", label: "English Translation" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setDisplayMode(m.id as any)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: displayMode === m.id ? "rgba(56,189,248,0.2)" : "transparent",
                  color: displayMode === m.id ? "#38bdf8" : "var(--text-muted)",
                  transition: "all 0.1s ease",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div style={{ display: "flex", flex: 1, gap: 12, overflow: "hidden" }}>
        {/* Left / Center: Transcript Stream */}
        <div
          style={{
            flex: 1,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Stream Header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeEvidenceId === "EV-104" ? (
                <Volume2 size={14} style={{ color: "#a78bfa" }} />
              ) : (
                <MessageSquare size={14} style={{ color: "#38bdf8" }} />
              )}
              <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>
                {activeEvidenceId === "EV-104" ? "Call Audio Intercept — Speaker-Turn Transcript" : "WhatsApp Chat Stream Translation"}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "JetBrains Mono, monospace",
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: "rgba(16,185,129,0.12)",
                  color: "#34d399",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                ORIGINAL PRESERVED · DETERMINISTIC
              </span>
            </div>

            {activeEvidenceId === "EV-104" && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: isPlaying ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  border: isPlaying ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.4)",
                  color: isPlaying ? "#f87171" : "#34d399",
                }}
              >
                {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                {isPlaying ? "Simulating Audio Stream..." : "Simulate Audio Playback"}
              </button>
            )}
          </div>

          {/* Transcript Message List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
            {activeEvidenceId === "EV-104" && transcription ? (
              transcription.segments.map((seg: any, idx: number) => {
                const isSuspect = seg.speaker.includes("Suspect") || seg.speaker.includes("Speaker A");
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveSegmentIndex(idx)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background: activeSegmentIndex === idx ? "rgba(59,130,246,0.12)" : isSuspect ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                      border: activeSegmentIndex === idx ? "1px solid #3b82f6" : isSuspect ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      transition: "all 0.1s ease",
                      cursor: "pointer",
                    }}
                  >
                    {/* Speaker Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "JetBrains Mono, monospace",
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-muted)",
                          }}
                        >
                          [{seg.timestamp}]
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: isSuspect ? "#f87171" : "#34d399",
                          }}
                        >
                          {seg.speaker}
                        </span>
                      </div>
                      <span style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                        ALIGNMENT: 100%
                      </span>
                    </div>

                    {/* Original Hindi Text */}
                    {(displayMode === "BOTH" || displayMode === "ORIGINAL") && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-primary)",
                          lineHeight: 1.5,
                          fontFamily: "system-ui, -apple-system, sans-serif",
                          background: "rgba(0,0,0,0.15)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          borderLeft: isSuspect ? "3px solid #ef4444" : "3px solid #10b981",
                        }}
                      >
                        <span style={{ fontSize: 9, color: "var(--text-muted)", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                          ORIGINAL (HINDI - देवनागरी):
                        </span>
                        {seg.originalText}
                      </div>
                    )}

                    {/* English Translated Text */}
                    {(displayMode === "BOTH" || displayMode === "TRANSLATED") && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#93c5fd",
                          lineHeight: 1.5,
                          background: "rgba(59,130,246,0.08)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          borderLeft: "3px solid #3b82f6",
                        }}
                      >
                        <span style={{ fontSize: 9, color: "#60a5fa", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                          CANONICAL TRANSLATION (ENGLISH):
                        </span>
                        {seg.translatedText}
                      </div>
                    )}
                  </div>
                );
              })
            ) : activeEvidenceId === "EV-102" && chatTranslation ? (
              chatTranslation.messages.map((msg: any, idx: number) => {
                const isSuspect = msg.sender.includes("+919811") || msg.sender.includes("Suspect");
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background: isSuspect ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.05)",
                      border: isSuspect ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isSuspect ? "#f87171" : "#34d399" }}>
                        {msg.sender}
                      </span>
                      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                        {msg.timestamp}
                      </span>
                    </div>

                    {(displayMode === "BOTH" || displayMode === "ORIGINAL") && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-primary)",
                          lineHeight: 1.5,
                          background: "rgba(0,0,0,0.15)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          borderLeft: "3px solid #f59e0b",
                        }}
                      >
                        <span style={{ fontSize: 8, color: "#fbbf24", display: "block", marginBottom: 2, fontFamily: "JetBrains Mono, monospace" }}>
                          ORIGINAL MESSAGE ({msg.language?.toUpperCase() || "HINGLISH"}):
                        </span>
                        {msg.originalText}
                      </div>
                    )}

                    {(displayMode === "BOTH" || displayMode === "TRANSLATED") && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#93c5fd",
                          lineHeight: 1.5,
                          background: "rgba(59,130,246,0.08)",
                          padding: "6px 8px",
                          borderRadius: 4,
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
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                Select an evidence item above to view its multilingual transcript.
              </div>
            )}
          </div>

          {/* Machine Generation & Statutory Caution Banner */}
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(245,158,11,0.08)",
              borderTop: "1px solid rgba(245,158,11,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 9,
              color: "#fbbf24",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            <span>
              <strong>STATUTORY EVIDENCE PROTOCOL:</strong> Translations are machine-generated forensic aids. Under Bharatiya Sakshya Adhiniyam, 2023 (BSA §63), original audio and text streams remain the primary legal record.
            </span>
          </div>
        </div>

        {/* Right Sidebar: Entity Discovery from Original Text & Metadata */}
        <div
          style={{
            width: 300,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Metadata Card */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
              AUDIO / TRANSCRIPT MANIFEST
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>EVIDENCE ID: </span>
                <span style={{ color: "#60a5fa", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                  {activeEvidenceId}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>MODEL PIPELINE: </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {activeEvidenceId === "EV-104" ? "Whisper-Large-v3 (Indic Voice)" : "IndicTrans-2 Forensic"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>CONFIDENCE: </span>
                <span style={{ color: "#34d399", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
                  94.2% (Validated Acoustic Sync)
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>SHA-256 HASH: </span>
                <div style={{ marginTop: 2 }}>
                  <HashDisplay
                    hash={
                      activeEvidenceId === "EV-104"
                        ? "e1f4a8b2c5d9e3f7a0b4c8d1e5f2a6b0c3d7e1f4a9b3c7d0e4f8a2b6c1d5e9f"
                        : "a3f2c819e4d72b06a1c0f5d8e9b3417c28e0f5a1b6c2d9e7f4a8b3c1d0e2f6a9"
                    }
                    truncate={true}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Entities Extracted Strictly from Original Text */}
          <div
            style={{
              flex: 1,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
              ENTITIES FROM ORIGINAL TEXT ({activeEvidenceId === "EV-104" ? "4" : "3"})
            </div>
            <div style={{ fontSize: 9, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              These entities were regex/NER extracted directly from raw native Hindi/Hinglish speech streams:
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {(activeEvidenceId === "EV-104" ? (transcription?.extractedEntities || []) : (chatTranslation?.extractedEntities || [])).map(
                (ent: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 4,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <EntityChip type={ent.type} value={ent.value} />
                    <span style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "#34d399" }}>
                      {(ent.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )
              )}
            </div>

            {onInspect && (
              <button
                onClick={() => onInspect(activeEvidenceId)}
                style={{
                  marginTop: 6,
                  padding: "6px",
                  borderRadius: 4,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Eye size={12} />
                Inspect In Forensic Vault
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
