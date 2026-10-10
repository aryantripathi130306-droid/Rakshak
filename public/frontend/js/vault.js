/**
 * Rakshak — Evidence Vault Page Script (Phase 3)
 * Full-stack forensic workstation for digital evidence ingestion,
 * cryptographic dual-hash verification, content-addressed storage,
 * and BSA Section 63 immutable chain of custody.
 */

import {
  getEvidence, getEvidenceDetail, reverifyEvidence, getEvidenceCustody,
  logCustodyEvent, getEvidenceDownloadUrl, uploadEvidence, getCases, ACTIVE_CASE_ID
} from './api.js';
import {
  computeSHA256, formatUTC, renderCategoryBadge, renderEntityChip,
  escapeHtml, showToast, copyToClipboard, truncateHash,
  CATEGORY_CONFIG, getEntityColor, $
} from './utils.js';
import { initLayout } from './layout.js';

// ─── State ────────────────────────────────────────────────────────────────────
let evidenceList = [];
let allCases = [];
let isLiveDb = false;
let selectedCategory = 'ALL';
let selectedCaseFilter = 'ALL';
let selectedStatusFilter = 'ALL';
let searchQuery = '';
let uploadingFiles = {};     // { [filename]: { progress, status, hash, error } }
let inspectorEvidenceId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  initTabBar();
  initDropzone();
  initSearchAndFilters();
  initCategoryFilter();
  await loadCasesList();
  await fetchEvidence();
  initInspectorEvents();
});

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function initTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const pane = document.getElementById(`tab-${tab}`);
      if (pane) pane.classList.add('active');

      if (tab === 'checklist') {
        renderChecklistSummary();
      }
    });
  });
}

