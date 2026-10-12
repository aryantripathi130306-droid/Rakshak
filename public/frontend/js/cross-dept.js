/**
 * Rakshak v3.0 — Cross-Department Collaboration & Access Requests Controller
 * Page 09: Inter-Agency Access Workflow, Security Scopes & Multi-Department Records
 */

import { submitDepartmentOnboardingRequest } from './api.js';

// ─── CANONICAL ACCESS REQUESTS DATASET ─────────────────────────────────────────
export const CANONICAL_REQUESTS = [];

// ─── STATE MANAGEMENT ─────────────────────────────────────────────────────────
export const crossDeptState = {
  requests: [],
  filteredRequests: [],
  selectedRequestId: null,
  activeStatusPill: 'ALL',
  searchQuery: '',
  filterStatus: 'ALL',
  filterType: 'ALL',
  filterDept: 'ALL',
  filterCase: 'ALL',
  filterDate: 'ALL',
  activeWorkspaceTab: 'requests',
  activeDetailTab: 'overview',
  metrics: {
    connectedDepts: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    sharedCases: 0,
    activeCollabs: 0
  }
};

// ─── DOM ELEMENT CACHE ────────────────────────────────────────────────────────
let elements = {};

function cacheElements() {
  elements = {
    // Metrics
    metricConnected: document.getElementById('metric-connected-depts'),
    metricPending: document.getElementById('metric-pending-requests'),
    metricApproved: document.getElementById('metric-approved-requests'),
    metricShared: document.getElementById('metric-shared-cases'),
    metricCollabs: document.getElementById('metric-active-collabs'),
    paginationSummary: document.getElementById('cd-pagination-summary'),

    // Table & Filters
    tableBody: document.getElementById('requests-table-body'),
    searchInput: document.getElementById('search-requests-input'),
    filterStatusSelect: document.getElementById('filter-status-select'),
    filterTypeSelect: document.getElementById('filter-type-select'),
    filterDeptSelect: document.getElementById('filter-dept-select'),
    filterCaseSelect: document.getElementById('filter-case-select'),
    filterDateSelect: document.getElementById('filter-date-select'),
    btnClearFilters: document.getElementById('btn-clear-filters'),

    // Details Panel Elements
    detailsHeroAvatar: document.getElementById('details-hero-avatar'),
    detailsHeroId: document.getElementById('details-hero-id'),
    detailsHeroStatus: document.getElementById('details-hero-status'),
    detailsHeroSubtitle: document.getElementById('details-hero-subtitle'),
    btnApprove: document.getElementById('btn-approve-request'),
    btnReject: document.getElementById('btn-reject-request'),

    // Details Meta
    detReqId: document.getElementById('det-req-id'),
    detReqType: document.getElementById('det-req-type'),
    detReqStatus: document.getElementById('det-req-status'),
    detReqPriority: document.getElementById('det-req-priority'),
    detReqDate: document.getElementById('det-req-date'),
    detReqBy: document.getElementById('det-req-by'),
    detReqTarget: document.getElementById('det-req-target'),
    detReqCaseLink: document.getElementById('det-req-case-link'),
    detReqPurpose: document.getElementById('det-req-purpose'),
    detReqAccessList: document.getElementById('det-req-access-list'),
    detailsTabOverview: document.getElementById('details-tab-overview'),

    // Modals
    modalRequestAccess: document.getElementById('modal-request-access'),
    btnRequestAccess: document.getElementById('btn-request-access'),
    btnCloseReqModal: document.getElementById('btn-close-req-modal'),
    btnCancelReqModal: document.getElementById('btn-cancel-req-modal'),
    formRequestAccess: document.getElementById('form-request-access'),

    modalApproveConfirm: document.getElementById('modal-approve-confirm'),
    apprConfirmReqId: document.getElementById('appr-confirm-req-id'),
    btnCloseApprModal: document.getElementById('btn-close-appr-modal'),
    btnCancelApprModal: document.getElementById('btn-cancel-appr-modal'),
    btnConfirmApprove: document.getElementById('btn-confirm-approve'),

    modalRejectConfirm: document.getElementById('modal-reject-confirm'),
    rejConfirmReqId: document.getElementById('rej-confirm-req-id'),
    btnCloseRejModal: document.getElementById('btn-close-rej-modal'),
    btnCancelRejModal: document.getElementById('btn-cancel-rej-modal'),
    btnConfirmReject: document.getElementById('btn-confirm-reject'),

    // Shell items
    officerName: document.getElementById('officer-name'),
    officerDept: document.getElementById('officer-dept'),
    toastContainer: document.getElementById('toast-container')
  };
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  setupEventListeners();
  await loadOfficerSession();
  renderTable();
  selectRequest(crossDeptState.selectedRequestId);
});

