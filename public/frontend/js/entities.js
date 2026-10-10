/**
 * Rakshak — Entity Analysis Page
 * Searchable, filterable table of all extracted forensic entities across evidence.
 * Entity detail panel with provenance, cross-case links, and navigation.
 */

import { initLayout } from './layout.js';
import {
  getEntities, getEntityDetail, getCases,
  getEvidenceDownloadUrl, ACTIVE_CASE_ID
} from './api.js';
import { escapeHtml, showToast } from './utils.js';

// ─── Entity Type Config ──────────────────────────────────────────────────────
const ENTITY_TYPE_CONFIG = {
  UPI:       { label: 'UPI VPA',      color: '#34d399', icon: '💳' },
  PHONE:     { label: 'Phone',        color: '#38bdf8', icon: '📱' },
  EMAIL:     { label: 'Email',        color: '#c084fc', icon: '✉' },
  IFSC:      { label: 'IFSC',         color: '#f59e0b', icon: '🏦' },
  UTR:       { label: 'UTR',          color: '#60a5fa', icon: '🔢' },
  DOMAIN:    { label: 'Domain',       color: '#2dd4bf', icon: '🌐' },
  IP:        { label: 'IP Address',   color: '#94a3b8', icon: '📡' },
  TELEGRAM:  { label: 'Telegram',     color: '#818cf8', icon: '✈' },
  ACCOUNT:   { label: 'Account',      color: '#fbbf24', icon: '🏧' },
  NAME:      { label: 'Name',         color: '#fb923c', icon: '👤' },
  GPS_COORD: { label: 'GPS',          color: '#a78bfa', icon: '📍' },
  ADDRESS:   { label: 'Address',      color: '#64748b', icon: '🏠' },
};

function getEntityTypeLabel(type) {
  return ENTITY_TYPE_CONFIG[type]?.label || type;
}
function getEntityTypeColor(type) {
  return ENTITY_TYPE_CONFIG[type]?.color || '#64748b';
}
function getEntityTypeIcon(type) {
  return ENTITY_TYPE_CONFIG[type]?.icon || '📌';
}

function getExtractionMethod(confidence) {
  if (confidence >= 0.95) return { label: 'Regex', class: 'method-regex' };
  if (confidence >= 0.85) return { label: 'Heuristic', class: 'method-heuristic' };
  return { label: 'Contextual', class: 'method-contextual' };
}

// ─── State ───────────────────────────────────────────────────────────────────
let currentFilters = {
  q: '',
  entityType: 'ALL',
  caseId: 'ALL',
  verificationStatus: 'ALL',
  page: 1,
  limit: 50,
  sortBy: 'extractedAt',
  sortOrder: 'desc',
};
let selectedEntityId = null;

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLayout({ activePage: 'entities' });
  initFilters();
  loadEntities();
  loadCaseOptions();
});

