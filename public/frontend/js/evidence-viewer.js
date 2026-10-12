/**
 * Rakshak — Evidence Viewer Page
 * Forensic evidence analysis view with metadata, content preview,
 * extracted entities, chain of custody, and cross-case intelligence.
 */

import { initLayout } from './layout.js';
import {
  getEvidence, getEvidenceDetail, getEvidenceText, getEvidenceDownloadUrl,
  reverifyEvidence, triggerExtraction, triggerOcr, getEntityDetail, ACTIVE_CASE_ID
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

function getTypeLabel(t) { return ENTITY_TYPE_CONFIG[t]?.label || t; }
function getTypeColor(t) { return ENTITY_TYPE_CONFIG[t]?.color || '#64748b'; }
function getTypeIcon(t) { return ENTITY_TYPE_CONFIG[t]?.icon || '📌'; }
function getMethod(c) {
  if (c >= 0.95) return { label: 'Regex', class: 'method-regex' };
  if (c >= 0.85) return { label: 'Heuristic', class: 'method-heuristic' };
  return { label: 'Contextual', class: 'method-contextual' };
}

// ─── State ───────────────────────────────────────────────────────────────────
let evidenceData = null;
let textContent = null;
let highlightTerm = '';

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout({ activePage: 'vault' });

  const params = new URLSearchParams(window.location.search);
  let evidenceId = params.get('id') || params.get('evidenceId');
  highlightTerm = params.get('highlight') || '';

  if (!evidenceId) {
    const sessionEv = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('rakshak_active_evidence_id') : null;
    if (sessionEv) {
      evidenceId = sessionEv;
    } else {
      try {
        const evList = await getEvidence({ limit: 1 });
        if (evList && evList.evidence && evList.evidence.length > 0) {
          evidenceId = evList.evidence[0].id;
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('id', evidenceId);
          window.history.replaceState({}, '', newUrl.toString());
        }
      } catch (_) {}
    }
  }

  if (!evidenceId) {
    showError('No evidence files found in the vault. Ingest an evidence file from the Evidence Vault first.');
    return;
  }

  loadEvidence(evidenceId);
  bindTabEvents();
  bindActions();
});

// ─── Load Evidence ───────────────────────────────────────────────────────────
async function loadEvidence(id) {
  const loading = document.getElementById('viewer-loading');
  const error = document.getElementById('viewer-error');
  const layout = document.getElementById('viewer-layout');

  try {
    const data = await getEvidenceDetail(id);
    evidenceData = data.evidence;

    loading.style.display = 'none';
    layout.style.display = 'flex';

    renderBreadcrumb();
    renderMetaCard();
    renderActions();
    renderEntityCount();

    // Load content preview
    loadContentPreview(id);

    // Pre-render entities tab
    renderEntitiesTab();

    // Pre-render custody tab
    renderCustodyTab();

    // Pre-render cross-case tab
    renderCrossCaseTab();

  } catch (err) {
    loading.style.display = 'none';
    showError(err.message || 'Failed to load evidence details.');
    console.error('[Viewer] Load error:', err);
  }
}

