/**
 * Rakshak — Cases Management Page Script
 * Interacts with /api/cases for search, filter, pagination, creation, and updating.
 */

import {
  getCases,
  getCase,
  createCase,
  patchCase,
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
  cases: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  search: '',
  statusFilter: '',
  typeFilter: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  editingCaseId: null,
};

let searchDebounceTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout({ activePage: 'cases' });
  bindEvents();
  await fetchAndRenderCases();
});

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Search input with debounce
  const searchInput = document.getElementById('search-input');
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

  // Filter dropdowns
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  const typeFilter = document.getElementById('filter-type');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      state.typeFilter = e.target.value;
      state.page = 1;
      fetchAndRenderCases();
    });
  }

  const sortBySelect = document.getElementById('filter-sort');
  if (sortBySelect) {
    sortBySelect.addEventListener('change', (e) => {
      const [by, order] = e.target.value.split('-');
      state.sortBy = by || 'createdAt';
      state.sortOrder = order || 'desc';
      fetchAndRenderCases();
    });
  }

  // New Case Modal
  const btnNewCase = document.getElementById('btn-new-case');
  const newCaseModal = document.getElementById('new-case-modal');
  const modalClose = document.getElementById('modal-close');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSubmit = document.getElementById('modal-submit');

  if (btnNewCase && newCaseModal) {
    btnNewCase.addEventListener('click', () => {
      resetNewCaseForm();
      newCaseModal.style.display = 'flex';
    });
  }

  const closeModal = () => {
    if (newCaseModal) newCaseModal.style.display = 'none';
  };
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);

  if (modalSubmit) {
    modalSubmit.addEventListener('click', handleNewCaseSubmit);
  }

  // Edit Case Modal close handlers
  const editModal = document.getElementById('edit-case-modal');
  const editModalClose = document.getElementById('edit-modal-close');
  const editModalCancel = document.getElementById('edit-modal-cancel');
  const editModalSubmit = document.getElementById('edit-modal-submit');

  const closeEditModal = () => {
    if (editModal) editModal.style.display = 'none';
    state.editingCaseId = null;
  };
  if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
  if (editModalCancel) editModalCancel.addEventListener('click', closeEditModal);
  if (editModalSubmit) editModalSubmit.addEventListener('click', handleEditCaseSubmit);

  // Pagination buttons
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        fetchAndRenderCases();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.page < state.totalPages) {
        state.page++;
        fetchAndRenderCases();
      }
    });
  }

  // Table row click Delegation (View / Edit)
  const tbody = document.getElementById('cases-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.btn-view-case');
      if (viewBtn) {
        const caseId = viewBtn.dataset.id;
        setActiveCaseId(caseId);
        window.location.href = `/frontend/pages/case-detail.html?id=${encodeURIComponent(caseId)}`;
        return;
      }

      const editBtn = e.target.closest('.btn-edit-case');
      if (editBtn) {
        const caseId = editBtn.dataset.id;
        openEditCaseModal(caseId);
        return;
      }
    });
  }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function fetchAndRenderCases() {
  const tbody = document.getElementById('cases-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-muted"><span class="spinner"></span> Fetching case dossiers…</td></tr>`;
  }

  try {
    const data = await getCases({
      q: state.search,
      status: state.statusFilter,
      type: state.typeFilter,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      page: state.page,
      limit: state.limit,
    });

    state.cases = data.cases || [];
    state.total = data.total || 0;
    state.page = data.page || 1;
    state.totalPages = data.totalPages || 1;

    renderStats();
    renderTable();
    renderPagination();
  } catch (err) {
    console.error('Failed to fetch cases:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-6">⚠️ Failed to load cases: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

// ─── Stats Rendering ──────────────────────────────────────────────────────────
function renderStats() {
  const totalEl = document.getElementById('stat-total-cases');
  const activeEl = document.getElementById('stat-active-cases');
  const closedEl = document.getElementById('stat-closed-cases');
  const lossEl = document.getElementById('stat-total-loss');

  if (!totalEl) return;

  const activeCount = state.cases.filter(c => c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION').length;
  const closedCount = state.cases.filter(c => c.status === 'CLOSED' || c.status === 'CHARGESHEET_FILED').length;
  const totalLoss = state.cases.reduce((sum, c) => sum + (c.totalLossINR || c.fraudAmountINR || 0), 0);

  totalEl.textContent = state.total;
  if (activeEl) activeEl.textContent = activeCount;
  if (closedEl) closedEl.textContent = closedCount;
  if (lossEl) lossEl.textContent = formatINR(totalLoss);
}

// ─── Table Rendering ──────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('cases-tbody');
  if (!tbody) return;

  if (state.cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state py-8 text-center">
          <div class="empty-state-icon" style="font-size:2rem;margin-bottom:8px">📋</div>
          <p class="font-medium text-main">No case files match the selected criteria.</p>
          <p class="text-xs text-muted" style="margin-top:4px">Try clearing filters or register a new cybercrime case dossier.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.cases.map(c => {
    const statusBadgeClass = getStatusBadgeClass(c.status);
    const statusLabel = formatStatusLabel(c.status);
    const formattedAmount = formatINR(c.totalLossINR || c.fraudAmountINR || 0);
    const dateStr = formatIST(c.createdAt || c.incidentDate);

    return `
      <tr class="table-row-hover">
        <td class="font-mono text-primary font-bold">
          <a href="/frontend/pages/case-detail.html?id=${encodeURIComponent(c.caseNumber)}" class="hover-underline">
            ${escapeHtml(c.caseNumber)}
          </a>
        </td>
        <td>
          <div class="font-medium text-main">${escapeHtml(c.complainantName || 'Anonymous')}</div>
          ${c.firNumber ? `<div class="text-xs text-muted">FIR: ${escapeHtml(c.firNumber)}</div>` : ''}
        </td>
        <td>
          <span class="badge badge-subtle text-xs">${escapeHtml(c.incidentType || 'General Fraud')}</span>
        </td>
        <td class="text-secondary text-sm">
          ${escapeHtml(c.jurisdiction || c.policeStation || 'HQ Cyber Cell')}
        </td>
        <td class="text-secondary text-sm">
          ${escapeHtml(c.investigatingOfficer || 'Unassigned')}
        </td>
        <td class="font-mono text-warning font-medium">
          ${formattedAmount}
        </td>
        <td>
          <span class="badge ${statusBadgeClass}">${escapeHtml(statusLabel)}</span>
        </td>
        <td class="text-xs text-muted">
          ${dateStr}
        </td>
        <td class="text-right">
          <div class="btn-group">
            <button class="btn btn-xs btn-outline btn-view-case" data-id="${escapeHtml(c.caseNumber)}" title="Open Case Dossier">
              📂 View
            </button>
            <button class="btn btn-xs btn-ghost btn-edit-case" data-id="${escapeHtml(c.caseNumber)}" title="Edit Case Details">
              ✏️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'OPEN': return 'badge-info';
    case 'UNDER_INVESTIGATION': return 'badge-warning';
    case 'CHARGESHEET_FILED': return 'badge-purple';
    case 'CLOSED': return 'badge-success';
    default: return 'badge-neutral';
  }
}

function formatStatusLabel(status) {
  switch (status) {
    case 'OPEN': return 'Open';
    case 'UNDER_INVESTIGATION': return 'Under Investigation';
    case 'CHARGESHEET_FILED': return 'Chargesheet Filed';
    case 'CLOSED': return 'Closed';
    default: return status || 'Unknown';
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function renderPagination() {
  const paginationContainer = document.getElementById('pagination-container');
  const pageInfo = document.getElementById('page-info');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');

  if (!paginationContainer) return;

  if (state.totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';
  if (pageInfo) {
    const startItem = (state.page - 1) * state.limit + 1;
    const endItem = Math.min(state.page * state.limit, state.total);
    pageInfo.textContent = `Showing ${startItem}–${endItem} of ${state.total} cases (Page ${state.page} of ${state.totalPages})`;
  }

  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
}

// ─── New Case Submission ──────────────────────────────────────────────────────
function resetNewCaseForm() {
  const form = document.getElementById('new-case-form');
  if (form) form.reset();
  const errorEl = document.getElementById('form-server-error');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

async function handleNewCaseSubmit() {
  const submitBtn = document.getElementById('modal-submit');
  const errorEl = document.getElementById('form-server-error');

  const incidentType = document.getElementById('field-incident-type')?.value?.trim();
  const complainantName = document.getElementById('field-complainant-name')?.value?.trim();
  const complainantPhone = document.getElementById('field-complainant-phone')?.value?.trim();
  const complainantEmail = document.getElementById('field-complainant-email')?.value?.trim();
  const jurisdiction = document.getElementById('field-jurisdiction')?.value?.trim();
  const investigatingOfficer = document.getElementById('field-officer')?.value?.trim();
  const firNumber = document.getElementById('field-fir')?.value?.trim();
  const fraudAmountINR = parseFloat(document.getElementById('field-fraud-amount')?.value) || 0;
  const priority = document.getElementById('field-priority')?.value || 'MEDIUM';
  const description = document.getElementById('field-description')?.value?.trim();

  // Basic client validation
  if (!incidentType) {
    showFormError(errorEl, 'Please specify an incident type.');
    return;
  }
  if (!complainantName) {
    showFormError(errorEl, 'Complainant name is required.');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Registering…`;
    }
    if (errorEl) errorEl.style.display = 'none';

    const newCase = await createCase({
      incidentType,
      complainantName,
      complainantPhone: complainantPhone || null,
      complainantEmail: complainantEmail || null,
      jurisdiction: jurisdiction || null,
      investigatingOfficer: investigatingOfficer || null,
      firNumber: firNumber || null,
      totalLossINR: fraudAmountINR,
      priority,
      description: description || null,
      status: 'OPEN',
    });

    showNotification(`Case ${newCase.caseNumber} registered successfully!`, 'success');
    document.getElementById('new-case-modal').style.display = 'none';
    state.page = 1;
    await fetchAndRenderCases();
  } catch (err) {
    console.error('Failed to create case:', err);
    showFormError(errorEl, err.message || 'Failed to register case. Check server logs.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Register Case`;
    }
  }
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// ─── Edit Case Modal ──────────────────────────────────────────────────────────
async function openEditCaseModal(caseId) {
  const editModal = document.getElementById('edit-case-modal');
  const editBody = document.getElementById('edit-modal-body');
  if (!editModal || !editBody) return;

  state.editingCaseId = caseId;
  editModal.style.display = 'flex';
  editBody.innerHTML = `<div class="loading-row py-8 text-center"><span class="spinner"></span> Loading case dossier details…</div>`;

  try {
    const res = await getCase(caseId);
    const c = res.case;

    editBody.innerHTML = `
      <form id="edit-case-form" class="form-grid">
        <div class="form-group col-span-2">
          <label class="form-label">Case Identifier</label>
          <input type="text" class="input font-mono" value="${escapeHtml(c.caseNumber)}" disabled />
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="edit-status" class="input">
            <option value="OPEN" ${c.status === 'OPEN' ? 'selected' : ''}>Open</option>
            <option value="UNDER_INVESTIGATION" ${c.status === 'UNDER_INVESTIGATION' ? 'selected' : ''}>Under Investigation</option>
            <option value="CHARGESHEET_FILED" ${c.status === 'CHARGESHEET_FILED' ? 'selected' : ''}>Chargesheet Filed</option>
            <option value="CLOSED" ${c.status === 'CLOSED' ? 'selected' : ''}>Closed</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Priority</label>
          <select id="edit-priority" class="input">
            <option value="LOW" ${c.priority === 'LOW' ? 'selected' : ''}>Low</option>
            <option value="MEDIUM" ${c.priority === 'MEDIUM' ? 'selected' : ''}>Medium</option>
            <option value="HIGH" ${c.priority === 'HIGH' ? 'selected' : ''}>High</option>
            <option value="CRITICAL" ${c.priority === 'CRITICAL' ? 'selected' : ''}>Critical</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Incident Type</label>
          <input type="text" id="edit-incident-type" class="input" value="${escapeHtml(c.incidentType || '')}" required />
        </div>

        <div class="form-group">
          <label class="form-label">FIR Number</label>
          <input type="text" id="edit-fir" class="input" value="${escapeHtml(c.firNumber || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label">Complainant Name</label>
          <input type="text" id="edit-complainant" class="input" value="${escapeHtml(c.complainantName || '')}" required />
        </div>

        <div class="form-group">
          <label class="form-label">Jurisdiction / Police Station</label>
          <input type="text" id="edit-jurisdiction" class="input" value="${escapeHtml(c.jurisdiction || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label">Investigating Officer</label>
          <input type="text" id="edit-officer" class="input" value="${escapeHtml(c.investigatingOfficer || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label">Fraud Amount (₹)</label>
          <input type="number" id="edit-fraud-amount" class="input" value="${c.totalLossINR || c.fraudAmountINR || 0}" step="100" />
        </div>

        <div class="form-group col-span-2">
          <label class="form-label">Description / Modus Operandi Notes</label>
          <textarea id="edit-description" class="input" rows="3">${escapeHtml(c.description || '')}</textarea>
        </div>

        <div class="form-server-error col-span-2" id="edit-form-error" style="display:none"></div>
      </form>
    `;
  } catch (err) {
    console.error('Failed to load case for edit:', err);
    editBody.innerHTML = `<div class="text-danger py-4 text-center">Failed to load case data: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleEditCaseSubmit() {
  if (!state.editingCaseId) return;

  const submitBtn = document.getElementById('edit-modal-submit');
  const errorEl = document.getElementById('edit-form-error');

  const status = document.getElementById('edit-status')?.value;
  const priority = document.getElementById('edit-priority')?.value;
  const incidentType = document.getElementById('edit-incident-type')?.value?.trim();
  const firNumber = document.getElementById('edit-fir')?.value?.trim();
  const complainantName = document.getElementById('edit-complainant')?.value?.trim();
  const jurisdiction = document.getElementById('edit-jurisdiction')?.value?.trim();
  const investigatingOfficer = document.getElementById('edit-officer')?.value?.trim();
  const totalLossINR = parseFloat(document.getElementById('edit-fraud-amount')?.value) || 0;
  const description = document.getElementById('edit-description')?.value?.trim();

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Saving…`;
    }

    await patchCase(state.editingCaseId, {
      status,
      priority,
      incidentType,
      firNumber: firNumber || null,
      complainantName,
      jurisdiction: jurisdiction || null,
      investigatingOfficer: investigatingOfficer || null,
      totalLossINR,
      description: description || null,
    });

    showNotification(`Case ${state.editingCaseId} updated successfully`, 'success');
    document.getElementById('edit-case-modal').style.display = 'none';
    state.editingCaseId = null;
    await fetchAndRenderCases();
  } catch (err) {
    console.error('Failed to update case:', err);
    showFormError(errorEl, err.message || 'Failed to update case.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Changes`;
    }
  }
}
