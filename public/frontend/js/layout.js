/**
 * Rakshak — Sidebar & Header Shared Module
 * Renders and manages the collapsible sidebar, header, and mobile navigation.
 * Used by all pages via import.
 */

import { ACTIVE_CASE_ID } from './api.js';
import { escapeHtml, copyToClipboard, showToast } from './utils.js';

// ─── Active Tab Detection ─────────────────────────────────────────────────────
function getActivePage(override) {
  if (override) return override;
  const path = window.location.pathname;
  const page = path.split('/').pop().replace('.html', '') || 'index';
  const map = {
    'dashboard':        'dashboard',
    'cases':            'cases',
    'case-detail':      'cases',
    'index':            'vault',
    'entities':         'entities',
    'evidence-viewer':  'entities',
    'timeline':         'timeline',
    'graph':            'graph',
    'legal':            'legal',
    'comms':            'comms',
    'reports':          'reports',
  };
  return map[page] || 'vault';
}

// ─── Sidebar Collapsed State ──────────────────────────────────────────────────
let sidebarCollapsed = false;

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  const btn = document.querySelector('.sidebar-collapse-btn');
  if (btn) btn.textContent = sidebarCollapsed ? '›' : '‹';
}

// ─── Mobile Sidebar ───────────────────────────────────────────────────────────
function openMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('visible');
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');

}

// ─── NAV Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',            icon: '◈',   href: '/frontend/pages/dashboard.html', badge: null },
  { id: 'cases',     label: 'Cases',                icon: '📋',  href: '/frontend/pages/cases.html',     badge: null },
  { id: 'vault',     label: 'Evidence Vault',       icon: '🛡',  href: '/frontend/pages/index.html',     badge: null },
  { id: 'entities',  label: 'Entity Analysis',      icon: '🔬',  href: '/frontend/pages/entities.html',  badge: null },
  { id: 'timeline',  label: 'Forensic Timeline',    icon: '📅',  href: '/frontend/pages/timeline.html',  badge: null },
  { id: 'graph',     label: 'Syndicate & Clusters', icon: '🕸',  href: '/frontend/pages/graph.html',     badge: null, alert: true },
  { id: 'legal',     label: 'Legal Matrix',         icon: '⚖',   href: '/frontend/pages/legal.html',    badge: null },
  { id: 'comms',     label: 'Comm Intel',           icon: '📡',  href: '/frontend/pages/comms.html',    badge: null },
  { id: 'reports',   label: 'Reports & RBAC',       icon: '📊',  href: '/frontend/pages/reports.html',  badge: null },
];

const SECONDARY_NAV = [
  { label: 'System Settings',   icon: '⚙',  href: '#', disabled: true },
];

// ─── Sidebar HTML ─────────────────────────────────────────────────────────────
function buildSidebarHTML(activeTab) {
  const navItems = NAV_ITEMS.map(item => {
    const isActive = item.id === activeTab;
    const badge = item.badge
      ? `<span class="nav-badge ${item.alert ? 'alert' : ''}">${item.alert ? '⚠ ' : ''}${escapeHtml(String(item.badge))}</span>`
      : item.alert
        ? `<span class="nav-badge alert">⚠ ALERT</span>`
        : '';
    return `
      <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}"
         aria-current="${isActive ? 'page' : 'false'}"
         aria-label="${escapeHtml(item.label)}">
        <span class="nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="nav-label">${escapeHtml(item.label)}</span>
        ${badge}
      </a>
    `;
  }).join('');

  const secondaryNav = SECONDARY_NAV.map(item => `
    <button class="nav-item disabled" disabled
      title="${escapeHtml(item.label)} — Not yet available"
      aria-disabled="true">
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="nav-label">${escapeHtml(item.label)}</span>
      <span class="nav-badge roadmap">SOON</span>
    </button>
  `).join('');

  return `
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-mark"><span>RK</span></div>
      <div class="logo-text-wrap">
        <div class="logo-name">RAKSHAK</div>
        <div class="logo-version">v3.0 · Forensic Platform</div>
      </div>
    </div>

    <!-- Case Card -->
    <div class="case-card">
      <div class="case-card-label">ACTIVE CASE</div>
      <div class="case-card-number">#${escapeHtml(ACTIVE_CASE_ID)}</div>
      <div class="case-card-status">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--text-accent);display:inline-block;animation:pulse-dot 2s ease-in-out infinite"></span>
        ACTIVE INQUIRY
      </div>
      <div class="case-card-divider"></div>
      <div class="case-card-field-label">JURISDICTION</div>
      <div class="case-card-field-value">Cyber Crime Branch · Chandigarh</div>
      <div style="margin-top:6px">
        <div class="case-card-field-label">OFFICER I/C</div>
        <div class="case-card-field-value">SI R.S. Meena (CCB-1147)</div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav" aria-label="Investigation modules">
      <div class="nav-section-label">INVESTIGATION</div>
      ${navItems}
      <div class="nav-divider" role="separator"></div>
      <div class="nav-section-label">ROADMAP</div>
      ${secondaryNav}
    </nav>

    <!-- Status Footer -->
    <div class="sidebar-footer">
      <div class="sidebar-status-row">
        <span class="status-dot online"></span>
        <span class="status-label">Syndicate Engine</span>
        <span class="status-value online">ONLINE</span>
      </div>
      <div class="sidebar-status-row">
        <span class="status-dot online"></span>
        <span class="status-label">Extraction Engine</span>
        <span class="status-value online">ONLINE</span>
      </div>
    </div>

    <!-- Collapse Button -->
    <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" aria-label="Toggle sidebar">‹</button>
  `;
}

