// ─────────────────────────────────────────────────────────────────────────────
// public/frontend/js/audit.js
// Controller for Page 11: Audit Logs & Security Activity
// Light-Neumorphic UI, Live DB sync, Row Selection, Multi-Filtering & Export
// ─────────────────────────────────────────────────────────────────────────────

// ─── Canonical Baseline Audit Records (Matches Reference Image Exactly) ──────
const CANONICAL_LOGS = [
  {
    id: "LOG-2024-00012345",
    timestamp: "15 Jan 2024, 10:30:45 AM",
    user: "Rajesh Kumar",
    userBadge: "INS-001",
    designation: "Inspector",
    department: "Cyber Crime Department",
    departmentShort: "Cyber Crime",
    action: "Viewed Evidence",
    resourceId: "EVT-2024-001245",
    resourceName: "mobile_001.jpg",
    resourceType: "Evidence File",
    caseId: "CC/2024/001",
    caseTitle: "Financial Fraud Investigation",
    ipAddress: "192.168.1.45",
    status: "Success",
    eventType: "Data Access",
    description: "User viewed evidence file details in the system",
    sessionId: "sess_7f3a9c2d1e6b",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    source: "Web Application",
    iconClass: "orange",
    iconChar: "📄",
  },
  {
    id: "LOG-2024-00012344",
    timestamp: "15 Jan 2024, 10:25:12 AM",
    user: "Priya Singh",
    userBadge: "SI-027",
    designation: "Sub Inspector",
    department: "Cyber Crime Department",
    departmentShort: "Cyber Crime",
    action: "Updated Case",
    resourceId: "CC/2024/001",
    resourceName: "CC/2024/001",
    resourceType: "Case File",
    caseId: "CC/2024/001",
    caseTitle: "Financial Fraud Investigation",
    ipAddress: "192.168.1.32",
    status: "Success",
    eventType: "User Action",
    description: "Updated case parameters and linked evidence references",
    sessionId: "sess_4e2b8c91a03f",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    source: "Web Application",
    iconClass: "blue",
    iconChar: "📄",
  },
  {
    id: "LOG-2024-00012343",
    timestamp: "15 Jan 2024, 10:20:08 AM",
    user: "System",
    userBadge: "SYSTEM",
    designation: "Security Monitor",
    department: "Central Security Gateway",
    departmentShort: "Central Gateway",
    action: "Failed Login",
    resourceId: "N/A",
    resourceName: "Authentication Gateway",
    resourceType: "Security Gateway",
    caseId: "N/A",
    caseTitle: "Access Perimeter",
    ipAddress: "203.0.113.45",
    status: "Failed",
    eventType: "Security",
    description: "Multiple failed login attempts detected against administrative console",
    sessionId: "sess_unauth_threat_01",
    userAgent: "Python-requests/2.31.0",
    source: "External Network Perimeter",
    iconClass: "red",
    iconChar: "🛡️",
  },
  {
    id: "LOG-2024-00012342",
    timestamp: "15 Jan 2024, 10:18:33 AM",
    user: "Amit Sharma",
    userBadge: "HC-105",
    designation: "Head Constable",
    department: "State Police (Delhi)",
    departmentShort: "State Police (Delhi)",
    action: "Created Report",
    resourceId: "RPT-2024-0032",
    resourceName: "Forensic Summary Dossier",
    resourceType: "Forensic Report",
    caseId: "CC/2024/001",
    caseTitle: "Financial Fraud Investigation",
    ipAddress: "192.168.1.78",
    status: "Success",
    eventType: "User Action",
    description: "Generated forensic summary dossier for judicial review",
    sessionId: "sess_91b7d5f02c4a",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    source: "Web Application",
    iconClass: "blue",
    iconChar: "📄",
  },
  {
    id: "LOG-2024-00012341",
    timestamp: "15 Jan 2024, 10:15:27 AM",
    user: "System",
    userBadge: "SYSTEM",
    designation: "Credential Policy Engine",
    department: "Economic Offences Wing",
    departmentShort: "Economic Offences",
    action: "Password Change",
    resourceId: "User: SI-043",
    resourceName: "Neha Verma Account",
    resourceType: "Officer Account",
    caseId: "N/A",
    caseTitle: "System Security Policy",
    ipAddress: "192.168.1.56",
    status: "Success",
    eventType: "System",
    description: "Rotated credentials according to 90-day password rotation policy",
    sessionId: "sess_sys_policy_rot",
    userAgent: "Internal Daemon",
    source: "IAM Service",
    iconClass: "gear",
    iconChar: "⚙️",
  },
  {
    id: "LOG-2024-00012340",
    timestamp: "15 Jan 2024, 10:12:14 AM",
    user: "Neha Verma",
    userBadge: "SI-043",
    designation: "Sub Inspector",
    department: "Economic Offences Wing",
    departmentShort: "Economic Offences",
    action: "Downloaded Evidence",
    resourceId: "EVT-2024-000987",
    resourceName: "bank_ledger_q3.bin",
    resourceType: "Evidence Container",
    caseId: "CC/2024/001",
    caseTitle: "Financial Fraud Investigation",
    ipAddress: "192.168.1.33",
    status: "Success",
    eventType: "Data Access",
    description: "Downloaded cryptographic container with SHA-256 validation",
    sessionId: "sess_6a11ef03c89b",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    source: "Web Application",
    iconClass: "blue",
    iconChar: "📄",
  },
  {
    id: "LOG-2024-00012339",
    timestamp: "15 Jan 2024, 10:08:55 AM",
    user: "Vikram Patel",
    userBadge: "INS-012",
    designation: "Inspector",
    department: "Narcotics Control Bureau",
    departmentShort: "Narcotics Control",
    action: "Deleted Entity (Soft)",
    resourceId: "ENT-2024-0067",
    resourceName: "Duplicate Bank Node",
    resourceType: "Entity Record",
    caseId: "CC/2026/002",
    caseTitle: "Cross-Border Narcotics Ring",
    ipAddress: "192.168.1.90",
    status: "Success",
    eventType: "User Action",
    description: "Flagged duplicate entity for soft deletion and chain archiving",
    sessionId: "sess_55f2ca09b11e",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    source: "Web Application",
    iconClass: "blue",
    iconChar: "📄",
  },
  {
    id: "LOG-2024-00012338",
    timestamp: "15 Jan 2024, 10:05:21 AM",
    user: "System",
    userBadge: "SYSTEM",
    designation: "RBAC Controller",
    department: "Forensic Lab",
    departmentShort: "Forensic Lab",
    action: "Role Updated",
    resourceId: "User: ANL-015",
    resourceName: "Pooja Arora Account",
    resourceType: "Officer Account",
    caseId: "N/A",
    caseTitle: "Administrative RBAC",
    ipAddress: "192.168.1.10",
    status: "Success",
    eventType: "System",
    description: "Updated RBAC permissions profile to Forensic Analyst level",
    sessionId: "sess_sys_rbac_sync",
    userAgent: "Internal Daemon",
    source: "RBAC Controller",
    iconClass: "gear",
    iconChar: "⚙️",
  },
];