function showError(msg) {
  document.getElementById('viewer-loading').style.display = 'none';
  const errorEl = document.getElementById('viewer-error');
  errorEl.style.display = 'flex';
  document.getElementById('viewer-error-msg').textContent = msg;
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
function renderBreadcrumb() {
  const el = document.getElementById('viewer-breadcrumb-name');
  if (el) el.textContent = evidenceData.fileName || evidenceData.id;
}

// ─── Metadata Card ───────────────────────────────────────────────────────────
function renderMetaCard() {
  const card = document.getElementById('viewer-meta-card');
  if (!card) return;

  const ev = evidenceData;
  const isVerified = ev.integrityStatus === 'VERIFIED';
  const caseNum = ev.case?.caseNumber || '—';
  const caseTitle = ev.case?.incidentType?.replace(/_/g, ' ') || '—';

  card.innerHTML = `
    <div class="viewer-meta-grid">
      <div class="meta-field">
        <span class="meta-label">Evidence ID</span>
        <code class="meta-value">${escapeHtml(ev.id.substring(0, 12))}…</code>
      </div>
      <div class="meta-field">
        <span class="meta-label">File Name</span>
        <span class="meta-value">${escapeHtml(ev.fileName)}</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Case</span>
        <span class="meta-value">
          <a href="case-detail.html?id=${encodeURIComponent(caseNum)}">${escapeHtml(caseNum)}</a>
          <span class="meta-sub">${escapeHtml(caseTitle)}</span>
        </span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Category</span>
        <span class="meta-value category-badge">${escapeHtml((ev.evidenceCategory || '').replace(/_/g, ' '))}</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">File Size</span>
        <span class="meta-value">${escapeHtml(ev.fileSize)}</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">MIME Type</span>
        <code class="meta-value">${escapeHtml(ev.mimeType)}</code>
      </div>
      <div class="meta-field">
        <span class="meta-label">Uploaded</span>
        <span class="meta-value">${ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleString() : '—'}</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">SHA-256</span>
        <code class="meta-value hash" title="${escapeHtml(ev.sha256Hash)}">${escapeHtml((ev.sha256Hash || '').substring(0, 20))}…</code>
      </div>
      <div class="meta-field">
        <span class="meta-label">Integrity</span>
        <span class="meta-value">
          <span class="integrity-badge ${isVerified ? 'verified' : 'tampered'}">
            ${isVerified ? '✅ VERIFIED' : '⚠ TAMPERED'}
          </span>
        </span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Entities Extracted</span>
        <span class="meta-value">${ev.facts?.length || 0}</span>
      </div>
    </div>
  `;
}

// ─── Actions ─────────────────────────────────────────────────────────────────
function renderActions() {
  const downloadBtn = document.getElementById('btn-download');
  if (downloadBtn && evidenceData) {
    downloadBtn.href = getEvidenceDownloadUrl(evidenceData.id);
  }
}

function bindActions() {
  document.getElementById('btn-run-ocr')?.addEventListener('click', handleRunOcr);
  document.getElementById('btn-re-extract')?.addEventListener('click', handleReExtract);
  document.getElementById('btn-verify')?.addEventListener('click', handleReVerify);
}

async function handleRunOcr() {
  if (!evidenceData) return;
  const btn = document.getElementById('btn-run-ocr');
  const origText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = '⏳ Running OCR…';
    btn.disabled = true;
  }

  try {
    const result = await triggerOcr(evidenceData.id);
    if (result.success) {
      showToast('success', `OCR complete (${result.ocr.engine}): ${result.entitiesCount} entities discovered.`);
    } else {
      showToast('info', `OCR status: ${result.ocr.status} (${result.ocr.charCount} chars)`);
    }
    // Reload evidence to refresh preview and entities
    await loadEvidence(evidenceData.id);
  } catch (err) {
    showToast('error', 'OCR execution failed: ' + (err.message || ''));
    console.error('[Viewer] OCR error:', err);
  } finally {
    if (btn) {
      btn.textContent = origText;
      btn.disabled = false;
    }
  }
}

async function handleReExtract() {
  if (!evidenceData) return;
  const btn = document.getElementById('btn-re-extract');
  const origText = btn.textContent;
  btn.textContent = '⏳ Extracting…';
  btn.disabled = true;

  try {
    const result = await triggerExtraction(evidenceData.id);
    showToast('success', `Extraction complete: ${result.entityCount} entities found.`);
    // Reload the evidence data
    await loadEvidence(evidenceData.id);
  } catch (err) {
    showToast('error', 'Re-extraction failed: ' + (err.message || ''));
    console.error('[Viewer] Re-extract error:', err);
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

async function handleReVerify() {
  if (!evidenceData) return;
  const btn = document.getElementById('btn-verify');
  const origText = btn.textContent;
  btn.textContent = '⏳ Verifying…';
  btn.disabled = true;

  try {
    const result = await reverifyEvidence(evidenceData.id);
    if (result.verified) {
      showToast('success', 'Integrity verified: SHA-256 hashes match.');
    } else {
      showToast('error', `Integrity check failed: ${result.status}`);
    }
    // Reload to update integrity status
    await loadEvidence(evidenceData.id);
  } catch (err) {
    showToast('error', 'Verification failed: ' + (err.message || ''));
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// ─── Tab Switching ───────────────────────────────────────────────────────────
function bindTabEvents() {
  document.querySelectorAll('.viewer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.viewerTab;
      document.querySelectorAll('.viewer-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.viewerTab === targetTab);
        t.setAttribute('aria-selected', t.dataset.viewerTab === targetTab ? 'true' : 'false');
      });
      document.querySelectorAll('.viewer-tab-panel').forEach(p => {
        const panelId = 'panel-' + p.id.replace('panel-', '');
        p.style.display = p.id === `panel-${targetTab}` ? 'block' : 'none';
        p.classList.toggle('active', p.id === `panel-${targetTab}`);
      });
    });
  });
}