// ─── Filter Setup ────────────────────────────────────────────────────────────
function initFilters() {
  const searchInput = document.getElementById('filter-search');
  const typeSelect = document.getElementById('filter-entity-type');
  const caseSelect = document.getElementById('filter-case');
  const verifySelect = document.getElementById('filter-verification');
  const resetBtn = document.getElementById('btn-reset-filters');
  const retryBtn = document.getElementById('btn-retry-entities');
  const exportBtn = document.getElementById('btn-export-entities');
  const closeDetail = document.getElementById('detail-panel-close');

  // Read URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q');
  const typeParam = urlParams.get('type') || urlParams.get('entityType');
  const caseParam = urlParams.get('case') || urlParams.get('caseId');
  const verifyParam = urlParams.get('status') || urlParams.get('verificationStatus');
  const idParam = urlParams.get('id') || urlParams.get('entityId');

  if (qParam) {
    currentFilters.q = qParam;
    if (searchInput) searchInput.value = qParam;
  }
  if (typeParam && typeParam !== 'ALL') {
    currentFilters.entityType = typeParam.toUpperCase();
    if (typeSelect) typeSelect.value = currentFilters.entityType;
  }
  if (caseParam && caseParam !== 'ALL') {
    currentFilters.caseId = caseParam;
  }
  if (verifyParam && verifyParam !== 'ALL') {
    currentFilters.verificationStatus = verifyParam.toUpperCase();
    if (verifySelect) verifySelect.value = currentFilters.verificationStatus;
  }
  if (idParam) {
    selectedEntityId = idParam;
    setTimeout(() => openEntityDetail(idParam), 300);
  }

  let debounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentFilters.q = searchInput.value.trim();
      currentFilters.page = 1;
      loadEntities();
    }, 350);
  });

  typeSelect?.addEventListener('change', () => {
    currentFilters.entityType = typeSelect.value;
    currentFilters.page = 1;
    loadEntities();
  });

  caseSelect?.addEventListener('change', () => {
    currentFilters.caseId = caseSelect.value;
    currentFilters.page = 1;
    loadEntities();
  });

  verifySelect?.addEventListener('change', () => {
    currentFilters.verificationStatus = verifySelect.value;
    currentFilters.page = 1;
    loadEntities();
  });

  resetBtn?.addEventListener('click', () => {
    currentFilters = { q: '', entityType: 'ALL', caseId: 'ALL', verificationStatus: 'ALL', page: 1, limit: 50, sortBy: 'extractedAt', sortOrder: 'desc' };
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = 'ALL';
    if (caseSelect) caseSelect.value = 'ALL';
    if (verifySelect) verifySelect.value = 'ALL';
    closeDetailPanel();
    loadEntities();
  });

  retryBtn?.addEventListener('click', () => loadEntities());

  exportBtn?.addEventListener('click', handleExport);

  closeDetail?.addEventListener('click', closeDetailPanel);
}

// ─── Load Case Options ──────────────────────────────────────────────────────
async function loadCaseOptions() {
  try {
    const data = await getCases({ limit: 100 });
    const select = document.getElementById('filter-case');
    if (!select || !data?.cases) return;
    for (const c of data.cases) {
      const opt = document.createElement('option');
      opt.value = c.caseNumber || c.id;
      opt.textContent = `${c.caseNumber} — ${c.incidentType?.replace(/_/g, ' ')}`;
      select.appendChild(opt);
    }
    if (currentFilters.caseId && currentFilters.caseId !== 'ALL') {
      select.value = currentFilters.caseId;
    }
  } catch {}
}

// ─── Load Entities ───────────────────────────────────────────────────────────
async function loadEntities() {
  const loadingEl = document.getElementById('entities-loading');
  const emptyEl = document.getElementById('entities-empty');
  const errorEl = document.getElementById('entities-error');
  const tablePanel = document.getElementById('entities-table-panel');
  const tbody = document.getElementById('entities-tbody');
  const countEl = document.getElementById('entities-count');

  loadingEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  errorEl.style.display = 'none';
  if (tbody) tbody.innerHTML = '';

  try {
    const params = {};
    if (currentFilters.q) params.q = currentFilters.q;
    if (currentFilters.entityType !== 'ALL') params.entityType = currentFilters.entityType;
    if (currentFilters.caseId !== 'ALL') params.caseId = currentFilters.caseId;
    if (currentFilters.verificationStatus !== 'ALL') params.verificationStatus = currentFilters.verificationStatus;
    params.page = currentFilters.page;
    params.limit = currentFilters.limit;
    params.sortBy = currentFilters.sortBy;
    params.sortOrder = currentFilters.sortOrder;

    const data = await getEntities(params);
    loadingEl.style.display = 'none';

    // Update type summary cards
    renderTypeSummary(data.typeCounts || {}, data.total);

    if (!data.entities || data.entities.length === 0) {
      emptyEl.style.display = 'flex';
      countEl.textContent = '0 entities found';
      renderPagination(0, 1, 1);
      return;
    }

    countEl.textContent = `${data.total} entities found · Page ${data.page} of ${data.totalPages}`;
    renderEntitiesTable(data.entities);
    renderPagination(data.total, data.page, data.totalPages);

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    document.getElementById('entities-error-msg').textContent = err.message || 'Failed to load entities.';
    console.error('[Entities] Load error:', err);
  }
}

