/**
 * Rakshak v3.0 — Cases Management & Case Details Controller
 * Light-neumorphic case listing, server-side filtering, interactive selection,
 * case detail inspection, timeline activity, and authorized creation/editing.
 */

import {
  getCurrentOfficerSession,
  logoutOfficer,
  getCases,
  getCase,
  createCase,
  patchCase,
  getCaseTimeline,
  getCaseEvidence,
  setActiveCaseId,
  ACTIVE_CASE_ID,
} from './api.js';
import {
  escapeHtml,
  formatIST,
  formatINR,
  showToast,
} from './utils.js';

let currentOfficer = null;

let state = {
  cases: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  search: '',
  statusFilter: '',
  typeFilter: '',
  dateRange: '30',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedCaseId: null,
  selectedCaseData: null,
};

let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', initCasesPage);

async function initCasesPage() {
  // ─── 1. Authenticate & Session Guard ─────────────────────────────────────────
  try {
    const session = await getCurrentOfficerSession();
    if (!session || !session.authenticated || !session.officer) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/frontend/pages/login.html?returnUrl=${returnUrl}`);
      return;
    }
    currentOfficer = session.officer;
  } catch (_) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/frontend/pages/login.html?returnUrl=${returnUrl}`);
    return;
  }

  // ─── 2. Topbar & Officer Shell Setup ─────────────────────────────────────────
  setupOfficerHeader(currentOfficer);
  setupSidebarNavigation(currentOfficer);

  // ─── 3. Check Initial URL Query Parameters ──────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q');
  const caseIdParam = urlParams.get('caseId') || urlParams.get('id') || ACTIVE_CASE_ID;
  const actionParam = urlParams.get('action');

  if (qParam) {
    state.search = qParam.trim();
    const searchInput = document.getElementById('cases-search');
    if (searchInput) searchInput.value = state.search;
  }

  if (caseIdParam && caseIdParam !== 'null' && caseIdParam !== 'undefined') {
    state.selectedCaseId = caseIdParam;
  }

  // ─── 4. Bind Table & Filter Events ──────────────────────────────────────────
  bindFilterEvents();
  bindModalEvents();
  bindDetailTabEvents();

  // ─── 5. Fetch Initial Cases List ────────────────────────────────────────────
  await fetchAndRenderCases();

  // If action=new was passed in query, open creation modal
  if (actionParam === 'new') {
    openCreateCaseModal();
  }
}

// ─── Shell Setup ──────────────────────────────────────────────────────────────
function setupOfficerHeader(officer) {
  const nameEl = document.getElementById('officer-display-name');
  const deptEl = document.getElementById('officer-display-dept');

  if (nameEl) nameEl.textContent = officer.name || 'Officer';
  if (deptEl) deptEl.textContent = officer.unit || officer.jurisdiction || 'Investigation Unit';

  const profileFullName = document.getElementById('profile-full-name');
  const profileBadgeNum = document.getElementById('profile-badge-num');
  const profileRoleTag = document.getElementById('profile-role-tag');
  const profileJur = document.getElementById('profile-jurisdiction');

  if (profileFullName) profileFullName.textContent = `${officer.designation || 'Officer'} ${officer.name}`;
  if (profileBadgeNum) profileBadgeNum.textContent = `Badge: ${officer.badgeNumber || 'N/A'}`;
  if (profileRoleTag) profileRoleTag.textContent = `Role: ${officer.role || 'INVESTIGATOR'}`;
  if (profileJur) profileJur.textContent = officer.jurisdiction || 'Department Scoped';

  const profilePill = document.getElementById('officer-profile-pill');
  const dropdown = document.getElementById('profile-dropdown');

  if (profilePill && dropdown) {
    profilePill.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.classList.contains('show');
      dropdown.classList.toggle('show', !isVisible);
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });
  }

  const logoutBtn = document.getElementById('btn-officer-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logoutOfficer();
      } catch (_) {}
      window.location.href = '/frontend/pages/login.html?loggedOut=1';
    });
  }

  // Global topbar search
  const globalSearchForm = document.getElementById('global-search-form');
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchForm && globalSearchInput) {
    globalSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = globalSearchInput.value.trim();
      const localSearch = document.getElementById('cases-search');
      if (localSearch) localSearch.value = q;
      state.search = q;
      state.page = 1;
      fetchAndRenderCases();
    });
  }
}