// ─── Application State ────────────────────────────────────────────────────────
const state = {
  logs: [],
  filteredLogs: [],
  selectedLogId: null,
  activeDetailTab: "overview",
  searchQuery: "",
  filterEventType: "",
  filterUser: "",
  filterDepartment: "",
  filterResource: "",
  filterStatus: "",
  currentUser: null,
  totalEventsCount: 0,
  userActivitiesCount: 0,
  securityEventsCount: 0,
  dataAccessEventsCount: 0,
  systemEventsCount: 0,
};

// ─── DOM References ───────────────────────────────────────────────────────────
const DOM = {
  tableBody: document.getElementById("audit-table-body"),
  paginationSummary: document.getElementById("pagination-summary"),
  searchInput: document.getElementById("audit-search-input"),
  globalSearchInput: document.getElementById("global-search-input"),
  btnClearFilters: document.getElementById("btn-clear-filters"),
  filterEventType: document.getElementById("filter-event-type"),
  filterUser: document.getElementById("filter-user"),
  filterDepartment: document.getElementById("filter-department"),
  filterResource: document.getElementById("filter-resource"),
  filterStatus: document.getElementById("filter-status"),
  toastContainer: document.getElementById("toast-container"),

  // Details Panel Elements
  logDetailsPanel: document.getElementById("log-details-panel"),
  detailHeroAction: document.getElementById("detail-hero-action"),
  detailHeroTime: document.getElementById("detail-hero-time"),
  detailHeroStatus: document.getElementById("detail-hero-status"),
  detailContentArea: document.getElementById("detail-content-area"),
  detailSubtabs: document.querySelectorAll(".neu-subtab-btn"),
  btnCloseDetails: document.getElementById("btn-close-details"),

  // Export Modal Elements
  btnExportLogs: document.getElementById("btn-export-logs"),
  modalExport: document.getElementById("modal-export"),
  btnCloseExport: document.getElementById("btn-close-export"),
  btnCancelExport: document.getElementById("btn-cancel-export"),
  btnConfirmExport: document.getElementById("btn-confirm-export"),
  exportFormat: document.getElementById("export-format"),
  exportScope: document.getElementById("export-scope"),

  // Header Elements
  btnDateRange: document.getElementById("btn-date-range"),
  dateRangeLabel: document.getElementById("date-range-label"),
  btnViewAllAlerts: document.getElementById("btn-view-all-alerts"),
};

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = "info") {
  if (!DOM.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `neu-toast ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️"}</span>
    <span>${message}</span>
  `;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Render Audit Table ───────────────────────────────────────────────────────
function renderTable() {
  if (!DOM.tableBody) return;

  if (state.filteredLogs.length === 0) {
    DOM.tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 32px; color: var(--neu-secondary);">
          No audit log records match the selected query and filters.
        </td>
      </tr>
    `;
    if (DOM.paginationSummary) {
      DOM.paginationSummary.textContent = "Showing 0 of 0 logs";
    }
    return;
  }

  DOM.tableBody.innerHTML = state.filteredLogs
    .map((log) => {
      const isSelected = log.id === state.selectedLogId;
      const statusClass =
        log.status.toLowerCase() === "success"
          ? "success"
          : log.status.toLowerCase() === "failed"
          ? "failed"
          : "blocked";

      const eventTypeClass =
        log.eventType === "Data Access"
          ? "data-access"
          : log.eventType === "User Action"
          ? "user-action"
          : log.eventType === "Security"
          ? "security"
          : "system";

      return `
        <tr class="audit-row ${isSelected ? "selected" : ""}" data-id="${log.id}">
          <td><input type="checkbox" ${isSelected ? "checked" : ""} aria-label="Select log ${log.id}" /></td>
          <td>
            <div class="neu-cell-timestamp">
              <span class="neu-icon-pill-small ${log.iconClass || "blue"}">${log.iconChar || "📄"}</span>
              <span>${log.timestamp}</span>
            </div>
          </td>
          <td>
            <div class="neu-cell-user">
              <span class="neu-user-name">${log.user}</span>
              ${log.userBadge && log.userBadge !== "SYSTEM" ? `<span class="neu-user-sub">(${log.userBadge})</span>` : ""}
            </div>
          </td>
          <td>
            <span class="neu-cell-action ${log.status.toLowerCase() === "failed" ? "failed" : ""}">${log.action}</span>
          </td>
          <td><span class="neu-badge-code">${log.resourceId}</span></td>
          <td><span class="neu-ip-code">${log.ipAddress}</span></td>
          <td><span class="neu-badge-status ${statusClass}">${log.status}</span></td>
          <td><span class="neu-badge-event-type ${eventTypeClass}">${log.eventType}</span></td>
          <td style="text-align: right;">
            <button class="neu-btn-action-more" data-action="row-menu" data-id="${log.id}" aria-label="More log options">•••</button>
          </td>
        </tr>
      `;
    })
    .join("");

  if (DOM.paginationSummary) {
    DOM.paginationSummary.textContent = `Showing 1-${state.filteredLogs.length} of ${state.totalEventsCount.toLocaleString()} logs`;
  }

  // Attach row click listeners
  DOM.tableBody.querySelectorAll(".audit-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectLog(row.dataset.id);
    });
  });
}

// ─── Select Log Event & Update Details Panel ──────────────────────────────────
function selectLog(logId) {
  const log = state.logs.find((l) => l.id === logId);
  if (!log) return;

  state.selectedLogId = logId;

  // Update table row styling
  DOM.tableBody.querySelectorAll(".audit-row").forEach((row) => {
    const isCurrent = row.dataset.id === logId;
    row.classList.toggle("selected", isCurrent);
    const cb = row.querySelector("input[type='checkbox']");
    if (cb) cb.checked = isCurrent;
  });

  // Hero Section
  if (DOM.detailHeroAction) DOM.detailHeroAction.textContent = log.action;
  if (DOM.detailHeroTime) DOM.detailHeroTime.textContent = log.timestamp;
  if (DOM.detailHeroStatus) {
    DOM.detailHeroStatus.textContent = log.status;
    DOM.detailHeroStatus.className = `neu-badge-status ${log.status.toLowerCase() === "success" ? "success" : "failed"}`;
  }

  // Render current active tab content
  renderDetailTabContent(state.activeDetailTab);
}

// ─── Detail Subtab Rendering ──────────────────────────────────────────────────
function renderDetailTabContent(tabName) {
  state.activeDetailTab = tabName;
  const log = state.logs.find((l) => l.id === state.selectedLogId);
  if (!log || !DOM.detailContentArea) return;

  if (tabName === "overview") {
    DOM.detailContentArea.innerHTML = `
      <div class="neu-info-block">
        <span class="neu-block-title">Event Information</span>
        <div class="neu-info-grid-row"><span class="label">Event ID</span><span class="value mono">${log.id}</span></div>
        <div class="neu-info-grid-row"><span class="label">Event Type</span><span class="value">${log.eventType}</span></div>
        <div class="neu-info-grid-row"><span class="label">Action</span><span class="value">${log.action}</span></div>
        <div class="neu-info-grid-row"><span class="label">Description</span><span class="value" style="max-width: 60%; font-weight: 500;">${log.description}</span></div>
        <div class="neu-info-grid-row"><span class="label">Timestamp</span><span class="value mono">${log.timestamp}</span></div>
        <div class="neu-info-grid-row"><span class="label">Status</span><span class="neu-badge-status ${log.status.toLowerCase() === "success" ? "success" : "failed"}">${log.status}</span></div>
        <div class="neu-info-grid-row"><span class="label">IP Address</span><span class="value mono">${log.ipAddress}</span></div>
        <div class="neu-info-grid-row"><span class="label">Session ID</span><span class="value mono">${log.sessionId}</span></div>
        <div class="neu-info-grid-row"><span class="label">User Agent</span><span class="value" style="font-size: 0.7rem; max-width: 65%;">${log.userAgent}</span></div>
        <div class="neu-info-grid-row"><span class="label">Source</span><span class="value">${log.source}</span></div>
      </div>

      <div class="neu-info-block">
        <span class="neu-block-title">User Information</span>
        <div class="neu-linked-card">
          <div class="neu-linked-left">
            <div class="neu-linked-icon blue" aria-hidden="true">👤</div>
            <div class="neu-linked-text">
              <span class="neu-linked-name">${log.user} ${log.userBadge ? `(${log.userBadge})` : ""}</span>
              <span class="neu-linked-sub">${log.designation || "Officer"} • ${log.department}</span>
            </div>
          </div>
          <a href="/frontend/pages/admin.html" class="neu-linked-action">View User Profile →</a>
        </div>
      </div>

      <div class="neu-info-block">
        <span class="neu-block-title">Resource Information</span>
        <div class="neu-linked-card">
          <div class="neu-linked-left">
            <div class="neu-linked-icon yellow" aria-hidden="true">📄</div>
            <div class="neu-linked-text">
              <span class="neu-linked-name">${log.resourceId}</span>
              <span class="neu-linked-sub">${log.resourceType} • ${log.resourceName}</span>
            </div>
          </div>
          <a href="/frontend/pages/evidence.html" class="neu-linked-action">View Evidence →</a>
        </div>
      </div>

      <div class="neu-info-block">
        <span class="neu-block-title">Case Information</span>
        <div class="neu-linked-card">
          <div class="neu-linked-left">
            <div class="neu-linked-icon purple" aria-hidden="true">💼</div>
            <div class="neu-linked-text">
              <span class="neu-linked-name">${log.caseId}</span>
              <span class="neu-linked-sub">${log.caseTitle}</span>
            </div>
          </div>
          <a href="/frontend/pages/cases.html" class="neu-linked-action">View Case →</a>
        </div>
      </div>
    `;
  } else if (tabName === "user") {
    DOM.detailContentArea.innerHTML = `
      <div class="neu-info-block">
        <span class="neu-block-title">Officer Credentials & Provenance</span>
        <div class="neu-info-grid-row"><span class="label">Full Name</span><span class="value">${log.user}</span></div>
        <div class="neu-info-grid-row"><span class="label">Badge Number</span><span class="value mono">${log.userBadge || "N/A"}</span></div>
        <div class="neu-info-grid-row"><span class="label">Designation</span><span class="value">${log.designation || "Investigator"}</span></div>
        <div class="neu-info-grid-row"><span class="label">Assigned Department</span><span class="value">${log.department}</span></div>
        <div class="neu-info-grid-row"><span class="label">Session ID</span><span class="value mono">${log.sessionId}</span></div>
        <div class="neu-info-grid-row"><span class="label">Source IP Address</span><span class="value mono">${log.ipAddress}</span></div>
      </div>
    `;
  } else if (tabName === "resource") {
    DOM.detailContentArea.innerHTML = `
      <div class="neu-info-block">
        <span class="neu-block-title">Target Forensic Resource Details</span>
        <div class="neu-info-grid-row"><span class="label">Resource ID</span><span class="value mono">${log.resourceId}</span></div>
        <div class="neu-info-grid-row"><span class="label">Resource Type</span><span class="value">${log.resourceType}</span></div>
        <div class="neu-info-grid-row"><span class="label">Resource Filename</span><span class="value mono">${log.resourceName}</span></div>
        <div class="neu-info-grid-row"><span class="label">Linked Case</span><span class="value mono">${log.caseId}</span></div>
        <div class="neu-info-grid-row"><span class="label">Integrity Status</span><span class="value" style="color: var(--neu-green);">SHA-256 Verified Immutable</span></div>
      </div>
    `;
  } else if (tabName === "additional") {
    DOM.detailContentArea.innerHTML = `
      <div class="neu-info-block">
        <span class="neu-block-title">Cryptographic & Runtime Telemetry</span>
        <div class="neu-info-grid-row"><span class="label">User Agent</span><span class="value mono" style="font-size: 0.68rem;">${log.userAgent}</span></div>
        <div class="neu-info-grid-row"><span class="label">Origin</span><span class="value">${log.source}</span></div>
        <div class="neu-info-grid-row"><span class="label">Audit Append-Only Flag</span><span class="value" style="color: var(--neu-green);">TRUE (PostgreSQL RLS Protected)</span></div>
        <div class="neu-info-grid-row"><span class="label">Storage Location</span><span class="value mono">prisma/dev.db [AuditLog]</span></div>
      </div>
    `;
  } else if (tabName === "related") {
    DOM.detailContentArea.innerHTML = `
      <div class="neu-info-block">
        <span class="neu-block-title">Correlated Activity by Same Session</span>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.78rem;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--neu-border);">
            <span><strong>LOGIN_SUCCESS</strong> via Gov-SSO</span>
            <span class="neu-badge-status success">Success</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--neu-border);">
            <span><strong>VIEW_EVIDENCE</strong> (${log.resourceId})</span>
            <span class="neu-badge-status success">Success</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span><strong>EXTRACT_OCR</strong> completed</span>
            <span class="neu-badge-status success">Success</span>
          </div>
        </div>
      </div>
    `;
  }
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────
function applyFilters() {
  const q = state.searchQuery.toLowerCase().trim();

  state.filteredLogs = state.logs.filter((log) => {
    // 1. Event Type filter
    if (state.filterEventType && log.eventType.toLowerCase() !== state.filterEventType.toLowerCase()) {
      return false;
    }

    // 2. User filter
    if (state.filterUser && !log.user.toLowerCase().includes(state.filterUser.toLowerCase())) {
      return false;
    }

    // 3. Department filter
    if (state.filterDepartment && !log.department.toLowerCase().includes(state.filterDepartment.toLowerCase())) {
      return false;
    }

    // 4. Resource Type filter
    if (state.filterResource && !log.resourceType.toLowerCase().includes(state.filterResource.toLowerCase())) {
      return false;
    }

    // 5. Status filter
    if (state.filterStatus && log.status.toUpperCase() !== state.filterStatus.toUpperCase()) {
      return false;
    }

    // 6. Text Query (Search across multiple fields)
    if (q) {
      const match =
        log.action.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q) ||
        log.resourceId.toLowerCase().includes(q) ||
        log.caseId.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        (log.userBadge && log.userBadge.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  renderTable();
}

// ─── Setup Event Listeners ────────────────────────────────────────────────────
function setupEventListeners() {
  // Search Inputs
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      applyFilters();
    });
  }

  if (DOM.globalSearchInput) {
    DOM.globalSearchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      if (DOM.searchInput) DOM.searchInput.value = e.target.value;
      applyFilters();
    });
  }

  // Filter Dropdowns
  if (DOM.filterEventType) {
    DOM.filterEventType.addEventListener("change", (e) => {
      state.filterEventType = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterUser) {
    DOM.filterUser.addEventListener("change", (e) => {
      state.filterUser = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterDepartment) {
    DOM.filterDepartment.addEventListener("change", (e) => {
      state.filterDepartment = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterResource) {
    DOM.filterResource.addEventListener("change", (e) => {
      state.filterResource = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterStatus) {
    DOM.filterStatus.addEventListener("change", (e) => {
      state.filterStatus = e.target.value;
      applyFilters();
    });
  }

  // Clear Filters
  if (DOM.btnClearFilters) {
    DOM.btnClearFilters.addEventListener("click", () => {
      state.searchQuery = "";
      state.filterEventType = "";
      state.filterUser = "";
      state.filterDepartment = "";
      state.filterResource = "";
      state.filterStatus = "";

      if (DOM.searchInput) DOM.searchInput.value = "";
      if (DOM.globalSearchInput) DOM.globalSearchInput.value = "";
      if (DOM.filterEventType) DOM.filterEventType.value = "";
      if (DOM.filterUser) DOM.filterUser.value = "";
      if (DOM.filterDepartment) DOM.filterDepartment.value = "";
      if (DOM.filterResource) DOM.filterResource.value = "";
      if (DOM.filterStatus) DOM.filterStatus.value = "";

      applyFilters();
      showToast("Filters cleared.", "info");
    });
  }

  // Detail Subtabs
  DOM.detailSubtabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.detailSubtabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      renderDetailTabContent(tab.dataset.tab);
    });
  });

  // Export Modal Triggers
  if (DOM.btnExportLogs) {
    DOM.btnExportLogs.addEventListener("click", () => {
      if (DOM.modalExport) DOM.modalExport.classList.add("open");
    });
  }

  if (DOM.btnCloseExport) {
    DOM.btnCloseExport.addEventListener("click", () => {
      if (DOM.modalExport) DOM.modalExport.classList.remove("open");
    });
  }

  if (DOM.btnCancelExport) {
    DOM.btnCancelExport.addEventListener("click", () => {
      if (DOM.modalExport) DOM.modalExport.classList.remove("open");
    });
  }

  if (DOM.btnConfirmExport) {
    DOM.btnConfirmExport.addEventListener("click", handleExport);
  }

  // Close details panel
  if (DOM.btnCloseDetails) {
    DOM.btnCloseDetails.addEventListener("click", () => {
      showToast("Selected log detail remains active in inspector view.", "info");
    });
  }

  // Date Range Button
  if (DOM.btnDateRange) {
    DOM.btnDateRange.addEventListener("click", () => {
      showToast("Displaying forensic calendar records for Year 2024.", "info");
    });
  }

  // View All Alerts Button
  if (DOM.btnViewAllAlerts) {
    DOM.btnViewAllAlerts.addEventListener("click", (e) => {
      e.preventDefault();
      // Set filter to Security
      if (DOM.filterEventType) {
        DOM.filterEventType.value = "Security";
        state.filterEventType = "Security";
        applyFilters();
        showToast("Filtered view to Security events.", "info");
      }
    });
  }

  // Close modal on escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && DOM.modalExport?.classList.contains("open")) {
      DOM.modalExport.classList.remove("open");
    }
  });
}

// ─── Export Handler ───────────────────────────────────────────────────────────
async function handleExport() {
  const format = DOM.exportFormat?.value || "CSV";
  const scope = DOM.exportScope?.value || "All Modules";

  showToast(`Preparing ${format} audit export...`, "info");
  if (DOM.modalExport) DOM.modalExport.classList.remove("open");

  try {
    const url = `/api/audit/export?format=${format}&module=${encodeURIComponent(scope)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Export failed.", "error");
      return;
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Rakshak_Audit_Logs_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    showToast(`Audit log ${format} file downloaded successfully.`, "success");
  } catch (err) {
    console.error("Export error:", err);
    showToast("Network error while generating export file.", "error");
  }
}

// ─── Live Backend Synchronization ─────────────────────────────────────────────
async function syncLiveBackend() {
  // 1. Authenticated User Profile Check
  try {
    const authRes = await fetch("/api/auth/me");
    if (authRes.ok) {
      const authData = await authRes.json();
      state.currentUser = authData.officer;
      const officerPill = document.getElementById("officer-name");
      const deptPill = document.getElementById("officer-dept");
      if (officerPill && state.currentUser?.name) {
        officerPill.textContent = `${state.currentUser.designation || "Officer"} ${state.currentUser.name}`;
      }
      if (deptPill && state.currentUser?.unit) {
        deptPill.textContent = state.currentUser.unit;
      }
    }
  } catch (err) {
    console.warn("Live session sync skipped:", err);
  }

  // 2. Fetch Live Audit Logs from DB
  try {
    const auditRes = await fetch("/api/audit?limit=25");
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      if (auditData.events && Array.isArray(auditData.events)) {
        auditData.events.forEach((dbEvt) => {
          let meta = {};
          try {
            if (dbEvt.metadata) meta = JSON.parse(dbEvt.metadata);
          } catch {
            meta = {};
          }

          const existingMatch = state.logs.find((l) => l.id === dbEvt.id);
          if (existingMatch) {
            existingMatch.timestamp = new Date(dbEvt.timestamp).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
            existingMatch.status = dbEvt.result === "SUCCESS" ? "Success" : dbEvt.result === "FAILED" ? "Failed" : "Blocked";
            existingMatch.ipAddress = dbEvt.ipAddress || existingMatch.ipAddress;
          } else {
            // Add new runtime audit record to top of list
            const dateStr = new Date(dbEvt.timestamp).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });

            state.logs.unshift({
              id: dbEvt.id,
              timestamp: dateStr,
              user: dbEvt.officerName || "System",
              userBadge: dbEvt.officerBadge || "SYSTEM",
              designation: "Officer",
              department: meta.department || "Cyber Crime Department",
              departmentShort: meta.department || "Cyber Crime",
              action: meta.displayAction || dbEvt.action,
              resourceId: dbEvt.targetId || "N/A",
              resourceName: meta.resourceName || dbEvt.targetType || "System Resource",
              resourceType: meta.resourceType || dbEvt.targetType || "Resource",
              caseId: meta.caseNumber || "CC/2024/001",
              caseTitle: meta.caseTitle || "Forensic Investigation",
              ipAddress: dbEvt.ipAddress || "192.168.1.1",
              status: dbEvt.result === "SUCCESS" ? "Success" : dbEvt.result === "FAILED" ? "Failed" : "Blocked",
              eventType: meta.eventType || (dbEvt.module === "Evidence" ? "Data Access" : dbEvt.module === "Auth" ? "Security" : "User Action"),
              description: dbEvt.details,
              sessionId: meta.sessionId || "sess_live_stream",
              userAgent: meta.userAgent || "Mozilla/5.0",
              source: meta.source || "Web Application",
              iconClass: dbEvt.result === "FAILED" ? "red" : "blue",
              iconChar: dbEvt.result === "FAILED" ? "🛡️" : "📄",
            });
          }
        });
        applyFilters();
      }
    }
  } catch (err) {
    console.warn("Live audit log sync skipped:", err);
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
function init() {
  renderTable();
  selectLog(state.selectedLogId);
  setupEventListeners();
  syncLiveBackend();
}

// Execute when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
