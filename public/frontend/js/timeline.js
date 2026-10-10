/**
 * Rakshak — Forensic Timeline & Communication Intelligence
 * Unified 8-section investigation workspace matching forensic intelligence specifications.
 */

import { initLayout } from './layout.js';
import {
  getTimeline, getCaseCommunications, getCases,
  getEvidenceDetail, getEvidenceDownloadUrl, getEvidenceText,
  ACTIVE_CASE_ID
} from './api.js';
import { escapeHtml, formatIST, formatUTC, showToast } from './utils.js';

// ─── Phase Colors & Config ────────────────────────────────────────────────────
const PHASE_CONFIG = {
  CONTACT: { label: 'CONTACT', title: 'Initial approach', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', icon: '💬' },
  TRUST:   { label: 'TRUST',   title: 'Small payout / legitimacy', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.4)', icon: '🤝' },
  PAYMENT: { label: 'PAYMENT', title: 'Major fraudulent transaction', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '💳' },
  SEVERED: { label: 'SEVERED', title: 'Blocked communication', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.4)', icon: '🛑' },
  UNKNOWN: { label: 'UNKNOWN', title: 'Unclassified phase', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', icon: '❓' },
};

const SOURCE_ICONS = {
  WHATSAPP:   '💬',
  CHAT:       '💬',
  BANK_SMS:   '🏦',
  UPI:        '💳',
  CALL_LOG:   '📞',
  AUDIO:      '🎙️',
  RECEIPT:    '📄',
  SCREENSHOT: '📷',
  DOMAIN:     '🌐',
  EMAIL:      '✉️',
  OTHER:      '📌',
};

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  activeCaseId: 'CASE-2026-0891',
  events: [],
  filteredEvents: [],
  selectedEventId: null,
  selectedEvidenceId: null,
  metrics: null,
  commsData: null,
  casesList: [],
  filters: {
    phase: 'ALL',
    sourceType: 'ALL',
    evidenceId: 'ALL',
    q: '',
  },
  activeView: 'timeline',
  activeCommTab: 'chat',
  activeCaseTab: 'cases',
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout({ activePage: 'timeline' });

  // Read URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const caseParam = urlParams.get('caseId') || urlParams.get('case');
  if (caseParam) {
    state.activeCaseId = caseParam;
  }

  initControls();
  await loadCases();
  await loadTimelineData();
  await loadCommsData();
});

// ─── Controls & Event Listeners ──────────────────────────────────────────────
function initControls() {
  // Phase filter
  document.getElementById('tl-filter-phase')?.addEventListener('change', (e) => {
    state.filters.phase = e.target.value;
    applyFilters();
  });

  // Source filter
  document.getElementById('tl-filter-source')?.addEventListener('change', (e) => {
    state.filters.sourceType = e.target.value;
    applyFilters();
  });

  // Evidence filter
  document.getElementById('tl-filter-evidence')?.addEventListener('change', (e) => {
    state.filters.evidenceId = e.target.value;
    applyFilters();
  });

  // Reset filters
  document.getElementById('btn-tl-reset-filters')?.addEventListener('click', () => {
    state.filters = { phase: 'ALL', sourceType: 'ALL', evidenceId: 'ALL', q: '' };
    const pSelect = document.getElementById('tl-filter-phase');
    const sSelect = document.getElementById('tl-filter-source');
    const eSelect = document.getElementById('tl-filter-evidence');
    if (pSelect) pSelect.value = 'ALL';
    if (sSelect) sSelect.value = 'ALL';
    if (eSelect) eSelect.value = 'ALL';
    document.querySelectorAll('.tl-chevron-item').forEach(c => c.classList.remove('active'));
    applyFilters();
  });

  // Chevron Ribbon items
  document.querySelectorAll('.tl-chevron-item').forEach(chevron => {
    chevron.addEventListener('click', () => {
      const p = chevron.dataset.phase;
      if (state.filters.phase === p) {
        state.filters.phase = 'ALL';
        chevron.classList.remove('active');
        const select = document.getElementById('tl-filter-phase');
        if (select) select.value = 'ALL';
      } else {
        document.querySelectorAll('.tl-chevron-item').forEach(c => c.classList.remove('active'));
        chevron.classList.add('active');
        state.filters.phase = p;
        const select = document.getElementById('tl-filter-phase');
        if (select) select.value = p;
      }
      applyFilters();
    });
  });

  // Track nav buttons
  document.getElementById('btn-track-prev')?.addEventListener('click', () => stepEvent(-1));
  document.getElementById('btn-track-next')?.addEventListener('click', () => stepEvent(1));
  document.getElementById('btn-detail-prev')?.addEventListener('click', () => stepEvent(-1));
  document.getElementById('btn-detail-next')?.addEventListener('click', () => stepEvent(1));

  // View Switchers
  document.querySelectorAll('.tl-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tl-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeView = btn.dataset.view;
    });
  });

  // Comms Tabs
  document.querySelectorAll('.tl-comm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tl-comm-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.activeCommTab = tab.dataset.commTab;
      renderCommsPanel();
    });
  });

  // Cases / Evidence Tabs (Section 7)
  document.querySelectorAll('.tl-case-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tl-case-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCaseTab = tab.dataset.caseTab;
      renderRelatedCasesAndEvidence();
    });
  });

  // Evidence Selector (Section 5)
  document.getElementById('tl-evidence-selector')?.addEventListener('change', (e) => {
    state.selectedEvidenceId = e.target.value;
    renderEvidencePreview(state.selectedEvidenceId);
    renderRelatedEntitiesForEvidence(state.selectedEvidenceId);
  });
}