// ─── Render Type Summary Cards ───────────────────────────────────────────────
function renderTypeSummary(typeCounts, total) {
  const container = document.getElementById('entity-type-summary');
  if (!container) return;

  const totalCard = `
    <div class="entity-summary-card total-card">
      <div class="summary-card-icon">🧬</div>
      <div class="summary-card-value">${total || 0}</div>
      <div class="summary-card-label">Total Entities</div>
    </div>
  `;

  const typeCards = Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([type, count]) => `
      <button class="entity-summary-card type-filter-card" data-type="${escapeHtml(type)}"
        title="Filter by ${getEntityTypeLabel(type)}">
        <div class="summary-card-icon">${getEntityTypeIcon(type)}</div>
        <div class="summary-card-value">${count}</div>
        <div class="summary-card-label">${getEntityTypeLabel(type)}</div>
      </button>
    `).join('');

  container.innerHTML = totalCard + typeCards;

  // Bind type card clicks to filter
  container.querySelectorAll('.type-filter-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      currentFilters.entityType = type;
      currentFilters.page = 1;
      document.getElementById('filter-entity-type').value = type;
      loadEntities();
    });
  });
}

// ─── Render Entities Table ───────────────────────────────────────────────────
function renderEntitiesTable(entities) {
  const tbody = document.getElementById('entities-tbody');
  if (!tbody) return;

  tbody.innerHTML = entities.map(ent => {
    const typeColor = getEntityTypeColor(ent.entityType);
    const method = getExtractionMethod(ent.confidence);
    const caseNum = ent.evidence?.case?.caseNumber || '—';
    const fileName = ent.evidence?.fileName || '—';
    const isSelected = ent.id === selectedEntityId;

    return `
      <tr class="entity-row ${isSelected ? 'selected' : ''}" data-entity-id="${escapeHtml(ent.id)}">
        <td class="col-type">
          <span class="entity-type-badge" style="--type-color: ${typeColor}">
            ${getEntityTypeIcon(ent.entityType)} ${getEntityTypeLabel(ent.entityType)}
          </span>
        </td>
        <td class="col-value">
          <span class="entity-raw-value" title="${escapeHtml(ent.rawValue)}">${escapeHtml(truncate(ent.rawValue, 32))}</span>
        </td>
        <td class="col-normalized">
          <code class="entity-normalized" title="${escapeHtml(ent.normalizedValue)}">${escapeHtml(truncate(ent.normalizedValue, 32))}</code>
        </td>
        <td class="col-source">
          <a href="evidence-viewer.html?id=${encodeURIComponent(ent.evidenceId)}" class="evidence-link" title="${escapeHtml(fileName)}">
            📄 ${escapeHtml(truncate(fileName, 20))}
          </a>
        </td>
        <td class="col-case">
          <a href="case-detail.html?id=${encodeURIComponent(caseNum)}" class="case-link">${escapeHtml(caseNum)}</a>
        </td>
        <td class="col-confidence">
          <span class="confidence-bar" title="${(ent.confidence * 100).toFixed(0)}%">
            <span class="confidence-fill" style="width: ${ent.confidence * 100}%; background: ${typeColor}"></span>
          </span>
          <span class="confidence-text">${(ent.confidence * 100).toFixed(0)}%</span>
        </td>
        <td class="col-method">
          <span class="method-badge ${method.class}">${method.label}</span>
        </td>
        <td class="col-actions">
          <button class="btn-icon" title="View details" data-action="detail" data-id="${escapeHtml(ent.id)}">🔍</button>
          <a href="evidence-viewer.html?id=${encodeURIComponent(ent.evidenceId)}&highlight=${encodeURIComponent(ent.rawValue)}" class="btn-icon" title="View in evidence">📄</a>
        </td>
      </tr>
    `;
  }).join('');

  // Bind row clicks
  tbody.querySelectorAll('.entity-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('[data-action]')) return;
      const id = row.dataset.entityId;
      if (id) openEntityDetail(id);
    });
  });

  // Bind detail buttons
  tbody.querySelectorAll('[data-action="detail"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEntityDetail(btn.dataset.id);
    });
  });
}

// ─── Pagination ──────────────────────────────────────────────────────────────
function renderPagination(total, page, totalPages) {
  const container = document.getElementById('entities-pagination');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  if (page > 1) html += `<button class="btn btn-sm btn-secondary" data-page="${page-1}">← Prev</button>`;
  html += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
  if (page < totalPages) html += `<button class="btn btn-sm btn-secondary" data-page="${page+1}">Next →</button>`;

  container.innerHTML = html;
  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilters.page = parseInt(btn.dataset.page);
      loadEntities();
    });
  });
}

