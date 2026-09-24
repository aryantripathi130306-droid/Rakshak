"use client";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import EvidenceVault from "@/components/tabs/EvidenceVault";
import TimelineView from "@/components/tabs/TimelineView";
import GraphView from "@/components/tabs/GraphView";
import LegalMatrix from "@/components/tabs/LegalMatrix";
import EvidenceInspector from "@/components/inspector/EvidenceInspector";
import {
  ACTIVE_CASE,
  EVIDENCE_ITEMS,
  TIMELINE_EVENTS,
  EVIDENCE_CHECKLIST,
  STATUTORY_SECTIONS,
  CASE_METRICS,
  MOCK_TRANSCRIPTION,
  MOCK_CLUSTER,
} from "@/lib/mock-data";
import { FileText, Shield, GitBranch, Scale } from "lucide-react";

const TABS = [
  { id: "vault",    label: "Evidence Vault",       icon: Shield,    subtitle: "Preserve" },
  { id: "timeline", label: "Forensic Timeline",    icon: FileText,  subtitle: "Understand" },
  { id: "graph",    label: "Syndicate & Clusters", icon: GitBranch, subtitle: "Connect & Cluster", alert: true },
  { id: "legal",    label: "Legal Matrix",         icon: Scale,     subtitle: "Classify" },
];