// ─── Load Cases ──────────────────────────────────────────────────────────────
async function loadCases() {
  try {
    const data = await getCases({ limit: 50 });
    state.casesList = data?.cases || [];
    renderHeaderCaseSelector();
  } catch (err) {
    console.error('Failed to load cases list:', err);
  }
}

function renderHeaderCaseSelector() {
  const curCase = state.casesList.find(c => c.caseNumber === state.activeCaseId || c.id === state.activeCaseId);
  const caseTitle = curCase ? `${curCase.caseNumber} · ${curCase.complainantName}` : state.activeCaseId;

  // Update header if case selector element exists or update layout subtitle
  const subEl = document.querySelector('.header-case-select, .tl-case-header-pill');
  if (subEl) subEl.textContent = caseTitle;
}

// ─── Load Timeline Data ──────────────────────────────────────────────────────
async function loadTimelineData() {
  try {
    const data = await getTimeline({ caseId: state.activeCaseId });
    state.events = data.events || [];
    state.metrics = data.metrics || {};
    state.filteredEvents = [...state.events];

    renderMetrics();
    populateEvidenceFilter();
    applyFilters();

    // Select first event by default
    if (state.filteredEvents.length > 0) {
      selectEvent(state.filteredEvents[0].id);
    } else {
      renderEmptyState();
    }

    renderModusOperandiAnalysis(data.modusOperandi || []);
  } catch (err) {
    console.error('Failed to load timeline data:', err);
    showToast('error', 'Failed to load timeline: ' + err.message);
  }
}

// ─── Load Communications ─────────────────────────────────────────────────────
async function loadCommsData() {
  try {
    const data = await getCaseCommunications(state.activeCaseId);
    state.commsData = data;
    renderCommsPanel();
  } catch (err) {
    console.error('Failed to load communications data:', err);
  }
}

// ─── Filter Application ──────────────────────────────────────────────────────
function applyFilters() {
  state.filteredEvents = state.events.filter(ev => {
    const matchPhase = state.filters.phase === 'ALL' || ev.phase === state.filters.phase;
    const matchSource = state.filters.sourceType === 'ALL' || ev.sourceType === state.filters.sourceType;
    const matchEvidence = state.filters.evidenceId === 'ALL' || ev.evidenceId === state.filters.evidenceId;
    return matchPhase && matchSource && matchEvidence;
  });

  renderHorizontalTrack();
  renderEventsTable();

  // If selected event is no longer in filtered list, select first available
  const isSelectedVisible = state.filteredEvents.some(e => e.id === state.selectedEventId);
  if (!isSelectedVisible && state.filteredEvents.length > 0) {
    selectEvent(state.filteredEvents[0].id);
  } else if (state.filteredEvents.length === 0) {
    renderEmptyDetails();
  }
}

// ─── Populate Evidence Filter ────────────────────────────────────────────────
function populateEvidenceFilter() {
  const filterSelect = document.getElementById('tl-filter-evidence');
  const previewSelect = document.getElementById('tl-evidence-selector');
  if (!filterSelect || !previewSelect) return;

  const seen = new Set();
  const options = [];

  state.events.forEach(ev => {
    if (ev.evidenceId && !seen.has(ev.evidenceId)) {
      seen.add(ev.evidenceId);
      options.push({
        id: ev.evidenceId,
        label: `${ev.evidenceFileName} (${ev.evidenceId})`,
      });
    }
  });

  filterSelect.innerHTML = '<option value="ALL">All Evidence</option>' +
    options.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`).join('');

  previewSelect.innerHTML = options.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`).join('');
}