function renderEntityCount() {
  const el = document.getElementById('tab-entity-count');
  if (el) el.textContent = evidenceData?.facts?.length || 0;
}

// ─── Content Preview ─────────────────────────────────────────────────────────
async function loadContentPreview(id) {
  const area = document.getElementById('content-preview-area');
  area.innerHTML = `<div class="entities-loading" style="display:flex"><div class="loading-spinner"></div><span>Loading content preview...</span></div>`;

  try {
    const data = await getEvidenceText(id);
    textContent = data;
    renderContentPreview(data);
  } catch (err) {
    area.innerHTML = `
      <div class="content-unavailable">
        <div class="empty-icon">📄</div>
        <div class="empty-title">Content Preview Unavailable</div>
        <div class="empty-desc">${escapeHtml(err.message || 'Failed to load content.')}</div>
        <a href="${getEvidenceDownloadUrl(id)}" class="btn btn-secondary btn-sm" download>⬇ Download Original</a>
      </div>
    `;
  }
}

function renderContentPreview(data) {
  const area = document.getElementById('content-preview-area');

  if (!data.available) {
    area.innerHTML = `
      <div class="content-unavailable">
        <div class="empty-icon">📄</div>
        <div class="empty-title">Content Preview Not Available</div>
        <div class="empty-desc">${escapeHtml(data.message || 'This file type does not support text preview.')}</div>
        ${evidenceData ? `<a href="${getEvidenceDownloadUrl(evidenceData.id)}" class="btn btn-secondary btn-sm" download>⬇ Download Original</a>` : ''}
      </div>
    `;
    return;
  }

  if (data.contentType === 'text') {
    renderTextPreview(data);
  } else if (data.contentType === 'image') {
    renderImagePreview(data);
  } else if (data.contentType === 'pdf') {
    renderPDFPreview(data);
  } else if (data.contentType === 'audio') {
    renderAudioPreview(data);
  } else if (data.contentType === 'video') {
    renderVideoPreview(data);
  } else {
    area.innerHTML = `
      <div class="content-unavailable">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Unsupported Preview Format</div>
        <div class="empty-desc">This file type (${escapeHtml(data.mimeType || '')}) does not have a built-in viewer.</div>
        ${evidenceData ? `<a href="${getEvidenceDownloadUrl(evidenceData.id)}" class="btn btn-secondary btn-sm" download>⬇ Download Original</a>` : ''}
      </div>
    `;
  }
}

function renderTextPreview(data) {
  const area = document.getElementById('content-preview-area');
  const lines = (data.text || '').split(/\r?\n/);
  const facts = evidenceData?.facts || [];

  // Build highlight terms from entities
  const highlightValues = new Set();
  if (highlightTerm) highlightValues.add(highlightTerm);
  facts.forEach(f => { if (f.rawValue) highlightValues.add(f.rawValue); });

  // Search bar for text content
  let html = `
    <div class="text-preview-toolbar">
      <input type="text" class="filter-input" id="text-search-input" placeholder="Search in content..." value="${escapeHtml(highlightTerm)}" />
      <span class="text-line-count">${data.lineCount || lines.length} lines · ${(data.totalCharacters || 0).toLocaleString()} chars</span>
      ${data.truncated ? '<span class="text-truncated-badge">Truncated</span>' : ''}
      ${data.note ? `<span class="text-note">${escapeHtml(data.note)}</span>` : ''}
    </div>
    <div class="text-content-area" id="text-content-area">
  `;

  lines.forEach((line, idx) => {
    let displayLine = escapeHtml(line);

    // Highlight entity matches
    highlightValues.forEach(term => {
      if (term && line.includes(term)) {
        const escaped = escapeHtml(term);
        displayLine = displayLine.replace(
          new RegExp(escapeRegex(escaped), 'g'),
          `<mark class="entity-highlight">${escaped}</mark>`
        );
      }
    });

    html += `<div class="text-line" id="line-${idx + 1}"><span class="line-number">${idx + 1}</span><span class="line-content">${displayLine || '&nbsp;'}</span></div>`;
  });

  html += `</div>`;
  area.innerHTML = html;

  // Scroll to first highlight
  if (highlightTerm) {
    setTimeout(() => {
      const firstHighlight = area.querySelector('.entity-highlight');
      if (firstHighlight) {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  // Bind text search
  const searchInput = document.getElementById('text-search-input');
  let debounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const term = searchInput.value.trim();
      highlightTextContent(term);
    }, 300);
  });
}