// ─── Load Cases for Dropdowns ─────────────────────────────────────────────────
async function loadCasesList() {
  try {
    const res = await getCases({ limit: 100 });
    if (res?.cases?.length > 0) {
      allCases = res.cases;

      // Populate Upload Case Select
      const uploadSelect = document.getElementById('upload-case-select');
      if (uploadSelect) {
        uploadSelect.innerHTML = allCases.map(c => `
          <option value="${escapeHtml(c.caseNumber)}" ${c.caseNumber === ACTIVE_CASE_ID ? 'selected' : ''}>
            ${escapeHtml(c.caseNumber)} · ${escapeHtml(c.complainantName)} (${escapeHtml(c.incidentType || 'Case')})
          </option>
        `).join('');
      }

      // Populate Filter Case Select
      const filterSelect = document.getElementById('filter-case-select');
      if (filterSelect) {
        filterSelect.innerHTML = `
          <option value="ALL">All Cases</option>
          ${allCases.map(c => `
            <option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} · ${escapeHtml(c.complainantName)}</option>
          `).join('')}
        `;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch cases list for dropdowns:', err);
  }
}

// ─── Evidence Fetching ────────────────────────────────────────────────────────
async function fetchEvidence() {
  const tableBody = document.getElementById('evidence-rows');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="10" class="loading-row"><span class="spinner"></span> Loading evidence vault assets…</td></tr>`;
  }

  try {
    const params = {};
    if (searchQuery) params.q = searchQuery;
    if (selectedCategory !== 'ALL') params.category = selectedCategory;
    if (selectedCaseFilter !== 'ALL') params.caseId = selectedCaseFilter;
    if (selectedStatusFilter !== 'ALL') params.status = selectedStatusFilter;

    const data = await getEvidence(params);
    if (data?.evidence) {
      evidenceList = data.evidence;
      isLiveDb = true;
    }
  } catch (err) {
    console.warn('API error fetching evidence:', err);
    isLiveDb = false;
    evidenceList = [];
  }

  renderCategoryFilter();
  renderEvidenceTable();
  updateLiveBadge();
}

// ─── Search & Filters ─────────────────────────────────────────────────────────
function initSearchAndFilters() {
  const searchInput = document.getElementById('evidence-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        searchQuery = e.target.value.trim();
        fetchEvidence();
      }, 250);
    });
  }

  const filterCaseSelect = document.getElementById('filter-case-select');
  if (filterCaseSelect) {
    filterCaseSelect.addEventListener('change', e => {
      selectedCaseFilter = e.target.value;
      fetchEvidence();
    });
  }

  const filterStatusSelect = document.getElementById('filter-status-select');
  if (filterStatusSelect) {
    filterStatusSelect.addEventListener('change', e => {
      selectedStatusFilter = e.target.value;
      fetchEvidence();
    });
  }

  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchQuery = '';
      selectedCategory = 'ALL';
      selectedCaseFilter = 'ALL';
      selectedStatusFilter = 'ALL';

      if (searchInput) searchInput.value = '';
      if (filterCaseSelect) filterCaseSelect.value = 'ALL';
      if (filterStatusSelect) filterStatusSelect.value = 'ALL';

      fetchEvidence();
    });
  }
}

// ─── Category Filter Chips ───────────────────────────────────────────────────
function initCategoryFilter() {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;
  bar.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    selectedCategory = chip.dataset.category || 'ALL';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    fetchEvidence();
  });
}

function renderCategoryFilter() {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;

  const categories = Object.keys(CATEGORY_CONFIG);
  const totalCount = evidenceList.length;

  let html = `<button class="filter-chip ${selectedCategory === 'ALL' ? 'active' : ''}" data-category="ALL">
    All Categories <span class="filter-chip-count">${totalCount}</span>
  </button>`;

  categories.forEach(cat => {
    const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER;
    const count = evidenceList.filter(e => e.evidenceCategory === cat).length;
    if (count > 0 || selectedCategory === cat) {
      html += `<button class="filter-chip ${selectedCategory === cat ? 'active' : ''}" data-category="${escapeHtml(cat)}"
        style="--chip-color:${cfg.color}">
        <span>${cfg.icon}</span>
        <span>${escapeHtml(cfg.label)}</span>
        <span class="filter-chip-count">${count}</span>
      </button>`;
    }
  });

  bar.innerHTML = html;
}

// ─── Evidence Table ───────────────────────────────────────────────────────────
function renderEvidenceTable() {
  const tbody = document.getElementById('evidence-rows');
  if (!tbody) return;

  if (evidenceList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-state-icon">🛡</div>
        <div class="empty-state-title">${searchQuery || selectedCategory !== 'ALL' || selectedCaseFilter !== 'ALL' ? 'No matching evidence found' : 'Evidence Vault Empty'}</div>
        <div class="empty-state-text">
          ${searchQuery || selectedCategory !== 'ALL' || selectedCaseFilter !== 'ALL'
            ? 'Try broadening your search query or resetting filters.'
            : 'Drop files into the upload area above to begin cryptographic intake.'}
        </div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = evidenceList.map((ev) => {
    const catCfg = CATEGORY_CONFIG[ev.evidenceCategory || 'OTHER'] || CATEGORY_CONFIG.OTHER;
    const isVerified = ev.integrityStatus === 'VERIFIED';
    const hashShort = truncateHash(ev.sha256Hash || '', 10);
    const ts = ev.uploadedAt ? formatUTC(ev.uploadedAt) : '—';
    const caseRef = ev.case?.caseNumber || ev.caseId || '—';

    const integrityClass = isVerified ? 'badge-green' : 'badge-red';
    const integrityLabel = isVerified ? '✓ VERIFIED' : '✕ TAMPERED';

    return `<tr class="ev-row" data-ev-id="${escapeHtml(ev.id)}">
      <td><span class="ev-id" title="${escapeHtml(ev.id)}">${escapeHtml(ev.id ? ev.id.substring(0, 14) + (ev.id.length > 14 ? '…' : '') : '—')}</span></td>
      <td>
        <div class="ev-filename">
          <span style="font-size:13px">${catCfg.icon}</span>
          <span title="${escapeHtml(ev.fileName)}">${escapeHtml(ev.fileName || '—')}</span>
        </div>
      </td>
      <td>
        <span class="badge border" style="font-size:9px;border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--text-secondary)">
          ${escapeHtml(caseRef)}
        </span>
      </td>
      <td>${renderCategoryBadge(ev.evidenceCategory || 'OTHER')}</td>
      <td><span class="ev-filetype">${escapeHtml(ev.fileType || '—')}</span></td>
      <td><span class="ev-filesize">${escapeHtml(ev.fileSize || '—')}</span></td>
      <td>
        <span class="ev-hash" data-hash="${escapeHtml(ev.sha256Hash || '')}"
          title="${escapeHtml(ev.sha256Hash || '')} — click to copy">
          ${escapeHtml(hashShort)}
          <span style="font-size:9px;opacity:0.6">⧉</span>
        </span>
      </td>
      <td><span class="ev-timestamp">${escapeHtml(ts)}</span></td>
      <td>
        <span class="badge border ${integrityClass}" style="border:1px solid">
          ${integrityLabel}
        </span>
      </td>
      <td style="text-align:right">
        <div class="ev-actions" style="justify-content:flex-end">
          <a class="ev-action-btn" href="./evidence-viewer.html?id=${encodeURIComponent(ev.id)}" title="Open Full Evidence Viewer & Entity Analysis">
            🔬 Analyze
          </a>
          <button class="ev-action-btn inspect-btn" data-ev-id="${escapeHtml(ev.id)}" title="Open Evidence Inspector">
            👁 Inspect
          </button>
          <button class="ev-action-btn reverify-btn" data-ev-id="${escapeHtml(ev.id)}" title="Run Cryptographic Re-Verification on Disk">
            🔄 Audit
          </button>
          <a class="ev-action-btn" href="${getEvidenceDownloadUrl(ev.id)}" download title="Download Original Evidence File">
            ⬇
          </a>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind hash copy buttons
  tbody.querySelectorAll('.ev-hash').forEach(el => {
    el.addEventListener('click', async () => {
      const hash = el.dataset.hash;
      if (hash) {
        await copyToClipboard(hash);
        showToast('success', 'SHA-256 hash copied to clipboard');
      }
    });
  });

  // Bind Inspect buttons
  tbody.querySelectorAll('.inspect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openInspector(btn.dataset.evId);
    });
  });

  // Bind Row Click to inspect (when not clicking actions or hash)
  tbody.querySelectorAll('.ev-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.ev-actions') || e.target.closest('.ev-hash')) return;
      openInspector(row.dataset.evId);
    });
  });

  // Bind Re-verify buttons
  tbody.querySelectorAll('.reverify-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const evId = btn.dataset.evId;
      btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span>';
      try {
        const res = await reverifyEvidence(evId);
        if (res.verified) {
          showToast('success', `✓ Cryptographic Audit Passed for ${res.fileName}`);
        } else {
          showToast('error', `✕ Integrity Alert: ${res.status} for ${res.fileName}`);
        }
        if (inspectorEvidenceId === evId) {
          openInspector(evId);
        }
      } catch (err) {
        showToast('error', `Audit failed: ${err.message}`);
      } finally {
        btn.innerHTML = '🔄 Audit';
      }
    });
  });
}

