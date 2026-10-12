// ─────────────────────────────────────────────────────────────────────────────
// public/frontend/js/admin.js
// Controller for Page 10: Administration & Officer Management
// Light-Neumorphic UI, Real RBAC enforcement, Live DB sync, Row Selection, Modals
// ─────────────────────────────────────────────────────────────────────────────

// ─── Canonical Baseline Officers (Matches Reference Image Exactly) ───────────
const CANONICAL_OFFICERS = [
  {
    id: "INS-001",
    badgeNumber: "INS-001",
    name: "Rajesh Kumar",
    email: "rajesh.kumar@gov.in",
    phone: "+91 98765 43210",
    department: "Cyber Crime",
    departmentFull: "Cyber Crime Department",
    ministry: "Ministry of Home Affairs",
    departmentCode: "CCD",
    departmentHead: "DIG A. K. Verma",
    role: "Inspector",
    rbacRole: "INVESTIGATOR",
    accessLevel: "High",
    status: "Active",
    joiningDate: "12 Mar 2018",
    lastLogin: "15 Jan 2024, 10:30 AM",
    avatarClass: "rk",
    avatarInitials: "RK",
    twoFactorAuth: true,
    lastPasswordChange: "10 Dec 2023",
    assignedRoles: ["Investigator", "Case Approver", "Evidence Viewer"],
    assignedCasesCount: 14,
  },
  {
    id: "SI-027",
    badgeNumber: "SI-027",
    name: "Priya Singh",
    email: "priya.singh@gov.in",
    phone: "+91 98765 43211",
    department: "Cyber Crime",
    departmentFull: "Cyber Crime Department",
    ministry: "Ministry of Home Affairs",
    departmentCode: "CCD",
    departmentHead: "DIG A. K. Verma",
    role: "Sub Inspector",
    rbacRole: "INVESTIGATOR",
    accessLevel: "Medium",
    status: "Active",
    joiningDate: "05 Aug 2020",
    lastLogin: "15 Jan 2024, 09:15 AM",
    avatarClass: "ps",
    avatarInitials: "PS",
    twoFactorAuth: true,
    lastPasswordChange: "18 Nov 2023",
    assignedRoles: ["Investigator", "Evidence Viewer"],
    assignedCasesCount: 9,
  },
  {
    id: "HC-105",
    badgeNumber: "HC-105",
    name: "Amit Sharma",
    email: "amit.sharma@gov.in",
    phone: "+91 98765 43212",
    department: "State Police (Delhi)",
    departmentFull: "State Police (Delhi)",
    ministry: "Delhi NCT Police Command",
    departmentCode: "DL-POLICE",
    departmentHead: "CP Sanjay Arora",
    role: "Head Constable",
    rbacRole: "INVESTIGATOR",
    accessLevel: "Medium",
    status: "Active",
    joiningDate: "19 Jan 2016",
    lastLogin: "15 Jan 2024, 08:45 AM",
    avatarClass: "as",
    avatarInitials: "AS",
    twoFactorAuth: true,
    lastPasswordChange: "02 Oct 2023",
    assignedRoles: ["Investigator"],
    assignedCasesCount: 7,
  },
  {
    id: "SI-043",
    badgeNumber: "SI-043",
    name: "Neha Verma",
    email: "neha.verma@gov.in",
    phone: "+91 98765 43213",
    department: "Economic Offences",
    departmentFull: "Economic Offences Wing",
    ministry: "Ministry of Home Affairs",
    departmentCode: "EOW",
    departmentHead: "Joint CP Chhaya Sharma",
    role: "Sub Inspector",
    rbacRole: "INVESTIGATOR",
    accessLevel: "Medium",
    status: "Pending",
    joiningDate: "01 Nov 2023",
    lastLogin: "14 Jan 2024, 05:20 PM",
    avatarClass: "nv",
    avatarInitials: "NV",
    twoFactorAuth: false,
    lastPasswordChange: "01 Nov 2023",
    assignedRoles: ["Investigator"],
    assignedCasesCount: 3,
  },
  {
    id: "INS-012",
    badgeNumber: "INS-012",
    name: "Vikram Patel",
    email: "vikram.patel@gov.in",
    phone: "+91 98765 43214",
    department: "Narcotics Control",
    departmentFull: "Narcotics Control Bureau",
    ministry: "Ministry of Home Affairs",
    departmentCode: "NCB",
    departmentHead: "DG Satya Narayan Pradhan",
    role: "Inspector",
    rbacRole: "INVESTIGATOR",
    accessLevel: "High",
    status: "Active",
    joiningDate: "14 Feb 2017",
    lastLogin: "15 Jan 2024, 07:30 AM",
    avatarClass: "vp",
    avatarInitials: "VP",
    twoFactorAuth: true,
    lastPasswordChange: "22 Dec 2023",
    assignedRoles: ["Investigator", "Case Approver"],
    assignedCasesCount: 11,
  },
  {
    id: "HC-221",
    badgeNumber: "HC-221",
    name: "Sandeep Rai",
    email: "sandeep.rai@gov.in",
    phone: "+91 98765 43215",
    department: "Intelligence Bureau",
    departmentFull: "Intelligence Bureau",
    ministry: "Ministry of Home Affairs",
    departmentCode: "IB",
    departmentHead: "Director Tapan Deka",
    role: "Head Constable",
    rbacRole: "VIEWER",
    accessLevel: "Low",
    status: "Active",
    joiningDate: "10 Jun 2019",
    lastLogin: "13 Jan 2024, 04:10 PM",
    avatarClass: "sr",
    avatarInitials: "SR",
    twoFactorAuth: true,
    lastPasswordChange: "15 Jan 2024",
    assignedRoles: ["Evidence Viewer"],
    assignedCasesCount: 2,
  },
  {
    id: "SI-067",
    badgeNumber: "SI-067",
    name: "Karan Mehta",
    email: "karan.mehta@gov.in",
    phone: "+91 98765 43216",
    department: "CBI",
    departmentFull: "Central Bureau of Investigation",
    ministry: "Department of Personnel and Training",
    departmentCode: "CBI",
    departmentHead: "Director Praveen Sood",
    role: "Sub Inspector",
    rbacRole: "INVESTIGATOR",
    accessLevel: "High",
    status: "Active",
    joiningDate: "23 Apr 2021",
    lastLogin: "15 Jan 2024, 06:50 AM",
    avatarClass: "km",
    avatarInitials: "KM",
    twoFactorAuth: true,
    lastPasswordChange: "05 Nov 2023",
    assignedRoles: ["Investigator", "Case Approver"],
    assignedCasesCount: 8,
  },
  {
    id: "ANL-015",
    badgeNumber: "ANL-015",
    name: "Pooja Arora",
    email: "pooja.arora@gov.in",
    phone: "+91 98765 43217",
    department: "Forensic Lab",
    departmentFull: "Central Forensic Science Laboratory",
    ministry: "Directorate of Forensic Science Services",
    departmentCode: "FSL",
    departmentHead: "Director Dr. S. K. Jain",
    role: "Analyst",
    rbacRole: "ANALYST",
    accessLevel: "Medium",
    status: "Inactive",
    joiningDate: "18 Sep 2022",
    lastLogin: "02 Jan 2024, 11:20 AM",
    avatarClass: "pa",
    avatarInitials: "PA",
    twoFactorAuth: false,
    lastPasswordChange: "18 Sep 2022",
    assignedRoles: ["Evidence Viewer"],
    assignedCasesCount: 1,
  },
];

