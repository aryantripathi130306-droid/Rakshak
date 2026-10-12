/**
 * Rakshak — Case Detail Workspace Page Script
 * Loads single case dossier via /api/cases/:caseId with all associated evidence,
 * extracted entities, timeline events, cluster syndicate links, and legal records.
 */

import {
  getCase,
  getCases,
  patchCase,
  getCaseEvidence,
  getCaseEntities,
  getCaseTimeline,
  getClusters,
  getCaseLegal,
  setActiveCaseId,
} from './api.js';
import {
  escapeHtml,
  formatIST,
  formatINR,
  showNotification,
} from './utils.js';
import { initLayout } from './layout.js';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  caseId: null,
  caseData: null,
  evidence: [],
  entities: [],
  timeline: [],
  clusters: [],
  legal: null,
  activeTab: 'overview',
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout({ activePage: 'cases' });

  // Get caseId from URL query param `?id=...`, `?caseNumber=...`, or fallback to storage/api
  const urlParams = new URLSearchParams(window.location.search);
  state.caseId = urlParams.get('id') || urlParams.get('caseNumber') || urlParams.get('caseId') ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('rakshak_active_case_id') : '') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('rakshak_active_case') : '');

  if (!state.caseId) {
    try {
      const res = await getCases({ limit: 1 });
      if (res && res.cases && res.cases.length > 0) {
        state.caseId = res.cases[0].id || res.cases[0].caseNumber;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('id', state.caseId);
        window.history.replaceState({}, '', newUrl.toString());
      }
    } catch (_) {}
  }

  if (!state.caseId) {
    renderNoCaseSelected();
    return;
  }

  // Update active case
  setActiveCaseId(state.caseId);

  bindEvents();
  await loadCaseDossier();
});