// ─── Entity Detail Panel ─────────────────────────────────────────────────────
async function openEntityDetail(entityId) {
  selectedEntityId = entityId;
  const panel = document.getElementById('entity-detail-panel');
  const body = document.getElementById('detail-panel-body');
  const title = document.getElementById('detail-panel-title');

  panel.style.display = 'flex';

  // Highlight selected row
  document.querySelectorAll('.entity-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.entityId === entityId);
  });

  body.innerHTML = `<div class="entities-loading" style="display:flex"><div class="loading-spinner"></div><span>Loading entity details...</span></div>`;

  try {
    const data = await getEntityDetail(entityId);
    const ent = data.entity;
    if (!ent) throw new Error('Entity data not available');

    const typeColor = getEntityTypeColor(ent.entityType);
    const method = getExtractionMethod(ent.confidence);

    title.textContent = `${getEntityTypeIcon(ent.entityType)} ${getEntityTypeLabel(ent.entityType)} Details`;

    let html = `
      <!-- Entity Header -->
      <div class="detail-entity-header">
        <span class="entity-type-badge lg" style="--type-color: ${typeColor}">
          ${getEntityTypeIcon(ent.entityType)} ${getEntityTypeLabel(ent.entityType)}
        </span>
        <div class="detail-entity-value">${escapeHtml(ent.normalizedValue)}</div>
      </div>

      <!-- Core Properties -->
      <div class="detail-section">
        <div class="detail-section-title">Identification</div>
        <div class="detail-field-grid">
          <div class="detail-field">
            <span class="detail-field-label">Entity Type</span>
            <span class="detail-field-value">${getEntityTypeLabel(ent.entityType)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Raw Value</span>
            <code class="detail-field-value">${escapeHtml(ent.rawValue)}</code>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Normalized Value</span>
            <code class="detail-field-value">${escapeHtml(ent.normalizedValue)}</code>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Assertion</span>
            <span class="detail-field-value">${escapeHtml(ent.factAssertion || '—')}</span>
          </div>
        </div>
      </div>

      <!-- Extraction Details -->
      <div class="detail-section">
        <div class="detail-section-title">Extraction Provenance</div>
        <div class="detail-field-grid">
          <div class="detail-field">
            <span class="detail-field-label">Confidence</span>
            <span class="detail-field-value">
              <span class="confidence-bar inline" title="${(ent.confidence*100).toFixed(0)}%">
                <span class="confidence-fill" style="width:${ent.confidence*100}%;background:${typeColor}"></span>
              </span>
              ${(ent.confidence*100).toFixed(1)}%
            </span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Extraction Method</span>
            <span class="detail-field-value"><span class="method-badge ${method.class}">${method.label}</span></span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Verification Status</span>
            <span class="detail-field-value">
              <span class="verification-badge ${ent.verificationStatus.toLowerCase()}">${ent.verificationStatus}</span>
            </span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Extracted At</span>
            <span class="detail-field-value">${ent.extractedAt ? new Date(ent.extractedAt).toLocaleString() : '—'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Source Hash</span>
            <code class="detail-field-value hash">${escapeHtml((ent.sourceHash || '').substring(0, 16))}…</code>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">Total Occurrences</span>
            <span class="detail-field-value">${data.totalOccurrences || 1}</span>
          </div>
        </div>
      </div>

      <!-- Source Evidence -->
      <div class="detail-section">
        <div class="detail-section-title">Source Evidence</div>
        ${ent.evidence ? `
          <div class="detail-evidence-card">
            <div class="detail-evidence-name">
              <a href="evidence-viewer.html?id=${encodeURIComponent(ent.evidenceId)}&highlight=${encodeURIComponent(ent.rawValue)}">
                📄 ${escapeHtml(ent.evidence.fileName || '—')}
              </a>
            </div>
            <div class="detail-field-grid">
              <div class="detail-field">
                <span class="detail-field-label">Category</span>
                <span class="detail-field-value">${escapeHtml((ent.evidence.evidenceCategory || '').replace(/_/g, ' '))}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">Case</span>
                <span class="detail-field-value">
                  ${ent.evidence.case ? `<a href="case-detail.html?id=${encodeURIComponent(ent.evidence.case.caseNumber)}">${escapeHtml(ent.evidence.case.caseNumber)}</a>` : '—'}
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">SHA-256</span>
                <code class="detail-field-value hash">${escapeHtml((ent.evidence.sha256Hash || '').substring(0, 16))}…</code>
              </div>
            </div>
          </div>
        ` : '<div class="detail-field-value">Source evidence not available</div>'}
      </div>
    `;

    // Related Facts (other occurrences)
    if (data.relatedFacts && data.relatedFacts.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-section-title">Other Occurrences (${data.relatedFacts.length})</div>
          <div class="detail-related-list">
            ${data.relatedFacts.map(rf => `
              <div class="detail-related-item">
                <a href="evidence-viewer.html?id=${encodeURIComponent(rf.evidenceId)}&highlight=${encodeURIComponent(rf.rawValue)}" class="related-evidence-link">
                  📄 ${escapeHtml(rf.evidence?.fileName || '—')}
                </a>
                <span class="related-case">${escapeHtml(rf.evidence?.case?.caseNumber || '—')}</span>
                <span class="confidence-text">${(rf.confidence*100).toFixed(0)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Cross-Case Links
    if (data.crossCaseLinks && data.crossCaseLinks.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-section-title">⚠ Cross-Case Intelligence (${data.crossCaseLinks.length} linked cases)</div>
          <div class="detail-cross-case-list">
            ${data.crossCaseLinks.map(cl => `
              <div class="detail-cross-case-item">
                <a href="case-detail.html?id=${encodeURIComponent(cl.case?.caseNumber || cl.caseId)}" class="cross-case-link">
                  ${escapeHtml(cl.case?.caseNumber || '—')}
                </a>
                <span class="cross-case-type">${escapeHtml(cl.case?.incidentType?.replace(/_/g, ' ') || '—')}</span>
                <span class="cross-case-status ${(cl.case?.status || '').toLowerCase()}">${escapeHtml(cl.case?.status || '—')}</span>
              </div>
            `).join('')}
          </div>
          <a href="graph.html" class="btn btn-secondary btn-sm" style="margin-top:8px">🕸 View Syndicate Graph</a>
        </div>
      `;
    }

    // Actions
    html += `
      <div class="detail-section detail-actions">
        <a href="evidence-viewer.html?id=${encodeURIComponent(ent.evidenceId)}&highlight=${encodeURIComponent(ent.rawValue)}" class="btn btn-primary btn-sm">📄 View in Evidence</a>
        <a href="case-detail.html?id=${encodeURIComponent(ent.evidence?.case?.caseNumber || '')}" class="btn btn-secondary btn-sm">📋 View Case</a>
        <a href="graph.html" class="btn btn-secondary btn-sm">🕸 Syndicate Graph</a>
      </div>
    `;

    body.innerHTML = html;

  } catch (err) {
    body.innerHTML = `
      <div class="entities-error" style="display:flex">
        <div class="error-icon">⚠</div>
        <div class="error-msg">${escapeHtml(err.message || 'Failed to load entity details.')}</div>
      </div>
    `;
    console.error('[Entity Detail] Error:', err);
  }
}

function closeDetailPanel() {
  const panel = document.getElementById('entity-detail-panel');
  if (panel) panel.style.display = 'none';
  selectedEntityId = null;
  document.querySelectorAll('.entity-row.selected').forEach(r => r.classList.remove('selected'));
}

// ─── Export ──────────────────────────────────────────────────────────────────
async function handleExport() {
  try {
    const params = {};
    if (currentFilters.q) params.q = currentFilters.q;
    if (currentFilters.entityType !== 'ALL') params.entityType = currentFilters.entityType;
    if (currentFilters.caseId !== 'ALL') params.caseId = currentFilters.caseId;
    params.limit = 1000; // Export up to 1000

    const data = await getEntities(params);
    const blob = new Blob([JSON.stringify(data.entities, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rakshak_Entities_Export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', `Exported ${data.entities.length} entities.`);
  } catch (err) {
    showToast('error', 'Export failed: ' + (err.message || ''));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '…' : str;
}