function updateLiveBadge() {
  const badge = document.getElementById('evidence-live-badge');
  if (!badge) return;
  const count = evidenceList.length;
  if (isLiveDb) {
    badge.className = 'evidence-live-badge live';
    badge.innerHTML = `<span class="evidence-live-dot"></span> ${count} ASSETS · LIVE FORENSIC VAULT`;
  } else {
    badge.className = 'evidence-live-badge';
    badge.textContent = `${count} ASSETS · COLD STORAGE`;
  }
}

// ─── Dropzone & Ingestion Flow ────────────────────────────────────────────────
function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFiles(e.target.files);
    e.target.value = '';  // allow re-uploading same file
  });
}

async function handleFiles(fileList) {
  const targetCaseSelect = document.getElementById('upload-case-select');
  const targetCategorySelect = document.getElementById('upload-category-select');
  const tamperCheckbox = document.getElementById('tamper-test-checkbox');

  const caseId = targetCaseSelect?.value || ACTIVE_CASE_ID;
  const categoryOverride = targetCategorySelect?.value || undefined;
  const simulateTampering = tamperCheckbox?.checked || false;

  for (const file of Array.from(fileList)) {
    await processUpload(file, caseId, categoryOverride, simulateTampering);
  }
}

async function processUpload(file, caseId, categoryOverride, simulateTampering) {
  const key = file.name + '_' + Date.now();
  uploadingFiles[key] = {
    name: file.name,
    progress: 15,
    status: 'Computing WebCrypto SHA-256…',
    hash: '',
  };
  renderUploadQueue();

  try {
    // Step 1: Compute real client-side SHA-256 using WebCrypto API
    const realClientHash = await computeSHA256(file);
    let submittedHash = realClientHash;

    if (simulateTampering) {
      // Deliberately tamper submitted client hash to demonstrate rejection
      submittedHash = '0000000000000000000000000000000000000000000000000000000000000000';
      uploadingFiles[key] = {
        ...uploadingFiles[key],
        progress: 45,
        hash: submittedHash,
        status: 'Transmitting Tampered Digest (Simulating Attack)…',
      };
    } else {
      uploadingFiles[key] = {
        ...uploadingFiles[key],
        progress: 45,
        hash: realClientHash,
        status: `Pre-hash: ${realClientHash.substring(0, 12)}… Transmitting…`,
      };
    }
    renderUploadQueue();

    // Step 2: Upload to backend for independent verification & cold storage
    const result = await uploadEvidence(file, caseId, submittedHash, categoryOverride);

    uploadingFiles[key] = {
      ...uploadingFiles[key],
      progress: 100,
      hash: result.sha256Hash || realClientHash,
      status: 'Dual-Hash Verified & Cold-Stored ✓',
    };
    renderUploadQueue();
    showToast('success', `${file.name} — Ingested & Verified successfully`);

    // Refresh evidence list & checklist
    await fetchEvidence();
  } catch (err) {
    uploadingFiles[key] = {
      ...uploadingFiles[key],
      progress: 100,
      status: `Integrity Alert: ${err.message || 'Upload failed'}`,
      error: true,
    };
    renderUploadQueue();
    showToast('error', `Ingestion Blocked: ${err.message || 'Verification failure'}`);
  }

  // Remove from queue after 5s
  setTimeout(() => {
    delete uploadingFiles[key];
    renderUploadQueue();
  }, 5000);
}