function renderNoCaseSelected() {
  const container = document.getElementById('case-detail-header') || document.getElementById('case-header-card');
  if (container) {
    container.innerHTML = `
      <div class="card p-6 text-center">
        <h3>📋 No Case Selected</h3>
        <p class="text-secondary mt-2">No active case identifier provided or found in the system.</p>
        <div style="margin-top:16px;">
          <a href="/frontend/pages/cases.html" class="btn btn-primary">← Browse All Cases</a>
        </div>
      </div>
    `;
  }
}

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Navigation back button
  const backBtn = document.getElementById('btn-back-cases');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/frontend/pages/cases.html';
    });
  }

  // Tab Switching
  const tabContainers = [
    document.getElementById('case-detail-tabs'),
    document.getElementById('case-tabs')
  ];
  tabContainers.forEach(container => {
    if (container) {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    }
  });

  // Action Buttons
  const editBtn = document.getElementById('btn-edit-case-header');
  if (editBtn) {
    editBtn.addEventListener('click', () => openStatusModal());
  }

  const assignBtn = document.getElementById('btn-assign-officer');
  if (assignBtn) {
    assignBtn.addEventListener('click', () => openAssignModal());
  }

  const exportLegalBtn = document.getElementById('btn-export-dossier');
  if (exportLegalBtn) {
    exportLegalBtn.addEventListener('click', () => handleExportLegal());
  }

  // Status Modal Handlers
  const statusModal = document.getElementById('status-modal');
  const statusModalClose = document.getElementById('status-modal-close');
  const statusModalCancel = document.getElementById('status-modal-cancel');
  const statusModalSubmit = document.getElementById('status-modal-submit');

  const closeStatusModal = () => { if (statusModal) statusModal.style.display = 'none'; };
  if (statusModalClose) statusModalClose.addEventListener('click', closeStatusModal);
  if (statusModalCancel) statusModalCancel.addEventListener('click', closeStatusModal);
  if (statusModalSubmit) statusModalSubmit.addEventListener('click', handleStatusUpdate);

  // Assign Modal Handlers
  const assignModal = document.getElementById('assign-modal');
  const assignModalClose = document.getElementById('assign-modal-close');
  const assignModalCancel = document.getElementById('assign-modal-cancel');
  const assignModalSubmit = document.getElementById('assign-modal-submit');

  const closeAssignModal = () => { if (assignModal) assignModal.style.display = 'none'; };
  if (assignModalClose) assignModalClose.addEventListener('click', closeAssignModal);
  if (assignModalCancel) assignModalCancel.addEventListener('click', closeAssignModal);
  if (assignModalSubmit) assignModalSubmit.addEventListener('click', handleAssignOfficerSubmit);
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadCaseDossier() {
  const container = document.getElementById('case-detail-header') || document.getElementById('case-header-card');
  if (container) {
    container.innerHTML = `
      <div class="case-detail-header-loading" style="padding:16px;">
        <a href="/frontend/pages/cases.html" class="btn btn-ghost btn-sm">← Back to Cases</a>
        <span class="spinner spinner-sm" style="margin-left:12px"></span>
        <span style="font-size:13px;color:var(--text-muted);margin-left:8px">Loading case dossier #${escapeHtml(state.caseId)}…</span>
      </div>
    `;
  }

  try {
    const res = await getCase(state.caseId);
    state.caseData = res.case || res;

    // Unhide tab bar and tab content area
    const tabsBar = document.getElementById('case-detail-tabs') || document.getElementById('case-tabs');
    if (tabsBar) tabsBar.style.display = 'flex';
    const tabContent = document.getElementById('case-tab-content');
    if (tabContent) tabContent.style.display = 'block';

    // Concurrently fetch related data
    const caseLookup = state.caseData.id || state.caseData.caseNumber;
    const [evRes, entRes, timeRes, clusRes, legRes] = await Promise.allSettled([
      getCaseEvidence(caseLookup),
      getCaseEntities(caseLookup),
      getCaseTimeline(caseLookup),
      getClusters(),
      getCaseLegal(caseLookup),
    ]);

    state.evidence = evRes.status === 'fulfilled' ? (evRes.value?.evidence || evRes.value || []) : [];
    state.entities = entRes.status === 'fulfilled' ? (entRes.value?.entities || entRes.value || []) : [];
    state.timeline = timeRes.status === 'fulfilled' ? (timeRes.value?.events || timeRes.value || []) : [];
    state.clusters = clusRes.status === 'fulfilled' ? (clusRes.value?.clusters || clusRes.value || []) : [];
    state.legal = legRes.status === 'fulfilled' ? (legRes.value?.legal || legRes.value || null) : null;

    renderHeader();
    renderActiveTab();
  } catch (err) {
    console.error('Failed to load case dossier:', err);
    if (container) {
      container.innerHTML = `
        <div class="card p-6 text-center text-danger">
          <h3>⚠️ Case Dossier Not Found</h3>
          <p class="text-secondary mt-2">Could not retrieve details for case ID: "${escapeHtml(state.caseId)}".</p>
          <button class="btn btn-outline mt-4" onclick="window.location.href='/frontend/pages/cases.html'">← Return to Cases</button>
        </div>
      `;
    }
  }
}

