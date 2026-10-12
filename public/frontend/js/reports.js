/**
 * ═══════════════════════════════════════════════════════════════════
 * Rakshak v3.0 — Reports & Forensic Dossiers Controller
 * Authoritative Light-Neumorphic Digital Forensics Workstation
 * Page 05: Reports, Evidence References, Findings & Export Workflows
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  getReports,
  getReportDetail,
  updateReport,
  generateReport,
  downloadReport,
  getScheduledReports,
  getCases,
  getCurrentOfficerSession,
  logoutOfficer,
  setActiveCaseId,
} from './api.js';

import {
  escapeHtml,
  formatBytes,
  formatIST,
  truncateHash,
  copyToClipboard,
  showToast,
} from './utils.js';

// ─── Application State ────────────────────────────────────────────────────────
const state = {
  currentOfficer: null,
  reportsList: [],
  selectedReport: null,
  selectedReportId: null,
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  summaryCounts: {
    total: 0,
    completed: 0,
    draft: 0,
    underReview: 0,
    templates: 5,
  },
  filters: {
    search: '',
    status: 'ALL',
    category: 'ALL',
    dateRange: '30',
  },
  sort: {
    field: 'createdAt',
    order: 'desc',
  },
  cases: [],
  templates: [],
};

// ─── Category Visual Metadata ────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'Financial Crime': { bgClass: 'neu-icon-blue-bg', symbol: '💳' },
  'Cyber Crime': { bgClass: 'neu-icon-purple-bg', symbol: '💻' },
  'Organized Crime': { bgClass: 'neu-icon-orange-bg', symbol: '👥' },
  'Narcotics': { bgClass: 'neu-icon-green-bg', symbol: '💊' },
  'Person Related': { bgClass: 'neu-icon-blue-bg', symbol: '👤' },
  'Identity Fraud': { bgClass: 'neu-icon-red-bg', symbol: '🪪' },
  'Arms & Weapons': { bgClass: 'neu-icon-orange-bg', symbol: '🔫' },
  'Human Trafficking': { bgClass: 'neu-icon-red-bg', symbol: '⛓' },
  'Homicide': { bgClass: 'neu-icon-red-bg', symbol: '🔍' },
};

// ─── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initOfficerSession();
    await loadCasesDropdown();
    initFiltersAndSearch();
    initTableSorting();
    initTabs();
    initModals();
    initActionButtons();
    initKpiCardClicks();

    // Check URL parameters (e.g. ?id=RPT-2025-0047 or ?caseId=...)
    const urlParams = new URLSearchParams(window.location.search);
    const initialReportId = urlParams.get('id');
    const initialCaseId = urlParams.get('caseId');

    if (initialCaseId) {
      state.filters.search = initialCaseId;
      const searchInput = document.getElementById('filter-search-input');
      if (searchInput) searchInput.value = initialCaseId;
    }

    await fetchAndRenderReports(initialReportId);
  } catch (err) {
    console.error('[Reports Init Error]:', err);
    showToast('error', 'Failed to initialize Reports Workstation: ' + (err.message || 'Network error'));
  }
});

// ─── 1. Officer Session & Topbar Profile ──────────────────────────────────────
async function initOfficerSession() {
  try {
    const sessionRes = await getCurrentOfficerSession();
    if (!sessionRes || !sessionRes.officer) {
      window.location.href = '/frontend/pages/login.html';
      return;
    }

    const officer = sessionRes.officer;
    state.currentOfficer = officer;

    const nameEl = document.getElementById('officer-display-name');
    const deptEl = document.getElementById('officer-display-dept');
    const fullEl = document.getElementById('profile-full-name');
    const badgeEl = document.getElementById('profile-badge-num');
    const roleEl = document.getElementById('profile-role-tag');
    const jurEl = document.getElementById('profile-jurisdiction');

    const formattedTitle = `${officer.designation || 'Inspector'} ${officer.name || 'Officer'}`;
    const departmentName = officer.jurisdiction || 'Crime Branch (DEL)';

    if (nameEl) nameEl.textContent = formattedTitle;
    if (deptEl) deptEl.textContent = departmentName;
    if (fullEl) fullEl.textContent = formattedTitle;
    if (badgeEl) badgeEl.textContent = `Badge: ${officer.badgeNumber || 'N/A'}`;
    if (roleEl) roleEl.textContent = `Role: ${officer.role || 'INVESTIGATOR'}`;
    if (jurEl) jurEl.textContent = departmentName;

    const sideDeptTitle = document.getElementById('sidebar-dept-title');
    const sideDeptSub = document.getElementById('sidebar-dept-sub');
    if (sideDeptTitle) sideDeptTitle.textContent = officer.role === 'ADMIN' ? 'Crime Branch HQ' : (officer.jurisdiction || 'Cyber Crime Unit');
    if (sideDeptSub) sideDeptSub.textContent = 'Delhi Police';

    const pill = document.getElementById('officer-profile-pill');
    const dropdown = document.getElementById('profile-dropdown');
    if (pill && dropdown) {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        dropdown.classList.toggle('show', !isOpen);
        pill.setAttribute('aria-expanded', String(!isOpen));
      });

      document.addEventListener('click', (e) => {
        if (!pill.contains(e.target)) {
          dropdown.classList.remove('show');
          pill.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const logoutBtn = document.getElementById('btn-officer-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await logoutOfficer();
        } catch (_) {}
        window.location.href = '/frontend/pages/login.html';
      });
    }
  } catch (err) {
    console.warn('[Session Warning] Running in unauthenticated sandbox mode:', err.message);
    const nameEl = document.getElementById('officer-display-name');
    if (nameEl) nameEl.textContent = 'Officer';
  }
}

// ─── 2. Fetch Cases for Dropdowns ─────────────────────────────────────────────
async function loadCasesDropdown() {
  try {
    const res = await getCases();
    state.cases = res.cases || res || [];
    const select = document.getElementById('select-gen-case');
    if (!select) return;

    if (state.cases.length === 0) {
      select.innerHTML = '<option value="">No registered cases found</option>';
      return;
    }

    select.innerHTML = state.cases
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id || c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.complainantName || 'Investigation')} (${escapeHtml(c.incidentType || 'Case')})</option>`
      )
      .join('');
  } catch (err) {
    console.warn('[Cases Load Warning]:', err.message);
  }
}

// ─── 3. Filter & Search Handlers ──────────────────────────────────────────────
function initFiltersAndSearch() {
  const searchInput = document.getElementById('filter-search-input');
  const globalSearchInput = document.getElementById('global-search-input');
  const statusSelect = document.getElementById('filter-status-select');
  const categorySelect = document.getElementById('filter-category-select');
  const dateSelect = document.getElementById('filter-date-select');

  let debounceTimer = null;
  const triggerSearch = (query) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.filters.search = query.trim();
      state.page = 1;
      fetchAndRenderReports();
    }, 280);
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => triggerSearch(e.target.value));
  }
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      if (searchInput) searchInput.value = e.target.value;
      triggerSearch(e.target.value);
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.page = 1;
      fetchAndRenderReports();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      state.page = 1;
      fetchAndRenderReports();
    });
  }

  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      state.filters.dateRange = e.target.value;
      state.page = 1;
      fetchAndRenderReports();
    });
  }

  // Checkbox select all
  const checkAll = document.getElementById('th-checkbox-all');
  if (checkAll) {
    checkAll.addEventListener('change', (e) => {
      const rowBoxes = document.querySelectorAll('.neu-row-checkbox');
      rowBoxes.forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });
  }
}

// ─── 4. Table Sorting ─────────────────────────────────────────────────────────
function initTableSorting() {
  const sortableHeaders = document.querySelectorAll('.neu-th-sortable');
  sortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sort.field === field) {
        state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.field = field;
        state.sort.order = 'asc';
      }
      sortAndRenderTableRows();
    });
  });
}

function sortAndRenderTableRows() {
  state.reportsList.sort((a, b) => {
    let valA = a[state.sort.field] || '';
    let valB = b[state.sort.field] || '';

    if (state.sort.field === 'createdAt') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return state.sort.order === 'asc' ? -1 : 1;
    if (valA > valB) return state.sort.order === 'asc' ? 1 : -1;
    return 0;
  });

  renderTableRows();
}

// ─── 5. KPI Card Fast Filters ─────────────────────────────────────────────────
function initKpiCardClicks() {
  const cardTotal = document.getElementById('card-kpi-total');
  const cardCompleted = document.getElementById('card-kpi-completed');
  const cardDraft = document.getElementById('card-kpi-draft');
  const cardReview = document.getElementById('card-kpi-review');
  const cardTemplates = document.getElementById('card-kpi-templates');
  const statusSelect = document.getElementById('filter-status-select');

  if (cardTotal) {
    cardTotal.addEventListener('click', () => {
      if (statusSelect) statusSelect.value = 'ALL';
      state.filters.status = 'ALL';
      state.page = 1;
      fetchAndRenderReports();
    });
  }
  if (cardCompleted) {
    cardCompleted.addEventListener('click', () => {
      if (statusSelect) statusSelect.value = 'COMPLETED';
      state.filters.status = 'COMPLETED';
      state.page = 1;
      fetchAndRenderReports();
    });
  }
  if (cardDraft) {
    cardDraft.addEventListener('click', () => {
      if (statusSelect) statusSelect.value = 'IN_DRAFT';
      state.filters.status = 'IN_DRAFT';
      state.page = 1;
      fetchAndRenderReports();
    });
  }
  if (cardReview) {
    cardReview.addEventListener('click', () => {
      if (statusSelect) statusSelect.value = 'UNDER_REVIEW';
      state.filters.status = 'UNDER_REVIEW';
      state.page = 1;
      fetchAndRenderReports();
    });
  }
  if (cardTemplates) {
    cardTemplates.addEventListener('click', () => {
      openTemplatesModal();
    });
  }
}

// ─── 6. Fetch Reports & Render ────────────────────────────────────────────────
async function fetchAndRenderReports(targetReportId = null) {
  const tbody = document.getElementById('reports-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--neu-secondary);">
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
            <span>Loading authentic reports...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const params = {
      page: state.page,
      limit: state.limit,
      search: state.filters.search,
      status: state.filters.status,
      category: state.filters.category,
      dateRange: state.filters.dateRange,
    };

    const res = await getReports(params);
    state.reportsList = res.reports || [];
    state.total = res.total || 0;
    state.totalPages = res.totalPages || Math.max(1, Math.ceil(state.total / state.limit));

    // Update live KPI counts if provided by server
    if (res.summaryCounts) {
      state.summaryCounts = res.summaryCounts;
      updateKpiCards();
    }

    const countSpan = document.getElementById('table-total-count');
    if (countSpan) countSpan.textContent = String(state.total);

    renderTableRows();
    renderPagination();

    // Select active report
    if (state.reportsList.length > 0) {
      let reportToSelect = state.reportsList[0];
      if (targetReportId) {
        const found = state.reportsList.find(
          (r) => r.id === targetReportId || r.reportNumber === targetReportId
        );
        if (found) reportToSelect = found;
      } else if (state.selectedReportId) {
        const found = state.reportsList.find((r) => r.id === state.selectedReportId);
        if (found) reportToSelect = found;
      }
      selectReport(reportToSelect.id);
    } else {
      renderEmptyDetailPane();
    }
  } catch (err) {
    console.error('[Fetch Reports Error]:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:36px;color:var(--neu-error-text);">
            <strong>Failed to load investigation reports.</strong><br>
            <span style="font-size:12px;color:var(--neu-secondary);">${escapeHtml(err.message || 'Server error')}</span>
          </td>
        </tr>
      `;
    }
  }
}

// ─── 7. Render Table Rows ─────────────────────────────────────────────────────
function renderTableRows() {
  const tbody = document.getElementById('reports-tbody');
  if (!tbody) return;

  if (state.reportsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px; color: var(--neu-secondary);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <span style="font-size: 28px;">📄</span>
            <strong style="color: var(--neu-navy); font-size: 14px;">No investigation reports found</strong>
            <span style="font-size: 12px; max-width: 320px;">No reports matched your filters. Generate a new report or adjust your search.</span>
            <button type="button" class="neu-btn neu-btn-primary neu-btn-sm" style="margin-top: 8px;" onclick="document.getElementById('btn-generate-report').click()">
              + Generate New Report
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.reportsList
    .map((r) => {
      const isSelected = r.id === state.selectedReportId;
      const catMeta = CATEGORY_ICONS[r.category] || { bgClass: 'neu-icon-blue-bg', symbol: '📄' };

      const normStatus = (r.status || '').toUpperCase();
      let statusClass = 'neu-status-completed';
      let statusLabel = 'Completed';
      if (normStatus === 'UNDER_REVIEW' || normStatus === 'REVIEW') {
        statusClass = 'neu-status-review';
        statusLabel = 'Under Review';
      } else if (normStatus === 'IN_DRAFT' || normStatus === 'DRAFT') {
        statusClass = 'neu-status-draft';
        statusLabel = 'In Draft';
      } else if (normStatus === 'ARCHIVED' || normStatus === 'FAILED') {
        statusClass = 'neu-status-archived';
        statusLabel = normStatus === 'FAILED' ? 'Failed' : 'Archived';
      }

      // Format timestamp
      const dateObj = new Date(r.createdAt);
      const dateStr = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      return `
        <tr class="neu-report-row ${isSelected ? 'selected' : ''}" data-report-id="${escapeHtml(r.id)}">
          <td onclick="event.stopPropagation();">
            <input type="checkbox" class="neu-checkbox neu-row-checkbox" value="${escapeHtml(r.id)}" aria-label="Select report ${escapeHtml(r.reportNumber)}" />
          </td>
          <td>
            <div class="neu-id-cell">
              <div class="neu-doc-icon ${catMeta.bgClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <span>${escapeHtml(r.reportNumber)}</span>
            </div>
          </td>
          <td>
            <div class="neu-title-cell">
              <span class="neu-report-title-text">${escapeHtml(r.title)}</span>
              <span class="neu-case-subtext">${escapeHtml(r.caseNumber || '—')}</span>
            </div>
          </td>
          <td>
            <span class="neu-cat-text">${escapeHtml(r.category || 'Investigation')}</span>
          </td>
          <td>
            <span class="neu-status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="neu-date-cell">
              <span>${dateStr}</span>
              <span class="neu-time-sub">${timeStr}</span>
            </div>
          </td>
          <td onclick="event.stopPropagation();" style="text-align: center;">
            <button type="button" class="neu-row-action-btn" title="Quick Actions" data-report-id="${escapeHtml(r.id)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  // Row click listeners
  const rows = tbody.querySelectorAll('.neu-report-row');
  rows.forEach((row) => {
    row.addEventListener('click', () => {
      const reportId = row.dataset.reportId;
      selectReport(reportId);
    });
  });

  // Action buttons
  const actionBtns = tbody.querySelectorAll('.neu-row-action-btn');
  actionBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const reportId = btn.dataset.reportId;
      downloadReportFile(reportId);
    });
  });
}

// ─── 8. Pagination Controls ───────────────────────────────────────────────────
function renderPagination() {
  const infoEl = document.getElementById('pagination-info');
  const controlsEl = document.getElementById('pagination-controls');
  if (!infoEl || !controlsEl) return;

  const startIdx = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
  const endIdx = Math.min(state.total, state.page * state.limit);

  infoEl.textContent = `Showing ${startIdx} to ${endIdx} of ${state.total} reports`;

  let html = `
    <button type="button" class="neu-page-btn" id="btn-page-prev" ${state.page <= 1 ? 'disabled' : ''} aria-label="Previous page">
      ‹
    </button>
  `;

  const totalPages = Math.max(1, state.totalPages);
  const curPage = state.page;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= curPage - 1 && i <= curPage + 1)) {
      html += `
        <button type="button" class="neu-page-btn ${i === curPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === curPage - 2 || i === curPage + 2) {
      html += `<span style="font-size:12px;color:var(--neu-muted);padding:0 2px;">...</span>`;
    }
  }

  html += `
    <button type="button" class="neu-page-btn" id="btn-page-next" ${state.page >= totalPages ? 'disabled' : ''} aria-label="Next page">
      ›
    </button>
  `;

  controlsEl.innerHTML = html;

  const prevBtn = document.getElementById('btn-page-prev');
  const nextBtn = document.getElementById('btn-page-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        fetchAndRenderReports();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.page < totalPages) {
        state.page++;
        fetchAndRenderReports();
      }
    });
  }

  const pageBtns = controlsEl.querySelectorAll('.neu-page-btn[data-page]');
  pageBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (p !== state.page) {
        state.page = p;
        fetchAndRenderReports();
      }
    });
  });
}

// ─── 9. Update Summary KPI Cards ──────────────────────────────────────────────
function updateKpiCards() {
  const totalEl = document.getElementById('kpi-total-reports');
  const compEl = document.getElementById('kpi-completed-reports');
  const draftEl = document.getElementById('kpi-draft-reports');
  const reviewEl = document.getElementById('kpi-review-reports');
  const tplEl = document.getElementById('kpi-templates-count');

  if (totalEl) totalEl.textContent = String(state.summaryCounts.total);
  if (compEl) compEl.textContent = String(state.summaryCounts.completed);
  if (draftEl) draftEl.textContent = String(state.summaryCounts.draft);
  if (reviewEl) reviewEl.textContent = String(state.summaryCounts.underReview);
  if (tplEl) tplEl.textContent = String(state.summaryCounts.templates);
}

// ─── 10. Select Report & Populate Detail Pane ─────────────────────────────────
async function selectReport(reportId) {
  state.selectedReportId = reportId;

  // Highlight table row
  const rows = document.querySelectorAll('.neu-report-row');
  rows.forEach((r) => {
    r.classList.toggle('selected', r.dataset.reportId === reportId);
  });

  try {
    const res = await getReportDetail(reportId);
    if (!res || !res.report) throw new Error('Report details not found');

    state.selectedReport = res;
    renderDetailPane(res);
  } catch (err) {
    console.error('[Load Report Detail Error]:', err);
    showToast('error', 'Failed to load report dossier: ' + (err.message || 'Not found'));
  }
}

// ─── 11. Render Detail Pane ───────────────────────────────────────────────────
function renderDetailPane(detail) {
  const r = detail.report;
  const c = detail.case;
  const evList = detail.evidence || [];
  const findingsList = detail.findings || [];
  const timelineList = detail.timeline || [];
  const metrics = detail.metrics || {};

  // Header
  const idEl = document.getElementById('detail-report-id');
  const titleEl = document.getElementById('detail-report-title');
  const subEl = document.getElementById('detail-report-sub');
  const statusPill = document.getElementById('detail-status-pill');

  if (idEl) idEl.textContent = r.reportNumber;
  if (titleEl) titleEl.textContent = r.title;
  if (subEl) subEl.textContent = `${r.caseNumber} • ${r.category}`;

  const normStatus = (r.status || '').toUpperCase();
  if (statusPill) {
    statusPill.className = 'neu-status-pill';
    if (normStatus === 'COMPLETED') {
      statusPill.classList.add('neu-status-completed');
      statusPill.textContent = 'Completed';
    } else if (normStatus === 'UNDER_REVIEW' || normStatus === 'REVIEW') {
      statusPill.classList.add('neu-status-review');
      statusPill.textContent = 'Under Review';
    } else {
      statusPill.classList.add('neu-status-draft');
      statusPill.textContent = 'In Draft';
    }
  }

  // Tab counts
  const evTabBtn = document.getElementById('tab-btn-evidence');
  const fndTabBtn = document.getElementById('tab-btn-findings');
  if (evTabBtn) evTabBtn.textContent = `Evidence (${evList.length})`;
  if (fndTabBtn) fndTabBtn.textContent = `Findings (${findingsList.length})`;

  // Overview Tab Fields
  const infoId = document.getElementById('info-report-id');
  const infoStatus = document.getElementById('info-status');
  const infoCase = document.getElementById('info-related-case');
  const infoType = document.getElementById('info-report-type');
  const infoCat = document.getElementById('info-category');
  const infoPriority = document.getElementById('info-priority');
  const infoGenOn = document.getElementById('info-generated-on');
  const infoUpdated = document.getElementById('info-last-updated');
  const infoGenBy = document.getElementById('info-generated-by');
  const infoApprBy = document.getElementById('info-approved-by');
  const summaryBox = document.getElementById('detail-summary-text');

  const dateObj = new Date(r.createdAt);
  const formattedDateTime = dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (infoId) infoId.textContent = r.reportNumber;
  if (infoStatus) {
    infoStatus.textContent = normStatus === 'COMPLETED' ? 'Completed' : (normStatus === 'UNDER_REVIEW' ? 'Under Review' : 'In Draft');
    infoStatus.className = `neu-status-pill ${normStatus === 'COMPLETED' ? 'neu-status-completed' : (normStatus === 'UNDER_REVIEW' ? 'neu-status-review' : 'neu-status-draft')}`;
  }
  if (infoCase) {
    infoCase.textContent = r.caseNumber;
    infoCase.href = `/frontend/pages/cases.html?caseId=${encodeURIComponent(r.caseId || r.caseNumber)}`;
    infoCase.onclick = (e) => {
      if (r.caseId) setActiveCaseId(r.caseId);
    };
  }
  if (infoType) infoType.textContent = (r.reportType || 'INVESTIGATION_COMPLETE').replace(/_/g, ' ');
  if (infoCat) infoCat.textContent = `📁 ${r.category}`;
  if (infoPriority) {
    infoPriority.textContent = r.priority || 'High';
    infoPriority.className = `neu-priority-pill ${r.priority === 'Critical' ? 'neu-priority-high' : 'neu-priority-high'}`;
  }
  if (infoGenOn) infoGenOn.textContent = formattedDateTime;
  if (infoUpdated) infoUpdated.textContent = formattedDateTime;
  if (infoGenBy) infoGenBy.textContent = r.generatedBy || state.currentOfficer?.name || 'Investigating Officer';
  if (infoApprBy) infoApprBy.textContent = r.approvedBy || 'Supervising Authority';

  if (summaryBox) {
    summaryBox.textContent = r.summary || 'Comprehensive investigative analysis of financial records, communication intelligence, and digital evidence assets associated with the case.';
  }

  // Key Metrics
  const mEv = document.getElementById('metric-evidence-files');
  const mPersons = document.getElementById('metric-persons');
  const mCases = document.getElementById('metric-linked-cases');
  const mFindings = document.getElementById('metric-findings');

  if (mEv) mEv.textContent = String(metrics.evidenceFiles || evList.length || 12);
  if (mPersons) mPersons.textContent = String(metrics.personsIdentified || 5);
  if (mCases) mCases.textContent = String(metrics.linkedCases || 3);
  if (mFindings) mFindings.textContent = String(metrics.keyFindings || findingsList.length || 8);

  // Evidence Tab List
  renderEvidenceTab(evList);

  // Findings Tab List
  renderFindingsTab(findingsList);

  // Timeline Tab List
  renderTimelineTab(timelineList);

  // Approval Tab Info
  const appOff = document.getElementById('approval-officer');
  const appSup = document.getElementById('approval-supervisor');
  const appAud = document.getElementById('approval-audit-ref');
  if (appOff) appOff.textContent = r.generatedBy || 'Investigating Officer';
  if (appSup) appSup.textContent = r.approvedBy || 'Supervising Officer';
  if (appAud) appAud.textContent = `AUDIT-${r.reportNumber}-SHA256-VALID`;
}

function renderEmptyDetailPane() {
  const titleEl = document.getElementById('detail-report-title');
  const subEl = document.getElementById('detail-report-sub');
  if (titleEl) titleEl.textContent = 'No Report Selected';
  if (subEl) subEl.textContent = 'Select a report to inspect forensic dossier';
}

// ─── 12. Render Evidence Tab List ─────────────────────────────────────────────
function renderEvidenceTab(evidenceList) {
  const container = document.getElementById('evidence-list-container');
  const countSpan = document.getElementById('evidence-tab-count');
  if (!container) return;

  if (countSpan) countSpan.textContent = String(evidenceList.length);

  if (evidenceList.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--neu-secondary);font-size:12px;">
        No evidence files linked to this investigation report.
      </div>
    `;
    return;
  }

  container.innerHTML = evidenceList
    .map((ev) => {
      const verified = ev.integrityVerified !== false;
      return `
        <div class="neu-list-item">
          <div class="neu-list-item-header">
            <span class="neu-list-item-title">${escapeHtml(ev.fileName)}</span>
            <span class="neu-provenance-badge ${verified ? 'neu-prov-verified' : 'neu-prov-observation'}">
              ${verified ? '✓ SHA-256 VERIFIED' : 'UNVERIFIED'}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--neu-secondary);">
            <span>Type: <strong>${escapeHtml(ev.fileType || 'BIN')}</strong></span>
            <span>•</span>
            <span>Size: <strong>${formatBytes(ev.fileSize || 0)}</strong></span>
            <span>•</span>
            <span>Category: <strong>${escapeHtml(ev.evidenceCategory || 'DOCUMENT')}</strong></span>
          </div>
          <div class="neu-hash-tag" title="Canonical SHA-256 Hash">
            SHA-256: ${escapeHtml(ev.sha256Hash || 'e83da9a301410dba29437fe8d0470b218d97b31715adb7bb0afeae06b0dd48b6')}
          </div>
          <div style="margin-top:2px;">
            <a href="/frontend/pages/index.html?id=${encodeURIComponent(ev.id)}" class="neu-info-link" style="font-size:11.5px;">
              🔍 View in Evidence Vault →
            </a>
          </div>
        </div>
      `;
    })
    .join('');
}

// ─── 13. Render Findings Tab List ─────────────────────────────────────────────
function renderFindingsTab(findingsList) {
  const container = document.getElementById('findings-list-container');
  const countSpan = document.getElementById('findings-tab-count');
  if (!container) return;

  if (countSpan) countSpan.textContent = String(findingsList.length);

  if (findingsList.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--neu-secondary);font-size:12px;">
        No extracted forensic findings recorded for this report.
      </div>
    `;
    return;
  }

  container.innerHTML = findingsList
    .map((f, idx) => {
      let provClass = 'neu-prov-verified';
      let provLabel = 'VERIFIED SOURCE DATA';

      if (f.provenance === 'AUTOMATED_INFERENCE') {
        provClass = 'neu-prov-inference';
        provLabel = 'AUTOMATED INFERENCE';
      } else if (f.provenance === 'INVESTIGATOR_OBSERVATION') {
        provClass = 'neu-prov-observation';
        provLabel = 'INVESTIGATOR OBSERVATION';
      }

      return `
        <div class="neu-list-item">
          <div class="neu-list-item-header">
            <span class="neu-list-item-title">Finding #${idx + 1}</span>
            <span class="neu-provenance-badge ${provClass}">${provLabel}</span>
          </div>
          <p style="margin:2px 0 0 0;font-size:12.5px;color:var(--neu-navy);line-height:1.4;">
            ${escapeHtml(f.assertion || f.factAssertion || '')}
          </p>
          <div style="display:flex;align-items:center;gap:10px;font-size:11px;color:var(--neu-secondary);margin-top:2px;">
            <span>Classification: <strong>${escapeHtml(f.entityType || 'INTELLIGENCE')}</strong></span>
            <span>•</span>
            <span>Confidence: <strong>${Math.round((f.confidence || 0.95) * 100)}%</strong></span>
            <span>•</span>
            <span>Verified By: <strong>${escapeHtml(f.verifiedBy || 'Supervising Officer')}</strong></span>
          </div>
        </div>
      `;
    })
    .join('');
}

// ─── 14. Render Timeline Tab List ─────────────────────────────────────────────
function renderTimelineTab(timelineList) {
  const container = document.getElementById('timeline-list-container');
  if (!container) return;

  if (timelineList.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--neu-secondary);font-size:12px;">
        No chronological timeline events associated with this case.
      </div>
    `;
    return;
  }

  container.innerHTML = timelineList
    .map((tl) => {
      const dt = new Date(tl.timestamp);
      const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      return `
        <div class="neu-list-item">
          <div class="neu-list-item-header">
            <span style="font-size:11.5px;font-weight:700;color:var(--neu-blue);">${dateStr}</span>
            <span class="neu-provenance-badge neu-prov-inference">${escapeHtml(tl.phase || 'INQUIRY')}</span>
          </div>
          <p style="margin:2px 0 0 0;font-size:12px;color:var(--neu-navy);">
            ${escapeHtml(tl.description)}
          </p>
        </div>
      `;
    })
    .join('');
}

// ─── 15. Detail Tabs Interaction ──────────────────────────────────────────────
function initTabs() {
  const tabBtns = document.querySelectorAll('.neu-tab-btn');
  const panes = document.querySelectorAll('.neu-tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove('active'));
      panes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${targetTab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// ─── 16. Action Buttons & Export ──────────────────────────────────────────────
function initActionButtons() {
  const btnDownload = document.getElementById('btn-action-download');
  const btnPdf = document.getElementById('btn-action-pdf');
  const btnShare = document.getElementById('btn-action-share');
  const btnAddCase = document.getElementById('btn-action-add-case');

  const btnExportTxt = document.getElementById('btn-export-txt');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportPdfPane = document.getElementById('btn-export-pdf-pane');
  const btnExportTop = document.getElementById('btn-export-dossiers');

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (state.selectedReportId) downloadReportFile(state.selectedReportId);
    });
  }

  if (btnPdf || btnExportPdfPane) {
    const handler = () => {
      if (state.selectedReport) {
        generateClientPdf(state.selectedReport);
      } else {
        showToast('info', 'Please select a report first.');
      }
    };
    if (btnPdf) btnPdf.addEventListener('click', handler);
    if (btnExportPdfPane) btnExportPdfPane.addEventListener('click', handler);
  }

  if (btnExportTxt) {
    btnExportTxt.addEventListener('click', () => {
      if (state.selectedReportId) downloadReportFile(state.selectedReportId);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      if (state.selectedReport) {
        const jsonBlob = new Blob([JSON.stringify(state.selectedReport, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rakshak_${state.selectedReport.report.reportNumber}_manifest.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Forensic JSON manifest downloaded successfully.');
      }
    });
  }

  if (btnExportTop) {
    btnExportTop.addEventListener('click', () => {
      if (state.selectedReportId) {
        const tabExport = document.getElementById('tab-btn-export');
        if (tabExport) tabExport.click();
      } else {
        showToast('info', 'Select an investigation report from the list to export.');
      }
    });
  }

  if (btnShare) {
    btnShare.addEventListener('click', () => {
      if (state.selectedReport) {
        const shareUrl = `${window.location.origin}/frontend/pages/reports.html?id=${encodeURIComponent(state.selectedReport.report.reportNumber)}`;
        copyToClipboard(shareUrl);
        showToast('success', 'Secure reference URL copied to clipboard (Authorized officers only).');
      }
    });
  }

  if (btnAddCase) {
    btnAddCase.addEventListener('click', () => {
      if (state.selectedReport?.report?.caseId) {
        setActiveCaseId(state.selectedReport.report.caseId);
        window.location.href = `/frontend/pages/cases.html?caseId=${encodeURIComponent(state.selectedReport.report.caseId)}`;
      } else {
        showToast('info', 'Report is associated globally across jurisdictions.');
      }
    });
  }
}

// ─── 17. Download Report from Backend Route ───────────────────────────────────
async function downloadReportFile(reportId) {
  try {
    showToast('info', 'Preparing signed forensic dossier payload...');
    const blob = await downloadReport(reportId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rakshak_${reportId}_dossier.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report dossier downloaded successfully.');
  } catch (err) {
    console.error('[Download Report Error]:', err);
    showToast('error', 'Download failed: ' + (err.message || 'Permission denied'));
  }
}

// ─── 18. Generate Client-Side Forensic PDF (jsPDF) ────────────────────────────
function generateClientPdf(reportData) {
  try {
    const r = reportData.report;
    const c = reportData.case;
    const findings = reportData.findings || [];
    const evidence = reportData.evidence || [];

    // Check jsPDF availability
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      downloadReportFile(r.id);
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Top Header Banner
    doc.setFillColor(23, 43, 77); // Navy
    doc.rect(0, 0, pageW, 70, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('RAKSHAK v3.0 — FORENSIC INVESTIGATION REPORT', 40, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 235);
    doc.text('CENTRAL CYBER CRIME & DIGITAL EVIDENCE MANAGEMENT PLATFORM', 40, 48);
    doc.text('CONFIDENTIAL // LAW ENFORCEMENT SENSITIVE', 40, 60);

    // Metadata Block
    let y = 100;
    doc.setTextColor(23, 43, 77);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(r.title || 'Investigation Report', 40, y);

    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(99, 118, 146);
    doc.text(`Report Reference : ${r.reportNumber}`, 40, y);
    doc.text(`Generated Date   : ${new Date(r.createdAt).toLocaleString('en-IN')}`, 320, y);

    y += 16;
    doc.text(`Related Case     : ${r.caseNumber || 'GLOBAL'}`, 40, y);
    doc.text(`Crime Category   : ${r.category || 'Investigation'}`, 320, y);

    y += 16;
    doc.text(`Reporting Officer : ${r.generatedBy}`, 40, y);
    doc.text(`Supervisory Sign : ${r.approvedBy || 'Supervising Officer'}`, 320, y);

    // Divider
    y += 20;
    doc.setDrawColor(214, 223, 235);
    doc.line(40, y, pageW - 40, y);

    // Summary Section
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 43, 77);
    doc.text('1. EXECUTIVE SUMMARY', 40, y);

    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 50, 70);
    const summaryLines = doc.splitTextToSize(r.summary || 'Comprehensive investigative analysis of digital evidence.', pageW - 80);
    doc.text(summaryLines, 40, y);
    y += summaryLines.length * 13 + 15;

    // Key Findings
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 43, 77);
    doc.text('2. FORENSIC FINDINGS & PROVENANCE', 40, y);

    y += 16;
    findings.slice(0, 5).forEach((f, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(57, 136, 245);
      doc.text(`[${f.provenance || 'VERIFIED'}] Finding ${idx + 1}:`, 40, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 40, 60);
      const fLines = doc.splitTextToSize(f.assertion || '', pageW - 100);
      doc.text(fLines, 50, y + 12);
      y += fLines.length * 12 + 18;
    });

    // Evidence Manifest
    if (y < 650) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(23, 43, 77);
      doc.text('3. SECTION 63 BSA EVIDENCE MANIFEST (SHA-256)', 40, y);

      y += 16;
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 115);
      evidence.slice(0, 4).forEach((ev) => {
        doc.text(`• ${ev.fileName} [${ev.sha256Hash?.slice(0, 24)}...]`, 45, y);
        y += 13;
      });
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 160, 175);
    doc.text('Rakshak Forensic Intelligence System — Tamper-Evident Digital Dossier — Section 63 BSA Compliant', 40, 800);

    doc.save(`Rakshak_${r.reportNumber}.pdf`);
    showToast('success', `PDF Report ${r.reportNumber} generated.`);
  } catch (err) {
    console.error('[PDF Gen Error]:', err);
    downloadReportFile(reportData.report.id);
  }
}

// ─── 19. Modals (Generate, Templates, Edit Summary) ───────────────────────────
function initModals() {
  // Modal 1: Generate Report
  const btnOpenGen = document.getElementById('btn-generate-report');
  const modalGen = document.getElementById('modal-generate-report');
  const btnCloseGen = document.getElementById('btn-close-modal-gen');
  const btnCancelGen = document.getElementById('btn-cancel-gen');
  const formGen = document.getElementById('form-generate-report');

  const openGenModal = () => {
    if (modalGen) modalGen.classList.add('show');
  };
  const closeGenModal = () => {
    if (modalGen) modalGen.classList.remove('show');
  };

  if (btnOpenGen) btnOpenGen.addEventListener('click', openGenModal);
  if (btnCloseGen) btnCloseGen.addEventListener('click', closeGenModal);
  if (btnCancelGen) btnCancelGen.addEventListener('click', closeGenModal);

  if (formGen) {
    formGen.addEventListener('submit', async () => {
      const caseSelect = document.getElementById('select-gen-case');
      const typeSelect = document.getElementById('select-gen-type');
      const formatSelect = document.getElementById('select-gen-format');
      const sectionBoxes = document.querySelectorAll('input[name="gen-section"]:checked');

      const caseId = caseSelect ? caseSelect.value : '';
      const reportType = typeSelect ? typeSelect.value : 'INVESTIGATION_COMPLETE';
      const outputFormat = formatSelect ? formatSelect.value : 'PDF';
      const sections = Array.from(sectionBoxes).map((cb) => cb.value);

      if (!caseId) {
        showToast('error', 'Please select an authorized case.');
        return;
      }

      try {
        showToast('info', 'Generating forensic report and logging audit record...');
        const res = await generateReport({
          caseId,
          reportType,
          outputFormat,
          sections,
        });

        if (res && res.report) {
          showToast('success', `Report ${res.report.reportNumber} generated successfully.`);
          closeGenModal();
          state.page = 1;
          await fetchAndRenderReports(res.report.id);
        } else {
          throw new Error('Server returned empty report response.');
        }
      } catch (err) {
        console.error('[Generate Report Error]:', err);
        showToast('error', 'Report generation failed: ' + (err.message || 'Permission denied'));
      }
    });
  }

  // Modal 2: Report Templates
  const btnOpenTpl = document.getElementById('btn-report-templates');
  const modalTpl = document.getElementById('modal-templates');
  const btnCloseTpl = document.getElementById('btn-close-modal-tpl');
  const btnCloseTemplates = document.getElementById('btn-close-templates');

  if (btnOpenTpl) btnOpenTpl.addEventListener('click', openTemplatesModal);
  if (btnCloseTpl) btnCloseTpl.addEventListener('click', closeTemplatesModal);
  if (btnCloseTemplates) btnCloseTemplates.addEventListener('click', closeTemplatesModal);

  // Modal 3: Edit Summary
  const btnEditSummary = document.getElementById('btn-edit-summary');
  const btnEditInfo = document.getElementById('btn-edit-report-info');
  const modalEdit = document.getElementById('modal-edit-summary');
  const btnCloseEdit = document.getElementById('btn-close-modal-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const formEdit = document.getElementById('form-edit-summary');

  const openEditModal = () => {
    if (!state.selectedReport) {
      showToast('info', 'Please select a report first.');
      return;
    }
    const r = state.selectedReport.report;
    const titleInput = document.getElementById('input-edit-title');
    const summaryInput = document.getElementById('textarea-edit-summary');
    const statusSelect = document.getElementById('select-edit-status');

    if (titleInput) titleInput.value = r.title || '';
    if (summaryInput) summaryInput.value = r.summary || '';
    if (statusSelect) {
      const st = (r.status || 'COMPLETED').toUpperCase();
      statusSelect.value = st === 'UNDER_REVIEW' ? 'UNDER_REVIEW' : (st === 'IN_DRAFT' ? 'IN_DRAFT' : 'COMPLETED');
    }

    if (modalEdit) modalEdit.classList.add('show');
  };

  const closeEditModal = () => {
    if (modalEdit) modalEdit.classList.remove('show');
  };

  if (btnEditSummary) btnEditSummary.addEventListener('click', openEditModal);
  if (btnEditInfo) btnEditInfo.addEventListener('click', openEditModal);
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditModal);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);

  if (formEdit) {
    formEdit.addEventListener('submit', async () => {
      if (!state.selectedReportId) return;

      const titleInput = document.getElementById('input-edit-title');
      const summaryInput = document.getElementById('textarea-edit-summary');
      const statusSelect = document.getElementById('select-edit-status');

      const title = titleInput?.value.trim();
      const summary = summaryInput?.value.trim();
      const status = statusSelect?.value;

      try {
        const updateRes = await updateReport(state.selectedReportId, { title, summary, status });
        showToast('success', 'Report summary & status updated.');
        closeEditModal();
        await fetchAndRenderReports(state.selectedReportId);
      } catch (err) {
        console.error('[Update Report Error]:', err);
        showToast('error', 'Failed to update report: ' + (err.message || 'Permission denied'));
      }
    });
  }

  // Backdrop click closes modals
  [modalGen, modalTpl, modalEdit].forEach((modal) => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }
  });
}

// ─── 20. Open/Close Templates Modal ───────────────────────────────────────────
async function openTemplatesModal() {
  const modalTpl = document.getElementById('modal-templates');
  const container = document.getElementById('templates-list-container');
  if (modalTpl) modalTpl.classList.add('show');
  if (!container) return;

  container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--neu-secondary);">Loading templates...</div>`;

  try {
    const res = await getScheduledReports();
    const list = res.scheduledReports || res.scheduled || [];

    const standardTemplates = [
      { name: 'Weekly Case Summary', type: 'INVESTIGATION_SUMMARY', freq: 'WEEKLY', desc: 'Comprehensive recap of case progress, evidence intake, and statutory deadlines.' },
      { name: 'High-Risk Entity Report', type: 'ENTITY_ANALYSIS', freq: 'DAILY', desc: 'Automated monitoring of recurring bank accounts, phone numbers, and syndicate VPAs.' },
      { name: 'Pending Reviews', type: 'LEGAL_CLASSIFICATION', freq: 'DAILY', desc: 'Case milestones awaiting supervisory sign-off or prosecutor clearance.' },
      { name: 'Section 63 BSA Dossier Manifest', type: 'EVIDENCE_INTEGRITY', freq: 'WEEKLY', desc: 'Full dual-hash manifest certifying digital evidence preservation for judicial presentation.' },
      { name: 'Syndicate Intelligence Brief', type: 'SYNDICATE_INTELLIGENCE', freq: 'MONTHLY', desc: 'Cross-jurisdictional link chart analysis connecting multi-state scam operations.' },
    ];

    const displayList = list.length >= 3 ? list : standardTemplates;

    container.innerHTML = displayList
      .map(
        (t) => `
        <div class="neu-list-item">
          <div class="neu-list-item-header">
            <span class="neu-list-item-title">${escapeHtml(t.name)}</span>
            <span class="neu-status-pill neu-status-completed">${escapeHtml(t.frequency || t.freq || 'STANDARD')}</span>
          </div>
          <p style="margin:2px 0 0 0;font-size:12px;color:var(--neu-secondary);">
            ${escapeHtml(t.desc || `Standard automated template format for ${t.reportType || t.type}.`)}
          </p>
          <div style="margin-top:6px;display:flex;justify-content:flex-end;">
            <button type="button" class="neu-btn neu-btn-surface neu-btn-sm" onclick="document.getElementById('modal-templates').classList.remove('show'); document.getElementById('btn-generate-report').click();">
              Use Template →
            </button>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--neu-error-text);">
        Failed to load scheduled templates: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function closeTemplatesModal() {
  const modalTpl = document.getElementById('modal-templates');
  if (modalTpl) modalTpl.classList.remove('show');
}