// ─── Application State ────────────────────────────────────────────────────────
const state = {
  officers: [...CANONICAL_OFFICERS],
  filteredOfficers: [...CANONICAL_OFFICERS],
  selectedOfficerId: "INS-001",
  activeStatusTab: "ALL",
  activeProfileTab: "overview",
  searchQuery: "",
  filterDepartment: "",
  filterRole: "",
  filterStatus: "",
  filterAccessLevel: "",
  currentUser: null,
  totalOfficersCount: 248,
  activeAccountsCount: 226,
  inactiveAccountsCount: 12,
  pendingApprovalsCount: 10,
  deactivatedAccountsCount: 0,
};

// ─── DOM References ───────────────────────────────────────────────────────────
const DOM = {
  tableBody: document.getElementById("officers-table-body"),
  paginationSummary: document.getElementById("pagination-summary"),
  searchInput: document.getElementById("officer-search-input"),
  globalSearchInput: document.getElementById("global-search-input"),
  btnClearFilters: document.getElementById("btn-clear-filters"),
  filterDepartment: document.getElementById("filter-department"),
  filterRole: document.getElementById("filter-role"),
  filterStatus: document.getElementById("filter-status"),
  filterAccessLevel: document.getElementById("filter-access-level"),
  statusTabs: document.querySelectorAll(".neu-status-tab-btn"),
  toastContainer: document.getElementById("toast-container"),

  // Selected Profile Elements
  heroAvatar: document.getElementById("hero-avatar"),
  heroFullname: document.getElementById("hero-fullname"),
  heroStatus: document.getElementById("hero-status"),
  heroBadge: document.getElementById("hero-badge"),
  heroRoleTitle: document.getElementById("hero-role-title"),
  infoFullname: document.getElementById("info-fullname"),
  infoBadge: document.getElementById("info-badge"),
  infoEmail: document.getElementById("info-email"),
  infoPhone: document.getElementById("info-phone"),
  infoDept: document.getElementById("info-dept"),
  infoDesignation: document.getElementById("info-designation"),
  infoJoining: document.getElementById("info-joining"),
  infoStatus: document.getElementById("info-status"),
  infoLastLogin: document.getElementById("info-last-login"),
  photoPreview: document.getElementById("photo-preview"),
  infoAccessLevel: document.getElementById("info-access-level"),
  info2FA: document.getElementById("info-2fa"),
  infoPwdChange: document.getElementById("info-pwd-change"),
  assignedRolesList: document.getElementById("assigned-roles-list"),
  cardDeptName: document.getElementById("card-dept-name"),
  cardDeptMinistry: document.getElementById("card-dept-ministry"),
  cardDeptCode: document.getElementById("card-dept-code"),
  cardDeptHead: document.getElementById("card-dept-head"),

  // Profile Subtabs
  profileSubtabs: document.querySelectorAll(".neu-subtab-btn"),
  profileContentArea: document.getElementById("profile-content-area"),

  // Modals & Triggers
  btnAddOfficer: document.getElementById("btn-add-officer"),
  modalAddOfficer: document.getElementById("modal-add-officer"),
  btnCloseModalOfficer: document.getElementById("btn-close-modal-officer"),
  btnCancelAddOfficer: document.getElementById("btn-cancel-add-officer"),
  formAddOfficer: document.getElementById("form-add-officer"),

  btnCreateDept: document.getElementById("btn-create-dept"),
  modalCreateDept: document.getElementById("modal-create-dept"),
  btnCloseModalDept: document.getElementById("btn-close-modal-dept"),
  btnCancelCreateDept: document.getElementById("btn-cancel-create-dept"),
  formCreateDept: document.getElementById("form-create-dept"),

  btnRoleMgmt: document.getElementById("btn-role-mgmt"),
  btnManageRolesInline: document.getElementById("btn-manage-roles-inline"),
  btnEditSelectedOfficer: document.getElementById("btn-edit-selected-officer"),
  modalManageRoles: document.getElementById("modal-manage-roles"),
  btnCloseModalRoles: document.getElementById("btn-close-modal-roles"),
  btnCancelRoles: document.getElementById("btn-cancel-roles"),
  formManageRoles: document.getElementById("form-manage-roles"),
  modalRoleOfficerName: document.getElementById("modal-role-officer-name"),
  modalRoleOfficerBadge: document.getElementById("modal-role-officer-badge"),
  modalSelectRbacRole: document.getElementById("modal-select-rbac-role"),

  // Activity & Department Lists
  recentActivitiesList: document.getElementById("recent-activities-list"),
  departmentsOverviewList: document.getElementById("departments-overview-list"),
  systemSettingsList: document.getElementById("system-settings-list"),
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

// ─── Render Officer Directory Table ───────────────────────────────────────────
function renderTable() {
  if (!DOM.tableBody) return;

  if (state.filteredOfficers.length === 0) {
    DOM.tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 32px; color: var(--neu-secondary);">
          No officers match the selected criteria. Try resetting filters.
        </td>
      </tr>
    `;
    if (DOM.paginationSummary) {
      DOM.paginationSummary.textContent = "Showing 0 of 0 officers";
    }
    return;
  }

  DOM.tableBody.innerHTML = state.filteredOfficers
    .map((off) => {
      const isSelected = off.badgeNumber === state.selectedOfficerId;
      const accessClass =
        off.accessLevel === "High"
          ? "high"
          : off.accessLevel === "Medium"
          ? "medium"
          : "low";
      const statusClass =
        off.status === "Active"
          ? "active"
          : off.status === "Pending"
          ? "pending"
          : off.status === "Inactive"
          ? "inactive"
          : "deactivated";

      return `
        <tr class="officer-row ${isSelected ? "selected" : ""}" data-id="${off.badgeNumber}">
          <td><input type="checkbox" ${isSelected ? "checked" : ""} aria-label="Select officer ${off.name}" /></td>
          <td>
            <div class="neu-cell-officer">
              <div class="neu-avatar-circle ${off.avatarClass || "default"}">${off.avatarInitials || off.name.slice(0, 2).toUpperCase()}</div>
              <div class="neu-officer-meta">
                <span class="neu-officer-fullname">${off.name}</span>
                <span class="neu-officer-email">${off.email}</span>
              </div>
            </div>
          </td>
          <td><span class="neu-badge-code">${off.badgeNumber}</span></td>
          <td>${off.department}</td>
          <td>${off.role}</td>
          <td><span class="neu-badge-access ${accessClass}">${off.accessLevel}</span></td>
          <td><span class="neu-badge-status ${statusClass}">${off.status}</span></td>
          <td style="text-align: right;">
            <button class="neu-btn-action-more" data-action="row-menu" data-badge="${off.badgeNumber}" aria-label="More options for ${off.name}">•••</button>
          </td>
        </tr>
      `;
    })
    .join("");

  if (DOM.paginationSummary) {
    DOM.paginationSummary.textContent = `Showing 1-${state.filteredOfficers.length} of ${state.totalOfficersCount} officers`;
  }

  // Attach row click handlers
  DOM.tableBody.querySelectorAll(".officer-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      // Don't override if action menu clicked
      if (e.target.closest(".neu-btn-action-more")) {
        e.stopPropagation();
        openOfficerQuickActions(row.dataset.id);
        return;
      }
      const badge = row.dataset.id;
      selectOfficer(badge);
    });
  });
}

// ─── Select Officer and Update Right Profile Panel ─────────────────────────────
function selectOfficer(badgeNumber) {
  const officer = state.officers.find((o) => o.badgeNumber === badgeNumber);
  if (!officer) return;

  state.selectedOfficerId = badgeNumber;

  // Update table row active styles
  DOM.tableBody.querySelectorAll(".officer-row").forEach((row) => {
    const isCurrent = row.dataset.id === badgeNumber;
    row.classList.toggle("selected", isCurrent);
    const cb = row.querySelector("input[type='checkbox']");
    if (cb) cb.checked = isCurrent;
  });

  // Hero Section
  if (DOM.heroAvatar) {
    DOM.heroAvatar.textContent = officer.avatarInitials;
    DOM.heroAvatar.className = `neu-hero-avatar ${officer.avatarClass || "default"}`;
  }
  if (DOM.heroFullname) DOM.heroFullname.textContent = officer.name;
  if (DOM.heroStatus) {
    DOM.heroStatus.textContent = officer.status;
    DOM.heroStatus.className = `neu-badge-status ${
      officer.status === "Active"
        ? "active"
        : officer.status === "Pending"
        ? "pending"
        : "inactive"
    }`;
  }
  if (DOM.heroBadge) DOM.heroBadge.textContent = officer.badgeNumber;
  if (DOM.heroRoleTitle) DOM.heroRoleTitle.textContent = officer.role;

  // Basic Information
  if (DOM.infoFullname) DOM.infoFullname.textContent = officer.name;
  if (DOM.infoBadge) DOM.infoBadge.textContent = officer.badgeNumber;
  if (DOM.infoEmail) DOM.infoEmail.textContent = officer.email;
  if (DOM.infoPhone) DOM.infoPhone.textContent = officer.phone || "+91 98765 00000";
  if (DOM.infoDept) DOM.infoDept.textContent = officer.departmentFull || officer.department;
  if (DOM.infoDesignation) DOM.infoDesignation.textContent = officer.role;
  if (DOM.infoJoining) DOM.infoJoining.textContent = officer.joiningDate || "15 Jan 2022";
  if (DOM.infoStatus) {
    DOM.infoStatus.textContent = officer.status;
    DOM.infoStatus.className = `value ${officer.status === "Active" ? "active-status" : ""}`;
  }
  if (DOM.infoLastLogin) DOM.infoLastLogin.textContent = officer.lastLogin || "Never";

  // Photo Box
  if (DOM.photoPreview) {
    DOM.photoPreview.textContent = officer.avatarInitials;
  }

  // Account Security
  if (DOM.infoAccessLevel) {
    DOM.infoAccessLevel.textContent = officer.accessLevel;
    DOM.infoAccessLevel.className = `neu-badge-access ${
      officer.accessLevel === "High" ? "high" : officer.accessLevel === "Medium" ? "medium" : "low"
    }`;
  }
  if (DOM.info2FA) {
    DOM.info2FA.textContent = officer.twoFactorAuth ? "Enabled" : "Disabled";
    DOM.info2FA.className = `neu-badge-status ${officer.twoFactorAuth ? "active" : "inactive"}`;
  }
  if (DOM.infoPwdChange) {
    DOM.infoPwdChange.textContent = officer.lastPasswordChange || "Not Recorded";
  }

  // Assigned Roles
  if (DOM.assignedRolesList) {
    DOM.assignedRolesList.innerHTML = (officer.assignedRoles || ["Investigator"])
      .map((roleName, idx) => {
        const color = idx === 0 ? "blue" : idx === 1 ? "green" : "purple";
        return `<span class="neu-role-tag ${color}">${roleName}</span>`;
      })
      .join("");
  }

  // Department Information
  if (DOM.cardDeptName) DOM.cardDeptName.textContent = officer.departmentFull || officer.department;
  if (DOM.cardDeptMinistry) DOM.cardDeptMinistry.textContent = officer.ministry || "Ministry of Home Affairs";
  if (DOM.cardDeptCode) DOM.cardDeptCode.textContent = officer.departmentCode || "CCD";
  if (DOM.cardDeptHead) DOM.cardDeptHead.textContent = officer.departmentHead || "Senior Superintendent of Police";

  // If currently viewing non-overview subtab, re-render that subtab
  renderProfileTabContent(state.activeProfileTab);
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────
function applyFilters() {
  const q = state.searchQuery.toLowerCase().trim();

  state.filteredOfficers = state.officers.filter((off) => {
    // 1. Status Tab filter
    if (state.activeStatusTab !== "ALL") {
      if (off.status.toUpperCase() !== state.activeStatusTab) {
        return false;
      }
    }

    // 2. Department dropdown filter
    if (state.filterDepartment && !off.department.toLowerCase().includes(state.filterDepartment.toLowerCase())) {
      return false;
    }

    // 3. Role dropdown filter
    if (state.filterRole && !off.role.toLowerCase().includes(state.filterRole.toLowerCase())) {
      return false;
    }

    // 4. Status dropdown filter
    if (state.filterStatus && off.status.toLowerCase() !== state.filterStatus.toLowerCase()) {
      return false;
    }

    // 5. Access Level dropdown filter
    if (state.filterAccessLevel && off.accessLevel.toLowerCase() !== state.filterAccessLevel.toLowerCase()) {
      return false;
    }

    // 6. Search query
    if (q) {
      const match =
        off.name.toLowerCase().includes(q) ||
        off.email.toLowerCase().includes(q) ||
        off.badgeNumber.toLowerCase().includes(q) ||
        off.department.toLowerCase().includes(q) ||
        off.role.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  renderTable();
}

// ─── Profile Subtab Switching ─────────────────────────────────────────────────
function renderProfileTabContent(tabName) {
  state.activeProfileTab = tabName;
  const officer = state.officers.find((o) => o.badgeNumber === state.selectedOfficerId);
  if (!officer || !DOM.profileContentArea) return;

  if (tabName === "overview") {
    // Restore default overview HTML structure
    DOM.profileContentArea.innerHTML = `
      <div class="neu-profile-overview-grid">
        <div class="neu-subcard-basic">
          <span class="neu-subcard-title">Basic Information</span>
          <div class="neu-info-pair"><span class="label">Full Name</span><span class="value" id="info-fullname">${officer.name}</span></div>
          <div class="neu-info-pair"><span class="label">Badge Number</span><span class="value" id="info-badge">${officer.badgeNumber}</span></div>
          <div class="neu-info-pair"><span class="label">Email</span><span class="value" id="info-email">${officer.email}</span></div>
          <div class="neu-info-pair"><span class="label">Phone</span><span class="value" id="info-phone">${officer.phone}</span></div>
          <div class="neu-info-pair"><span class="label">Department</span><span class="value" id="info-dept">${officer.departmentFull}</span></div>
          <div class="neu-info-pair"><span class="label">Designation</span><span class="value" id="info-designation">${officer.role}</span></div>
          <div class="neu-info-pair"><span class="label">Joining Date</span><span class="value" id="info-joining">${officer.joiningDate}</span></div>
          <div class="neu-info-pair"><span class="label">Status</span><span class="value ${officer.status === "Active" ? "active-status" : ""}" id="info-status">${officer.status}</span></div>
          <div class="neu-info-pair"><span class="label">Last Login</span><span class="value" id="info-last-login">${officer.lastLogin}</span></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div class="neu-subcard-photo">
            <span class="neu-subcard-title" style="align-self: flex-start;">Profile Photo</span>
            <div class="neu-photo-preview" id="photo-preview">${officer.avatarInitials}</div>
            <button class="neu-btn-change-photo" id="btn-change-photo"><span>↑</span> Change Photo</button>
          </div>
          <div class="neu-subcard-security">
            <span class="neu-subcard-title">Account Security</span>
            <div class="neu-info-pair"><span class="label">Access Level</span><span class="neu-badge-access ${officer.accessLevel === "High" ? "high" : "medium"}" id="info-access-level">${officer.accessLevel}</span></div>
            <div class="neu-info-pair"><span class="label">Two-Factor Auth</span><span class="neu-badge-status ${officer.twoFactorAuth ? "active" : "inactive"}" id="info-2fa">${officer.twoFactorAuth ? "Enabled" : "Disabled"}</span></div>
            <div class="neu-info-pair"><span class="label">Last Password Change</span><span class="value" id="info-pwd-change">${officer.lastPasswordChange}</span></div>
          </div>
        </div>
      </div>
      <div class="neu-subcard-roles">
        <div class="neu-roles-header">
          <span class="neu-subcard-title" style="margin: 0;">Assigned Roles</span>
          <button class="neu-btn-manage-roles" id="btn-manage-roles-inline">Manage Roles</button>
        </div>
        <div class="neu-role-tags" id="assigned-roles-list">
          ${officer.assignedRoles.map((r, i) => `<span class="neu-role-tag ${i === 0 ? "blue" : i === 1 ? "green" : "purple"}">${r}</span>`).join("")}
        </div>
      </div>
      <div class="neu-subcard-dept">
        <div class="neu-dept-card-header">
          <div class="neu-dept-icon-box" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="2"></line><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M8 10h.01"></path><path d="M16 10h.01"></path></svg>
          </div>
          <div class="neu-dept-header-text">
            <span class="neu-dept-title">${officer.departmentFull}</span>
            <span class="neu-dept-sub">${officer.ministry}</span>
          </div>
        </div>
        <div class="neu-dept-meta-row"><span class="label" style="color: var(--neu-secondary); font-size: 0.78rem;">Department Code</span><span class="value" style="font-weight: 700;">${officer.departmentCode}</span></div>
        <div class="neu-dept-meta-row"><span class="label" style="color: var(--neu-secondary); font-size: 0.78rem;">Head</span><span class="value" style="font-weight: 600;">${officer.departmentHead}</span></div>
        <a href="/frontend/pages/cross-dept.html" class="neu-link-view-dept">View Department →</a>
      </div>
    `;

    // Rebind inline manage roles button
    const inlineBtn = document.getElementById("btn-manage-roles-inline");
    if (inlineBtn) inlineBtn.addEventListener("click", () => openManageRolesModal(officer));

    const changePhotoBtn = document.getElementById("btn-change-photo");
    if (changePhotoBtn) {
      changePhotoBtn.addEventListener("click", () => {
        showToast("Profile photos are managed via government SSO directory policy.", "info");
      });
    }
  } else if (tabName === "roles") {
    DOM.profileContentArea.innerHTML = `
      <div class="neu-subcard-basic" style="gap: 14px;">
        <div class="neu-roles-header">
          <span class="neu-subcard-title" style="margin: 0;">Assigned Role & RBAC Permissions Matrix</span>
          <button class="neu-btn-manage-roles" id="btn-manage-roles-inline">Edit Role</button>
        </div>
        <p style="font-size: 0.8rem; color: var(--neu-secondary); margin: 0;">
          Primary Role: <strong>${officer.rbacRole}</strong> • Clearance: <strong>${officer.accessLevel}</strong>
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--neu-border); padding-bottom: 6px;">
            <span>Case Management (create, view, edit)</span>
            <span style="color: var(--neu-green); font-weight: 700;">Granted</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--neu-border); padding-bottom: 6px;">
            <span>Forensic Evidence Vault (SHA-256 integrity, upload)</span>
            <span style="color: var(--neu-green); font-weight: 700;">Granted</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--neu-border); padding-bottom: 6px;">
            <span>Intelligence & Syndicate Graph Analysis</span>
            <span style="color: var(--neu-green); font-weight: 700;">Granted</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--neu-border); padding-bottom: 6px;">
            <span>Legal Section 63/65B Certificate Generation</span>
            <span style="color: var(--neu-green); font-weight: 700;">Granted</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Platform Administrative Role Provisioning</span>
            <span style="color: ${officer.rbacRole === "ADMIN" ? "var(--neu-green)" : "var(--neu-secondary)"}; font-weight: 700;">
              ${officer.rbacRole === "ADMIN" ? "Granted" : "Restricted (Admin Only)"}
            </span>
          </div>
        </div>
      </div>
    `;
    const inlineBtn = document.getElementById("btn-manage-roles-inline");
    if (inlineBtn) inlineBtn.addEventListener("click", () => openManageRolesModal(officer));
  } else if (tabName === "dept") {
    DOM.profileContentArea.innerHTML = `
      <div class="neu-subcard-dept" style="padding: 20px;">
        <div class="neu-dept-card-header">
          <div class="neu-dept-icon-box" style="width: 40px; height: 40px;"><span style="font-size: 1.2rem;">🏛️</span></div>
          <div class="neu-dept-header-text">
            <span class="neu-dept-title" style="font-size: 1rem;">${officer.departmentFull}</span>
            <span class="neu-dept-sub">${officer.ministry}</span>
          </div>
        </div>
        <div class="neu-dept-meta-row" style="margin-top: 10px;">
          <span class="label">Jurisdiction Scope</span>
          <span class="value">${officer.department === "Cyber Crime" ? "Central Cyber Cell Delhi & National Command" : "State Territory"}</span>
        </div>
        <div class="neu-dept-meta-row">
          <span class="label">Department Head</span>
          <span class="value">${officer.departmentHead}</span>
        </div>
        <div class="neu-dept-meta-row">
          <span class="label">Department Code</span>
          <span class="value" style="font-family: var(--font-mono);">${officer.departmentCode}</span>
        </div>
        <div class="neu-dept-meta-row">
          <span class="label">Department Isolation</span>
          <span class="value" style="color: var(--neu-green); font-weight: 700;">PostgreSQL RLS Enforced</span>
        </div>
        <a href="/frontend/pages/cross-dept.html" class="neu-link-view-dept" style="margin-top: 12px;">Open Cross-Department Portal →</a>
      </div>
    `;
  } else if (tabName === "activity") {
    DOM.profileContentArea.innerHTML = `
      <div class="neu-subcard-basic" style="gap: 10px;">
        <span class="neu-subcard-title">Activity Trail for ${officer.name}</span>
        <div class="neu-activity-item">
          <div class="neu-activity-left">
            <div class="neu-activity-avatar orange">👤</div>
            <span class="neu-activity-text">Successful login via Gov-SSO MFA</span>
          </div>
          <span class="neu-activity-time">${officer.lastLogin}</span>
        </div>
        <div class="neu-activity-item">
          <div class="neu-activity-left">
            <div class="neu-activity-avatar blue">📄</div>
            <span class="neu-activity-text">Reviewed case evidence records</span>
          </div>
          <span class="neu-activity-time">15 Jan 2024, 09:15 AM</span>
        </div>
        <div class="neu-activity-item">
          <div class="neu-activity-left">
            <div class="neu-activity-avatar blue">🛡️</div>
            <span class="neu-activity-text">Session authenticated from 103.45.67.89</span>
          </div>
          <span class="neu-activity-time">14 Jan 2024, 18:30 PM</span>
        </div>
      </div>
    `;
  } else if (tabName === "cases") {
    DOM.profileContentArea.innerHTML = `
      <div class="neu-subcard-basic" style="gap: 12px;">
        <span class="neu-subcard-title">Assigned Active Cases (${officer.assignedCasesCount || 8})</span>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--neu-border);">
            <span><strong>CC/2026/001</strong> — Investment Syndicate Fraud</span>
            <span class="neu-badge-status active">Under Inquiry</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--neu-border);">
            <span><strong>CC/2026/002</strong> — Digital Arrest Extortion Case</span>
            <span class="neu-badge-status active">Active</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span><strong>CC/2026/005</strong> — Telegram Task Scam Ring</span>
            <span class="neu-badge-status pending">Verification</span>
          </div>
        </div>
        <a href="/frontend/pages/cases.html" class="neu-link-view-dept" style="margin-top: 6px;">View All Assigned Cases →</a>
      </div>
    `;
  }
}

// ─── Modal Open/Close Controls ────────────────────────────────────────────────
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("open");
  const firstInput = modalEl.querySelector("input, select");
  if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("open");
}

function openManageRolesModal(officer) {
  if (!officer || !DOM.modalManageRoles) return;
  if (DOM.modalRoleOfficerName) DOM.modalRoleOfficerName.textContent = officer.name;
  if (DOM.modalRoleOfficerBadge) DOM.modalRoleOfficerBadge.textContent = officer.badgeNumber;
  if (DOM.modalSelectRbacRole) DOM.modalSelectRbacRole.value = officer.rbacRole || "INVESTIGATOR";
  openModal(DOM.modalManageRoles);
}

function openOfficerQuickActions(badgeNumber) {
  const officer = state.officers.find((o) => o.badgeNumber === badgeNumber);
  if (!officer) return;
  selectOfficer(badgeNumber);
  openManageRolesModal(officer);
}

// ─── Setup Event Listeners ────────────────────────────────────────────────────
function setupEventListeners() {
  // 1. Status Tab Click Handlers
  DOM.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.statusTabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      state.activeStatusTab = tab.dataset.status || "ALL";
      applyFilters();
    });
  });

  // 2. Search Inputs
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

  // 3. Filter Dropdowns
  if (DOM.filterDepartment) {
    DOM.filterDepartment.addEventListener("change", (e) => {
      state.filterDepartment = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterRole) {
    DOM.filterRole.addEventListener("change", (e) => {
      state.filterRole = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterStatus) {
    DOM.filterStatus.addEventListener("change", (e) => {
      state.filterStatus = e.target.value;
      applyFilters();
    });
  }

  if (DOM.filterAccessLevel) {
    DOM.filterAccessLevel.addEventListener("change", (e) => {
      state.filterAccessLevel = e.target.value;
      applyFilters();
    });
  }

  // 4. Clear Filters
  if (DOM.btnClearFilters) {
    DOM.btnClearFilters.addEventListener("click", () => {
      state.searchQuery = "";
      state.filterDepartment = "";
      state.filterRole = "";
      state.filterStatus = "";
      state.filterAccessLevel = "";
      state.activeStatusTab = "ALL";

      if (DOM.searchInput) DOM.searchInput.value = "";
      if (DOM.globalSearchInput) DOM.globalSearchInput.value = "";
      if (DOM.filterDepartment) DOM.filterDepartment.value = "";
      if (DOM.filterRole) DOM.filterRole.value = "";
      if (DOM.filterStatus) DOM.filterStatus.value = "";
      if (DOM.filterAccessLevel) DOM.filterAccessLevel.value = "";

      DOM.statusTabs.forEach((t) => {
        const isAll = t.dataset.status === "ALL";
        t.classList.toggle("active", isAll);
        t.setAttribute("aria-selected", isAll ? "true" : "false");
      });

      applyFilters();
      showToast("Filters cleared.", "info");
    });
  }

  // 5. Profile Subtabs
  DOM.profileSubtabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.profileSubtabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      renderProfileTabContent(tab.dataset.tab);
    });
  });

  // 6. Add Officer Modal
  if (DOM.btnAddOfficer) {
    DOM.btnAddOfficer.addEventListener("click", () => openModal(DOM.modalAddOfficer));
  }
  if (DOM.btnCloseModalOfficer) {
    DOM.btnCloseModalOfficer.addEventListener("click", () => closeModal(DOM.modalAddOfficer));
  }
  if (DOM.btnCancelAddOfficer) {
    DOM.btnCancelAddOfficer.addEventListener("click", () => closeModal(DOM.modalAddOfficer));
  }
  if (DOM.formAddOfficer) {
    DOM.formAddOfficer.addEventListener("submit", handleAddOfficerSubmit);
  }

  // 7. Create Department Modal
  if (DOM.btnCreateDept) {
    DOM.btnCreateDept.addEventListener("click", () => openModal(DOM.modalCreateDept));
  }
  if (DOM.btnCloseModalDept) {
    DOM.btnCloseModalDept.addEventListener("click", () => closeModal(DOM.modalCreateDept));
  }
  if (DOM.btnCancelCreateDept) {
    DOM.btnCancelCreateDept.addEventListener("click", () => closeModal(DOM.modalCreateDept));
  }
  if (DOM.formCreateDept) {
    DOM.formCreateDept.addEventListener("submit", handleCreateDeptSubmit);
  }

  // 8. Role Management Modal
  if (DOM.btnRoleMgmt) {
    DOM.btnRoleMgmt.addEventListener("click", () => {
      const selected = state.officers.find((o) => o.badgeNumber === state.selectedOfficerId);
      openManageRolesModal(selected || state.officers[0]);
    });
  }
  if (DOM.btnManageRolesInline) {
    DOM.btnManageRolesInline.addEventListener("click", () => {
      const selected = state.officers.find((o) => o.badgeNumber === state.selectedOfficerId);
      openManageRolesModal(selected || state.officers[0]);
    });
  }
  if (DOM.btnEditSelectedOfficer) {
    DOM.btnEditSelectedOfficer.addEventListener("click", () => {
      const selected = state.officers.find((o) => o.badgeNumber === state.selectedOfficerId);
      openManageRolesModal(selected || state.officers[0]);
    });
  }
  if (DOM.btnCloseModalRoles) {
    DOM.btnCloseModalRoles.addEventListener("click", () => closeModal(DOM.modalManageRoles));
  }
  if (DOM.btnCancelRoles) {
    DOM.btnCancelRoles.addEventListener("click", () => closeModal(DOM.modalManageRoles));
  }
  if (DOM.formManageRoles) {
    DOM.formManageRoles.addEventListener("submit", handleManageRolesSubmit);
  }

  // 9. Close modals on backdrop click or Escape
  document.querySelectorAll(".neu-modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".neu-modal-backdrop.open").forEach((b) => closeModal(b));
    }
  });

  // 10. System Settings Item click handlers
  if (DOM.systemSettingsList) {
    DOM.systemSettingsList.querySelectorAll(".neu-setting-item").forEach((item) => {
      item.addEventListener("click", () => {
        const setting = item.dataset.setting;
        showToast(`Policy for '${setting}' is cryptographically enforced and managed by Central SysAdmin.`, "info");
      });
    });
  }
}

// ─── Backend Integration: Add Officer ─────────────────────────────────────────
async function handleAddOfficerSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("add-officer-name")?.value.trim();
  const badgeNumber = document.getElementById("add-officer-badge")?.value.trim().toUpperCase();
  const designation = document.getElementById("add-officer-designation")?.value;
  const email = document.getElementById("add-officer-email")?.value.trim();
  const phone = document.getElementById("add-officer-phone")?.value.trim();
  const role = document.getElementById("add-officer-role")?.value;
  const dept = document.getElementById("add-officer-dept")?.value;

  if (!name || !badgeNumber) {
    showToast("Name and Badge Number are required.", "error");
    return;
  }

  const payload = {
    name,
    badgeNumber,
    designation,
    role,
    jurisdiction: "Delhi NCR",
    unit: dept,
    email: email || `${badgeNumber.toLowerCase()}@police.gov.in`,
    phone: phone || "+91 98000 00000",
  };

  try {
    const res = await fetch("/api/officers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      // If error (e.g. 403 or 409), display actual message
      showToast(data.error || "Failed to provision officer.", "error");
      return;
    }

    showToast(`Account provisioned successfully for ${name} (${badgeNumber}).`, "success");
    closeModal(DOM.modalAddOfficer);
    DOM.formAddOfficer.reset();

    // Append to local state & re-render
    const initials = name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const newOfficerObj = {
      id: data.officer?.id || badgeNumber,
      badgeNumber,
      name,
      email: payload.email,
      phone: payload.phone,
      department: dept.includes("Cyber") ? "Cyber Crime" : dept,
      departmentFull: dept,
      ministry: "Ministry of Home Affairs",
      departmentCode: badgeNumber.split("-")[0] || "CCD",
      departmentHead: "DIG A. K. Verma",
      role: designation,
      rbacRole: role,
      accessLevel: role === "ADMIN" ? "High" : role === "INVESTIGATOR" ? "Medium" : "Low",
      status: "Active",
      joiningDate: "Today",
      lastLogin: "Never",
      avatarClass: "default",
      avatarInitials: initials,
      twoFactorAuth: true,
      lastPasswordChange: "Today",
      assignedRoles: [role],
      assignedCasesCount: 0,
    };

    state.officers.unshift(newOfficerObj);
    state.totalOfficersCount += 1;
    state.activeAccountsCount += 1;

    // Update summary counts
    const statTotal = document.getElementById("stat-total-officers");
    const statActive = document.getElementById("stat-active-accounts");
    if (statTotal) statTotal.textContent = String(state.totalOfficersCount);
    if (statActive) statActive.textContent = String(state.activeAccountsCount);

    applyFilters();
    selectOfficer(badgeNumber);
  } catch (err) {
    console.error("Error creating officer:", err);
    showToast("Network error while provisioning account.", "error");
  }
}

// ─── Backend Integration: Create Department ───────────────────────────────────
async function handleCreateDeptSubmit(e) {
  e.preventDefault();
  const code = document.getElementById("add-dept-code")?.value.trim().toUpperCase();
  const name = document.getElementById("add-dept-name")?.value.trim();
  const stateVal = document.getElementById("add-dept-state")?.value.trim();
  const jurisdiction = document.getElementById("add-dept-jurisdiction")?.value.trim();

  if (!code || !name) {
    showToast("Department code and name are required.", "error");
    return;
  }

  try {
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, state: stateVal, jurisdiction }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to create department.", "error");
      return;
    }

    showToast(`Department '${name}' (${code}) registered successfully.`, "success");
    closeModal(DOM.modalCreateDept);
    DOM.formCreateDept.reset();

    // Increment department count
    const statDept = document.getElementById("stat-total-departments");
    if (statDept) {
      const current = parseInt(statDept.textContent, 10) || 18;
      statDept.textContent = String(current + 1);
    }
  } catch (err) {
    console.error("Error registering department:", err);
    showToast("Network error while creating department.", "error");
  }
}

// ─── Manage Roles Submit Handler ──────────────────────────────────────────────
async function handleManageRolesSubmit(e) {
  e.preventDefault();
  const officer = state.officers.find((o) => o.badgeNumber === state.selectedOfficerId);
  if (!officer) return;

  const newRbacRole = DOM.modalSelectRbacRole?.value || officer.rbacRole;
  const capInvestigator = document.getElementById("cap-investigator")?.checked;
  const capApprover = document.getElementById("cap-approver")?.checked;
  const capViewer = document.getElementById("cap-evidence-viewer")?.checked;

  const newRoles = [];
  if (capInvestigator) newRoles.push("Investigator");
  if (capApprover) newRoles.push("Case Approver");
  if (capViewer) newRoles.push("Evidence Viewer");
  if (newRoles.length === 0) newRoles.push(newRbacRole);

  // If officer has backend uuid, call PATCH /api/officers/:id
  if (officer.id && officer.id.length > 10) {
    try {
      const res = await fetch(`/api/officers/${officer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRbacRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to update role.", "error");
      }
    } catch (err) {
      console.warn("Patch error:", err);
    }
  }

  officer.rbacRole = newRbacRole;
  officer.assignedRoles = newRoles;
  officer.accessLevel = newRbacRole === "ADMIN" ? "High" : newRbacRole === "INVESTIGATOR" ? "Medium" : "Low";

  closeModal(DOM.modalManageRoles);
  showToast(`Updated roles and permissions for ${officer.name}.`, "success");

  applyFilters();
  selectOfficer(officer.badgeNumber);
}

