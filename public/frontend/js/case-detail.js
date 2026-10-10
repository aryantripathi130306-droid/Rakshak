/**
 * Rakshak — Case Detail Workspace Page Script
 * Loads single case dossier via /api/cases/:caseId with all associated evidence,
 * extracted entities, timeline events, cluster syndicate links, and legal records.
 */

import {
  getCase,
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

  // Get caseId from URL query param `?id=...` or fallback to localStorage
  const urlParams = new URLSearchParams(window.location.search);
  state.caseId = urlParams.get('id') || urlParams.get('caseNumber') || localStorage.getItem('rakshak_active_case');

  if (!state.caseId) {
    showNotification('No case identifier provided', 'error');
    window.location.href = '/frontend/pages/cases.html';
    return;
  }

  // Update localStorage active case
  setActiveCaseId(state.caseId);

  bindEvents();
  await loadCaseDossier();
});

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Navigation back button
  const backBtn = document.getElementById('btn-back-cases');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/frontend/pages/cases.html';
    });
  }

  // Tab Switching
  const tabContainer = document.getElementById('case-tabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  }

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

  // Modal Handlers
  const statusModal = document.getElementById('status-modal');
  const statusModalClose = document.getElementById('status-modal-close');
  const statusModalCancel = document.getElementById('status-modal-cancel');
  const statusModalSubmit = document.getElementById('status-modal-submit');

  const closeStatusModal = () => { if (statusModal) statusModal.style.display = 'none'; };
  if (statusModalClose) statusModalClose.addEventListener('click', closeStatusModal);
  if (statusModalCancel) statusModalCancel.addEventListener('click', closeStatusModal);
  if (statusModalSubmit) statusModalSubmit.addEventListener('click', handleStatusUpdate);
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadCaseDossier() {
  const container = document.getElementById('case-header-card');
  if (container) {
    container.innerHTML = `<div class="loading-row py-8 text-center"><span class="spinner"></span> Loading case dossier #${escapeHtml(state.caseId)}…</div>`;
  }

  try {
    const res = await getCase(state.caseId);
    state.caseData = res.case;

    // Concurrently fetch related data
    const [evRes, entRes, timeRes, clusRes, legRes] = await Promise.allSettled([
      getCaseEvidence(state.caseData.id || state.caseData.caseNumber),
      getCaseEntities(state.caseData.id || state.caseData.caseNumber),
      getCaseTimeline(state.caseData.id || state.caseData.caseNumber),
      getClusters(),
      getCaseLegal(state.caseData.id || state.caseData.caseNumber),
    ]);

    state.evidence = evRes.status === 'fulfilled' ? (evRes.value.evidence || evRes.value || []) : [];
    state.entities = entRes.status === 'fulfilled' ? (entRes.value.entities || entRes.value || []) : [];
    state.timeline = timeRes.status === 'fulfilled' ? (timeRes.value.events || timeRes.value || []) : [];
    state.clusters = clusRes.status === 'fulfilled' ? (clusRes.value.clusters || clusRes.value || []) : [];
    state.legal = legRes.status === 'fulfilled' ? (legRes.value.legal || legRes.value || null) : null;

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
  const container = document.getElementById('case-header-card');
  if (!container || !state.caseData) return;

  const c = state.caseData;
  const statusBadge = getStatusBadge(c.status);
  const priorityBadge = getPriorityBadge(c.priority);
  const formattedLoss = formatINR(c.totalLossINR || c.fraudAmountINR || 0);

  container.innerHTML = `
    <div class="card p-6 mb-6">
      <div class="flex-between align-start mb-4">
        <div>
          <div class="flex-align gap-3 mb-2">
            <h1 class="text-2xl font-bold font-mono text-primary">${escapeHtml(c.caseNumber)}</h1>
            <span class="badge ${statusBadge.class}">${escapeHtml(statusBadge.label)}</span>
            <span class="badge ${priorityBadge.class}">${escapeHtml(priorityBadge.label)}</span>
          </div>
          <p class="text-secondary text-sm">
            <span class="font-medium text-main">${escapeHtml(c.incidentType || 'Cyber Crime Incident')}</span>
            ${c.firNumber ? ` • <span class="font-mono">FIR No: ${escapeHtml(c.firNumber)}</span>` : ''}
          </p>
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline" id="btn-assign-officer">
            👤 ${escapeHtml(c.investigatingOfficer ? 'Reassign Officer' : 'Assign Officer')}
          </button>
          <button class="btn btn-sm btn-primary" id="btn-edit-case-header">
            ⚙️ Update Status
          </button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 pt-4 border-t border-glass">
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
    case 'UNDER_INVESTIGATION': return { class: 'badge-warning', label: 'Under Investigation' };
    case 'CHARGESHEET_FILED': return { class: 'badge-purple', label: 'Chargesheet Filed' };
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
  const buttons = document.querySelectorAll('#case-tabs [data-tab]');
  buttons.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderActiveTab();
}

function renderActiveTab() {
  const contentEl = document.getElementById('tab-content-area');
  if (!contentEl) return;

  switch (state.activeTab) {
    case 'overview':
      renderOverviewTab(contentEl);
      break;
    case 'evidence':
      renderEvidenceTab(contentEl);
      break;
    case 'entities':
      renderEntitiesTab(contentEl);
      break;
    case 'timeline':
      renderTimelineTab(contentEl);
      break;
    case 'syndicate':
      renderSyndicateTab(contentEl);
      break;
    case 'legal':
      renderLegalTab(contentEl);
      break;
    default:
      renderOverviewTab(contentEl);
  }
}

// ─── 1. Overview Tab ──────────────────────────────────────────────────────────
function renderOverviewTab(container) {
  const c = state.caseData;
  const recentEv = state.evidence.slice(0, 4);
  const recentEnt = state.entities.slice(0, 6);

  container.innerHTML = `
    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2 space-y-6">
        <!-- Incident Brief -->
        <div class="card p-5">
          <h3 class="card-title mb-3">📝 Incident Description & Modus Operandi</h3>
          <p class="text-secondary text-sm leading-relaxed" style="white-space: pre-wrap;">
            ${escapeHtml(c.description || 'No detailed modus operandi notes attached to this case file.')}
          </p>
        </div>

        <!-- Attached Digital Evidence Summary -->
        <div class="card p-5">
          <div class="flex-between mb-4">
            <h3 class="card-title">🛡 Attached Digital Evidence (${state.evidence.length})</h3>
            <button class="btn btn-xs btn-outline" onclick="window.location.href='/frontend/pages/index.html'">+ Upload Evidence</button>
          </div>
          ${recentEv.length === 0 ? `
            <div class="text-center py-6 text-muted text-sm">No evidence files linked to this case dossier yet.</div>
          ` : `
            <div class="space-y-3">
              ${recentEv.map(ev => `
                <div class="flex-between p-3 rounded bg-glass-subtle hover-bg">
                  <div>
                    <div class="font-medium text-main text-sm">${escapeHtml(ev.filename || ev.title)}</div>
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
      <div class="space-y-6">
        <div class="card p-5">
          <h3 class="card-title mb-4">🎯 Key Intelligence Signals</h3>
          <div class="space-y-4">
            <div class="flex-between">
              <span class="text-sm text-secondary">Linked Entities:</span>
              <span class="font-mono font-bold text-main">${state.entities.length}</span>
            </div>
            <div class="flex-between">
              <span class="text-sm text-secondary">Timeline Events:</span>
              <span class="font-mono font-bold text-main">${state.timeline.length}</span>
            </div>
            <div class="flex-between">
              <span class="text-sm text-secondary">Syndicate Clusters:</span>
              <span class="font-mono font-bold text-primary">${state.clusters.length}</span>
            </div>
            <div class="flex-between">
              <span class="text-sm text-secondary">Registered Date:</span>
              <span class="text-xs text-muted font-mono">${formatIST(c.createdAt)}</span>
            </div>
          </div>
        </div>

        <!-- Extracted Entities Quick List -->
        <div class="card p-5">
          <h3 class="card-title mb-3">🔍 Extracted Identifiers</h3>
          ${recentEnt.length === 0 ? `
            <div class="text-center py-4 text-muted text-xs">No extracted entities found.</div>
          ` : `
            <div class="flex flex-wrap gap-2">
              ${recentEnt.map(ent => `
                <span class="badge badge-outline font-mono text-xs" title="${escapeHtml(ent.type)}">
                  ${escapeHtml(ent.value)}
                </span>
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
    <div class="card p-5">
      <div class="flex-between mb-4">
        <h3 class="card-title">🛡 Forensic Digital Evidence Vault (${state.evidence.length})</h3>
        <button class="btn btn-sm btn-primary" onclick="window.location.href='/frontend/pages/index.html'">+ Upload New Evidence</button>
      </div>

      ${state.evidence.length === 0 ? `
        <div class="empty-state py-10 text-center">
          <div style="font-size:2.5rem;margin-bottom:8px">📁</div>
          <p class="font-medium text-main">No digital evidence uploaded for case ${escapeHtml(state.caseData.caseNumber)}.</p>
          <p class="text-xs text-muted mt-1">Upload bank statements, CDR logs, screenshot PDFs, or transaction receipts to initiate auto-extraction.</p>
        </div>
      ` : `
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>File Type</th>
                <th>SHA-256 Hash</th>
                <th>Size</th>
                <th>Uploaded At</th>
                <th>Status</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.evidence.map(ev => `
                <tr>
                  <td class="font-medium text-main">
                    <a href="/frontend/pages/evidence-viewer.html?id=${encodeURIComponent(ev.id)}" class="hover-underline" style="color:#60a5fa">
                      📄 ${escapeHtml(ev.filename || ev.fileName || ev.title || 'Evidence')}
                    </a>
                  </td>
                  <td><span class="badge badge-subtle text-xs">${escapeHtml(ev.fileType || ev.mimeType || 'FILE')}</span></td>
                  <td class="font-mono text-xs text-muted" title="${escapeHtml(ev.sha256Hash || ev.sha256 || '')}">
                    ${(ev.sha256Hash || ev.sha256 || 'N/A').slice(0, 20)}…
                  </td>
                  <td class="font-mono text-xs text-secondary">${ev.fileSizeBytes ? (ev.fileSizeBytes / 1024).toFixed(1) + ' KB' : (ev.fileSize || 'N/A')}</td>
                  <td class="text-xs text-muted">${formatIST(ev.uploadedAt || ev.createdAt)}</td>
                  <td><span class="badge badge-success text-xs">Verified 🔒</span></td>
                  <td style="text-align:right">
                    <a href="/frontend/pages/evidence-viewer.html?id=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-secondary" style="font-size:10px;padding:3px 8px;">
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
    <div class="card p-5">
      <div class="flex-between mb-4">
        <h3 class="card-title">🔍 Deterministically Extracted Forensic Entities (${state.entities.length})</h3>
        <a href="/frontend/pages/entities.html?case=${encodeURIComponent(state.caseData.caseNumber || '')}" class="btn btn-sm btn-secondary">
          🔬 View in Entity Analysis
        </a>
      </div>

      ${state.entities.length === 0 ? `
        <div class="empty-state py-10 text-center">
          <div style="font-size:2.5rem;margin-bottom:8px">🏷️</div>
          <p class="font-medium text-main">No entities extracted yet.</p>
          <p class="text-xs text-muted mt-1">Entities (UPI IDs, Phone Numbers, IFSC Codes, Domains, IPs) are automatically parsed when evidence is ingested.</p>
        </div>
      ` : `
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Entity Type</th>
                <th>Identifier Value</th>
                <th>Confidence</th>
                <th>Extracted From</th>
                <th>Cross-Case Linkage</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.entities.map(ent => `
                <tr>
                  <td><span class="badge badge-info text-xs font-mono">${escapeHtml(ent.type || ent.entityType)}</span></td>
                  <td class="font-mono font-bold text-main">
                    <a href="/frontend/pages/entities.html?q=${encodeURIComponent(ent.value)}" class="hover-underline" style="color:#60a5fa">
                      ${escapeHtml(ent.value)}
                    </a>
                  </td>
                  <td><span class="text-xs font-mono text-success">100% Deterministic</span></td>
                  <td class="text-xs text-muted">${escapeHtml(ent.sourceFile || 'Evidence Parser')}</td>
                  <td>
                    ${ent.caseCount && ent.caseCount > 1 ? `
                      <span class="badge badge-warning text-xs font-bold">⚠️ Linked to ${ent.caseCount} Cases</span>
                    ` : `
                      <span class="badge badge-neutral text-xs">Single Case</span>
                    `}
                  </td>
                  <td style="text-align:right">
                    <a href="/frontend/pages/entities.html?q=${encodeURIComponent(ent.value)}" class="btn btn-sm btn-secondary" style="font-size:10px;padding:3px 8px;">
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
    <div class="card p-5">
      <div class="flex-between mb-4">
        <h3 class="card-title">⏱ Modus Operandi & Chronological Timeline (${state.timeline.length})</h3>
        <button class="btn btn-xs btn-outline" onclick="window.location.href='/frontend/pages/timeline.html'">View Master Timeline →</button>
      </div>

      ${state.timeline.length === 0 ? `
        <div class="empty-state py-10 text-center">
          <div style="font-size:2.5rem;margin-bottom:8px">⏱</div>
          <p class="font-medium text-main">No timeline events recorded.</p>
          <p class="text-xs text-muted mt-1">Timeline events are tagged during evidence extraction or manual investigator note-taking.</p>
        </div>
      ` : `
        <div class="timeline-vertical space-y-4 relative pl-6 border-l border-glass-subtle">
          ${state.timeline.map(ev => `
            <div class="timeline-item relative">
              <div class="timeline-marker bg-primary rounded-full absolute -left-8 top-1 w-3 h-3"></div>
              <div class="text-xs text-muted font-mono mb-1">${formatIST(ev.timestamp || ev.createdAt)}</div>
              <div class="font-medium text-main text-sm">${escapeHtml(ev.title || ev.action)}</div>
              <p class="text-xs text-secondary mt-1">${escapeHtml(ev.description || '')}</p>
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
    <div class="card p-5">
      <div class="flex-between mb-4">
        <h3 class="card-title">🕸 Cross-Case Syndicate Intelligence & Cluster Graph</h3>
        <button class="btn btn-xs btn-primary" onclick="window.location.href='/frontend/pages/graph.html'">Interactive Syndicate Map →</button>
      </div>

      ${state.clusters.length === 0 ? `
        <div class="empty-state py-10 text-center">
          <div style="font-size:2.5rem;margin-bottom:8px">🌐</div>
          <p class="font-medium text-main">No cross-case syndicate clusters matched.</p>
          <p class="text-xs text-muted mt-1">When extracted entities match other registered cases, syndicate clusters automatically populate here.</p>
        </div>
      ` : `
        <div class="space-y-4">
          ${state.clusters.map(clus => `
            <div class="p-4 rounded card-subtle border border-glass">
              <div class="flex-between mb-2">
                <div class="font-bold text-primary font-mono text-base">${escapeHtml(clus.title || clus.name || `Cluster #${clus.id}`)}</div>
                <span class="badge badge-warning text-xs font-mono">${clus.caseCount || 2} Linked Cases</span>
              </div>
              <p class="text-xs text-secondary mb-3">${escapeHtml(clus.description || 'Shared infrastructure detected across cybercrime cases.')}</p>
              <div class="flex flex-wrap gap-2">
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
    <div class="card p-5">
      <div class="flex-between mb-4">
        <h3 class="card-title">⚖ BSA Section 63 Legal Admissibility Dossier</h3>
        <button class="btn btn-sm btn-primary" id="btn-export-dossier">📥 Export Legal Certificate</button>
      </div>

      <div class="space-y-4 text-sm text-secondary">
        <div class="p-4 rounded bg-glass-subtle">
          <h4 class="font-bold text-main mb-2">Legal Compliance Overview (BSA Section 63)</h4>
          <p class="text-xs leading-relaxed mb-3">
            Under Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023, digital evidence submitted in judicial proceedings requires strict chain-of-custody verification, cryptographic hash integrity, and tamper-proof intake audit logs.
          </p>
          <div class="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-glass-subtle">
            <div>Intake Verification Status: <span class="text-success font-bold">VERIFIED 🔒</span></div>
            <div>Cryptographic Standard: <span class="text-main font-bold">SHA-256</span></div>
          </div>
        </div>

        <div class="p-4 rounded card-subtle">
          <h4 class="font-bold text-main mb-2">Dossier Inclusion Summary</h4>
          <ul class="list-disc pl-5 space-y-1 text-xs">
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

  const statusSelect = document.getElementById('status-select');
  if (statusSelect) statusSelect.value = state.caseData.status;

  modal.style.display = 'flex';
}

async function handleStatusUpdate() {
  const submitBtn = document.getElementById('status-modal-submit');
  const statusSelect = document.getElementById('status-select');
  if (!statusSelect || !state.caseData) return;

  const newStatus = statusSelect.value;
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Updating…`;
    }

    await patchCase(state.caseData.caseNumber, { status: newStatus });
    showNotification(`Case status updated to ${newStatus}`, 'success');
    document.getElementById('status-modal').style.display = 'none';

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
  const officer = prompt('Enter Investigating Officer Name / Rank / Badge ID:', state.caseData?.investigatingOfficer || '');
  if (officer !== null && officer.trim() !== '') {
    patchCase(state.caseData.caseNumber, { investigatingOfficer: officer.trim() })
      .then(() => {
        showNotification(`Investigating Officer assigned: ${officer.trim()}`, 'success');
        loadCaseDossier();
      })
      .catch(err => {
        showNotification(err.message || 'Failed to assign officer', 'error');
      });
  }
}

// ─── Legal Export ─────────────────────────────────────────────────────────────
function handleExportLegal() {
  window.location.href = `/frontend/pages/legal.html?caseId=${encodeURIComponent(state.caseData.caseNumber)}`;
}