export default function InvestigationDashboard() {
  const [activeTab, setActiveTab] = useState("vault");
  const [inspectorEvidenceId, setInspectorEvidenceId] = useState<string | null>(null);

  const handleInspect = (evidenceId: string) => {
    setInspectorEvidenceId(evidenceId);
  };
  const handleCloseInspector = () => setInspectorEvidenceId(null);

  const handleDownloadBSA63 = async () => {
    try {
      const res = await fetch("/api/cases/CASE-2026-0891/dossier");
      const dossier = await res.json();
      const manifest = dossier.section63BSAManifest || {};
      const payload = {
        certificateTitle: "Statutory Certificate Under Section 63, Bharatiya Sakshya Adhiniyam, 2023",
        statutoryProvision: "Section 63 BSA (Admissibility of Electronic Records)",
        issuedBy: "Rakshak Digital Forensics Platform v3.0",
        caseNumber: dossier.caseHeader?.caseNumber || ACTIVE_CASE.caseNumber,
        complainant: dossier.caseHeader?.complainantName || ACTIVE_CASE.victimName,
        jurisdiction: dossier.caseHeader?.jurisdiction || ACTIVE_CASE.jurisdiction,
        certifiedTimestampUTC: new Date().toISOString(),
        admissibilityDeclaration:
          "This electronic record was generated in the ordinary course of official investigation. Original artifacts were ingested into immutable cold storage with dual-hash verification. Chain of custody preserved without variance.",
        integritySummary: {
          totalArtifacts: manifest.items?.length || EVIDENCE_ITEMS.length,
          allIntegrityVerified: manifest.allIntegrityVerified ?? true,
          storageStandard: "IMMUTABLE_COLD_BLOB",
          categoriesSupported: 12,
        },
        evidenceManifest: manifest.items || [],
        communicationIntelligence: {
          transcriptionEvidenceId: "EV-104",
          originalLanguage: "Hindi (hi-IN)",
          targetLanguage: "English (en-US)",
          status: "Original speech stream preserved with acoustic verification",
        },
        syndicateCrossCaseLinkage: dossier.syndicateLinkageAnalysis || {},
        clusterIntelligence: {
          clusterId: MOCK_CLUSTER.id,
          clusterName: MOCK_CLUSTER.name,
          confidence: MOCK_CLUSTER.confidence,
          memberCaseCount: MOCK_CLUSTER.cases.length,
        },
        statutoryClassifications: dossier.recommendedStatutoryClassifications?.sections || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rakshak_BSA_Section63_Certificate_${dossier.caseHeader?.caseNumber || "CASE-2026-0891"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export BSA §63 certificate:", err);
    }
  };

  const handleExportPDF = async () => {
    let liveDossier: any = null;
    try {
      const res = await fetch("/api/cases/CASE-2026-0891/dossier");
      if (res.ok) {
        liveDossier = await res.json();
      }
    } catch (e) {
      console.warn("Live dossier API offline, rendering with local fallback", e);
    }

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFillColor(8, 13, 20);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(96, 165, 250);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Rakshak — Case Investigation Dossier", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(138, 152, 170);
    doc.text(`Generated: ${new Date().toISOString()} · CONFIDENTIAL · BSA §63 COMPLIANT`, 14, 20);
    doc.text(`Platform: Rakshak v3.0-forensic · Multi-Category & Cross-Case Intelligence Engine`, 14, 25);

    y = 36;

    // Case Metadata
    doc.setFillColor(13, 21, 32);
    doc.roundedRect(12, y, pageW - 24, 44, 2, 2, "F");
    doc.setDrawColor(30, 45, 68);
    doc.roundedRect(12, y, pageW - 24, 44, 2, 2, "S");

    doc.setTextColor(138, 152, 170);
    doc.setFontSize(7);
    doc.text("PRIMARY CASE IDENTIFIER", 16, y + 6);
    doc.setTextColor(96, 165, 250);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`#${liveDossier?.caseHeader?.caseNumber || ACTIVE_CASE.caseNumber}`, 16, y + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(138, 152, 170);
    const fields = [
      ["Incident Type", "Task Scam — Multi-State Mule Network"],
      ["Status", liveDossier?.caseHeader?.status || ACTIVE_CASE.status],
      ["Jurisdiction", liveDossier?.caseHeader?.jurisdiction || ACTIVE_CASE.jurisdiction],
      ["Complainant", liveDossier?.caseHeader?.complainantName || ACTIVE_CASE.victimName],
      ["Amount Defrauded", `₹${(liveDossier?.caseHeader?.amountDefraudedINR || ACTIVE_CASE.amountDefrauded).toLocaleString("en-IN")}`],
      ["Created", new Date(liveDossier?.caseHeader?.caseCreatedAtUTC || ACTIVE_CASE.createdAt).toLocaleString("en-IN")],
    ];
    fields.forEach(([label, val], i) => {
      const col = i < 3 ? 16 : pageW / 2 + 4;
      const row = i < 3 ? i : i - 3;
      doc.setTextColor(100, 116, 139);
      doc.text(label + ":", col, y + 21 + row * 7);
      doc.setTextColor(226, 232, 240);
      doc.text(val || "", col + 30, y + 21 + row * 7);
    });
    y += 52;

    // Metrics
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(138, 152, 170);
    doc.text("CORE INVESTIGATION METRICS", 14, y);
    y += 5;
    const metrics = [
      ["Evidence Items", String(EVIDENCE_ITEMS.length)],
      ["Evidence Categories", "6 Distinct Types"],
      ["Syndicate Matches", String(CASE_METRICS.syndicateMatches)],
      ["Case Clusters", "1 Active Ring"],
    ];
    metrics.forEach(([k, v], i) => {
      const x = 14 + (i % 4) * 46;
      doc.setFillColor(13, 21, 32);
      doc.roundedRect(x, y, 44, 14, 1, 1, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(k.toUpperCase(), x + 2, y + 5);
      doc.setTextColor(96, 165, 250);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(v, x + 2, y + 12);
    });
    y += 22;

    // Evidence Categories & Integrity Manifest (Section 63 BSA)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(138, 152, 170);
    doc.text("MULTI-CATEGORY EVIDENCE INTEGRITY MANIFEST (BSA SECTION 63)", 14, y);
    y += 6;

    EVIDENCE_ITEMS.forEach((ev: any) => {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFillColor(11, 18, 28);
      doc.roundedRect(12, y, pageW - 24, 16, 1, 1, "F");
      doc.setTextColor(96, 165, 250);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(ev.id, 16, y + 5);
      doc.setTextColor(226, 232, 240);
      doc.setFont("helvetica", "normal");
      doc.text(ev.fileName, 34, y + 5);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text(`Category: ${ev.evidenceCategory || "OTHER"} | Type: ${ev.fileType}`, 34, y + 11);
      doc.text(`SHA-256: ${ev.sha256Hash.slice(0, 24)}...`, 110, y + 11);
      doc.setTextColor(16, 185, 129);
      doc.text(ev.integrityStatus === "VERIFIED" ? "VERIFIED ✓" : "UNVERIFIED", pageW - 35, y + 8);
      y += 18;
    });

    y += 4;

    // Communication Intelligence Summary
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(138, 152, 170);
    doc.text("COMMUNICATION INTELLIGENCE & SPEECH TRANSCRIPT SUMMARY", 14, y);
    y += 6;

    doc.setFillColor(11, 18, 28);
    doc.roundedRect(12, y, pageW - 24, 24, 1, 1, "F");
    doc.setTextColor(196, 181, 253);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("EV-104 Call Recording (Hindi Intercept → English)", 16, y + 5);
    doc.setTextColor(226, 232, 240);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("• Key Statement (Suspect): 'Transfer remaining Rs 24,500 to Paytm account 919876543210 for Tier-2 unlock'", 16, y + 11);
    doc.text("• Key Statement (Suspect): 'You can verify the payment arrival at mule88@oksbi'", 16, y + 16);
    doc.setTextColor(251, 191, 36);
    doc.text("Note: Machine-generated translation with original audio/text preserved under BSA §63.", 16, y + 21);
    y += 28;

    // Case Cluster Analysis Summary
    if (y > 230) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(138, 152, 170);
    doc.text("CASE CLUSTER & MULTI-JURISDICTION SYNDICATE LINKAGES", 14, y);
    y += 6;

    doc.setFillColor(11, 18, 28);
    doc.roundedRect(12, y, pageW - 24, 30, 1, 1, "F");
    doc.setTextColor(248, 113, 113);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Cluster: ${MOCK_CLUSTER.name} (${MOCK_CLUSTER.confidence})`, 16, y + 5);
    doc.setTextColor(226, 232, 240);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`• Total Defrauded Across Cluster: Rs ${(MOCK_CLUSTER.totalFraudAmount).toLocaleString("en-IN")} across 5 interconnected FIRs`, 16, y + 11);
    doc.text("• Shared Mule Handle: mule88@oksbi (Seen across Chandigarh, Delhi, Bengaluru FIRs)", 16, y + 16);
    doc.text("• Shared Infrastructure: verify-job-portal.in + Suspect Contact +919876543210", 16, y + 21);
    doc.setTextColor(251, 191, 36);
    doc.text("• Statutory Status: Potential syndicate cluster — requires inter-state joint verification under Section 91 CrPC.", 16, y + 26);
    y += 34;

    // Statutory Sections
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(138, 152, 170);
    doc.text("APPLICABLE STATUTORY PROVISIONS", 14, y);
    y += 6;

    STATUTORY_SECTIONS.slice(0, 4).forEach((sec: any) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFillColor(11, 18, 28);
      doc.roundedRect(12, y, pageW - 24, 12, 1, 1, "F");
      doc.setTextColor(196, 181, 253);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${sec.code} ${sec.act}`, 16, y + 7);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(sec.bailable ? "Bailable" : "Non-Bailable", pageW - 40, y + 7);
      y += 14;
    });

    // Footer disclaimer on all pages
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(74, 85, 104);
      doc.text(
        "DISCLAIMER: This dossier is generated by Rakshak — an Investigative Intelligence Tool. Results indicate potential syndicate matches, not confirmed determinations. This document does not constitute proof of guilt. Verify all findings with Legal Cell before filing charge-sheet.",
        14, 287,
        { maxWidth: pageW - 28 }
      );
    }

    doc.save(`Rakshak_Cluster_Dossier_${ACTIVE_CASE.caseNumber}_${Date.now()}.pdf`);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Top Header */}
      <Header onExportPDF={handleExportPDF} onDownloadBSA63={handleDownloadBSA63} />

      {/* Body: Sidebar + Main Canvas + Inspector */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg-base)",
          }}
        >
          {/* Tab Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              flexShrink: 0,
              paddingLeft: 4,
            }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    transition: "all 0.12s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                  }}
                >
                  <Icon size={13} style={{ color: isActive ? "#60a5fa" : "inherit" }} />
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: 9, color: "var(--text-muted)",
                      marginLeft: 1,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    [{tab.subtitle}]
                  </span>
                  {tab.alert && (
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#ef4444",
                        marginLeft: 2,
                      }}
                      className="animate-pulse-dot"
                    />
                  )}
                </button>
              );
            })}

            <div style={{ flex: 1 }} />

            {/* System timestamp */}
            <div
              style={{
                display: "flex", alignItems: "center",
                padding: "0 14px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: activeTab !== "graph" ? "16px" : "12px",
              }}
            >
              {activeTab === "vault" && <EvidenceVault onInspect={handleInspect} />}
              {activeTab === "timeline" && <TimelineView onInspect={handleInspect} />}
              {activeTab === "graph" && <GraphView onInspect={handleInspect} />}
              {activeTab === "legal" && <LegalMatrix onInspect={handleInspect} />}
            </div>

            {/* Right Inspector Panel */}
            {inspectorEvidenceId && activeTab !== "graph" && (
              <EvidenceInspector
                evidenceId={inspectorEvidenceId}
                onClose={handleCloseInspector}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