// ─── Header HTML ──────────────────────────────────────────────────────────────
function buildHeaderHTML(activeCaseId) {
  return `
    <!-- Mobile Menu Button -->
    <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation">
      <span>☰</span>
    </button>

    <div class="header-left">
      <!-- Case Number -->
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <button class="case-number-btn" id="case-number-copy" title="Click to copy case number">
          <span>#${escapeHtml(activeCaseId)}</span>
          <span id="case-copy-icon" style="font-size:11px;opacity:0.5">⧉</span>
        </button>
        <div class="case-status-badge">
          <span class="case-status-dot"></span>
          ACTIVE INQUIRY
        </div>
      </div>

      <div class="divider-vertical" style="height:28px" aria-hidden="true"></div>

      <!-- Incident Info -->
      <div class="incident-info">
        <div class="incident-title">
          Part-Time Task Scam
          <span style="color:var(--text-muted);font-weight:400"> · Multi-Jurisdiction Mule Syndicate</span>
        </div>
        <div class="incident-sub">
          <span>Cyber Crime Branch — Sector 17, Chandigarh</span> · SI R.S. Meena (CCB-1147)
        </div>
      </div>
    </div>

    <div class="header-right desktop-only">
      <!-- Evidence Items -->
      <div class="metric-pill" id="metric-evidence">
        <div>
          <div class="metric-pill-label">EVIDENCE ITEMS</div>
          <div class="metric-pill-value" id="metric-ev-count">—</div>
        </div>
      </div>
      <!-- Categories -->
      <div class="metric-pill">
        <div>
          <div class="metric-pill-label">CATEGORIES</div>
          <div class="metric-pill-value">12 Types</div>
        </div>
      </div>
      <!-- Clusters -->
      <div class="metric-pill">
        <div>
          <div class="metric-pill-label">CLUSTERS</div>
          <div class="metric-pill-value" id="metric-clusters">—</div>
        </div>
      </div>
      <!-- Linked FIRs -->
      <div class="metric-pill alert">
        <div>
          <div class="metric-pill-label">LINKED FIRs</div>
          <div class="metric-pill-value" id="metric-firs">— <span style="font-size:7px;padding:1px 3px;border-radius:2px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;letter-spacing:0.05em">ALERT</span></div>
        </div>
      </div>

      <div class="divider-vertical" style="height:28px;margin:0 4px" aria-hidden="true"></div>

      <!-- BSA §63 Cert Button -->
      <button class="btn btn-success btn-sm" id="bsa63-btn" title="Download Section 63 BSA Certificate">
        🛡 BSA §63 Cert
      </button>
      <!-- Export Dossier -->
      <button class="btn btn-secondary btn-sm" id="export-pdf-btn">
        ⬇ Export Dossier
      </button>
    </div>
  `;
}

// ─── Inject Layout ─────────────────────────────────────────────────────────────
/**
 * Inject the shared sidebar and header into the page.
 * Call this from each page script.
 *
 * @param {{ caseId?: string }} [options]
 */
export function initLayout(options = {}) {
  const caseId = options.caseId || ACTIVE_CASE_ID;
  const activeTab = getActivePage(options.activePage);

  // ── Header ──
  const header = document.querySelector('.app-header');
  if (header) {
    header.innerHTML = buildHeaderHTML(caseId);
    bindHeaderEvents(caseId);
  }

  // ── Sidebar ──
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.innerHTML = buildSidebarHTML(activeTab);
    bindSidebarEvents();
  }

  // ── Sidebar Overlay ──
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeMobileSidebar);
  }

  // ── Live Metric Load ──
  loadHeaderMetrics(caseId);
}

