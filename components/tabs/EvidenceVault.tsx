"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, Shield, CheckCircle, Clock, Eye, Download,
  FileText, FileImage, File, AlertTriangle, Copy, Check, X, Search,
  Mail, PhoneCall, MessageSquare, CreditCard, Camera, UserCheck, Film, Globe,
} from "lucide-react";
import { EVIDENCE_ITEMS, EvidenceItem, EvidenceCategory } from "@/lib/mock-data";
import HashDisplay from "@/components/ui/HashDisplay";
import EntityChip from "@/components/ui/EntityChip";

interface EvidenceVaultProps {
  onInspect: (evidenceId: string) => void;
}

export const CATEGORY_CONFIG: Record<
  EvidenceCategory,
  { label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; bg: string; border: string }
> = {
  CHAT:              { label: "Chat Log",         icon: MessageSquare, color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.3)" },
  UPI_FINANCIAL:     { label: "UPI / Financial",  icon: CreditCard,    color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)" },
  CALL_LOG:          { label: "Call / Audio",     icon: PhoneCall,     color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)" },
  EMAIL:             { label: "Email Record",     icon: Mail,          color: "#c084fc", bg: "rgba(192,132,252,0.1)", border: "rgba(192,132,252,0.3)" },
  PHISHING_EMAIL:    { label: "Phishing Email",   icon: AlertTriangle, color: "#f87171", bg: "rgba(248,113,113,0.12)",border: "rgba(248,113,113,0.4)" },
  IDENTITY_DATA:     { label: "Identity Data",    icon: UserCheck,     color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
  DOCUMENT:          { label: "Document",         icon: FileText,      color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" },
  CRIME_SCENE_PHOTO: { label: "Scene Photo / ATM",icon: Camera,        color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)" },
  AUDIO:             { label: "Audio Intercept",  icon: PhoneCall,     color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  VIDEO:             { label: "Video Footage",    icon: Film,          color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)" },
  URL_WEB:           { label: "Web / URL",        icon: Globe,         color: "#2dd4bf", bg: "rgba(45,212,191,0.1)",  border: "rgba(45,212,191,0.3)" },
  OTHER:             { label: "Other Asset",      icon: File,          color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)" },
};

function FileIcon({ type, category }: { type: string; category?: EvidenceCategory }) {
  if (category && CATEGORY_CONFIG[category]) {
    const IconComp = CATEGORY_CONFIG[category].icon;
    return <IconComp size={13} style={{ color: CATEGORY_CONFIG[category].color }} />;
  }
  if (type === "PNG" || type === "JPG") return <FileImage size={13} style={{ color: "#60a5fa" }} />;
  if (type === "PDF") return <FileText size={13} style={{ color: "#f87171" }} />;
  return <File size={13} style={{ color: "#a78bfa" }} />;
}

export default function EvidenceVault({ onInspect }: EvidenceVaultProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number; hash: string; status?: string; error?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(EVIDENCE_ITEMS);
  const [isLiveDb, setIsLiveDb] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch live evidence from API
  const fetchLiveEvidence = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/cases/CASE-2026-0891/evidence");
      if (res.ok) {
        const data = await res.json();
        if (data.evidence && data.evidence.length > 0) {
          const merged = data.evidence.map((liveEv: EvidenceItem) => {
            const mockMatch = EVIDENCE_ITEMS.find((m) => m.id === liveEv.id || m.fileName === liveEv.fileName);
            return {
              ...liveEv,
              evidenceCategory: liveEv.evidenceCategory || mockMatch?.evidenceCategory || "OTHER",
              mockBoundingBox: mockMatch?.mockBoundingBox,
              authenticity: mockMatch?.authenticity,
              metadata: liveEv.metadata || mockMatch?.metadata,
              extractedEntities: liveEv.extractedEntities?.length ? liveEv.extractedEntities : (mockMatch?.extractedEntities || []),
            };
          });

          // Ensure any mock-only rich items not yet uploaded in SQLite also appear
          const missingMockItems = EVIDENCE_ITEMS.filter(
            (m) => !merged.some((l: EvidenceItem) => l.id === m.id || l.fileName === m.fileName)
          );
          setEvidenceList([...merged, ...missingMockItems]);
          setIsLiveDb(true);
        }
      }
    } catch (err) {
      console.warn("Using local forensic evidence dataset", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchLiveEvidence();
  }, [fetchLiveEvidence]);

  // Compute real SHA-256 hashing using Web Crypto API
  const computeHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const entry = { name: file.name, progress: 15, hash: "", status: "Hashing (SHA-256)..." };
      setUploadingFiles((prev) => [...prev, entry]);

      try {
        // Step 1: Web Crypto API client-side SHA-256
        const clientHash = await computeHash(file);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, progress: 45, hash: clientHash, status: "Transmitting to Immutable Vault..." } : f
          )
        );

        // Step 2: Live API Upload to /api/evidence/upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caseId", "CASE-2026-0891");
        formData.append("clientHash", clientHash);

        const response = await fetch("/api/evidence/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();

        // Step 3: Verified
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? { ...f, progress: 100, hash: data.sha256Hash || clientHash, status: "Dual-Hash Verified & Ingested ✓" }
              : f
          )
        );

        // Refresh live list
        await fetchLiveEvidence();
      } catch (err: any) {
        console.error("Upload error:", err);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? { ...f, progress: 100, error: err.message || "Failed", status: `Error: ${err.message}` }
              : f
          )
        );
      }

      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }, 4000);
    }
  }, [fetchLiveEvidence]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // Get distinct categories present in the evidence list
  const presentCategories = Array.from(new Set(evidenceList.map((e) => e.evidenceCategory || "OTHER")));

  const filteredEvidence = evidenceList.filter((ev) => {
    const matchesSearch =
      ev.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.fileType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.evidenceCategory && ev.evidenceCategory.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "ALL" || ev.evidenceCategory === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 14, overflow: "hidden" }}>
      {/* Top: Dropzone + Upload Queue */}
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1,
            border: `1px dashed ${dragOver ? "#3b82f6" : "var(--border-strong)"}`,
            borderRadius: 6,
            padding: "16px 20px",
            cursor: "pointer",
            background: dragOver ? "rgba(59,130,246,0.05)" : "var(--bg-elevated)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.15s ease",
            textAlign: "center",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: dragOver ? "rgba(59,130,246,0.15)" : "var(--bg-overlay)",
              border: `1px solid ${dragOver ? "rgba(59,130,246,0.4)" : "var(--border-default)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Upload size={15} style={{ color: dragOver ? "#60a5fa" : "var(--text-muted)" }} />
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
              Drop evidence files or click to browse
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.5, fontFamily: "JetBrains Mono, monospace" }}>
              Accepts: .eml Phishing Mails · ID Scans · Scene Photos / CCTV · WhatsApp .txt · MP3 Audio · PDF Slips<br />
              <span style={{ color: "#60a5fa" }}>Auto-computes client-side SHA-256 before transport</span>
            </div>
          </div>
          <div
            style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 600,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
              color: "#6ee7b7", letterSpacing: "0.07em",
            }}
          >
            12 EVIDENCE CATEGORIES SUPPORTED · BSA §63 CHAIN PRESERVED
          </div>
        </div>

        {/* Upload Status Panel */}
        <div
          style={{
            width: 250, padding: 12,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: 8, fontWeight: 600 }}>
            INGESTION QUEUE
          </div>
          {uploadingFiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              <CheckCircle size={18} style={{ color: "#10b981", margin: "0 auto 4px" }} />
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Queue empty</div>
              <div style={{ color: "var(--text-muted)", fontSize: 9, marginTop: 2 }}>
                Ready for ingestion
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {uploadingFiles.map((f) => (
                <div key={f.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                      {f.name}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}>
                      {f.progress}%
                    </span>
                  </div>
                  <div style={{ height: 3, background: "var(--bg-overlay)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%", borderRadius: 2,
                        background: f.progress === 100 ? "#10b981" : "#3b82f6",
                        width: `${f.progress}%`,
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                  {f.status && (
                    <div style={{ marginTop: 3, fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: f.error ? "#f87171" : f.progress === 100 ? "#10b981" : "#60a5fa" }}>
                      {f.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Chips Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 2,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setSelectedCategory("ALL")}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            border: selectedCategory === "ALL" ? "1px solid #3b82f6" : "1px solid var(--border-default)",
            background: selectedCategory === "ALL" ? "rgba(59,130,246,0.15)" : "var(--bg-elevated)",
            color: selectedCategory === "ALL" ? "#60a5fa" : "var(--text-secondary)",
            whiteSpace: "nowrap",
            transition: "all 0.1s ease",
          }}
        >
          All Categories ({evidenceList.length})
        </button>

        {presentCategories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER;
          const count = evidenceList.filter((e) => e.evidenceCategory === cat).length;
          const isSelected = selectedCategory === cat;
          const IconComponent = cfg.icon;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                border: isSelected ? `1px solid ${cfg.color}` : "1px solid var(--border-default)",
                background: isSelected ? cfg.bg : "var(--bg-elevated)",
                color: isSelected ? cfg.color : "var(--text-secondary)",
                whiteSpace: "nowrap",
                transition: "all 0.1s ease",
              }}
            >
              <IconComponent size={12} style={{ color: cfg.color }} />
              <span>{cfg.label}</span>
              <span
                style={{
                  fontSize: 9,
                  opacity: 0.8,
                  padding: "0 4px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Evidence Table */}
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
        {/* Table Header */}
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={13} style={{ color: "#60a5fa" }} />
            <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500 }}>
              Forensic Evidence Vault
            </span>
            <span
              style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 3,
                background: isLiveDb ? "rgba(16,185,129,0.12)" : "var(--bg-overlay)",
                border: isLiveDb ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-default)",
                color: isLiveDb ? "#34d399" : "var(--text-muted)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              {isLiveDb && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />}
              {filteredEvidence.length} ASSETS · {isLiveDb ? "LIVE FORENSIC PIPELINE" : "IMMUTABLE_COLD_STORAGE"}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              placeholder="Filter evidence or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 4, padding: "4px 8px 4px 26px",
                color: "var(--text-primary)", fontSize: 11,
                outline: "none", width: 200,
              }}
            />
          </div>
        </div>

        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "75px 1fr 120px 50px 70px 170px 130px 85px 80px",
            padding: "7px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            flexShrink: 0,
            gap: 6,
          }}
        >
          {["EV-ID", "File Name", "Category", "Type", "Size", "SHA-256 Hash", "Timestamp (UTC)", "Integrity", "Actions"].map(
            (col) => (
              <div
                key={col}
                style={{
                  color: "var(--text-muted)",
                  fontSize: 9, letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {col}
              </div>
            )
          )}
        </div>

        {/* Table Rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredEvidence.map((ev, idx) => (
            <EvidenceRow key={ev.id} ev={ev} idx={idx} onInspect={onInspect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EvidenceRow({ ev, idx, onInspect }: { ev: EvidenceItem; idx: number; onInspect: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const catCfg = CATEGORY_CONFIG[ev.evidenceCategory || "OTHER"] || CATEGORY_CONFIG.OTHER;
  const CatIcon = catCfg.icon;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "75px 1fr 120px 50px 70px 170px 130px 85px 80px",
        padding: "9px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        background: hover ? "var(--bg-elevated)" : idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
        alignItems: "center",
        transition: "background 0.1s",
        gap: 6,
      }}
    >
      {/* EV ID */}
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11, color: "#60a5fa", fontWeight: 600,
        }}
      >
        {ev.id}
      </div>

      {/* File Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <FileIcon type={ev.fileType} category={ev.evidenceCategory} />
        <span style={{ color: "var(--text-primary)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ev.fileName}
        </span>
      </div>

      {/* Category Badge */}
      <div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            background: catCfg.bg,
            border: `1px solid ${catCfg.border}`,
            color: catCfg.color,
            fontSize: 9,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <CatIcon size={10} />
          {catCfg.label}
        </span>
      </div>

      {/* Type */}
      <div
        style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.05em",
          fontFamily: "JetBrains Mono, monospace",
          color: "var(--text-muted)",
        }}
      >
        {ev.fileType}
      </div>

      {/* Size */}
      <div style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
        {ev.fileSize}
      </div>

      {/* Hash */}
      <HashDisplay hash={ev.sha256Hash} truncate />

      {/* Timestamp */}
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
        {new Date(ev.uploadedAt).toISOString().replace("T", " ").slice(0, 19)}Z
      </div>

      {/* Integrity Badge */}
      <div>
        <span
          className="status-verified"
          style={{
            padding: "2px 6px", borderRadius: 3, fontSize: 9,
            fontWeight: 600, letterSpacing: "0.05em",
            display: "inline-flex", alignItems: "center", gap: 3,
            border: "1px solid",
          }}
        >
          <CheckCircle size={9} />
          {ev.integrityStatus}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => onInspect(ev.id)}
          title="Inspect evidence details & metadata"
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
            borderRadius: 3, padding: "4px 6px", cursor: "pointer",
            color: "var(--text-secondary)", display: "flex", alignItems: "center",
            transition: "all 0.1s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)"; (e.currentTarget as HTMLElement).style.color = "#60a5fa"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          <Eye size={11} />
        </button>
        <button
          title="Download original"
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
            borderRadius: 3, padding: "4px 6px", cursor: "pointer",
            color: "var(--text-secondary)", display: "flex", alignItems: "center",
          }}
        >
          <Download size={11} />
        </button>
      </div>
    </div>
  );
}