function renderUploadQueue() {
  const container = document.getElementById('upload-queue-items');
  if (!container) return;

  const items = Object.values(uploadingFiles);
  if (items.length === 0) {
    container.innerHTML = `
      <div class="upload-queue-empty">
        <div class="upload-queue-empty-icon">✓</div>
        <div style="color:var(--text-muted);font-size:11px">Queue empty</div>
        <div style="color:var(--text-muted);font-size:9px;margin-top:2px">Ready for forensic ingestion</div>
      </div>`;
    return;
  }

  container.innerHTML = items.map(f => `
    <div class="upload-item">
      <div class="upload-item-header">
        <span class="upload-item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="upload-item-pct">${f.progress}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${f.progress === 100 && !f.error ? 'success' : f.error ? 'error' : ''}"
          style="width:${f.progress}%"></div>
      </div>
      ${f.status ? `<div class="upload-item-status ${f.progress === 100 && !f.error ? 'done' : f.error ? 'errored' : ''}">
        ${escapeHtml(f.status)}
      </div>` : ''}
    </div>
  `).join('');
}

// ─── Evidence Inspector ───────────────────────────────────────────────────────
async function openInspector(evId) {
  inspectorEvidenceId = evId;
  const panel = document.getElementById('inspector-panel');
  const body = document.getElementById('inspector-body');
  if (!panel || !body) return;

  panel.style.display = 'flex';
  body.innerHTML = `<div class="loading-row"><span class="spinner"></span> Loading forensic details…</div>`;

  try {
    const data = await getEvidenceDetail(evId);
    if (data?.evidence) {
      renderInspectorContent(data.evidence);
    } else {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-title">Evidence record not found</div></div>`;
    }
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load evidence details</div><div class="empty-state-text">${escapeHtml(err.message)}</div></div>`;
  }
}

function closeInspector() {
  const panel = document.getElementById('inspector-panel');
  if (panel) panel.style.display = 'none';
  inspectorEvidenceId = null;
}

function initInspectorEvents() {
  const closeBtn = document.getElementById('inspector-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeInspector);
}

function renderInspectorContent(ev) {
  const body = document.getElementById('inspector-body');
  if (!body) return;

  const catCfg = CATEGORY_CONFIG[ev.evidenceCategory || 'OTHER'] || CATEGORY_CONFIG.OTHER;
  const ver = ev.verificationDetails || {};
  const isVerified = ev.integrityStatus === 'VERIFIED';
  const downloadUrl = getEvidenceDownloadUrl(ev.id);
  const previewUrl = getEvidenceDownloadUrl(ev.id, true);

  // 1. Verification Card HTML
  let verifyCardHtml = '';
  if (isVerified && ver.fileExistsOnDisk) {
    verifyCardHtml = `
      <div class="verify-report-card verified">
        <div class="verify-report-header">
          <span>✓ CRYPTOGRAPHIC INTEGRITY VERIFIED</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px">BSA §63 VALID</span>
        </div>
        <div style="font-size:10px;line-height:1.4">
          Dual SHA-256 match confirmed. Physical bytes on disk match canonical server digest.
        </div>
      </div>
    `;
  } else if (!ver.fileExistsOnDisk) {
    verifyCardHtml = `
      <div class="verify-report-card missing">
        <div class="verify-report-header">
          <span>⚠ COLD STORAGE ASSET PENDING</span>
        </div>
        <div style="font-size:10px;line-height:1.4">
          Database metadata record is active. Cold storage physical binary was not found at standard path.
        </div>
      </div>
    `;
  } else {
    verifyCardHtml = `
      <div class="verify-report-card tampered">
        <div class="verify-report-header">
          <span>✕ INTEGRITY VIOLATION DETECTED</span>
        </div>
        <div style="font-size:10px;line-height:1.4">
          Submitted client digest differs from server computed hash. Evidence is not admissible.
        </div>
      </div>
    `;
  }

  // 2. Safe Preview HTML
  let previewHtml = '';
  const mime = (ev.mimeType || '').toLowerCase();
  const fileExt = (ev.fileType || '').toUpperCase();

  if (mime.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(fileExt)) {
    previewHtml = `
      <div class="ev-preview-box">
        <div class="ev-preview-header">
          <span>📷 FORENSIC IMAGE PREVIEW</span>
          <span>${escapeHtml(ev.fileSize)}</span>
        </div>
        <div class="ev-preview-img-wrap">
          <img src="${previewUrl}" class="ev-preview-img" alt="Forensic Evidence Preview" onerror="this.parentElement.innerHTML='<div style=\\'color:var(--text-muted);font-size:10px;padding:12px\\'>Preview image unavailable</div>'" />
        </div>
      </div>
    `;
  } else if (mime.startsWith('audio/') || ['MP3', 'WAV', 'OGG'].includes(fileExt)) {
    previewHtml = `
      <div class="ev-preview-box">
        <div class="ev-preview-header">
          <span>🎙 AUDIO RECORDING PLAYBACK</span>
          <span>${escapeHtml(ev.fileSize)}</span>
        </div>
        <div class="ev-preview-audio">
          <audio controls src="${previewUrl}" style="width:100%"></audio>
        </div>
      </div>
    `;
  } else if (mime === 'text/plain' || mime === 'message/rfc822' || ['TXT', 'EML', 'JSON', 'LOG'].includes(fileExt)) {
    previewHtml = `
      <div class="ev-preview-box">
        <div class="ev-preview-header">
          <span>📄 TEXT / EML FORENSIC PREVIEW</span>
          <button class="btn btn-secondary btn-sm" id="load-text-preview-btn" style="font-size:9px;padding:2px 6px;">Load Text</button>
        </div>
        <pre class="ev-preview-text" id="text-preview-content">Click "Load Text" to stream read-only evidence contents…</pre>
      </div>
    `;
  }

  // 3. Extracted Facts HTML
  const factsList = ev.facts || [];
  const entityChips = factsList.map(ent =>
    `<div class="inspector-entity-item">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
        ${renderEntityChip({ type: ent.entityType, value: ent.normalizedValue, confidence: ent.confidence })}
        <span class="inspector-entity-value truncate" title="${escapeHtml(ent.factAssertion || ent.rawValue)}">${escapeHtml(ent.factAssertion || ent.rawValue)}</span>
      </div>
      <span class="inspector-confidence">${Math.round((ent.confidence || 0) * 100)}%</span>
    </div>`
  ).join('') || '<div style="color:var(--text-muted);font-size:10px">No entities extracted from this asset.</div>';

  // 4. Syndicate Cross-Case Matches
  const crossMatches = ev.crossCaseMatches || [];
  let crossMatchesHtml = '';
  if (crossMatches.length > 0) {
    crossMatchesHtml = crossMatches.map(m => `
      <div class="cross-case-card">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:9px;color:var(--text-muted);font-weight:600">${escapeHtml(m.entityType)}: ${escapeHtml(m.normalizedValue)}</span>
          <a href="./case-detail.html?caseId=${encodeURIComponent(m.otherCaseNumber)}" class="cross-case-link">
            🔗 ${escapeHtml(m.otherCaseNumber)} · ${escapeHtml(m.otherCaseComplainant)}
          </a>
        </div>
        <span class="badge badge-amber" style="font-size:8px">${escapeHtml(m.otherCaseIncidentType || 'Case')}</span>
      </div>
    `).join('');
  } else {
    crossMatchesHtml = '<div style="color:var(--text-muted);font-size:10px">No cross-case syndicate linkages for these entities.</div>';
  }

  // 5. Timeline Events HTML
  const timelineRefs = ev.timelineRefs || [];
  let timelineRefsHtml = '';
  if (timelineRefs.length > 0) {
    timelineRefsHtml = timelineRefs.map(t => `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:6px 8px;margin-bottom:4px;font-size:10px">
        <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:9px;font-family:'JetBrains Mono',monospace;margin-bottom:2px">
          <span>${formatUTC(t.timestamp)}</span>
          <span class="badge border" style="font-size:8px">${escapeHtml(t.phase)}</span>
        </div>
        <div style="color:var(--text-primary)">${escapeHtml(t.description)}</div>
      </div>
    `).join('');
  } else {
    timelineRefsHtml = '<div style="color:var(--text-muted);font-size:10px">No timeline events linked to this asset.</div>';
  }

  // 6. Chain of Custody Events HTML
  const custodyList = ev.custodyEvents || [];
  const custodyHtml = custodyList.map(c => `
    <div class="custody-entry ${c.result === 'FAILED' ? 'danger' : c.eventType === 'INTEGRITY_AUDIT' ? 'audit' : ''}">
      <div class="custody-header">
        <span class="custody-actor">${escapeHtml(c.actor || 'Forensic System')}</span>
        <span class="custody-time">${formatUTC(c.timestamp)}</span>
      </div>
      <div class="custody-action">${escapeHtml(c.action)}</div>
      <span class="custody-badge ${escapeHtml(c.result || 'SUCCESS')}">${escapeHtml(c.eventType)} · ${escapeHtml(c.result)}</span>
    </div>
  `).join('') || '<div style="color:var(--text-muted);font-size:10px">No chain of custody records recorded yet.</div>';

  body.innerHTML = `
    <!-- Evidence Header -->
    <div class="inspector-ev-header">
      <span class="inspector-ev-icon">${catCfg.icon}</span>
      <div style="flex:1;min-width:0">
        <div class="inspector-ev-name" title="${escapeHtml(ev.fileName)}">${escapeHtml(ev.fileName || '—')}</div>
        <div class="inspector-ev-id">${escapeHtml(ev.id || '')}</div>
      </div>
      <a class="btn btn-secondary btn-sm" href="${downloadUrl}" download title="Download Original Binary">
        ⬇ Export
      </a>
    </div>

    <!-- Verification Card -->
    ${verifyCardHtml}

    <!-- Safe Preview -->
    ${previewHtml}

    <!-- Actions Row -->
    <div style="display:flex;gap:6px;margin:12px 0;flex-wrap:wrap;">
      <a class="btn btn-primary btn-sm" href="./evidence-viewer.html?id=${encodeURIComponent(ev.id)}" style="flex:1;text-align:center;font-size:10px;">
        🔬 Full Evidence Viewer
      </a>
      <button class="btn btn-secondary btn-sm" id="btn-reverify-inspector" style="flex:1;font-size:10px;">
        🔄 Live Digest Audit
      </button>
      <a class="btn btn-secondary btn-sm" href="./case-detail.html?caseId=${encodeURIComponent(ev.case?.caseNumber || ev.caseId || '')}" style="flex:1;text-align:center;font-size:10px;">
        📁 Case: ${escapeHtml(ev.case?.caseNumber || ev.caseId || 'Open')}
      </a>
    </div>

    <!-- Fields -->
    <div class="inspector-section-title">EVIDENCE METADATA</div>
    <div class="inspector-field">
      <div class="inspector-field-label">CATEGORY</div>
      <div>${renderCategoryBadge(ev.evidenceCategory || 'OTHER')}</div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">ASSOCIATED CASE</div>
      <div class="inspector-field-value">
        ${escapeHtml(ev.case?.caseNumber || ev.caseId || '—')} · ${escapeHtml(ev.case?.complainantName || 'Complainant')}
      </div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">FILE TYPE & MIME</div>
      <div class="inspector-field-value">${escapeHtml(ev.fileType || '—')} · ${escapeHtml(ev.mimeType || '—')}</div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">FILE SIZE</div>
      <div class="inspector-field-value">${escapeHtml(ev.fileSize || '—')} (${ev.rawFileSize || 0} bytes)</div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">UPLOAD TIMESTAMP (UTC)</div>
      <div class="inspector-field-value">${escapeHtml(ev.uploadedAt ? formatUTC(ev.uploadedAt) : '—')}</div>
    </div>

    <div class="inspector-divider"></div>

    <!-- SHA-256 Hashes -->
    <div class="inspector-section-title">CRYPTOGRAPHIC DUAL HASHES</div>
    <div class="inspector-field">
      <div class="inspector-field-label">CANONICAL SERVER SHA-256</div>
      <div class="hash-display">
        <span style="word-break:break-all">${escapeHtml(ev.sha256Hash || '—')}</span>
        <button class="hash-copy-btn" data-hash="${escapeHtml(ev.sha256Hash || '')}" title="Copy hash">⧉</button>
      </div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">CLIENT PRE-TRANSIT HASH</div>
      <div class="hash-display">
        <span style="word-break:break-all">${escapeHtml(ev.clientHash || '—')}</span>
        <button class="hash-copy-btn" data-hash="${escapeHtml(ev.clientHash || '')}" title="Copy hash">⧉</button>
      </div>
    </div>
    <div class="inspector-field">
      <div class="inspector-field-label">STORAGE REFERENCE</div>
      <div class="inspector-field-value" style="font-size:9px;color:var(--text-muted)">
        ${escapeHtml(ev.storagePath || `/uploads/raw/${ev.sha256Hash}.bin`)}
      </div>
    </div>

    <div class="inspector-divider"></div>

    <!-- Extracted Facts -->
    <div class="inspector-section-title">EXTRACTED ENTITIES (${factsList.length})</div>
    <div class="inspector-entity-list">${entityChips}</div>

    <div class="inspector-divider"></div>

    <!-- Cross-Case Syndicate Matches -->
    <div class="inspector-section-title">CROSS-CASE SYNDICATE MATCHES (${crossMatches.length})</div>
    <div style="margin-top:6px;">${crossMatchesHtml}</div>

    <div class="inspector-divider"></div>

    <!-- Case Timeline Events -->
    <div class="inspector-section-title">LINKED TIMELINE EVENTS (${timelineRefs.length})</div>
    <div style="margin-top:6px;">${timelineRefsHtml}</div>

    <div class="inspector-divider"></div>

    <!-- Chain of Custody History -->
    <div class="inspector-section-title">IMMUTABLE CHAIN OF CUSTODY LOG (${custodyList.length})</div>
    <div class="custody-timeline">${custodyHtml}</div>

    <!-- Append Custody Note Form -->
    <div style="margin-top:14px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:10px;">
      <div style="font-size:10px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">LOG CHAIN OF CUSTODY EVENT</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <select id="custody-event-type" class="vault-select" style="width:100%;font-size:10px;">
          <option value="OFFICER_NOTE">Officer Forensic Note</option>
          <option value="CUSTODY_TRANSFER">Custody / Station Transfer</option>
          <option value="COURT_PRODUCTION">Produced in Court (Section 63)</option>
          <option value="LAB_EXAMINATION">Sent to Cyber Forensic Lab (CFSL)</option>
        </select>
        <input type="text" id="custody-action-input" class="evidence-search" style="width:100%;font-size:10px;" placeholder="Event description / Memo reference…" />
        <button class="btn btn-primary btn-sm" id="btn-save-custody-entry" style="font-size:10px;padding:4px 8px;align-self:flex-end;">
          + Append Entry
        </button>
      </div>
    </div>
  `;

  // Bind copy hash buttons
  body.querySelectorAll('.hash-copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await copyToClipboard(btn.dataset.hash);
      showToast('success', 'Hash copied');
    });
  });

  // Bind text preview loader if text file
  const textPreviewBtn = document.getElementById('load-text-preview-btn');
  if (textPreviewBtn) {
    textPreviewBtn.addEventListener('click', async () => {
      const targetPre = document.getElementById('text-preview-content');
      if (!targetPre) return;
      targetPre.textContent = 'Streaming raw evidence text…';
      try {
        const res = await fetch(downloadUrl);
        const text = await res.text();
        targetPre.textContent = text || '[Empty file content]';
      } catch (err) {
        targetPre.textContent = `Error reading content: ${err.message}`;
      }
    });
  }

  // Bind Re-verify Inspector button
  const reverifyBtn = document.getElementById('btn-reverify-inspector');
  if (reverifyBtn) {
    reverifyBtn.addEventListener('click', async () => {
      reverifyBtn.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span> Auditing…';
      try {
        const res = await reverifyEvidence(ev.id);
        if (res.verified) {
          showToast('success', '✓ Live Cryptographic Audit PASSED');
        } else {
          showToast('error', `✕ Audit Alert: ${res.status}`);
        }
        await openInspector(ev.id);
      } catch (err) {
        showToast('error', `Audit failed: ${err.message}`);
        reverifyBtn.textContent = '🔄 Live Digest Audit';
      }
    });
  }

  // Bind Save Custody Entry button
  const saveCustodyBtn = document.getElementById('btn-save-custody-entry');
  if (saveCustodyBtn) {
    saveCustodyBtn.addEventListener('click', async () => {
      const typeSelect = document.getElementById('custody-event-type');
      const actionInput = document.getElementById('custody-action-input');
      const action = actionInput?.value.trim();

      if (!action) {
        showToast('warning', 'Please enter a description for the custody entry');
        return;
      }

      saveCustodyBtn.disabled = true;
      try {
        await logCustodyEvent(ev.id, {
          eventType: typeSelect?.value || 'OFFICER_NOTE',
          actor: 'Investigating Officer (Rakshak Console)',
          action,
          result: 'SUCCESS',
        });
        showToast('success', 'Custody entry appended to audit log');
        await openInspector(ev.id);
      } catch (err) {
        showToast('error', `Failed to log custody event: ${err.message}`);
        saveCustodyBtn.disabled = false;
      }
    });
  }
}

// ─── Section 63 Checklist Tab ────────────────────────────────────────────────
function renderChecklistSummary() {
  const tbody = document.getElementById('checklist-evidence-rows');
  if (!tbody) return;

  if (evidenceList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No evidence assets available to audit.</td></tr>`;
    return;
  }

  tbody.innerHTML = evidenceList.map(ev => {
    const isDualHashMatch = (ev.clientHash || '').toLowerCase() === (ev.sha256Hash || '').toLowerCase();
    const hasStorage = !!ev.storagePath;
    const isSection63Admissible = isDualHashMatch && hasStorage;

    return `<tr>
      <td><span class="ev-id">${escapeHtml(ev.id ? ev.id.substring(0, 12) + '…' : '—')}</span></td>
      <td><strong>${escapeHtml(ev.fileName || '—')}</strong></td>
      <td><span class="badge border" style="font-size:9px">${escapeHtml(ev.case?.caseNumber || ev.caseId || '—')}</span></td>
      <td>
        <span class="badge ${isDualHashMatch ? 'badge-green' : 'badge-red'}" style="font-size:9px">
          ${isDualHashMatch ? '✓ DUAL MATCH' : '✕ MISMATCH'}
        </span>
      </td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text-muted)">${escapeHtml(ev.storagePath || 'None')}</span></td>
      <td><span class="badge badge-blue" style="font-size:9px">✓ APPEND-ONLY</span></td>
      <td>
        <span class="badge border ${isSection63Admissible ? 'badge-green' : 'badge-red'}" style="font-weight:700;font-size:9px;border:1px solid">
          ${isSection63Admissible ? '✓ CERTIFIED ADMISSIBLE' : '✕ INADMISSIBLE'}
        </span>
      </td>
    </tr>`;
  }).join('');
}