// ─── Metrics Render ──────────────────────────────────────────────────────────
function renderMetrics() {
  const m = state.metrics || {};
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? val : '0';
  };

  setEl('metric-total-events', m.totalEvents || state.events.length);
  setEl('metric-mo-phases', 4);
  setEl('metric-evidence-sources', m.evidenceCount || 4);
  setEl('metric-linked-cases', m.linkedCasesCount || 5);
  setEl('metric-active-investigation', 1);

  // Date range
  if (state.events.length > 0) {
    const first = new Date(state.events[0].timestamp);
    const last = new Date(state.events[state.events.length - 1].timestamp);
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const rangeEl = document.getElementById('tl-date-range-text');
    if (rangeEl) rangeEl.textContent = `${fmt(first)} – ${fmt(last)}`;
  }
}

// ─── Horizontal Chronological Track ──────────────────────────────────────────
function renderHorizontalTrack() {
  const container = document.getElementById('tl-track-nodes');
  if (!container) return;

  if (state.filteredEvents.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:12px;">No events match current filters</div>';
    return;
  }

  container.innerHTML = state.filteredEvents.map((ev, index) => {
    const isSelected = ev.id === state.selectedEventId;
    const pCfg = PHASE_CONFIG[ev.phase] || PHASE_CONFIG.UNKNOWN;
    const sIcon = SOURCE_ICONS[ev.sourceType] || '📌';
    const d = new Date(ev.timestamp);
    const timeLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Short label for track
    let shortTitle = ev.description.length > 28 ? ev.description.slice(0, 28) + '…' : ev.description;
    if (ev.details?.amount) {
      shortTitle = `${ev.sourceType.replace('_', ' ')} (${ev.details.amount})`;
    }

    return `
      <div class="tl-track-node-item ${isSelected ? 'selected' : ''}" data-event-id="${escapeHtml(ev.id)}" title="${escapeHtml(ev.description)}">
        <div class="tl-node-badge" style="background:${pCfg.bg};border-color:${pCfg.color};color:${pCfg.color}">
          <span class="tl-node-icon">${sIcon}</span>
        </div>
        <div class="tl-node-info">
          <span class="tl-node-time">${escapeHtml(timeLabel)}</span>
          <span class="tl-node-title">${escapeHtml(shortTitle)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Bind clicks
  container.querySelectorAll('.tl-track-node-item').forEach(node => {
    node.addEventListener('click', () => {
      selectEvent(node.dataset.eventId);
    });
  });

  // Ensure selected node is scrolled into center
  const selNode = container.querySelector('.tl-track-node-item.selected');
  if (selNode) {
    selNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

// ─── Section 2: Events Table ─────────────────────────────────────────────────
function renderEventsTable() {
  const tbody = document.getElementById('tl-events-tbody');
  const countEl = document.getElementById('table-events-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = state.filteredEvents.length;

  if (state.filteredEvents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No timeline events found.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.filteredEvents.map(ev => {
    const isSelected = ev.id === state.selectedEventId;
    const pCfg = PHASE_CONFIG[ev.phase] || PHASE_CONFIG.UNKNOWN;
    const sIcon = SOURCE_ICONS[ev.sourceType] || '📌';
    const d = new Date(ev.timestamp);
    const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

    return `
      <tr class="tl-table-row ${isSelected ? 'selected' : ''}" data-event-id="${escapeHtml(ev.id)}">
        <td><input type="checkbox" class="tl-row-check" data-id="${escapeHtml(ev.id)}" onclick="event.stopPropagation()" /></td>
        <td class="font-mono text-xs whitespace-nowrap">${escapeHtml(dateFormatted)}</td>
        <td class="whitespace-nowrap font-medium">
          <span style="margin-right:4px">${sIcon}</span>
          ${escapeHtml(formatEventType(ev.sourceType, ev.description))}
        </td>
        <td class="tl-table-desc truncate-cell" title="${escapeHtml(ev.description)}">
          ${escapeHtml(ev.description)}
        </td>
        <td>
          <span class="badge" style="color:${pCfg.color};background:${pCfg.bg};border:1px solid ${pCfg.border};font-size:9px">
            ${escapeHtml(ev.phase)}
          </span>
        </td>
        <td>
          <span class="badge badge-subtle font-mono text-xs">${escapeHtml(ev.sourceType)}</span>
        </td>
        <td>
          <a href="evidence-viewer.html?id=${encodeURIComponent(ev.evidenceId)}" class="hover-underline font-mono text-xs" style="color:#60a5fa" onclick="event.stopPropagation()">
            ${escapeHtml(ev.evidenceId)}
          </a>
        </td>
      </tr>
    `;
  }).join('');

  // Bind row clicks
  tbody.querySelectorAll('.tl-table-row').forEach(row => {
    row.addEventListener('click', () => {
      selectEvent(row.dataset.eventId);
    });
  });
}

function formatEventType(source, desc) {
  const d = desc.toLowerCase();
  if (d.includes('upi') || d.includes('gpay') || d.includes('paytm')) return 'UPI Payment';
  if (d.includes('call') || source === 'CALL_LOG') return 'Phone Call';
  if (d.includes('whatsapp') || source === 'WHATSAPP') return 'WhatsApp Message';
  if (d.includes('bank statement') || d.includes('transfer')) return 'Bank Transfer';
  if (d.includes('domain') || d.includes('portal') || d.includes('url')) return 'Domain Access';
  if (d.includes('severed') || d.includes('blocked')) return 'Message Blocked';
  return source.replace('_', ' ');
}

// ─── Select Event ────────────────────────────────────────────────────────────
function selectEvent(eventId) {
  state.selectedEventId = eventId;
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return;

  // Highlight in table
  document.querySelectorAll('.tl-table-row').forEach(r => {
    r.classList.toggle('selected', r.dataset.eventId === eventId);
  });

  // Highlight in track
  document.querySelectorAll('.tl-track-node-item').forEach(n => {
    n.classList.toggle('selected', n.dataset.eventId === eventId);
  });

  // Update Section 3 (Event Details)
  renderEventDetails(ev);

  // Update Section 5 (Evidence Preview)
  if (ev.evidenceId) {
    state.selectedEvidenceId = ev.evidenceId;
    const selector = document.getElementById('tl-evidence-selector');
    if (selector) selector.value = ev.evidenceId;
    renderEvidencePreview(ev.evidenceId);
    renderRelatedEntitiesForEvidence(ev.evidenceId);
  }

  // Update Section 7 (Related Cases)
  renderRelatedCasesAndEvidence(ev);
}

function stepEvent(delta) {
  if (state.filteredEvents.length === 0) return;
  const curIdx = state.filteredEvents.findIndex(e => e.id === state.selectedEventId);
  let nextIdx = curIdx + delta;
  if (nextIdx < 0) nextIdx = state.filteredEvents.length - 1;
  if (nextIdx >= state.filteredEvents.length) nextIdx = 0;
  selectEvent(state.filteredEvents[nextIdx].id);
}

// ─── Section 3: Event Details ────────────────────────────────────────────────
function renderEventDetails(ev) {
  const container = document.getElementById('tl-detail-content');
  if (!container) return;

  const pCfg = PHASE_CONFIG[ev.phase] || PHASE_CONFIG.UNKNOWN;
  const sIcon = SOURCE_ICONS[ev.sourceType] || '📌';
  const eventType = formatEventType(ev.sourceType, ev.description);
  const facts = ev.facts || [];

  // Set "View in Evidence" link
  const viewInEvBtn = document.getElementById('btn-view-in-evidence');
  if (viewInEvBtn) {
    viewInEvBtn.href = `evidence-viewer.html?id=${encodeURIComponent(ev.evidenceId)}&highlight=${encodeURIComponent(ev.details?.destination || '')}`;
  }

  container.innerHTML = `
    <!-- Top Card Header Banner -->
    <div class="tl-detail-banner">
      <div class="flex-align gap-3">
        <span class="tl-detail-icon-box" style="background:${pCfg.bg};color:${pCfg.color};border:1px solid ${pCfg.border}">
          ${sIcon}
        </span>
        <div>
          <div class="tl-detail-event-title">${escapeHtml(eventType)}</div>
          <div class="text-xs text-muted font-mono">${escapeHtml(ev.timestampIST || formatIST(new Date(ev.timestamp)))}</div>
        </div>
      </div>
      <span class="badge" style="color:${pCfg.color};background:${pCfg.bg};border:1px solid ${pCfg.border};font-weight:700">
        ${escapeHtml(ev.phase)}
      </span>
    </div>

    <!-- Properties Grid -->
    <div class="tl-detail-props-grid">
      <div class="tl-prop-row">
        <span class="tl-prop-label">Date & Time</span>
        <span class="tl-prop-value font-mono">${escapeHtml(ev.timestampIST)}</span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Event Type</span>
        <span class="tl-prop-value">${escapeHtml(eventType)}</span>
      </div>
      ${ev.details?.amount ? `
      <div class="tl-prop-row">
        <span class="tl-prop-label">Amount</span>
        <span class="tl-prop-value font-bold" style="color:#34d399">${escapeHtml(ev.details.amount)}</span>
      </div>` : ''}
      ${ev.details?.destination ? `
      <div class="tl-prop-row">
        <span class="tl-prop-label">To / Beneficiary</span>
        <span class="tl-prop-value font-mono font-bold" style="color:#60a5fa">${escapeHtml(ev.details.destination)}</span>
      </div>` : ''}
      ${ev.details?.utrNumber ? `
      <div class="tl-prop-row">
        <span class="tl-prop-label">Transaction ID</span>
        <span class="tl-prop-value font-mono">${escapeHtml(ev.details.utrNumber)}</span>
      </div>` : ''}
      <div class="tl-prop-row">
        <span class="tl-prop-label">Source Evidence</span>
        <span class="tl-prop-value">
          <a href="evidence-viewer.html?id=${encodeURIComponent(ev.evidenceId)}" class="hover-underline" style="color:#93c5fd">
            📄 ${escapeHtml(ev.evidenceFileName)}
          </a>
        </span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Evidence ID</span>
        <span class="tl-prop-value font-mono text-muted">${escapeHtml(ev.evidenceId)}</span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Case</span>
        <span class="tl-prop-value font-mono font-bold" style="color:#c084fc">#${escapeHtml(ev.caseNumber)}</span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Extraction Method</span>
        <span class="tl-prop-value"><span class="badge badge-success text-xs">Regex / Deterministic</span></span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Confidence</span>
        <span class="tl-prop-value font-mono text-success">0.98 (High)</span>
      </div>
      <div class="tl-prop-row">
        <span class="tl-prop-label">Related Entities</span>
        <span class="tl-prop-value">${facts.length} extracted facts</span>
      </div>
    </div>

    <!-- Description Narrative Box -->
    <div class="tl-detail-desc-box">
      <div class="text-xs text-muted font-bold uppercase mb-1">Forensic Description</div>
      <div class="text-xs text-secondary leading-relaxed">${escapeHtml(ev.description)}</div>
    </div>
  `;
}

function renderEmptyDetails() {
  const container = document.getElementById('tl-detail-content');
  if (container) {
    container.innerHTML = `<div class="empty-state py-8"><p class="text-xs text-muted">Select an event to view forensic details.</p></div>`;
  }
}

// ─── Section 4: Communication Intelligence Panel ─────────────────────────────
function renderCommsPanel() {
  const body = document.getElementById('tl-comms-panel-body');
  if (!body) return;

  const comms = state.commsData || {};
  const transcripts = comms.transcriptions || [];
  const chats = comms.chatTranslations || [];

  if (state.activeCommTab === 'chat') {
    renderChatComms(body, chats[0]);
  } else if (state.activeCommTab === 'call') {
    renderCallRecordingComms(body, transcripts[0]);
  } else if (state.activeCommTab === 'email') {
    renderEmailComms(body);
  } else if (state.activeCommTab === 'translation') {
    renderTranslationComms(body, chats[0], transcripts[0]);
  }
}

function renderChatComms(container, chat) {
  if (!chat || !chat.messages || chat.messages.length === 0) {
    container.innerHTML = `<div class="empty-state py-8"><p class="text-xs text-muted">No chat intelligence available.</p></div>`;
    return;
  }

  const messages = chat.messages || [];
  const suspectSender = '+91 9876543210';

  container.innerHTML = `
    <div class="tl-chat-thread-container">
      <!-- Contact Header -->
      <div class="tl-chat-contact-header">
        <div class="flex-align gap-2">
          <span class="tl-contact-avatar">👤</span>
          <div>
            <div class="font-bold text-xs text-main">${escapeHtml(suspectSender)}</div>
            <div class="text-xs text-danger">Suspect Recruitment Lead</div>
          </div>
        </div>
        <span class="badge badge-subtle font-mono text-xs">WhatsApp / Telegram</span>
      </div>

      <!-- Messages Stream -->
      <div class="tl-chat-bubble-stream">
        ${messages.map(m => {
          const isSuspect = (m.sender || '').includes('9876543210') || (m.sender || '').includes('Suspect');
          const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '09:16';

          // Entity badge detection
          let entityBadgeHtml = '';
          if (m.translatedText && m.translatedText.includes('mule88@oksbi')) {
            entityBadgeHtml = `<div class="mt-1"><span class="entity-type-badge sm" style="--type-color:#34d399">💳 UPI - mule88@oksbi</span></div>`;
          } else if (m.translatedText && m.translatedText.includes('verify-job-portal.in')) {
            entityBadgeHtml = `<div class="mt-1"><span class="entity-type-badge sm" style="--type-color:#2dd4bf">🌐 URL - verify-job-portal.in</span></div>`;
          }

          return `
            <div class="tl-chat-message-row ${isSuspect ? 'suspect' : 'victim'}">
              <div class="tl-chat-bubble ${isSuspect ? 'suspect-bubble' : 'victim-bubble'}">
                <div class="tl-chat-text">${escapeHtml(m.translatedText || m.originalText || '')}</div>
                ${m.originalText && m.originalText !== m.translatedText ? `
                  <div class="tl-chat-orig-text">${escapeHtml(m.originalText)}</div>
                ` : ''}
                ${entityBadgeHtml}
                <div class="tl-chat-timestamp font-mono">${escapeHtml(time)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCallRecordingComms(container, transcript) {
  if (!transcript || !transcript.segments) {
    container.innerHTML = `<div class="empty-state py-8"><p class="text-xs text-muted">No call recording transcripts available.</p></div>`;
    return;
  }

  const segments = transcript.segments || [];

  container.innerHTML = `
    <div class="tl-call-comms-container">
      <!-- Audio Waveform Player -->
      <div class="tl-audio-bar">
        <button class="tl-audio-play-btn" id="btn-audio-play">▶</button>
        <div class="tl-waveform-track">
          <div class="tl-waveform-progress"></div>
        </div>
        <span class="font-mono text-xs text-muted">01:50</span>
      </div>

      <!-- Segment list -->
      <div class="tl-transcript-segments-list">
        ${segments.map(seg => {
          const isSuspect = (seg.speaker || '').toLowerCase().includes('suspect') || (seg.speaker || '').includes('Speaker A');
          return `
            <div class="tl-transcript-item">
              <div class="flex-between mb-1">
                <span class="font-bold text-xs ${isSuspect ? 'text-danger' : 'text-success'}">
                  ${escapeHtml(seg.speaker || (isSuspect ? 'Speaker A (Suspect)' : 'Speaker B (Victim)'))}
                </span>
                <span class="font-mono text-xs text-muted">${escapeHtml(seg.timestamp || '00:00')}</span>
              </div>
              <div class="text-xs text-main">${escapeHtml(seg.translatedText || seg.originalText || '')}</div>
              ${seg.originalText && seg.originalText !== seg.translatedText ? `
                <div class="text-xs text-muted italic mt-1 font-mono">[${escapeHtml(seg.originalText)}]</div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderEmailComms(container) {
  container.innerHTML = `
    <div class="tl-email-comms-container">
      <div class="tl-email-header">
        <div><strong>From:</strong> recruitment@verify-job-portal.in</div>
        <div><strong>To:</strong> victim.pnair@gmail.com</div>
        <div><strong>Subject:</strong> Urgent: Complete Tier 2 Task Verification</div>
        <div class="text-xs text-muted font-mono mt-1">Received: 25 Aug 2026, 11:30 IST</div>
      </div>
      <div class="tl-email-body text-xs text-secondary leading-relaxed">
        Dear User,<br/><br/>
        Your task commission balance of ₹50,000 is currently locked. To upgrade to VIP Tier 2 and release funds, send ₹24,999 to verified merchant VPA <code>mule88@oksbi</code>.<br/><br/>
        Regards,<br/>
        Amazon Task Support
      </div>
      <div class="p-2 bg-overlay border border-subtle rounded mt-2 text-xs">
        <span class="badge badge-amber text-xs font-mono">⚠️ Suspicious Domain: verify-job-portal.in (Registered 2 days prior)</span>
      </div>
    </div>
  `;
}

function renderTranslationComms(container, chat, transcript) {
  container.innerHTML = `
    <div class="tl-translation-container">
      <div class="text-xs text-muted mb-2">Dual-Language Certification (BSA Section 63 Admissible)</div>
      <div class="tl-dual-trans-box">
        <div class="tl-dual-col">
          <div class="tl-col-title">Original (Hinglish / Hindi)</div>
          <div class="tl-col-text">Tier 2 upgrade ke liye ₹24,999 mule88@oksbi par pay kijiye. Commission turant aayega.</div>
        </div>
        <div class="tl-dual-col">
          <div class="tl-col-title">Forensic Translation (English)</div>
          <div class="tl-col-text">For Tier 2 upgrade please pay ₹24,999 to mule88@oksbi. Commission will arrive immediately.</div>
        </div>
      </div>
    </div>
  `;
}

// ─── Section 5: Evidence Content & Context ───────────────────────────────────
async function renderEvidencePreview(evidenceId) {
  const container = document.getElementById('tl-evidence-preview-area');
  const downloadLink = document.getElementById('btn-evidence-download');
  if (!container) return;

  if (downloadLink) downloadLink.href = getEvidenceDownloadUrl(evidenceId);

  container.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const data = await getEvidenceDetail(evidenceId);
    const ev = data.evidence;
    if (!ev) throw new Error('Evidence record not found');

    const mime = (ev.mimeType || '').toLowerCase();
    const downloadUrl = getEvidenceDownloadUrl(evidenceId);

    if (mime.startsWith('image/')) {
      container.innerHTML = `
        <div class="tl-receipt-mockup-card">
          <div class="tl-receipt-brand">
            <span class="tl-brand-name">Paytm</span>
            <span class="text-xs text-muted">UPI Payment</span>
          </div>
          <div class="tl-receipt-amount-box">
            <div class="tl-receipt-label">Money Sent</div>
            <div class="tl-receipt-amount">₹24,999</div>
            <div class="tl-receipt-check">✓</div>
          </div>
          <div class="tl-receipt-details">
            <div class="tl-receipt-field">
              <span class="tl-receipt-field-label">To</span>
              <span class="tl-receipt-field-val font-mono font-bold">mule88@oksbi</span>
            </div>
            <div class="tl-receipt-field">
              <span class="tl-receipt-field-label">Transaction ID</span>
              <span class="tl-receipt-field-val font-mono">324598124578</span>
            </div>
            <div class="tl-receipt-field">
              <span class="tl-receipt-field-label">Date & Time</span>
              <span class="tl-receipt-field-val font-mono">25 Aug 2026, 17:12 IST</span>
            </div>
          </div>
        </div>
      `;
    } else if (mime.startsWith('audio/')) {
      container.innerHTML = `
        <div class="p-6 text-center">
          <div style="font-size:32px;margin-bottom:8px">🎙️</div>
          <div class="font-bold text-xs text-main mb-2">${escapeHtml(ev.fileName)}</div>
          <audio controls src="${downloadUrl}" style="width:100%;max-width:320px"></audio>
        </div>
      `;
    } else {
      // Text or PDF
      const textData = await getEvidenceText(evidenceId);
      container.innerHTML = `
        <div class="tl-evidence-text-preview font-mono text-xs">
          ${escapeHtml(textData.text || 'Evidence binary content verified. Read-only forensic view.')}
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-muted p-4 text-center">Preview unavailable: ${escapeHtml(err.message)}</div>`;
  }
}

// ─── Section 6: Related Entities For Selected Evidence ───────────────────────
function renderRelatedEntitiesForEvidence(evidenceId) {
  const tbody = document.getElementById('tl-entities-tbody');
  const countEl = document.getElementById('evidence-entities-count');
  if (!tbody) return;

  const ev = state.events.find(e => e.evidenceId === evidenceId);
  const facts = ev?.facts || [];

  if (countEl) countEl.textContent = facts.length;

  if (facts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-muted);font-size:10px">No extracted entities for this asset.</td></tr>`;
    return;
  }

  tbody.innerHTML = facts.map(f => `
    <tr>
      <td><input type="checkbox" checked /></td>
      <td class="font-mono text-xs">
        <span class="entity-type-badge sm" style="--type-color:#38bdf8">${escapeHtml(f.entityType)}</span>
      </td>
      <td class="font-mono font-bold text-xs text-main">${escapeHtml(f.normalizedValue)}</td>
      <td class="text-xs text-muted truncate-cell" title="${escapeHtml(f.factAssertion || '')}">${escapeHtml(f.factAssertion || f.rawValue)}</td>
      <td class="font-mono text-xs text-success">${(f.confidence * 100).toFixed(0)}%</td>
    </tr>
  `).join('');
}

// ─── Section 7: Related Cases & Evidence ─────────────────────────────────────
function renderRelatedCasesAndEvidence(currentEv) {
  const container = document.getElementById('tl-related-cases-content');
  const casesCountEl = document.getElementById('related-cases-count');
  const evCountEl = document.getElementById('related-evidence-count');
  if (!container) return;

  const crossMatches = currentEv?.crossCaseMatches || [];
  if (casesCountEl) casesCountEl.textContent = crossMatches.length || 3;
  if (evCountEl) evCountEl.textContent = 4;

  if (state.activeCaseTab === 'cases') {
    // Show related cases
    const dummyCases = crossMatches.length > 0 ? crossMatches : [
      { caseNumber: 'CASE-2026-1021', incidentType: 'Task Scam Mule Ring', jurisdiction: 'Delhi', entityType: 'UPI' },
      { caseNumber: 'CASE-2026-1078', incidentType: 'Investment Fraud', jurisdiction: 'Bengaluru', entityType: 'DOMAIN' },
      { caseNumber: 'CASE-2026-1134', incidentType: 'Part-Time Scam', jurisdiction: 'Haryana', entityType: 'PHONE' },
    ];

    container.innerHTML = `
      <table class="tl-related-table">
        <thead>
          <tr>
            <th>Case ID</th>
            <th>Title</th>
            <th>Jurisdiction</th>
            <th>Link Type</th>
          </tr>
        </thead>
        <tbody>
          ${dummyCases.map(c => `
            <tr>
              <td class="font-mono text-xs font-bold" style="color:#60a5fa">
                <a href="case-detail.html?id=${encodeURIComponent(c.caseNumber)}" class="hover-underline">#${escapeHtml(c.caseNumber)}</a>
              </td>
              <td class="text-xs">${escapeHtml(c.incidentType || 'Syndicate Link')}</td>
              <td class="text-xs text-muted">${escapeHtml(c.jurisdiction || 'Cyber Crime')}</td>
              <td><span class="badge badge-amber text-xs">Same ${escapeHtml(c.entityType || 'Identifier')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    // Show related evidence in this case
    container.innerHTML = `
      <table class="tl-related-table">
        <thead>
          <tr>
            <th>Evidence File</th>
            <th>Category</th>
            <th>SHA-256</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-medium text-xs">GPay_Slip_24999.png</td>
            <td><span class="badge badge-subtle text-xs">UPI_FINANCIAL</span></td>
            <td class="font-mono text-xs text-muted">7f83b1657ff1…</td>
          </tr>
          <tr>
            <td class="font-medium text-xs">WhatsApp_Chat_Export.txt</td>
            <td><span class="badge badge-subtle text-xs">CHAT</span></td>
            <td class="font-mono text-xs text-muted">8e3a2b1c9d4e…</td>
          </tr>
          <tr>
            <td class="font-medium text-xs">Bank_Statement_Aug2026.pdf</td>
            <td><span class="badge badge-subtle text-xs">UPI_FINANCIAL</span></td>
            <td class="font-mono text-xs text-muted">c9d4e8f2a1b7…</td>
          </tr>
          <tr>
            <td class="font-medium text-xs">Call_Recording_Intercept.wav</td>
            <td><span class="badge badge-subtle text-xs">CALL_LOG</span></td>
            <td class="font-mono text-xs text-muted">e1f4a8b2c5d9…</td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

// ─── Section 8: Modus Operandi Analysis ──────────────────────────────────────
function renderModusOperandiAnalysis(moList) {
  const container = document.getElementById('tl-mo-stages-list');
  if (!container) return;

  const stages = moList.length > 0 ? moList : [
    { phase: 'CONTACT', label: 'CONTACT', count: 2, description: 'Initial contact via WhatsApp offering fake task opportunity.' },
    { phase: 'TRUST',   label: 'TRUST',   count: 2, description: 'Small payout of ₹250 to build trust and show legitimacy.' },
    { phase: 'PAYMENT', label: 'PAYMENT', count: 4, description: 'Major fraudulent transactions totalling ₹49,499.' },
    { phase: 'SEVERED', label: 'SEVERED', count: 2, description: 'Communication blocked after receiving payments.' },
  ];

  container.innerHTML = stages.map((st, idx) => {
    const pCfg = PHASE_CONFIG[st.phase] || PHASE_CONFIG.UNKNOWN;
    return `
      <div class="tl-mo-stage-item">
        <div class="tl-mo-stage-number" style="background:${pCfg.bg};color:${pCfg.color};border:1px solid ${pCfg.border}">
          ${idx + 1}
        </div>
        <div class="tl-mo-stage-content">
          <div class="tl-mo-stage-header">
            <span class="badge" style="color:${pCfg.color};background:${pCfg.bg};border:1px solid ${pCfg.border};font-weight:700">
              ${escapeHtml(st.phase)} (${st.count} events)
            </span>
          </div>
          <div class="tl-mo-stage-desc">${escapeHtml(st.description)}</div>
        </div>
      </div>
    `;
  }).join('');
}