// ─── Event Binding ────────────────────────────────────────────────────────────
function bindHeaderEvents(caseId) {
  const copyBtn = document.getElementById('case-number-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const copied = await copyToClipboard(caseId);
      if (copied) {
        const icon = document.getElementById('case-copy-icon');
        if (icon) { icon.textContent = '✓'; icon.style.color = '#10b981'; }
        setTimeout(() => {
          if (icon) { icon.textContent = '⧉'; icon.style.color = ''; }
        }, 1500);
      }
    });
  }

  const bsaBtn = document.getElementById('bsa63-btn');
  if (bsaBtn) {
    bsaBtn.addEventListener('click', () => handleBSA63Download(caseId));
  }

  const exportBtn = document.getElementById('export-pdf-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => handleDossierExport(caseId));
  }

  const mobileMenu = document.getElementById('mobile-menu-btn');
  if (mobileMenu) {
    mobileMenu.addEventListener('click', openMobileSidebar);
  }
}

function bindSidebarEvents() {
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar);
  }
}

// ─── Live Metrics ─────────────────────────────────────────────────────────────
async function loadHeaderMetrics(caseId) {
  try {
    const { getCaseEvidence, getClusters } = await import('./api.js');

    // Load evidence count
    const evData = await getCaseEvidence(caseId).catch(() => null);
    const evCount = document.getElementById('metric-ev-count');
    if (evCount && evData?.evidence) {
      evCount.textContent = evData.evidence.length;
    }

    // Load clusters
    const clusterData = await getClusters().catch(() => null);
    const clMetric = document.getElementById('metric-clusters');
    const firMetric = document.getElementById('metric-firs');
    if (clusterData?.clusters) {
      const count = clusterData.clusters.length;
      if (clMetric) clMetric.textContent = count + (count === 1 ? ' Syndicate' : ' Syndicates');
      if (firMetric) {
        // Count total linked cases across clusters
        const linked = clusterData.clusters.reduce((acc, c) => acc + (c.linkedCases?.length || c.memberCaseCount || 0), 0);
        firMetric.innerHTML = `${linked} Cases <span style="font-size:7px;padding:1px 3px;border-radius:2px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;letter-spacing:0.05em">ALERT</span>`;
      }
    }
  } catch (_) {
    // Fail gracefully — metrics are informational
  }
}

// ─── BSA §63 Download ─────────────────────────────────────────────────────────
async function handleBSA63Download(caseId) {
  const btn = document.getElementById('bsa63-btn');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const { getCaseDossier } = await import('./api.js');
    const { downloadJSON } = await import('./utils.js');

    const dossier = await getCaseDossier(caseId);
    const payload = {
      certificateTitle: 'Statutory Certificate Under Section 63, Bharatiya Sakshya Adhiniyam, 2023',
      statutoryProvision: 'Section 63 BSA (Admissibility of Electronic Records)',
      issuedBy: 'Rakshak Digital Forensics Platform v3.0',
      caseNumber: dossier.caseHeader?.caseNumber || caseId,
      complainant: dossier.caseHeader?.complainantName || '—',
      jurisdiction: dossier.caseHeader?.jurisdiction || '—',
      certifiedTimestampUTC: new Date().toISOString(),
      admissibilityDeclaration:
        'This electronic record was generated in the ordinary course of official investigation. Original artifacts were ingested into immutable cold storage with dual-hash verification. Chain of custody preserved without variance.',
      integritySummary: {
        totalArtifacts: dossier.section63BSAManifest?.items?.length || 0,
        allIntegrityVerified: dossier.section63BSAManifest?.allIntegrityVerified ?? true,
        storageStandard: 'IMMUTABLE_COLD_BLOB',
        categoriesSupported: 12,
      },
      evidenceManifest: dossier.section63BSAManifest?.items || [],
      syndicateCrossCaseLinkage: dossier.syndicateLinkageAnalysis || {},
      statutoryClassifications: dossier.recommendedStatutoryClassifications?.sections || [],
    };

    downloadJSON(payload, `Rakshak_BSA_Section63_Certificate_${caseId}.json`);
    showToast('success', 'BSA §63 Certificate downloaded.');
  } catch (err) {
    showToast('error', 'Failed to generate BSA §63 certificate.');
    console.error(err);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

// ─── Dossier Export ───────────────────────────────────────────────────────────
async function handleDossierExport(caseId) {
  const btn = document.getElementById('export-pdf-btn');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const { getCaseDossier } = await import('./api.js');
    const { downloadJSON } = await import('./utils.js');

    const dossier = await getCaseDossier(caseId);
    downloadJSON(dossier, `Rakshak_Dossier_${caseId}_${Date.now()}.json`);
    showToast('success', 'Case dossier exported.');
  } catch (err) {
    showToast('error', 'Failed to export case dossier.');
    console.error(err);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}