// ─── Live Sync with Backend ───────────────────────────────────────────────────
async function syncLiveBackend() {
  // 1. Sync Current Authenticated User Session
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
    console.warn("Live auth check skipped:", err);
  }

  // 2. Fetch Live Officers from DB to supplement canonical baseline
  try {
    const offRes = await fetch("/api/officers");
    if (offRes.ok) {
      const offData = await offRes.json();
      if (offData.officers && Array.isArray(offData.officers)) {
        offData.officers.forEach((dbOff) => {
          const match = state.officers.find(
            (o) => o.badgeNumber === dbOff.badgeNumber || o.email === dbOff.email
          );
          if (match) {
            match.id = dbOff.id;
            match.role = dbOff.designation || match.role;
            match.rbacRole = dbOff.role || match.rbacRole;
            match.status = dbOff.status === "ACTIVE" ? "Active" : dbOff.status === "SUSPENDED" ? "Pending" : "Inactive";
          } else {
            // Append newly created officer from DB
            const initials = dbOff.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            state.officers.push({
              id: dbOff.id,
              badgeNumber: dbOff.badgeNumber,
              name: dbOff.name,
              email: dbOff.email,
              phone: "+91 98111 00000",
              department: dbOff.unit || "Cyber Crime",
              departmentFull: dbOff.department?.name || dbOff.unit || "Cyber Crime Department",
              ministry: "Ministry of Home Affairs",
              departmentCode: dbOff.department?.code || "CCD",
              departmentHead: "DIG A. K. Verma",
              role: dbOff.designation || "Investigator",
              rbacRole: dbOff.role || "INVESTIGATOR",
              accessLevel: dbOff.role === "ADMIN" ? "High" : "Medium",
              status: dbOff.status === "ACTIVE" ? "Active" : "Inactive",
              joiningDate: "15 Jan 2024",
              lastLogin: "Recent",
              avatarClass: "default",
              avatarInitials: initials,
              twoFactorAuth: true,
              lastPasswordChange: "Recent",
              assignedRoles: [dbOff.role || "Investigator"],
              assignedCasesCount: 4,
            });
          }
        });
        applyFilters();
      }
    }
  } catch (err) {
    console.warn("Live officers sync skipped:", err);
  }

  // 3. Fetch Recent Audit Logs for Lower Activity Panel
  try {
    const auditRes = await fetch("/api/audit?limit=4");
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      if (auditData.events && Array.isArray(auditData.events) && auditData.events.length > 0) {
        if (DOM.recentActivitiesList) {
          DOM.recentActivitiesList.innerHTML = auditData.events
            .map((evt, idx) => {
              const avatarColor = idx % 2 === 0 ? "orange" : "blue";
              const timeFormatted = new Date(evt.timestamp).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

              return `
                <div class="neu-activity-item">
                  <div class="neu-activity-left">
                    <div class="neu-activity-avatar ${avatarColor}">👤</div>
                    <span class="neu-activity-text">${evt.details || `${evt.officerName} executed ${evt.action}`}</span>
                  </div>
                  <span class="neu-activity-time">${timeFormatted}</span>
                </div>
              `;
            })
            .join("");
        }
      }
    }
  } catch (err) {
    console.warn("Live audit fetch skipped:", err);
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
function init() {
  renderTable();
  selectOfficer(state.selectedOfficerId);
  setupEventListeners();
  syncLiveBackend();
}

// Execute when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