function setupSidebarNavigation(officer) {
  const isAdmin = officer.role === 'ADMIN';
  const permissions = officer.permissions || [];

  const crossDeptLink = document.getElementById('nav-cross-dept');
  const adminLink = document.getElementById('nav-admin');
  const auditLink = document.getElementById('nav-audit');

  if (crossDeptLink && (isAdmin || permissions.includes('case:transfer'))) {
    crossDeptLink.style.display = 'flex';
  }
  if (adminLink && isAdmin) {
    adminLink.style.display = 'flex';
  }
  if (auditLink && (isAdmin || permissions.includes('audit:view'))) {
    auditLink.style.display = 'flex';
  }

  // Sidebar Dept Card
  const sidebarDeptTitle = document.getElementById('sidebar-dept-title');
  const sidebarDeptSub = document.getElementById('sidebar-dept-sub');
  if (sidebarDeptTitle) sidebarDeptTitle.textContent = officer.unit || 'Cyber Crime Branch';
  if (sidebarDeptSub) sidebarDeptSub.textContent = officer.jurisdiction || 'Delhi Police';
}

// ─── Filter & Search Bindings ─────────────────────────────────────────────────
function bindFilterEvents() {
  const searchInput = document.getElementById('cases-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        fetchAndRenderCases();
      }, 300);
    });
  }

  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  const typeSelect = document.getElementById('filter-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      state.typeFilter = e.target.value;
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  const dateSelect = document.getElementById('filter-date-range');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      state.dateRange = e.target.value;
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = '';
      if (typeSelect) typeSelect.value = '';
      if (dateSelect) dateSelect.value = 'all';

      state.search = '';
      state.statusFilter = '';
      state.typeFilter = '';
      state.dateRange = 'all';
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  // Sortable column headers
  bindSortHeader('th-sort-caseNumber', 'caseNumber');
  bindSortHeader('th-sort-title', 'complainantName');
  bindSortHeader('th-sort-type', 'incidentType');
  bindSortHeader('th-sort-status', 'status');
  bindSortHeader('th-sort-updatedAt', 'updatedAt');
}

function bindSortHeader(elementId, field) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.addEventListener('click', () => {
    if (state.sortBy === field) {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortBy = field;
      state.sortOrder = 'desc';
    }
    fetchAndRenderCases();
  });
}