// ─── AUTH SESSION & DEPARTMENT LOAD ───────────────────────────────────────────
async function loadOfficerSession() {
  try {
    let token = null;
    try {
      if (typeof localStorage !== 'undefined') token = localStorage.getItem('rakshak_token');
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    const res = await fetch('/api/auth/me', { credentials: 'include', headers });
    if (res.ok) {
      const data = await res.json();
      if (data.officer) {
        if (elements.officerName) elements.officerName.textContent = data.officer.name;
        if (elements.officerDept) elements.officerDept.textContent = data.officer.jurisdiction || 'Cyber Crime Department';
      }
    }

    // Load department directory count
    const deptRes = await fetch('/api/departments', { credentials: 'include', headers });
    if (deptRes.ok) {
      const deptData = await deptRes.json();
      if (deptData && typeof deptData.total === 'number') {
        crossDeptState.metrics.connectedDepts = deptData.total;
        if (elements.metricConnected) elements.metricConnected.textContent = deptData.total;
      }
    }

    // Load onboarding requests queue
    const reqRes = await fetch('/api/auth/onboard-requests', { credentials: 'include', headers });
    if (reqRes.ok) {
      const reqData = await reqRes.json();
      if (reqData && Array.isArray(reqData.requests)) {
        crossDeptState.requests = reqData.requests.map((r) => ({
          id: r.id ? `REQ-${r.id.substring(0, 8).toUpperCase()}` : 'REQ-LIVE',
          type: 'Agency Onboarding',
          fromDept: r.departmentName || 'External Department',
          toDept: 'Cyber Crime Special Cell',
          caseId: 'INTER-AGENCY',
          caseTitle: `Jurisdiction: ${r.jurisdiction || 'State Police'}`,
          purpose: `Officer: ${r.nodalOfficerName || 'N/A'}`,
          fullPurpose: `Official Onboarding Application for ${r.departmentName}. Reference: ${r.authorizationRef || 'N/A'}`,
          status: r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : 'Pending',
          priority: 'High',
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : 'Recent',
          fullDateTime: r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : 'Recent',
          requestedBy: r.nodalOfficerName || 'Nodal Officer',
          requestingDept: r.departmentName || 'Department',
          targetDept: 'Cyber Crime Special Cell',
          icon: '🏛',
          iconClass: 'neu-metric-icon-blue',
          scopes: [
            { name: 'Case Intelligence', scope: 'Read Access', icon: '📄', color: 'neu-metric-icon-blue' },
            { name: 'Forensic Vault', scope: 'Restricted Access', icon: '🛡', color: 'neu-metric-icon-green' }
          ]
        }));

        crossDeptState.filteredRequests = [...crossDeptState.requests];
        crossDeptState.metrics.pendingRequests = crossDeptState.requests.filter(r => r.status === 'Pending').length;
        crossDeptState.metrics.approvedRequests = crossDeptState.requests.filter(r => r.status === 'Approved').length;

        if (elements.metricPending) elements.metricPending.textContent = crossDeptState.metrics.pendingRequests;
        if (elements.metricApproved) elements.metricApproved.textContent = crossDeptState.metrics.approvedRequests;

        if (crossDeptState.requests.length > 0) {
          crossDeptState.selectedRequestId = crossDeptState.requests[0].id;
        }
      }
    }
  } catch (err) {
    console.warn('[Cross-Dept] Background load notice:', err);
  }
}

// ─── RENDER REQUESTS TABLE ────────────────────────────────────────────────────
export function renderTable() {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = '';
  const displayList = crossDeptState.filteredRequests;

  if (displayList.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 16px; color: var(--neu-secondary);">
          <div style="font-size: 28px; margin-bottom: 8px; opacity: 0.5;">🏛️</div>
          <div style="font-weight: 700; color: var(--neu-navy); margin-bottom: 4px;">No Inter-Agency Requests</div>
          <div style="font-size: 12px; color: var(--neu-secondary);">Cross-department access applications and collaboration tickets will appear here.</div>
        </td>
      </tr>
    `;
    if (elements.paginationSummary) elements.paginationSummary.textContent = 'Showing 0 of 0 requests';
    return;
  }

  if (displayList.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px 16px; color: var(--neu-secondary);">
          <div style="font-size: 28px; margin-bottom: 6px;">🔍</div>
          <div style="font-weight: 700; font-size: 13.5px; color: var(--neu-navy);">No cross-department access requests match your filters</div>
          <div style="font-size: 12px; margin-top: 4px;">Try adjusting your search query or clear all active filters</div>
        </td>
      </tr>
    `;
    return;
  }

  displayList.forEach((req) => {
    const isSelected = req.id === crossDeptState.selectedRequestId;
    const tr = document.createElement('tr');
    tr.dataset.requestId = req.id;
    if (isSelected) tr.classList.add('selected');

    const statusBadgeClass =
      req.status === 'Approved' ? 'cd-status-approved' :
      req.status === 'Rejected' ? 'cd-status-rejected' : 'cd-status-pending';

    tr.innerHTML = `
      <td><input type="checkbox" aria-label="Select request ${req.id}" /></td>
      <td>
        <div class="cd-req-id-cell">
          <div class="cd-req-icon ${req.iconClass}" aria-hidden="true">${req.icon}</div>
          <span>${escapeHtml(req.id)}</span>
        </div>
      </td>
      <td>${escapeHtml(req.type)}</td>
      <td>${escapeHtml(req.fromDept)}</td>
      <td>${escapeHtml(req.toDept)}</td>
      <td><a href="/frontend/pages/cases.html?case=${encodeURIComponent(req.caseId)}" class="cd-case-link">${escapeHtml(req.caseId)}</a></td>
      <td>${escapeHtml(req.purpose)}</td>
      <td><span class="cd-badge-status ${statusBadgeClass}">${escapeHtml(req.status)}</span></td>
      <td style="white-space: nowrap;">${escapeHtml(req.date)}</td>
      <td style="text-align: center;"><button class="cd-row-action-btn" title="Actions" aria-label="Actions for ${req.id}">•••</button></td>
    `;

    tr.addEventListener('click', (e) => {
      // Don't select row if clicking checkbox or case link directly
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;
      selectRequest(req.id);
    });

    elements.tableBody.appendChild(tr);
  });

  if (elements.paginationSummary) {
    elements.paginationSummary.textContent = `Showing 1–${Math.min(displayList.length, 8)} of 24 requests`;
  }
}

// ─── SELECT REQUEST & POPULATE DETAILS PANEL ──────────────────────────────────
export function selectRequest(requestId) {
  crossDeptState.selectedRequestId = requestId;
  const req = crossDeptState.requests.find((r) => r.id === requestId) || crossDeptState.requests[0];
  if (!req) return;

  // 1. Highlight row in table
  document.querySelectorAll('#requests-table-body tr').forEach((r) => {
    r.classList.remove('selected');
  });
  const row = document.querySelector(`#requests-table-body tr[data-request-id="${requestId}"]`);
  if (row) row.classList.add('selected');

  // 2. Hero Banner
  if (elements.detailsHeroId) elements.detailsHeroId.textContent = req.id;
  if (elements.detailsHeroStatus) {
    elements.detailsHeroStatus.textContent = req.status;
    elements.detailsHeroStatus.className = `cd-badge-status ${
      req.status === 'Approved' ? 'cd-status-approved' :
      req.status === 'Rejected' ? 'cd-status-rejected' : 'cd-status-pending'
    }`;
  }
  if (elements.detailsHeroSubtitle) {
    elements.detailsHeroSubtitle.textContent = `${req.type} Request • ${req.fullDateTime}`;
  }
  if (elements.detailsHeroAvatar) {
    elements.detailsHeroAvatar.textContent = req.icon;
    elements.detailsHeroAvatar.className = `cd-details-avatar ${req.iconClass}`;
  }

  // 3. Request Information Table
  if (elements.detReqId) elements.detReqId.textContent = req.id;
  if (elements.detReqType) elements.detReqType.textContent = req.type;
  if (elements.detReqStatus) {
    elements.detReqStatus.textContent = req.status;
    elements.detReqStatus.className = `cd-badge-status ${
      req.status === 'Approved' ? 'cd-status-approved' :
      req.status === 'Rejected' ? 'cd-status-rejected' : 'cd-status-pending'
    }`;
  }
  if (elements.detReqPriority) elements.detReqPriority.textContent = req.priority || 'Medium';
  if (elements.detReqDate) elements.detReqDate.textContent = req.fullDateTime;
  if (elements.detReqBy) {
    elements.detReqBy.innerHTML = `${escapeHtml(req.requestedBy)}<br/><small style="color: var(--neu-secondary);">${escapeHtml(req.requestingDept)}</small>`;
  }
  if (elements.detReqTarget) elements.detReqTarget.textContent = req.targetDept;
  if (elements.detReqCaseLink) {
    elements.detReqCaseLink.textContent = req.caseId;
    elements.detReqCaseLink.href = `/frontend/pages/cases.html?case=${encodeURIComponent(req.caseId)}`;
  }

  // 4. Purpose & Scopes
  if (elements.detReqPurpose) elements.detReqPurpose.textContent = req.fullPurpose;

  if (elements.detReqAccessList) {
    elements.detReqAccessList.innerHTML = '';
    req.scopes.forEach((sc) => {
      const item = document.createElement('div');
      item.className = 'cd-access-item';
      item.innerHTML = `
        <div class="cd-access-icon ${sc.color}" aria-hidden="true">${sc.icon}</div>
        <div class="cd-access-item-text">
          <span class="cd-access-name">${escapeHtml(sc.name)}</span>
          <span class="cd-access-scope">${escapeHtml(sc.scope)}</span>
        </div>
      `;
      elements.detReqAccessList.appendChild(item);
    });
  }

  // 5. Update Action Buttons state
  if (elements.btnApprove && elements.btnReject) {
    if (req.status === 'Approved') {
      elements.btnApprove.style.opacity = '0.5';
      elements.btnApprove.style.pointerEvents = 'none';
      elements.btnReject.style.opacity = '1';
      elements.btnReject.style.pointerEvents = 'auto';
    } else if (req.status === 'Rejected') {
      elements.btnApprove.style.opacity = '1';
      elements.btnApprove.style.pointerEvents = 'auto';
      elements.btnReject.style.opacity = '0.5';
      elements.btnReject.style.pointerEvents = 'none';
    } else {
      elements.btnApprove.style.opacity = '1';
      elements.btnApprove.style.pointerEvents = 'auto';
      elements.btnReject.style.opacity = '1';
      elements.btnReject.style.pointerEvents = 'auto';
    }
  }
}

// ─── FILTERING & SEARCH LOGIC ─────────────────────────────────────────────────
export function applyFilters() {
  const query = (elements.searchInput?.value || '').trim().toLowerCase();
  const statusSelect = elements.filterStatusSelect?.value || 'ALL';
  const typeSelect = elements.filterTypeSelect?.value || 'ALL';
  const deptSelect = elements.filterDeptSelect?.value || 'ALL';
  const caseSelect = elements.filterCaseSelect?.value || 'ALL';
  const dateSelect = elements.filterDateSelect?.value || 'ALL';

  crossDeptState.filteredRequests = crossDeptState.requests.filter((req) => {
    // 1. Status Pill Filter
    if (crossDeptState.activeStatusPill !== 'ALL' && req.status !== crossDeptState.activeStatusPill) {
      return false;
    }

    // 2. Status Dropdown Filter
    if (statusSelect !== 'ALL' && req.status !== statusSelect) {
      return false;
    }

    // 3. Request Type Filter
    if (typeSelect !== 'ALL' && req.type !== typeSelect) {
      return false;
    }

    // 4. Department Filter
    if (deptSelect !== 'ALL' && !req.fromDept.includes(deptSelect) && !req.toDept.includes(deptSelect)) {
      return false;
    }

    // 5. Case Filter
    if (caseSelect !== 'ALL' && req.caseId !== caseSelect) {
      return false;
    }

    // 6. Text Search across fields
    if (query) {
      const matchText = (
        req.id + ' ' +
        req.type + ' ' +
        req.fromDept + ' ' +
        req.toDept + ' ' +
        req.caseId + ' ' +
        req.purpose + ' ' +
        req.requestedBy
      ).toLowerCase();
      if (!matchText.includes(query)) return false;
    }

    return true;
  });

  renderTable();

  // If selected row is no longer in filtered set, select first available
  if (crossDeptState.filteredRequests.length > 0) {
    const isVisible = crossDeptState.filteredRequests.some((r) => r.id === crossDeptState.selectedRequestId);
    if (!isVisible) {
      selectRequest(crossDeptState.filteredRequests[0].id);
    }
  }
}

export function clearFilters() {
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.filterStatusSelect) elements.filterStatusSelect.value = 'ALL';
  if (elements.filterTypeSelect) elements.filterTypeSelect.value = 'ALL';
  if (elements.filterDeptSelect) elements.filterDeptSelect.value = 'ALL';
  if (elements.filterCaseSelect) elements.filterCaseSelect.value = 'ALL';
  if (elements.filterDateSelect) elements.filterDateSelect.value = 'ALL';

  crossDeptState.activeStatusPill = 'ALL';
  document.querySelectorAll('.cd-status-pill-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusFilter === 'ALL');
  });

  crossDeptState.filteredRequests = [...crossDeptState.requests];
  renderTable();
  selectRequest(crossDeptState.selectedRequestId);
  showToast('All filters cleared', 'info');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // 1. Status Filter Pills
  document.querySelectorAll('.cd-status-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cd-status-pill-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      crossDeptState.activeStatusPill = btn.dataset.statusFilter;
      applyFilters();
    });
  });

  // 2. Search & Select inputs
  let searchTimer;
  elements.searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 250);
  });

  elements.filterStatusSelect?.addEventListener('change', applyFilters);
  elements.filterTypeSelect?.addEventListener('change', applyFilters);
  elements.filterDeptSelect?.addEventListener('change', applyFilters);
  elements.filterCaseSelect?.addEventListener('change', applyFilters);
  elements.filterDateSelect?.addEventListener('change', applyFilters);
  elements.btnClearFilters?.addEventListener('click', clearFilters);

  // 3. Workspace Tabs
  document.querySelectorAll('.cd-tab-item').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cd-tab-item').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const view = tab.dataset.view;
      crossDeptState.activeWorkspaceTab = view;
      handleWorkspaceTabSwitch(view);
    });
  });

  // 4. Details Sub-tabs
  document.querySelectorAll('.cd-detail-tab-btn').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cd-detail-tab-btn').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const tabKey = tab.dataset.tab;
      crossDeptState.activeDetailTab = tabKey;
      handleDetailTabSwitch(tabKey);
    });
  });

  // 5. Approve Workflow Modal
  elements.btnApprove?.addEventListener('click', () => {
    if (elements.modalApproveConfirm) {
      if (elements.apprConfirmReqId) elements.apprConfirmReqId.textContent = crossDeptState.selectedRequestId;
      elements.modalApproveConfirm.classList.add('open');
    }
  });

  elements.btnCloseApprModal?.addEventListener('click', () => {
    elements.modalApproveConfirm?.classList.remove('open');
  });
  elements.btnCancelApprModal?.addEventListener('click', () => {
    elements.modalApproveConfirm?.classList.remove('open');
  });

  elements.btnConfirmApprove?.addEventListener('click', async () => {
    const req = crossDeptState.requests.find((r) => r.id === crossDeptState.selectedRequestId);
    if (req) {
      req.status = 'Approved';
      applyFilters();
      selectRequest(req.id);
      elements.modalApproveConfirm?.classList.remove('open');
      showToast(`Access Request ${req.id} approved successfully`, 'success');
      // Post audit log entry
      try {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CROSS_DEPT_APPROVE',
            module: 'CrossDept',
            targetType: 'AccessRequest',
            targetId: req.id,
            details: `Approved inter-agency access request ${req.id} for case ${req.caseId}`
          })
        }).catch(() => {});
      } catch (_) {}
    }
  });

  // 6. Reject Workflow Modal
  elements.btnReject?.addEventListener('click', () => {
    if (elements.modalRejectConfirm) {
      if (elements.rejConfirmReqId) elements.rejConfirmReqId.textContent = crossDeptState.selectedRequestId;
      elements.modalRejectConfirm.classList.add('open');
    }
  });

  elements.btnCloseRejModal?.addEventListener('click', () => {
    elements.modalRejectConfirm?.classList.remove('open');
  });
  elements.btnCancelRejModal?.addEventListener('click', () => {
    elements.modalRejectConfirm?.classList.remove('open');
  });

  elements.btnConfirmReject?.addEventListener('click', async () => {
    const reasonInput = document.getElementById('rej-reason');
    const reason = reasonInput?.value || 'Jurisdictional boundary constraint';
    const req = crossDeptState.requests.find((r) => r.id === crossDeptState.selectedRequestId);
    if (req) {
      req.status = 'Rejected';
      applyFilters();
      selectRequest(req.id);
      elements.modalRejectConfirm?.classList.remove('open');
      showToast(`Access Request ${req.id} declined (${reason})`, 'error');
    }
  });

  // 7. Request Access Modal
  elements.btnRequestAccess?.addEventListener('click', () => {
    elements.modalRequestAccess?.classList.add('open');
  });
  elements.btnCloseReqModal?.addEventListener('click', () => {
    elements.modalRequestAccess?.classList.remove('open');
  });
  elements.btnCancelReqModal?.addEventListener('click', () => {
    elements.modalRequestAccess?.classList.remove('open');
  });

  elements.formRequestAccess?.addEventListener('submit', (e) => {
    e.preventDefault();
    const targetDept = document.getElementById('req-target-dept')?.value || 'Economic Offences Wing';
    const caseId = document.getElementById('req-case-id')?.value || 'CC/2024/001';
    const type = document.getElementById('req-type')?.value || 'Case Access';
    const purpose = document.getElementById('req-purpose')?.value || 'Cross-agency investigation';

    const newId = `REQ-2024-${Math.floor(100 + Math.random() * 900)}`;
    const newReq = {
      id: newId,
      type: type,
      fromDept: 'Cyber Crime',
      toDept: targetDept.split(' ')[0],
      caseId: caseId,
      caseTitle: 'Financial Fraud Investigation',
      purpose: purpose.slice(0, 30) + '...',
      fullPurpose: purpose,
      status: 'Pending',
      priority: 'Medium',
      date: '15 Jan 2024',
      fullDateTime: '15 Jan 2024, 11:00 AM',
      requestedBy: 'Inspector Rajesh Kumar',
      requestingDept: 'Cyber Crime Department',
      targetDept: targetDept,
      icon: '👤',
      iconClass: 'neu-metric-icon-blue',
      scopes: [
        { name: 'Case Details', scope: 'Read Access', icon: '📄', color: 'neu-metric-icon-blue' },
        { name: 'Evidence Metadata', scope: 'Read Access', icon: '📄', color: 'neu-metric-icon-green' }
      ]
    };

    crossDeptState.requests.unshift(newReq);
    crossDeptState.filteredRequests.unshift(newReq);
    crossDeptState.selectedRequestId = newId;

    renderTable();
    selectRequest(newId);

    elements.modalRequestAccess?.classList.remove('open');
    elements.formRequestAccess?.reset();
    showToast(`Access request ${newId} submitted to ${targetDept}`, 'success');
  });

  // 8. Collaborate buttons in directory
  document.querySelectorAll('.cd-btn-collab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dept = btn.dataset.dept;
      showToast(`Initiating direct liaison channel with ${dept}`, 'info');
      if (elements.modalRequestAccess) {
        elements.modalRequestAccess.classList.add('open');
        const deptSelect = document.getElementById('req-target-dept');
        if (deptSelect && dept) deptSelect.value = dept;
      }
    });
  });

  // 9. Department Directory Button in Header
  document.getElementById('btn-dept-dir')?.addEventListener('click', () => {
    const dirTab = document.querySelector('.cd-tab-item[data-view="directory"]');
    if (dirTab) dirTab.click();
  });

  // 10. Share Case Button in Header
  document.getElementById('btn-share-case')?.addEventListener('click', () => {
    if (elements.modalRequestAccess) {
      elements.modalRequestAccess.classList.add('open');
      const typeSelect = document.getElementById('req-type');
      if (typeSelect) typeSelect.value = 'Case Access';
    }
  });

  // 11. Onboard Department Modal Controls
  const modalOnboard = document.getElementById('modal-dept-onboard');
  const btnOpenOnboard = document.getElementById('btn-onboard-dept');
  const btnCloseOnboard = document.getElementById('btn-close-onboard-modal');
  const btnCancelOnboard = document.getElementById('btn-cancel-onboard-modal');
  const formOnboard = document.getElementById('form-dept-onboard');
  const successAlert = document.getElementById('onboard-success-alert');
  const successRef = document.getElementById('onboard-success-ref');
  const submitBtn = document.getElementById('btn-submit-onboard');
  const btnText = document.getElementById('onboard-btn-text');

  function openOnboardModal() {
    if (modalOnboard) {
      modalOnboard.classList.add('open');
      if (successAlert) successAlert.style.display = 'none';
      formOnboard?.reset();
    }
  }

  function closeOnboardModal() {
    if (modalOnboard) modalOnboard.classList.remove('open');
  }

  btnOpenOnboard?.addEventListener('click', openOnboardModal);
  btnCloseOnboard?.addEventListener('click', closeOnboardModal);
  btnCancelOnboard?.addEventListener('click', closeOnboardModal);

  modalOnboard?.addEventListener('click', (e) => {
    if (e.target === modalOnboard) closeOnboardModal();
  });

  // URL query trigger (e.g. ?action=onboard)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'onboard' || window.location.hash === '#onboard') {
    openOnboardModal();
  }

  formOnboard?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const departmentName = document.getElementById('onboard-dept-name')?.value?.trim();
    const jurisdiction = document.getElementById('onboard-dept-jurisdiction')?.value?.trim();
    const nodalOfficerName = document.getElementById('onboard-nodal-name')?.value?.trim();
    const nodalOfficerBadge = document.getElementById('onboard-nodal-badge')?.value?.trim();
    const nodalEmail = document.getElementById('onboard-nodal-email')?.value?.trim();
    const contactPhone = document.getElementById('onboard-dept-phone')?.value?.trim();
    const authorizationRef = document.getElementById('onboard-auth-ref')?.value?.trim();

    if (!departmentName || !jurisdiction || !nodalOfficerName || !nodalOfficerBadge || !nodalEmail || !authorizationRef) {
      showToast('Please fill all mandatory fields marked with *', 'error');
      return;
    }

    if (btnText) btnText.textContent = 'Transmitting Application...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await submitDepartmentOnboardingRequest({
        departmentName,
        jurisdiction,
        nodalOfficerName,
        nodalOfficerBadge,
        nodalEmail,
        contactPhone,
        authorizationRef
      });

      if (res && res.success) {
        if (successRef) successRef.textContent = res.requestId || `REQ-${Date.now().toString(36).toUpperCase()}`;
        if (successAlert) successAlert.style.display = 'block';
        showToast('Department onboarding request transmitted for verification', 'success');
        setTimeout(() => {
          closeOnboardModal();
        }, 2500);
      } else {
        showToast(res?.error || 'Failed to submit onboarding application', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'Network error while transmitting application', 'error');
    } finally {
      if (btnText) btnText.textContent = 'Submit Onboarding Application';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ─── TAB SWITCH HANDLERS ──────────────────────────────────────────────────────
function handleWorkspaceTabSwitch(view) {
  const container = document.getElementById('cd-workspace-container');
  if (!container) return;

  if (view === 'requests') {
    container.style.display = 'grid';
    const dynView = document.getElementById('cd-dynamic-view-container');
    if (dynView) dynView.remove();
  } else {
    container.style.display = 'none';
    let dynView = document.getElementById('cd-dynamic-view-container');
    if (!dynView) {
      dynView = document.createElement('div');
      dynView.id = 'cd-dynamic-view-container';
      container.parentNode.insertBefore(dynView, container.nextSibling);
    }

    if (view === 'shared-cases') {
      dynView.innerHTML = `
        <div class="cd-panel">
          <div class="cd-panel-header">
            <h2 class="cd-panel-title">Shared Investigation Cases (42 Active)</h2>
          </div>
          <div class="cd-table-container">
            <table class="cd-table">
              <thead>
                <tr>
                  <th>Case Number</th>
                  <th>Incident Type</th>
                  <th>Originating Department</th>
                  <th>Collaborating Department</th>
                  <th>Access Scope</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="/frontend/pages/cases.html?case=CC/2024/001" class="cd-case-link">CC/2024/001</a></td>
                  <td>Financial Fraud</td>
                  <td>Cyber Crime Department</td>
                  <td>Economic Offences Wing</td>
                  <td>Read Access (Financial Ledger)</td>
                  <td>31 Dec 2024</td>
                  <td><span class="cd-badge-status cd-status-approved">Active</span></td>
                </tr>
                <tr>
                  <td><a href="/frontend/pages/cases.html?case=CC/2024/045" class="cd-case-link">CC/2024/045</a></td>
                  <td>Cyber Extortion</td>
                  <td>Cyber Crime Department</td>
                  <td>Intelligence Bureau</td>
                  <td>Full Case Dossier</td>
                  <td>15 Nov 2024</td>
                  <td><span class="cd-badge-status cd-status-approved">Active</span></td>
                </tr>
                <tr>
                  <td><a href="/frontend/pages/cases.html?case=CC/2024/078" class="cd-case-link">CC/2024/078</a></td>
                  <td>Money Laundering</td>
                  <td>Narcotics Control Bureau</td>
                  <td>Cyber Crime Department</td>
                  <td>Evidence Metadata</td>
                  <td>28 Feb 2025</td>
                  <td><span class="cd-badge-status cd-status-approved">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (view === 'network') {
      dynView.innerHTML = `
        <div class="cd-panel">
          <div class="cd-panel-header">
            <h2 class="cd-panel-title">Inter-Agency Collaboration Topology</h2>
          </div>
          <div style="padding: 24px; text-align: center; color: var(--neu-secondary);">
            <div style="font-size: 32px; margin-bottom: 12px;">🌐</div>
            <p style="font-size: 14px; font-weight: 700; color: var(--neu-navy);">12 Connected Security Agencies</p>
            <p style="font-size: 12.5px; max-width: 500px; margin: 0 auto; line-height: 1.5;">
              Centralized tenant-isolated mesh connecting Cyber Crime Cell, EOW, Narcotics Control, Intelligence Bureau, and State CID branches through Section 91 CrPC/BNSS compliant cryptographic relays.
            </p>
          </div>
        </div>
      `;
    } else if (view === 'directory') {
      dynView.innerHTML = `
        <div class="cd-panel">
          <div class="cd-panel-header">
            <h2 class="cd-panel-title">National Forensic Agency Directory</h2>
          </div>
          <p style="font-size: 12.5px; color: var(--neu-secondary); margin: 0;">
            Browse and establish authorized cross-department evidentiary links across Ministry of Home Affairs recognized agencies.
          </p>
        </div>
      `;
    }
  }
}

function handleDetailTabSwitch(tabKey) {
  const req = crossDeptState.requests.find((r) => r.id === crossDeptState.selectedRequestId);
  if (!req || !elements.detailsTabOverview) return;

  if (tabKey === 'overview') {
    elements.detailsTabOverview.style.display = 'block';
    const dynTab = document.getElementById('cd-dynamic-detail-tab');
    if (dynTab) dynTab.remove();
  } else {
    elements.detailsTabOverview.style.display = 'none';
    let dynTab = document.getElementById('cd-dynamic-detail-tab');
    if (!dynTab) {
      dynTab = document.createElement('div');
      dynTab.id = 'cd-dynamic-detail-tab';
      dynTab.style.padding = '10px 0';
      elements.detailsTabOverview.parentNode.appendChild(dynTab);
    }

    if (tabKey === 'related-case') {
      dynTab.innerHTML = `
        <h4 class="cd-block-heading">Associated Case Intelligence</h4>
        <div class="cd-meta-table" style="margin-top: 8px;">
          <div class="cd-meta-row">
            <span class="cd-meta-key">Case Number</span>
            <span class="cd-meta-val"><a href="/frontend/pages/cases.html?case=${encodeURIComponent(req.caseId)}" class="cd-case-link">${escapeHtml(req.caseId)}</a></span>
          </div>
          <div class="cd-meta-row">
            <span class="cd-meta-key">Investigation Type</span>
            <span class="cd-meta-val">${escapeHtml(req.caseTitle)}</span>
          </div>
          <div class="cd-meta-row">
            <span class="cd-meta-key">Lead Department</span>
            <span class="cd-meta-val">${escapeHtml(req.requestingDept)}</span>
          </div>
        </div>
      `;
    } else if (tabKey === 'request-files') {
      dynTab.innerHTML = `
        <h4 class="cd-block-heading">Attached Requisition Files</h4>
        <p style="font-size: 12px; color: var(--neu-secondary); margin: 8px 0 0 0;">
          Formal Section 91 BNSS / CrPC Notice signed by Investigating Officer attached and verified.
        </p>
      `;
    } else if (tabKey === 'communication') {
      dynTab.innerHTML = `
        <h4 class="cd-block-heading">Inter-Agency Communications Trail</h4>
        <p style="font-size: 12px; color: var(--neu-secondary); margin: 8px 0 0 0;">
          Encrypted liaison log active between ${escapeHtml(req.fromDept)} and ${escapeHtml(req.toDept)}.
        </p>
      `;
    } else if (tabKey === 'audit-log') {
      dynTab.innerHTML = `
        <h4 class="cd-block-heading">Access Request Tamper-Evident Audit</h4>
        <div class="cd-meta-table" style="margin-top: 8px;">
          <div class="cd-meta-row">
            <span class="cd-meta-key">Audit Digest</span>
            <span class="cd-meta-val" style="font-family: var(--font-mono); font-size: 11px;">SHA256:8b4c2e1f0a9d3e8f7a6b5c4d3e2f1a0b</span>
          </div>
          <div class="cd-meta-row">
            <span class="cd-meta-key">Recorded Actor</span>
            <span class="cd-meta-val">${escapeHtml(req.requestedBy)}</span>
          </div>
          <div class="cd-meta-row">
            <span class="cd-meta-key">Timestamp</span>
            <span class="cd-meta-val">${escapeHtml(req.fullDateTime)}</span>
          </div>
        </div>
      `;
    }
  }
}

// ─── UTILITIES & TOASTS ───────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(message, type = 'info') {
  if (!elements.toastContainer) elements.toastContainer = document.getElementById('toast-container');
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `neu-toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