function highlightTextContent(term) {
  const lines = document.querySelectorAll('#text-content-area .text-line');
  const facts = evidenceData?.facts || [];
  const allTerms = new Set();
  if (term) allTerms.add(term);
  facts.forEach(f => { if (f.rawValue) allTerms.add(f.rawValue); });

  const sourceText = (textContent?.text || '').split(/\r?\n/);

  lines.forEach((lineEl, idx) => {
    const rawLine = sourceText[idx] || '';
    let display = escapeHtml(rawLine);

    allTerms.forEach(t => {
      if (t && rawLine.includes(t)) {
        const escaped = escapeHtml(t);
        display = display.replace(
          new RegExp(escapeRegex(escaped), 'g'),
          `<mark class="entity-highlight">${escaped}</mark>`
        );
      }
    });

    const contentEl = lineEl.querySelector('.line-content');
    if (contentEl) contentEl.innerHTML = display || '&nbsp;';
  });

  // Scroll to first match
  if (term) {
    const firstHighlight = document.querySelector('#text-content-area .entity-highlight');
    if (firstHighlight) firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderImagePreview(data) {
  const area = document.getElementById('content-preview-area');
  const hasText = data.text && data.text.trim().length > 0;

  area.innerHTML = `
    <div class="ocr-split-view">
      <div class="image-preview-container">
        <img src="${escapeHtml(data.previewUrl)}" alt="Evidence image preview" class="evidence-image-preview"
          onerror="this.parentElement.innerHTML='<div class=\\'content-unavailable\\'><div class=\\'empty-icon\\'>🖼</div><div class=\\'empty-title\\'>Image Load Failed</div></div>'" />
      </div>
      <div class="ocr-text-pane">
        <div class="text-preview-toolbar">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge-status ${data.ocrConfidence > 0 ? 'ready' : 'inactive'}">${escapeHtml(data.ocrEngine || 'TESSERACT_OCR')}</span>
            <span class="text-line-count">${data.ocrConfidence != null ? `Confidence: ${data.ocrConfidence}%` : ''} · ${data.lineCount || 0} lines</span>
          </div>
          ${!hasText ? `<button class="btn btn-primary btn-sm" id="btn-inline-run-ocr">⚡ Run Forensic OCR</button>` : ''}
        </div>
        ${data.ocrNote ? `<div class="ocr-notice">ℹ ${escapeHtml(data.ocrNote)}</div>` : ''}
        ${hasText ? `
          <div class="text-content-area" id="ocr-text-content-area">
            ${(data.text || '').split(/\r?\n/).map((line, idx) => `
              <div class="text-line">
                <span class="line-number">${idx + 1}</span>
                <span class="line-content">${escapeHtml(line) || '&nbsp;'}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state-card" style="margin:20px 0;padding:20px;text-align:center">
            <div style="font-size:24px;margin-bottom:8px">🔍</div>
            <div style="font-size:13px;font-weight:600;color:#f1f5f9">No Extracted Text Displayed</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">Click "Run Forensic OCR" to process this image on-premises.</div>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('btn-inline-run-ocr')?.addEventListener('click', handleRunOcr);
}

function renderPDFPreview(data) {
  const area = document.getElementById('content-preview-area');
  const hasText = data.text && data.text.trim().length > 0;

  area.innerHTML = `
    <div class="ocr-split-view">
      <div class="pdf-preview-container">
        <iframe src="${escapeHtml(data.previewUrl)}" class="evidence-pdf-preview"
          sandbox="allow-same-origin" title="PDF Evidence Preview"></iframe>
      </div>
      <div class="ocr-text-pane">
        <div class="text-preview-toolbar">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge-status ready">${escapeHtml(data.ocrEngine || 'PDF_PARSE')}</span>
            <span class="text-line-count">${data.lineCount || 0} lines · ${(data.totalCharacters || 0).toLocaleString()} chars</span>
          </div>
          ${!hasText ? `<button class="btn btn-primary btn-sm" id="btn-inline-run-pdf-ocr">⚡ Extract Text</button>` : ''}
        </div>
        ${data.ocrNote ? `<div class="ocr-notice">ℹ ${escapeHtml(data.ocrNote)}</div>` : ''}
        ${hasText ? `
          <div class="text-content-area" id="ocr-pdf-text-content-area">
            ${(data.text || '').split(/\r?\n/).map((line, idx) => `
              <div class="text-line">
                <span class="line-number">${idx + 1}</span>
                <span class="line-content">${escapeHtml(line) || '&nbsp;'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-inline-run-pdf-ocr')?.addEventListener('click', handleRunOcr);
}

function renderAudioPreview(data) {
  const area = document.getElementById('content-preview-area');
  area.innerHTML = `
    <div class="audio-preview-container">
      <div class="audio-icon">🔊</div>
      <audio controls preload="metadata" class="evidence-audio-preview">
        <source src="${escapeHtml(data.previewUrl)}" type="${escapeHtml(data.mimeType || 'audio/mpeg')}" />
        Your browser does not support audio playback.
      </audio>
      <div class="audio-notice">Audio playback from original evidence file. No transcription available without ASR backend.</div>
    </div>
  `;
}

function renderVideoPreview(data) {
  const area = document.getElementById('content-preview-area');
  area.innerHTML = `
    <div class="video-preview-container">
      <video controls preload="metadata" class="evidence-video-preview">
        <source src="${escapeHtml(data.previewUrl)}" type="${escapeHtml(data.mimeType || 'video/mp4')}" />
        Your browser does not support video playback.
      </video>
    </div>
  `;
}

// ─── Entities Tab ────────────────────────────────────────────────────────────
function renderEntitiesTab() {
  const facts = evidenceData?.facts || [];
  const summaryEl = document.getElementById('viewer-entities-summary');
  const tbody = document.getElementById('viewer-entities-tbody');
  const emptyEl = document.getElementById('viewer-entities-empty');

  if (facts.length === 0) {
    emptyEl.style.display = 'flex';
    summaryEl.innerHTML = '';
    tbody.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';

  // Summary by type
  const typeCounts = {};
  facts.forEach(f => { typeCounts[f.entityType] = (typeCounts[f.entityType] || 0) + 1; });

  summaryEl.innerHTML = `
    <div class="extraction-summary-row">
      <div class="extraction-summary-card">
        <div class="summary-card-value">${facts.length}</div>
        <div class="summary-card-label">Total Entities</div>
      </div>
      ${Object.entries(typeCounts).map(([type, count]) => `
        <div class="extraction-summary-card">
          <div class="summary-card-value" style="color:${getTypeColor(type)}">${count}</div>
          <div class="summary-card-label">${getTypeLabel(type)}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Entity table
  tbody.innerHTML = facts.map(f => {
    const method = getMethod(f.confidence);
    return `
      <tr class="entity-row" data-entity-id="${escapeHtml(f.id)}">
        <td>
          <span class="entity-type-badge" style="--type-color: ${getTypeColor(f.entityType)}">
            ${getTypeIcon(f.entityType)} ${getTypeLabel(f.entityType)}
          </span>
        </td>
        <td><span class="entity-raw-value">${escapeHtml(f.rawValue)}</span></td>
        <td><code class="entity-normalized">${escapeHtml(f.normalizedValue)}</code></td>
        <td>
          <span class="confidence-bar" title="${(f.confidence*100).toFixed(0)}%">
            <span class="confidence-fill" style="width:${f.confidence*100}%;background:${getTypeColor(f.entityType)}"></span>
          </span>
          <span class="confidence-text">${(f.confidence*100).toFixed(0)}%</span>
        </td>
        <td><span class="method-badge ${method.class}">${method.label}</span></td>
        <td>
          <button class="btn-icon" data-action="navigate" data-value="${escapeHtml(f.rawValue)}" title="Navigate to in content">📍</button>
          <a href="entities.html?q=${encodeURIComponent(f.normalizedValue)}" class="btn-icon" title="Search across all evidence">🔎</a>
        </td>
      </tr>
    `;
  }).join('');

  // Bind navigation actions
  tbody.querySelectorAll('[data-action="navigate"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      // Switch to content tab and highlight
      document.querySelector('[data-viewer-tab="content"]')?.click();
      setTimeout(() => highlightTextContent(value), 100);
    });
  });

  // Bind entity search
  const searchInput = document.getElementById('viewer-entity-search');
  searchInput?.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    tbody.querySelectorAll('.entity-row').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

// ─── Custody Tab ─────────────────────────────────────────────────────────────
function renderCustodyTab() {
  const container = document.getElementById('custody-timeline-list');
  const events = evidenceData?.custodyEvents || [];

  if (events.length === 0) {
    container.innerHTML = `
      <div class="content-unavailable">
        <div class="empty-icon">🔗</div>
        <div class="empty-title">No Custody Events</div>
        <div class="empty-desc">No chain-of-custody events have been recorded for this evidence.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map((evt, idx) => `
    <div class="custody-event">
      <div class="custody-event-marker">
        <span class="custody-dot ${evt.result === 'SUCCESS' || evt.result === 'VERIFIED' ? 'success' : evt.result === 'FAILED' ? 'danger' : 'warning'}"></span>
        ${idx < events.length - 1 ? '<span class="custody-line"></span>' : ''}
      </div>
      <div class="custody-event-content">
        <div class="custody-event-header">
          <span class="custody-event-type">${escapeHtml(evt.eventType?.replace(/_/g, ' '))}</span>
          <span class="custody-event-result ${(evt.result || '').toLowerCase()}">${escapeHtml(evt.result)}</span>
        </div>
        <div class="custody-event-action">${escapeHtml(evt.action)}</div>
        <div class="custody-event-meta">
          <span class="custody-event-actor">${escapeHtml(evt.actor)}</span>
          <span class="custody-event-time">${evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── Cross-Case Tab ──────────────────────────────────────────────────────────
function renderCrossCaseTab() {
  const container = document.getElementById('cross-case-content');
  const matches = evidenceData?.crossCaseMatches || [];

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="content-unavailable">
        <div class="empty-icon">🕸</div>
        <div class="empty-title">No Cross-Case Links</div>
        <div class="empty-desc">No entities from this evidence appear in other cases. Cross-case intelligence is generated when shared entities are detected.</div>
      </div>
    `;
    return;
  }

  // Group by case
  const caseMap = {};
  matches.forEach(m => {
    const key = m.otherCaseNumber;
    if (!caseMap[key]) caseMap[key] = { ...m, entities: [] };
    caseMap[key].entities.push({ type: m.entityType, value: m.normalizedValue });
  });

  container.innerHTML = `
    <div class="cross-case-warning">
      ⚠ <strong>${matches.length} shared entities</strong> found across <strong>${Object.keys(caseMap).length} other case(s)</strong>.
      Cross-case linkage indicates potential syndicate activity. This information does not independently establish criminal connection.
    </div>
    <div class="cross-case-list">
      ${Object.values(caseMap).map(c => `
        <div class="cross-case-card">
          <div class="cross-case-card-header">
            <a href="case-detail.html?id=${encodeURIComponent(c.otherCaseNumber)}" class="cross-case-number">${escapeHtml(c.otherCaseNumber)}</a>
            <span class="cross-case-status ${(c.otherCaseStatus || '').toLowerCase()}">${escapeHtml(c.otherCaseStatus)}</span>
          </div>
          <div class="cross-case-card-body">
            <div class="cross-case-type">${escapeHtml(c.otherCaseIncidentType?.replace(/_/g, ' ') || '—')}</div>
            <div class="cross-case-complainant">${escapeHtml(c.otherCaseComplainant || '—')}</div>
            <div class="cross-case-entities">
              ${c.entities.map(e => `
                <span class="entity-type-badge sm" style="--type-color: ${getTypeColor(e.type)}">
                  ${getTypeIcon(e.type)} ${escapeHtml(e.value)}
                </span>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <a href="graph.html" class="btn btn-secondary btn-sm" style="margin-top:12px">🕸 View Full Syndicate Graph</a>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