// ─── Fetch Cases from Live Backend ────────────────────────────────────────────
async function fetchAndRenderCases() {
  const tbody = document.getElementById('cases-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="neu-empty-row">
            <span class="neu-spinner"></span>
            <span>Loading investigation cases…</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const params = {
      page: state.page,
      limit: state.limit,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    };
    if (state.search) params.q = state.search;
    if (state.statusFilter) params.status = state.statusFilter;
    if (state.typeFilter) params.type = state.typeFilter;

    const res = await getCases(params);

    state.cases = res.cases || [];
    state.total = res.total || 0;
    state.totalPages = res.totalPages || Math.ceil(state.total / state.limit) || 1;

    renderCasesTable(state.cases);
    renderPagination();

    // Auto-select first case if none selected, or restore active selected case
    if (state.cases.length > 0) {
      const match = state.cases.find(c => c.caseNumber === state.selectedCaseId || c.id === state.selectedCaseId);
      if (match) {
        selectCase(match.caseNumber || match.id);
      } else {
        selectCase(state.cases[0].caseNumber || state.cases[0].id);
      }
    } else {
      renderEmptyCaseDetails();
    }

  } catch (err) {
    console.error('[Cases] Error fetching cases:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="neu-empty-row" style="color:var(--neu-error)">
              <span>Failed to load investigation cases from server.</span>
              <button class="neu-btn-secondary" id="btn-retry-fetch" style="margin-top:6px">Retry</button>
            </div>
          </td>
        </tr>
      `;
      const retryBtn = document.getElementById('btn-retry-fetch');
      if (retryBtn) retryBtn.addEventListener('click', fetchAndRenderCases);
    }
    renderEmptyCaseDetails();
  }
}

// ─── Table Rendering ──────────────────────────────────────────────────────────
function renderCasesTable(cases) {
  const tbody = document.getElementById('cases-table-body');
  const countLabel = document.getElementById('cases-count-label');

  if (countLabel) {
    const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
    const end = Math.min(state.page * state.limit, state.total);
    countLabel.textContent = `Showing ${start} to ${end} of ${state.total} cases`;
  }

  if (!tbody) return;

  if (cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="neu-empty-row">
            <span style="font-size:28px">📁</span>
            <span style="font-weight:700;color:var(--neu-navy)">No investigation cases found</span>
            <span style="font-size:11.5px;color:var(--neu-secondary)">Try adjusting your search criteria or register a new case.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cases.map(c => {
    const caseId = c.caseNumber || c.id;
    const isSelected = caseId === state.selectedCaseId;
    const title = c.title || c.complainantName || 'Investigation Case';
    const desc = c.description || c.incidentType?.replace(/_/g, ' ') || 'No summary registered';
    const categoryInfo = getCategoryBadge(c.incidentType);
    const statusInfo = getStatusPill(c.status);
    const dateFormatted = c.updatedAt ? formatCaseDate(c.updatedAt) : '—';

    return `
      <tr class="neu-case-row ${isSelected ? 'selected' : ''}" data-case-id="${escapeHtml(caseId)}">
        <td style="text-align:center" onclick="event.stopPropagation()">
          <input type="checkbox" class="neu-row-checkbox" value="${escapeHtml(caseId)}" aria-label="Select case ${escapeHtml(caseId)}" />
        </td>
        <td class="neu-col-case-num">${escapeHtml(caseId)}</td>
        <td>
          <div class="neu-col-title-wrap">
            <span class="neu-col-title">${escapeHtml(title)}</span>
            <span class="neu-col-desc">${escapeHtml(desc)}</span>
          </div>
        </td>
        <td>
          <div class="neu-col-category-wrap">
            <span class="neu-cat-icon-badge" style="background:${categoryInfo.bg};color:${categoryInfo.color}">${categoryInfo.icon}</span>
            <span class="neu-cat-name">${escapeHtml(categoryInfo.label)}</span>
          </div>
        </td>
        <td>
          <span class="neu-status-pill ${statusInfo.className}">${statusInfo.label}</span>
        </td>
        <td class="neu-col-date">${dateFormatted}</td>
        <td class="neu-col-arrow">&rsaquo;</td>
      </tr>
    `;
  }).join('');

  // Row click listeners
  tbody.querySelectorAll('.neu-case-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-case-id');
      if (id) {
        tbody.querySelectorAll('.neu-case-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        selectCase(id);
      }
    });
  });
}

// ─── Category & Status Helpers ────────────────────────────────────────────────
function getCategoryBadge(type) {
  const norm = (type || '').toLowerCase();
  if (norm.includes('investment') || norm.includes('fraud') || norm.includes('financial')) {
    return { label: 'Financial Crime', icon: '💼', bg: '#E1EDFC', color: 'var(--cat-blue)' };
  }
  if (norm.includes('digital') || norm.includes('cyber') || norm.includes('arrest')) {
    return { label: 'Cyber Crime', icon: '🛡️', bg: '#F1EAFF', color: 'var(--cat-purple)' };
  }
  if (norm.includes('task') || norm.includes('organized') || norm.includes('theft')) {
    return { label: 'Organized Crime', icon: '⭐', bg: '#FFF2E8', color: 'var(--cat-orange)' };
  }
  if (norm.includes('kyc') || norm.includes('identity')) {
    return { label: 'Identity Fraud', icon: '🪪', bg: '#E0F2FE', color: 'var(--cat-teal)' };
  }
  if (norm.includes('romance') || norm.includes('person')) {
    return { label: 'Person Related', icon: '👤', bg: '#FEE2E2', color: 'var(--cat-red)' };
  }
  return { label: type?.replace(/_/g, ' ') || 'General Investigation', icon: '📁', bg: '#E2E8F2', color: 'var(--neu-secondary)' };
}

function getStatusPill(status) {
  const norm = (status || '').toUpperCase();
  if (norm === 'OPEN' || norm === 'ACTIVE') {
    return { label: 'Active', className: 'active' };
  }
  if (norm === 'UNDER_INQUIRY' || norm === 'IN_PROGRESS' || norm === 'UNDER_INVESTIGATION') {
    return { label: 'Under Review', className: 'review' };
  }
  if (norm === 'CHARGESHEETED') {
    return { label: 'Chargesheeted', className: 'review' };
  }
  return { label: 'Closed', className: 'closed' };
}

function formatCaseDate(iso) {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day}<br/><span style="font-size:9.5px;color:#8495AB">${time}</span>`;
  } catch (_) {
    return iso;
  }
}

// ─── Pagination Controls ──────────────────────────────────────────────────────
function renderPagination() {
  const container = document.getElementById('cases-pagination');
  if (!container) return;

  if (state.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="neu-page-btn" id="pg-prev" ${state.page <= 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>
  `;

  for (let i = 1; i <= state.totalPages; i++) {
    html += `
      <button class="neu-page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>
    `;
  }

  html += `
    <button class="neu-page-btn" id="pg-next" ${state.page >= state.totalPages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>
  `;

  container.innerHTML = html;

  const prev = document.getElementById('pg-prev');
  const next = document.getElementById('pg-next');
  if (prev) {
    prev.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        fetchAndRenderCases();
      }
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      if (state.page < state.totalPages) {
        state.page++;
        fetchAndRenderCases();
      }
    });
  }

  container.querySelectorAll('.neu-page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (p && p !== state.page) {
        state.page = p;
        fetchAndRenderCases();
      }
    });
  });
}

// ─── Case Selection & Detail Inspection ───────────────────────────────────────
async function selectCase(caseId) {
  state.selectedCaseId = caseId;
  setActiveCaseId(caseId);

  // Update browser URL query without reload
  const url = new URL(window.location.href);
  url.searchParams.set('caseId', caseId);
  window.history.replaceState({}, '', url.toString());

  try {
    const res = await getCase(caseId);
    const kase = res.case;
    state.selectedCaseData = kase;
    populateCaseDetails(kase);
    loadRecentCaseActivity(caseId);
  } catch (err) {
    console.error(`[Cases] Failed to fetch case details for ${caseId}:`, err);
    showToast(err.message || 'Unable to inspect selected case.', 'error');
  }
}

function populateCaseDetails(kase) {
  const caseNumber = kase.caseNumber || kase.id;
  const statusInfo = getStatusPill(kase.status);
  const categoryInfo = getCategoryBadge(kase.incidentType);
  const title = kase.title || kase.complainantName || 'Investigation Case';
  const desc = kase.description || 'No case summary provided.';

  // Header
  const numEl = document.getElementById('d-case-num');
  const statusPill = document.getElementById('d-status-pill');
  const titleEl = document.getElementById('d-case-title');
  const descEl = document.getElementById('d-case-desc');

  if (numEl) numEl.textContent = caseNumber;
  if (statusPill) {
    statusPill.className = `neu-status-pill ${statusInfo.className}`;
    statusPill.textContent = statusInfo.label;
  }
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;

  // Metadata Grid
  const cellNum = document.getElementById('cell-case-num');
  const cellStatus = document.getElementById('cell-status');
  const cellCat = document.getElementById('cell-category');
  const cellPriority = document.getElementById('cell-priority');
  const cellReg = document.getElementById('cell-registered');
  const cellUpd = document.getElementById('cell-updated');
  const cellOff = document.getElementById('cell-officer');
  const cellDept = document.getElementById('cell-department');

  if (cellNum) cellNum.textContent = caseNumber;
  if (cellStatus) {
    cellStatus.className = `neu-status-pill ${statusInfo.className}`;
    cellStatus.textContent = statusInfo.label;
  }
  if (cellCat) cellCat.textContent = categoryInfo.label;
  if (cellPriority) {
    const amt = kase.amountDefrauded ?? kase.totalLossINR ?? 0;
    if (amt >= 500000) {
      cellPriority.className = 'neu-priority-badge neu-priority-high';
      cellPriority.textContent = 'High';
    } else if (amt > 0) {
      cellPriority.className = 'neu-priority-badge neu-priority-med';
      cellPriority.textContent = 'Medium';
    } else {
      cellPriority.className = 'neu-priority-badge neu-priority-low';
      cellPriority.textContent = 'Standard';
    }
  }

  if (cellReg) cellReg.textContent = kase.createdAt ? new Date(kase.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  if (cellUpd) cellUpd.textContent = kase.updatedAt ? new Date(kase.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  if (cellOff) cellOff.textContent = kase.investigatingOfficer || kase.officerName || 'Inspector Sharma';
  if (cellDept) cellDept.textContent = kase.jurisdiction || 'Crime Branch (DEL)';

  // Summary Text
  const summaryEl = document.getElementById('summary-text');
  if (summaryEl) summaryEl.textContent = desc;

  // Edit button permission
  const editBtn = document.getElementById('btn-edit-case');
  if (editBtn) {
    editBtn.onclick = () => openEditCaseModal(kase);
  }
}

async function loadRecentCaseActivity(caseId) {
  const container = document.getElementById('activity-list');
  const linkTimeline = document.getElementById('link-view-timeline');
  if (linkTimeline) {
    linkTimeline.href = `/frontend/pages/timeline.html?caseId=${encodeURIComponent(caseId)}`;
  }

  if (!container) return;

  try {
    const [timelineRes, evidenceRes] = await Promise.allSettled([
      getCaseTimeline(caseId),
      getCaseEvidence(caseId),
    ]);

    const events = timelineRes.status === 'fulfilled' ? (timelineRes.value?.events || []) : [];
    const evidence = evidenceRes.status === 'fulfilled' ? (evidenceRes.value?.evidence || []) : [];

    const activities = [];

    // Map evidence additions
    evidence.slice(0, 2).forEach(ev => {
      activities.push({
        title: 'Evidence Uploaded',
        sub: ev.fileName || 'Digital File',
        icon: '📄',
        bg: '#E1EDFC',
        color: 'var(--neu-blue)',
        date: ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent',
      });
    });

    // Map timeline events
    events.slice(0, 2).forEach(t => {
      activities.push({
        title: t.title || 'Case Milestone',
        sub: t.description || 'Timeline event recorded',
        icon: '⏱️',
        bg: '#F1EAFF',
        color: 'var(--cat-purple)',
        date: t.eventTimestamp ? new Date(t.eventTimestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent',
      });
    });

    if (activities.length === 0) {
      container.innerHTML = `
        <div style="font-size:11.5px;color:var(--neu-secondary);padding:6px 0;">
          No recent forensic activities recorded for this case.
        </div>
      `;
      return;
    }

    container.innerHTML = activities.map(act => `
      <div class="neu-activity-row">
        <div class="neu-act-left">
          <div class="neu-act-icon-badge" style="background:${act.bg};color:${act.color}">
            <span>${act.icon}</span>
          </div>
          <div class="neu-act-info">
            <span class="neu-act-title">${escapeHtml(act.title)}</span>
            <span class="neu-act-sub">${escapeHtml(act.sub)}</span>
          </div>
        </div>
        <span class="neu-act-date">${act.date}</span>
      </div>
    `).join('');

  } catch (_) {
    container.innerHTML = `
      <div style="font-size:11.5px;color:var(--neu-muted);padding:6px 0;">
        Activity trail ready for ingestion.
      </div>
    `;
  }
}

function renderEmptyCaseDetails() {
  const numEl = document.getElementById('d-case-num');
  const titleEl = document.getElementById('d-case-title');
  const descEl = document.getElementById('d-case-desc');
  const summaryEl = document.getElementById('summary-text');
  const activityList = document.getElementById('activity-list');

  if (numEl) numEl.textContent = '—';
  if (titleEl) titleEl.textContent = 'No Case Selected';
  if (descEl) descEl.textContent = 'Select an investigation case from the table to inspect details.';
  if (summaryEl) summaryEl.textContent = 'No case data available.';
  if (activityList) activityList.innerHTML = '<div style="font-size:11.5px;color:var(--neu-secondary);padding:6px 0;">No activities to display.</div>';
}

// ─── Detail Tabs Navigation ───────────────────────────────────────────────────
function bindDetailTabEvents() {
  const tabs = {
    'tab-overview': 'tab-content-overview',
  };

  const overviewTab = document.getElementById('tab-overview');
  const evidenceTab = document.getElementById('tab-evidence');
  const personsTab = document.getElementById('tab-persons');
  const timelineTab = document.getElementById('tab-timeline');
  const reportsTab = document.getElementById('tab-reports');

  if (evidenceTab) {
    evidenceTab.addEventListener('click', () => {
      const id = state.selectedCaseId || '';
      window.location.href = `/frontend/pages/index.html?caseId=${encodeURIComponent(id)}`;
    });
  }

  if (personsTab) {
    personsTab.addEventListener('click', () => {
      const id = state.selectedCaseId || '';
      window.location.href = `/frontend/pages/entities.html?caseId=${encodeURIComponent(id)}`;
    });
  }

  if (timelineTab) {
    timelineTab.addEventListener('click', () => {
      const id = state.selectedCaseId || '';
      window.location.href = `/frontend/pages/timeline.html?caseId=${encodeURIComponent(id)}`;
    });
  }

  if (reportsTab) {
    reportsTab.addEventListener('click', () => {
      const id = state.selectedCaseId || '';
      window.location.href = `/frontend/pages/reports.html?caseId=${encodeURIComponent(id)}`;
    });
  }
}

// ─── Modals: Create & Edit Case ───────────────────────────────────────────────
function bindModalEvents() {
  const btnNewCase = document.getElementById('btn-new-case');
  const modalClose = document.getElementById('modal-close');
  const modalCancel = document.getElementById('modal-cancel');
  const newCaseForm = document.getElementById('new-case-form');

  if (btnNewCase) {
    btnNewCase.addEventListener('click', openCreateCaseModal);
  }

  const closeCreateModal = () => {
    const modal = document.getElementById('new-case-modal');
    if (modal) modal.style.display = 'none';
  };

  if (modalClose) modalClose.addEventListener('click', closeCreateModal);
  if (modalCancel) modalCancel.addEventListener('click', closeCreateModal);

  if (newCaseForm) {
    newCaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('modal-error-msg');
      if (errBox) errBox.style.display = 'none';

      const complainant = document.getElementById('f-complainant')?.value.trim();
      const incidentType = document.getElementById('f-type')?.value;
      const jurisdiction = document.getElementById('f-jurisdiction')?.value.trim();
      const firNumber = document.getElementById('f-fir')?.value.trim();
      const officerName = document.getElementById('f-officer')?.value.trim();
      const amountDefrauded = parseFloat(document.getElementById('f-amount')?.value) || 0;
      const status = document.getElementById('f-status')?.value || 'OPEN';
      const description = document.getElementById('f-description')?.value.trim();

      if (!complainant) {
        if (errBox) {
          errBox.textContent = 'Complainant Name is required.';
          errBox.style.display = 'block';
        }
        return;
      }
      if (!incidentType) {
        if (errBox) {
          errBox.textContent = 'Incident Type / Category is required.';
          errBox.style.display = 'block';
        }
        return;
      }

      const submitBtn = document.getElementById('modal-submit-btn');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const payload = {
          complainantName: complainant,
          incidentType,
          jurisdiction: jurisdiction || currentOfficer?.jurisdiction || 'Delhi Police',
          firNumber,
          officerName: officerName || currentOfficer?.name || 'Inspector Sharma',
          amountDefrauded,
          status,
          description,
        };

        const res = await createCase(payload);
        closeCreateModal();
        showToast('Investigation case registered successfully.', 'success');

        // Refresh table and select new case
        await fetchAndRenderCases();
        if (res && (res.caseNumber || res.id)) {
          selectCase(res.caseNumber || res.id);
        }

      } catch (err) {
        console.error('[Cases] Error creating case:', err);
        if (errBox) {
          errBox.textContent = err.message || 'Failed to register case.';
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Edit Case Modal bindings
  const editModal = document.getElementById('edit-case-modal');
  const editClose = document.getElementById('edit-modal-close');
  const editCancel = document.getElementById('edit-modal-cancel');
  const editForm = document.getElementById('edit-case-form');

  const closeEditModal = () => {
    if (editModal) editModal.style.display = 'none';
  };

  if (editClose) editClose.addEventListener('click', closeEditModal);
  if (editCancel) editCancel.addEventListener('click', closeEditModal);

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('edit-error-msg');
      if (errBox) errBox.style.display = 'none';

      if (!state.selectedCaseId) return;

      const submitBtn = document.getElementById('edit-modal-submit-btn');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const updates = {
          status: document.getElementById('ef-status')?.value,
          incidentType: document.getElementById('ef-type')?.value,
          officerName: document.getElementById('ef-officer')?.value.trim(),
          amountDefrauded: parseFloat(document.getElementById('ef-amount')?.value) || 0,
          firNumber: document.getElementById('ef-fir')?.value.trim(),
          jurisdiction: document.getElementById('ef-jurisdiction')?.value.trim(),
          description: document.getElementById('ef-description')?.value.trim(),
        };

        await patchCase(state.selectedCaseId, updates);
        closeEditModal();
        showToast('Case details updated successfully.', 'success');

        await fetchAndRenderCases();
        await selectCase(state.selectedCaseId);

      } catch (err) {
        console.error('[Cases] Error updating case:', err);
        if (errBox) {
          errBox.textContent = err.message || 'Failed to update case.';
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

function openCreateCaseModal() {
  const modal = document.getElementById('new-case-modal');
  if (!modal) return;
  const jurInput = document.getElementById('f-jurisdiction');
  const offInput = document.getElementById('f-officer');
  if (jurInput && currentOfficer) jurInput.value = currentOfficer.jurisdiction || '';
  if (offInput && currentOfficer) offInput.value = currentOfficer.name || '';
  modal.style.display = 'flex';
}

function openEditCaseModal(kase) {
  const modal = document.getElementById('edit-case-modal');
  if (!modal || !kase) return;

  const efStatus = document.getElementById('ef-status');
  const efType = document.getElementById('ef-type');
  const efOfficer = document.getElementById('ef-officer');
  const efAmount = document.getElementById('ef-amount');
  const efFir = document.getElementById('ef-fir');
  const efJur = document.getElementById('ef-jurisdiction');
  const efDesc = document.getElementById('ef-description');

  if (efStatus) efStatus.value = kase.status || 'OPEN';
  if (efType) efType.value = kase.incidentType || 'Task_Scam';
  if (efOfficer) efOfficer.value = kase.officerName || kase.investigatingOfficer || '';
  if (efAmount) efAmount.value = kase.amountDefrauded ?? kase.totalLossINR ?? 0;
  if (efFir) efFir.value = kase.firNumber || '';
  if (efJur) efJur.value = kase.jurisdiction || '';
  if (efDesc) efDesc.value = kase.description || '';

  modal.style.display = 'flex';
}