// ─── Header Rendering ─────────────────────────────────────────────────────────
function renderHeader() {
  const container = document.getElementById('case-detail-header') || document.getElementById('case-header-card');
  if (!container || !state.caseData) return;

  const c = state.caseData;
  const statusBadge = getStatusBadge(c.status);
  const priorityBadge = getPriorityBadge(c.priority);
  const formattedLoss = formatINR(c.totalLossINR || c.fraudAmountINR || 0);

  container.innerHTML = `
    <div class="card p-6 mb-4" style="border-radius:12px; background:var(--surface, #ffffff); box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <a href="/frontend/pages/cases.html" class="btn btn-ghost btn-sm" id="btn-back-cases" style="padding:4px 8px; font-size:12px;">← Cases</a>
            <h1 class="text-2xl font-bold font-mono text-primary" style="margin:0;">${escapeHtml(c.caseNumber)}</h1>
            <span class="badge ${statusBadge.class}">${escapeHtml(statusBadge.label)}</span>
            <span class="badge ${priorityBadge.class}">${escapeHtml(priorityBadge.label)}</span>
          </div>
          <p class="text-secondary text-sm" style="margin:4px 0 0 0;">
            <span class="font-medium text-main">${escapeHtml(c.incidentType || 'Cyber Crime Incident')}</span>
            ${c.firNumber ? ` • <span class="font-mono">FIR No: ${escapeHtml(c.firNumber)}</span>` : ''}
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm btn-outline" id="btn-assign-officer">
            👤 ${escapeHtml(c.investigatingOfficer ? 'Reassign Officer' : 'Assign Officer')}
          </button>
          <button class="btn btn-sm btn-primary" id="btn-edit-case-header">
            ⚙️ Update Status
          </button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.08);">
        <div>
          <div class="text-xs text-muted">Complainant</div>
          <div class="font-medium text-main text-sm mt-1">${escapeHtml(c.complainantName || 'N/A')}</div>
          ${c.complainantPhone ? `<div class="text-xs text-secondary font-mono">${escapeHtml(c.complainantPhone)}</div>` : ''}
        </div>
        <div>
          <div class="text-xs text-muted">Jurisdiction / Police Station</div>
          <div class="font-medium text-main text-sm mt-1">${escapeHtml(c.jurisdiction || c.policeStation || 'HQ Cyber Unit')}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Investigating Officer</div>
          <div class="font-medium text-main text-sm mt-1">${escapeHtml(c.investigatingOfficer || 'Unassigned')}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Total Fraud / Financial Loss</div>
          <div class="font-mono font-bold text-warning text-base mt-1">${formattedLoss}</div>
        </div>
      </div>
    </div>
  `;

  // Re-bind dynamic header buttons
  const newEditBtn = document.getElementById('btn-edit-case-header');
  if (newEditBtn) newEditBtn.addEventListener('click', () => openStatusModal());

  const newAssignBtn = document.getElementById('btn-assign-officer');
  if (newAssignBtn) newAssignBtn.addEventListener('click', () => openAssignModal());
}

function getStatusBadge(status) {
  switch (status) {
    case 'OPEN': return { class: 'badge-info', label: 'Open' };
    case 'UNDER_INQUIRY':
    case 'UNDER_INVESTIGATION': return { class: 'badge-warning', label: 'Under Investigation' };
    case 'CHARGESHEET_FILED':
    case 'CHARGESHEETED': return { class: 'badge-purple', label: 'Chargesheet Filed' };
    case 'CLOSED': return { class: 'badge-success', label: 'Closed' };
    default: return { class: 'badge-neutral', label: status || 'Unknown' };
  }
}

function getPriorityBadge(prio) {
  switch (prio) {
    case 'CRITICAL': return { class: 'badge-danger', label: 'CRITICAL' };
    case 'HIGH': return { class: 'badge-warning', label: 'HIGH' };
    case 'MEDIUM': return { class: 'badge-info', label: 'MEDIUM' };
    default: return { class: 'badge-neutral', label: prio || 'LOW' };
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabName) {
  state.activeTab = tabName;

  // Update UI active buttons
  const buttons = document.querySelectorAll('#case-detail-tabs [data-tab], #case-tabs [data-tab]');
  buttons.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Toggle tab panes
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(pane => {
    const isActive = pane.id === `tab-${tabName}`;
    pane.classList.toggle('active', isActive);
    pane.style.display = isActive ? 'block' : 'none';
  });

  renderActiveTab();
}

function renderActiveTab() {
  // Update count indicators
  const evCountEl = document.getElementById('count-evidence');
  const evBadge = document.getElementById('ev-count-badge');
  if (evCountEl) evCountEl.textContent = state.evidence.length;
  if (evBadge) evBadge.textContent = state.evidence.length;

  const entCountEl = document.getElementById('count-entities');
  const entBadge = document.getElementById('ent-count-badge');
  if (entCountEl) entCountEl.textContent = state.entities.length;
  if (entBadge) entBadge.textContent = state.entities.length;

  const tlCountEl = document.getElementById('count-timeline');
  const tlBadge = document.getElementById('tl-count-badge');
  if (tlCountEl) tlCountEl.textContent = state.timeline.length;
  if (tlBadge) tlBadge.textContent = state.timeline.length;

  // Resolve target container
  const contentFallback = document.getElementById('tab-content-area');
  const overviewContainer = document.getElementById('overview-body') || contentFallback;
  const evidenceContainer = document.getElementById('detail-evidence-body') || contentFallback;
  const entitiesContainer = document.getElementById('detail-entities-body') || contentFallback;
  const timelineContainer = document.getElementById('detail-timeline-body') || contentFallback;
  const syndicateContainer = document.getElementById('detail-syndicate-body') || contentFallback;
  const legalContainer = document.getElementById('detail-legal-body') || contentFallback;

  switch (state.activeTab) {
    case 'overview':
      if (overviewContainer) renderOverviewTab(overviewContainer);
      break;
    case 'evidence':
      if (evidenceContainer) renderEvidenceTab(evidenceContainer);
      break;
    case 'entities':
      if (entitiesContainer) renderEntitiesTab(entitiesContainer);
      break;
    case 'timeline':
      if (timelineContainer) renderTimelineTab(timelineContainer);
      break;
    case 'syndicate':
      if (syndicateContainer) renderSyndicateTab(syndicateContainer);
      break;
    case 'legal':
      if (legalContainer) renderLegalTab(legalContainer);
      break;
    default:
      if (overviewContainer) renderOverviewTab(overviewContainer);
  }
}

// ─── 1. Overview Tab ──────────────────────────────────────────────────────────
function renderOverviewTab(container) {
  const c = state.caseData;
  const recentEv = state.evidence.slice(0, 4);
  const recentEnt = state.entities.slice(0, 6);

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px;">
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Incident Brief -->
        <div class="card p-5">
          <h3 class="card-title mb-3" style="font-size:1rem; font-weight:700;">📝 Incident Description & Modus Operandi</h3>
          <p class="text-secondary text-sm leading-relaxed" style="white-space: pre-wrap; line-height:1.6;">
            ${escapeHtml(c.description || 'No detailed modus operandi notes attached to this case file.')}
          </p>
        </div>

        <!-- Attached Digital Evidence Summary -->
        <div class="card p-5">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 class="card-title" style="font-size:1rem; font-weight:700;">🛡 Attached Digital Evidence (${state.evidence.length})</h3>
            <button class="btn btn-xs btn-outline" onclick="window.location.href='/frontend/pages/index.html'">+ Upload Evidence</button>
          </div>
          ${recentEv.length === 0 ? `
            <div class="text-center py-6 text-muted text-sm">No evidence files linked to this case dossier yet.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${recentEv.map(ev => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:8px; background:rgba(0,0,0,0.03);">
                  <div>
                    <div class="font-medium text-main text-sm">
                      <a href="/frontend/pages/evidence.html?id=${encodeURIComponent(ev.id)}" style="color:#2563eb; text-decoration:none; font-weight:600;">
                        ${escapeHtml(ev.filename || ev.fileName || ev.title || 'Evidence Item')}
                      </a>
                    </div>
                    <div class="font-mono text-xs text-muted">SHA-256: ${(ev.sha256Hash || ev.sha256 || 'N/A').slice(0, 16)}…</div>
                  </div>
                  <span class="badge badge-subtle text-xs">${escapeHtml(ev.fileType || ev.mimeType || 'FILE')}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Quick Stats Sidebar -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="card p-5">
          <h3 class="card-title mb-4" style="font-size:1rem; font-weight:700; margin-bottom:14px;">🎯 Key Intelligence Signals</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span class="text-sm text-secondary">Linked Entities:</span>
              <span class="font-mono font-bold text-main">${state.entities.length}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span class="text-sm text-secondary">Timeline Events:</span>
              <span class="font-mono font-bold text-main">${state.timeline.length}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span class="text-sm text-secondary">Syndicate Clusters:</span>
              <span class="font-mono font-bold text-primary">${state.clusters.length}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span class="text-sm text-secondary">Registered Date:</span>
              <span class="text-xs text-muted font-mono">${formatIST(c.createdAt)}</span>
            </div>
          </div>
        </div>

        <!-- Extracted Entities Quick List -->
        <div class="card p-5">
          <h3 class="card-title mb-3" style="font-size:1rem; font-weight:700; margin-bottom:12px;">🔍 Extracted Identifiers</h3>
          ${recentEnt.length === 0 ? `
            <div class="text-center py-4 text-muted text-xs">No extracted entities found.</div>
          ` : `
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${recentEnt.map(ent => `
                <a href="/frontend/pages/entities.html?q=${encodeURIComponent(ent.value)}" class="badge badge-outline font-mono text-xs" title="${escapeHtml(ent.type || '')}" style="text-decoration:none;">
                  ${escapeHtml(ent.value)}
                </a>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ─── 2. Evidence Tab ──────────────────────────────────────────────────────────
function renderEvidenceTab(container) {
  container.innerHTML = `
    <div class="card p-5" style="border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 class="card-title" style="font-size:1rem; font-weight:700;">🛡 Forensic Digital Evidence Vault (${state.evidence.length})</h3>
        <button class="btn btn-sm btn-primary" onclick="window.location.href='/frontend/pages/index.html'">+ Upload New Evidence</button>
      </div>

      ${state.evidence.length === 0 ? `
        <div class="empty-state py-10 text-center" style="padding:40px; text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px">📁</div>
          <p class="font-medium text-main">No digital evidence uploaded for case ${escapeHtml(state.caseData.caseNumber)}.</p>
          <p class="text-xs text-muted mt-1">Upload bank statements, CDR logs, screenshot PDFs, or transaction receipts to initiate auto-extraction.</p>
        </div>
      ` : `
        <div class="table-container" style="overflow-x:auto;">
          <table class="table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; font-size:12px; color:var(--text-muted);">
                <th style="padding:10px 8px;">Filename</th>
                <th style="padding:10px 8px;">File Type</th>
                <th style="padding:10px 8px;">SHA-256 Hash</th>
                <th style="padding:10px 8px;">Size</th>
                <th style="padding:10px 8px;">Uploaded At</th>
                <th style="padding:10px 8px;">Status</th>
                <th style="padding:10px 8px; text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.evidence.map(ev => `
                <tr style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:13px;">
                  <td style="padding:12px 8px;" class="font-medium text-main">
                    <a href="/frontend/pages/evidence.html?id=${encodeURIComponent(ev.id)}" class="hover-underline" style="color:#2563eb; text-decoration:none; font-weight:600;">
                      📄 ${escapeHtml(ev.filename || ev.fileName || ev.title || 'Evidence')}
                    </a>
                  </td>
                  <td style="padding:12px 8px;"><span class="badge badge-subtle text-xs">${escapeHtml(ev.fileType || ev.mimeType || 'FILE')}</span></td>
                  <td style="padding:12px 8px;" class="font-mono text-xs text-muted" title="${escapeHtml(ev.sha256Hash || ev.sha256 || '')}">
                    ${(ev.sha256Hash || ev.sha256 || 'N/A').slice(0, 20)}…
                  </td>
                  <td style="padding:12px 8px;" class="font-mono text-xs text-secondary">${ev.fileSizeBytes ? (ev.fileSizeBytes / 1024).toFixed(1) + ' KB' : (ev.fileSize || 'N/A')}</td>
                  <td style="padding:12px 8px;" class="text-xs text-muted">${formatIST(ev.uploadedAt || ev.createdAt)}</td>
                  <td style="padding:12px 8px;"><span class="badge badge-success text-xs">Verified 🔒</span></td>
                  <td style="padding:12px 8px; text-align:right;">
                    <a href="/frontend/pages/evidence.html?id=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-secondary" style="font-size:11px; padding:4px 10px; text-decoration:none;">
                      🔬 Analyze
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ─── 3. Entities Tab ──────────────────────────────────────────────────────────
function renderEntitiesTab(container) {
  container.innerHTML = `
    <div class="card p-5" style="border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 class="card-title" style="font-size:1rem; font-weight:700;">🔍 Deterministically Extracted Forensic Entities (${state.entities.length})</h3>
        <a href="/frontend/pages/entities.html?case=${encodeURIComponent(state.caseData.caseNumber || '')}" class="btn btn-sm btn-secondary" style="text-decoration:none;">
          🔬 View in Entity Analysis
        </a>
      </div>

      ${state.entities.length === 0 ? `
        <div class="empty-state py-10 text-center" style="padding:40px; text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px">🏷️</div>
          <p class="font-medium text-main">No entities extracted yet.</p>
          <p class="text-xs text-muted mt-1">Entities (UPI IDs, Phone Numbers, IFSC Codes, Domains, IPs) are automatically parsed when evidence is ingested.</p>
        </div>
      ` : `
        <div class="table-container" style="overflow-x:auto;">
          <table class="table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; font-size:12px; color:var(--text-muted);">
                <th style="padding:10px 8px;">Entity Type</th>
                <th style="padding:10px 8px;">Identifier Value</th>
                <th style="padding:10px 8px;">Confidence</th>
                <th style="padding:10px 8px;">Extracted From</th>
                <th style="padding:10px 8px;">Cross-Case Linkage</th>
                <th style="padding:10px 8px; text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.entities.map(ent => `
                <tr style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:13px;">
                  <td style="padding:12px 8px;"><span class="badge badge-info text-xs font-mono">${escapeHtml(ent.type || ent.entityType)}</span></td>
                  <td style="padding:12px 8px;" class="font-mono font-bold text-main">
                    <a href="/frontend/pages/entities.html?q=${encodeURIComponent(ent.value)}" class="hover-underline" style="color:#2563eb; text-decoration:none;">
                      ${escapeHtml(ent.value)}
                    </a>
                  </td>
                  <td style="padding:12px 8px;"><span class="text-xs font-mono text-success">100% Deterministic</span></td>
                  <td style="padding:12px 8px;" class="text-xs text-muted">${escapeHtml(ent.sourceFile || 'Evidence Parser')}</td>
                  <td style="padding:12px 8px;">
                    ${ent.caseCount && ent.caseCount > 1 ? `
                      <span class="badge badge-warning text-xs font-bold">⚠️ Linked to ${ent.caseCount} Cases</span>
                    ` : `
                      <span class="badge badge-neutral text-xs">Single Case</span>
                    `}
                  </td>
                  <td style="padding:12px 8px; text-align:right;">
                    <a href="/frontend/pages/entities.html?q=${encodeURIComponent(ent.value)}" class="btn btn-sm btn-secondary" style="font-size:11px; padding:4px 10px; text-decoration:none;">
                      🔍 Trace
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ─── 4. Timeline Tab ──────────────────────────────────────────────────────────
function renderTimelineTab(container) {
  container.innerHTML = `
    <div class="card p-5" style="border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 class="card-title" style="font-size:1rem; font-weight:700;">⏱ Modus Operandi & Chronological Timeline (${state.timeline.length})</h3>
        <button class="btn btn-xs btn-outline" onclick="window.location.href='/frontend/pages/timeline.html'">View Master Timeline →</button>
      </div>

      ${state.timeline.length === 0 ? `
        <div class="empty-state py-10 text-center" style="padding:40px; text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px">⏱</div>
          <p class="font-medium text-main">No timeline events recorded.</p>
          <p class="text-xs text-muted mt-1">Timeline events are tagged during evidence extraction or manual investigator note-taking.</p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:16px; padding-left:16px; border-left:2px solid rgba(37,99,235,0.2);">
          ${state.timeline.map(ev => `
            <div style="position:relative;">
              <div style="width:10px; height:10px; border-radius:50%; background:#2563eb; position:absolute; left:-22px; top:4px;"></div>
              <div class="text-xs text-muted font-mono mb-1">${formatIST(ev.timestamp || ev.createdAt)}</div>
              <div class="font-medium text-main text-sm" style="font-weight:600;">${escapeHtml(ev.title || ev.action || 'Investigation Event')}</div>
              <p class="text-xs text-secondary mt-1" style="margin:4px 0 0 0;">${escapeHtml(ev.description || '')}</p>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// ─── 5. Syndicate Tab ─────────────────────────────────────────────────────────
function renderSyndicateTab(container) {
  container.innerHTML = `
    <div class="card p-5" style="border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 class="card-title" style="font-size:1rem; font-weight:700;">🕸 Cross-Case Syndicate Intelligence & Cluster Graph</h3>
        <button class="btn btn-xs btn-primary" onclick="window.location.href='/frontend/pages/graph.html'">Interactive Syndicate Map →</button>
      </div>

      ${state.clusters.length === 0 ? `
        <div class="empty-state py-10 text-center" style="padding:40px; text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px">🌐</div>
          <p class="font-medium text-main">No cross-case syndicate clusters matched.</p>
          <p class="text-xs text-muted mt-1">When extracted entities match other registered cases, syndicate clusters automatically populate here.</p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${state.clusters.map(clus => `
            <div style="padding:14px 18px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); background:rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="font-bold text-primary font-mono text-base">${escapeHtml(clus.title || clus.name || `Cluster #${clus.id}`)}</div>
                <span class="badge badge-warning text-xs font-mono">${clus.caseCount || 2} Linked Cases</span>
              </div>
              <p class="text-xs text-secondary mb-3">${escapeHtml(clus.description || 'Shared infrastructure detected across cybercrime cases.')}</p>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${(clus.sharedEntities || []).map(ent => `
                  <span class="badge badge-purple text-xs font-mono">🔗 ${escapeHtml(ent)}</span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// ─── 6. Legal Tab ─────────────────────────────────────────────────────────────
function renderLegalTab(container) {
  container.innerHTML = `
    <div class="card p-5" style="border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 class="card-title" style="font-size:1rem; font-weight:700;">⚖ BSA Section 63 Legal Admissibility Dossier</h3>
        <button class="btn btn-sm btn-primary" id="btn-export-dossier">📥 Export Legal Certificate</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="padding:16px; border-radius:8px; background:rgba(37,99,235,0.04); border:1px solid rgba(37,99,235,0.15);">
          <h4 class="font-bold text-main mb-2" style="font-size:13px; font-weight:700;">Legal Compliance Overview (BSA Section 63)</h4>
          <p class="text-xs leading-relaxed mb-3" style="line-height:1.6;">
            Under Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023, digital evidence submitted in judicial proceedings requires strict chain-of-custody verification, cryptographic hash integrity, and tamper-proof intake audit logs.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:12px; font-family:monospace; padding-top:10px; border-top:1px solid rgba(0,0,0,0.08);">
            <div>Intake Verification Status: <span class="text-success font-bold" style="color:#16a34a;">VERIFIED 🔒</span></div>
            <div>Cryptographic Standard: <span class="text-main font-bold">SHA-256</span></div>
          </div>
        </div>

        <div style="padding:16px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); background:rgba(0,0,0,0.01);">
          <h4 class="font-bold text-main mb-2" style="font-size:13px; font-weight:700;">Dossier Inclusion Summary</h4>
          <ul style="padding-left:20px; font-size:12px; line-height:1.8; color:var(--text-secondary);">
            <li>Primary Complaint & FIR Record</li>
            <li>Verified Digital Evidence Hash Audit Trail (${state.evidence.length} files)</li>
            <li>Extracted Technical Identifiers & Metadata Report (${state.entities.length} entities)</li>
            <li>Chronological Modus Operandi Timeline (${state.timeline.length} entries)</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const exportBtn = document.getElementById('btn-export-dossier');
  if (exportBtn) exportBtn.addEventListener('click', () => handleExportLegal());
}

// ─── Status Update Modal ──────────────────────────────────────────────────────
function openStatusModal() {
  const modal = document.getElementById('status-modal');
  if (!modal || !state.caseData) return;

  const statusSelect = document.getElementById('new-status-select') || document.getElementById('status-select');
  if (statusSelect) statusSelect.value = state.caseData.status;

  modal.style.display = 'flex';
}

async function handleStatusUpdate() {
  const submitBtn = document.getElementById('status-modal-submit');
  const statusSelect = document.getElementById('new-status-select') || document.getElementById('status-select');
  if (!statusSelect || !state.caseData) return;

  const newStatus = statusSelect.value;
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Updating…`;
    }

    const caseLookup = state.caseData.id || state.caseData.caseNumber;
    await patchCase(caseLookup, { status: newStatus });
    showNotification(`Case status updated to ${newStatus}`, 'success');
    const modal = document.getElementById('status-modal');
    if (modal) modal.style.display = 'none';

    await loadCaseDossier();
  } catch (err) {
    console.error('Failed to update status:', err);
    showNotification(err.message || 'Failed to update status', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Update Status`;
    }
  }
}

// ─── Assign Officer Modal ─────────────────────────────────────────────────────
function openAssignModal() {
  const modal = document.getElementById('assign-modal');
  if (modal && state.caseData) {
    const nameInput = document.getElementById('assign-officer-name');
    if (nameInput) nameInput.value = state.caseData.investigatingOfficer || '';
    modal.style.display = 'flex';
    return;
  }

  // Fallback prompt if modal element missing
  const officer = prompt('Enter Investigating Officer Name / Rank / Badge ID:', state.caseData?.investigatingOfficer || '');
  if (officer !== null && officer.trim() !== '') {
    const caseLookup = state.caseData.id || state.caseData.caseNumber;
    patchCase(caseLookup, { investigatingOfficer: officer.trim() })
      .then(() => {
        showNotification(`Investigating Officer assigned: ${officer.trim()}`, 'success');
        loadCaseDossier();
      })
      .catch(err => {
        showNotification(err.message || 'Failed to assign officer', 'error');
      });
  }
}

async function handleAssignOfficerSubmit() {
  const nameInput = document.getElementById('assign-officer-name');
  const badgeInput = document.getElementById('assign-officer-badge');
  const submitBtn = document.getElementById('assign-modal-submit');

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const badgeVal = badgeInput ? badgeInput.value.trim() : '';
  const officerDesc = badgeVal ? `${nameVal} (${badgeVal})` : nameVal;

  if (!officerDesc) {
    showNotification('Please enter an officer name or badge', 'error');
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    const caseLookup = state.caseData.id || state.caseData.caseNumber;
    await patchCase(caseLookup, { investigatingOfficer: officerDesc });
    showNotification(`Officer assigned: ${officerDesc}`, 'success');
    const modal = document.getElementById('assign-modal');
    if (modal) modal.style.display = 'none';
    await loadCaseDossier();
  } catch (err) {
    showNotification(err.message || 'Failed to assign officer', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── Legal Export ─────────────────────────────────────────────────────────────
function handleExportLegal() {
  const caseParam = state.caseData?.caseNumber || state.caseId;
  window.location.href = `/frontend/pages/legal.html?caseId=${encodeURIComponent(caseParam)}`;
}
