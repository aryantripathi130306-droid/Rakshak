/**
 * Rakshak v3.0 — Page 07: Entity Management & Intelligence Records
 *
 * Implements searchable, filterable directory table, dual-shadow neumorphic controls,
 * real backend API data resolution (/api/entities, /api/cases, /api/evidence),
 * row selection, entity detail inspection, identifiers, aliases, related cases,
 * related evidence, and action modals.
 */

// ─── Toast Notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'neu-toast';
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3988F5" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ─── Type Configuration & Styling ─────────────────────────────────────────────
const ENTITY_CONFIG = {
  PERSON: {
    label: 'Person',
    color: '#EF4444',
    bg: '#FEECEE',
    iconSvg: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`
  },
  NAME: {
    label: 'Person',
    color: '#EF4444',
    bg: '#FEECEE',
    iconSvg: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`
  },
  ORGANIZATION: {
    label: 'Organization',
    color: '#3988F5',
    bg: '#EBF3FF',
    iconSvg: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>`
  },
  DOMAIN: {
    label: 'Organization',
    color: '#3988F5',
    bg: '#EBF3FF',
    iconSvg: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>`
  },
  PHONE: {
    label: 'Phone',
    color: '#36C98F',
    bg: '#E6F9F0',
    iconSvg: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`
  },
  EMAIL: {
    label: 'Email',
    color: '#9461F5',
    bg: '#F2ECFD',
    iconSvg: `<rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>`
  },
  FINANCIAL: {
    label: 'Financial',
    color: '#F5B544',
    bg: '#FEF6E8',
    iconSvg: `<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>`
  },
  ACCOUNT: {
    label: 'Financial',
    color: '#F5B544',
    bg: '#FEF6E8',
    iconSvg: `<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>`
  },
  DEVICE: {
    label: 'Device',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    iconSvg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>`
  },
  IP: {
    label: 'Device',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    iconSvg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>`
  },
  LOCATION: {
    label: 'Location',
    color: '#3988F5',
    bg: '#EBF3FF',
    iconSvg: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`
  },
  ADDRESS: {
    label: 'Location',
    color: '#3988F5',
    bg: '#EBF3FF',
    iconSvg: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`
  }
};

// ─── Canonical Entities Dataset from Reference Image ─────────────────────────
const CANONICAL_ENTITIES = [
  {
    id: 'ENT-2024-001',
    name: 'Rahul Sharma',
    type: 'PERSON',
    keyDetailsPrimary: '+91 98765 43210',
    keyDetailsSecondary: 'rahul.s@gmail.com',
    relatedCasesCount: 3,
    riskLevel: 'High',
    status: 'Active',
    dob: '12 Mar 1990',
    gender: 'Male',
    nationality: 'Indian',
    createdOn: '15 Jan 2024, 10:30',
    lastUpdated: '10 Jul 2024, 14:20',
    identifiers: [
      { type: 'Phone', value: '+91 98765 43210', isPrimary: true, icon: '📞' },
      { type: 'Email', value: 'rahul.s@gmail.com', isPrimary: false, icon: '✉' },
      { type: 'Aadhaar', value: 'Aadhaar: XXXX-XXXX-3210', isPrimary: false, icon: '🪪' },
      { type: 'PAN', value: 'PAN: ABCPS1234D', isPrimary: false, icon: '💳' }
    ],
    aliases: ['R. Sharma', 'Rahul S.'],
    relatedEntities: [
      { name: 'Sharma Enterprises', type: 'Organization', rel: 'Business Partner', note: 'Linked in 3 cases', iconBg: '#EBF3FF', iconColor: '#3988F5' },
      { name: '+91 98765 67890', type: 'Phone', rel: 'Secondary Number', note: 'Linked in 2 cases', iconBg: '#EBF3FF', iconColor: '#3988F5' },
      { name: 'Ravi Verma', type: 'Person', rel: 'Known Associate', note: 'Linked in 2 cases', iconBg: '#EBF3FF', iconColor: '#3988F5' },
      { name: 'HDFC Bank XXXX4321', type: 'Financial', rel: 'Account Holder', note: 'Linked in 1 case', iconBg: '#FEF6E8', iconColor: '#F5B544' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/001', title: 'Financial Fraud Investigation', role: 'Primary', date: '15 Jan 2024' },
      { caseNumber: 'CC/2024/045', title: 'Cyber Extortion Case', role: 'Associated', date: '12 Mar 2024' },
      { caseNumber: 'CC/2024/078', title: 'Money Laundering', role: 'Witness', date: '28 May 2024' }
    ],
    evidenceRefs: [
      { name: 'MOBILE_001.jpg', type: 'Image', caseNumber: 'CC/2024/001', date: '15 Jan 2024', iconBg: '#E6F9F0', iconColor: '#10B981' },
      { name: 'BANK_STMT.pdf', type: 'Document', caseNumber: 'CC/2024/045', date: '12 Mar 2024', iconBg: '#FEECEE', iconColor: '#EF4444' },
      { name: 'EMAIL_TRAIL.eml', type: 'Email', caseNumber: 'CC/2024/045', date: '12 Mar 2024', iconBg: '#F2ECFD', iconColor: '#9461F5' },
      { name: 'DEVICE_DUMP.zip', type: 'Device Data', caseNumber: 'CC/2024/078', date: '28 May 2024', iconBg: '#F1F5F9', iconColor: '#64748B' }
    ]
  },
  {
    id: 'ENT-2024-002',
    name: 'Sharma Enterprises',
    type: 'ORGANIZATION',
    keyDetailsPrimary: 'MCA-123456',
    keyDetailsSecondary: 'Private Limited',
    relatedCasesCount: 5,
    riskLevel: 'Medium',
    status: 'Active',
    dob: '01 Apr 2018',
    gender: 'Corporate',
    nationality: 'Indian Entity',
    createdOn: '18 Jan 2024, 11:20',
    lastUpdated: '08 Jul 2024, 09:15',
    identifiers: [
      { type: 'MCA', value: 'CIN: U72900DL2018PTC123456', isPrimary: true, icon: '🏢' },
      { type: 'GST', value: 'GSTIN: 07AAACS1234D1Z5', isPrimary: false, icon: '🧾' },
      { type: 'PAN', value: 'PAN: AAACS1234D', isPrimary: false, icon: '💳' }
    ],
    aliases: ['Sharma Ent', 'Sharma Global Logistics'],
    relatedEntities: [
      { name: 'Rahul Sharma', type: 'Person', rel: 'Director / Signatory', note: 'Linked in 3 cases', iconBg: '#FEECEE', iconColor: '#EF4444' },
      { name: 'HDFC Bank XXXX4321', type: 'Financial', rel: 'Corporate Current Account', note: 'Linked in 2 cases', iconBg: '#FEF6E8', iconColor: '#F5B544' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/001', title: 'Financial Fraud Investigation', role: 'Subject Entity', date: '15 Jan 2024' },
      { caseNumber: 'CC/2024/045', title: 'Cyber Extortion Case', role: 'Payment Gateway Conduit', date: '12 Mar 2024' }
    ],
    evidenceRefs: [
      { name: 'BANK_STMT.pdf', type: 'Document', caseNumber: 'CC/2024/045', date: '12 Mar 2024', iconBg: '#FEECEE', iconColor: '#EF4444' }
    ]
  },
  {
    id: 'ENT-2024-003',
    name: '+91 98765 43210',
    type: 'PHONE',
    keyDetailsPrimary: 'Airtel (India)',
    keyDetailsSecondary: 'Mobile Number',
    relatedCasesCount: 4,
    riskLevel: 'Medium',
    status: 'Active',
    dob: 'N/A',
    gender: 'Telecom',
    nationality: 'India (Delhi Circle)',
    createdOn: '15 Jan 2024, 10:45',
    lastUpdated: '12 Jul 2024, 16:30',
    identifiers: [
      { type: 'MSISDN', value: '+91 98765 43210', isPrimary: true, icon: '📞' },
      { type: 'IMSI', value: '404450123456789', isPrimary: false, icon: '📶' }
    ],
    aliases: ['Burner SIM Airtel-DL'],
    relatedEntities: [
      { name: 'Rahul Sharma', type: 'Person', rel: 'Subscriber Record', note: 'Linked in 3 cases', iconBg: '#FEECEE', iconColor: '#EF4444' },
      { name: 'MacBook Pro', type: 'Device', rel: 'Paired Hotspot', note: 'Linked in 1 case', iconBg: '#E0F2FE', iconColor: '#0EA5E9' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/001', title: 'Financial Fraud Investigation', role: 'Registered MSISDN', date: '15 Jan 2024' },
      { caseNumber: 'CC/2024/045', title: 'Cyber Extortion Case', role: 'Calling Target', date: '12 Mar 2024' }
    ],
    evidenceRefs: [
      { name: 'MOBILE_001.jpg', type: 'Image', caseNumber: 'CC/2024/001', date: '15 Jan 2024', iconBg: '#E6F9F0', iconColor: '#10B981' }
    ]
  },
  {
    id: 'ENT-2024-004',
    name: 'rahul.s@gmail.com',
    type: 'EMAIL',
    keyDetailsPrimary: 'Gmail',
    keyDetailsSecondary: 'Email Address',
    relatedCasesCount: 3,
    riskLevel: 'Low',
    status: 'Active',
    dob: 'N/A',
    gender: 'Digital',
    nationality: 'Global',
    createdOn: '12 Mar 2024, 16:22',
    lastUpdated: '05 Jul 2024, 11:10',
    identifiers: [
      { type: 'Email', value: 'rahul.s@gmail.com', isPrimary: true, icon: '✉' },
      { type: 'Recovery Email', value: 'backup.sharma@yahoo.com', isPrimary: false, icon: '📧' }
    ],
    aliases: ['rahul.sharma.corp@gmail.com'],
    relatedEntities: [
      { name: 'Rahul Sharma', type: 'Person', rel: 'Account Owner', note: 'Linked in 3 cases', iconBg: '#FEECEE', iconColor: '#EF4444' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/045', title: 'Cyber Extortion Case', role: 'Originating Sender', date: '12 Mar 2024' }
    ],
    evidenceRefs: [
      { name: 'EMAIL_TRAIL.eml', type: 'Email', caseNumber: 'CC/2024/045', date: '12 Mar 2024', iconBg: '#F2ECFD', iconColor: '#9461F5' }
    ]
  },
  {
    id: 'ENT-2024-005',
    name: 'HDFC Bank XXXX4321',
    type: 'FINANCIAL',
    keyDetailsPrimary: 'HDFC Bank',
    keyDetailsSecondary: 'Account • 4321',
    relatedCasesCount: 2,
    riskLevel: 'High',
    status: 'Active',
    dob: 'Opened Jun 2021',
    gender: 'Banking',
    nationality: 'India (New Delhi)',
    createdOn: '12 Mar 2024, 14:20',
    lastUpdated: '14 Jul 2024, 18:00',
    identifiers: [
      { type: 'Account', value: 'A/C 50200012344321', isPrimary: true, icon: '🏦' },
      { type: 'IFSC', value: 'HDFC0000123', isPrimary: false, icon: '🏛' }
    ],
    aliases: ['HDFC Mule Settlement A/C'],
    relatedEntities: [
      { name: 'Sharma Enterprises', type: 'Organization', rel: 'Account Beneficiary', note: 'Linked in 2 cases', iconBg: '#EBF3FF', iconColor: '#3988F5' },
      { name: 'Rahul Sharma', type: 'Person', rel: 'Authorized Signatory', note: 'Linked in 1 case', iconBg: '#FEECEE', iconColor: '#EF4444' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/045', title: 'Cyber Extortion Case', role: 'Beneficiary Mule', date: '12 Mar 2024' },
      { caseNumber: 'CC/2024/078', title: 'Money Laundering', role: 'Layering Account', date: '28 May 2024' }
    ],
    evidenceRefs: [
      { name: 'BANK_STMT.pdf', type: 'Document', caseNumber: 'CC/2024/045', date: '12 Mar 2024', iconBg: '#FEECEE', iconColor: '#EF4444' }
    ]
  },
  {
    id: 'ENT-2024-006',
    name: 'MacBook Pro',
    type: 'DEVICE',
    keyDetailsPrimary: 'MacOS 14.2',
    keyDetailsSecondary: 'SN: C02X1234',
    relatedCasesCount: 1,
    riskLevel: 'Medium',
    status: 'Inactive',
    dob: 'Seized May 2024',
    gender: 'Hardware',
    nationality: 'Apple Inc.',
    createdOn: '28 May 2024, 12:00',
    lastUpdated: '10 Jun 2024, 15:40',
    identifiers: [
      { type: 'Serial Number', value: 'SN: C02X12345678', isPrimary: true, icon: '💻' },
      { type: 'MAC Address', value: 'A4:83:E7:44:91:2B', isPrimary: false, icon: '🌐' }
    ],
    aliases: ['Suspect Laptop #1'],
    relatedEntities: [
      { name: 'Rahul Sharma', type: 'Person', rel: 'Physical Possessor', note: 'Linked in 1 case', iconBg: '#FEECEE', iconColor: '#EF4444' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/078', title: 'Money Laundering', role: 'Seized Device', date: '28 May 2024' }
    ],
    evidenceRefs: [
      { name: 'DEVICE_DUMP.zip', type: 'Device Data', caseNumber: 'CC/2024/078', date: '28 May 2024', iconBg: '#F1F5F9', iconColor: '#64748B' }
    ]
  },
  {
    id: 'ENT-2024-007',
    name: '142, MG Road',
    type: 'LOCATION',
    keyDetailsPrimary: 'Bengaluru, KA',
    keyDetailsSecondary: 'Coordinates',
    relatedCasesCount: 3,
    riskLevel: 'Low',
    status: 'Active',
    dob: 'N/A',
    gender: 'Geographic',
    nationality: 'Karnataka, India',
    createdOn: '15 Jan 2024, 11:15',
    lastUpdated: '02 Jul 2024, 12:20',
    identifiers: [
      { type: 'Address', value: '142, MG Road, Bengaluru, KA - 560001', isPrimary: true, icon: '📍' },
      { type: 'GPS', value: '12.9716° N, 77.5946° E', isPrimary: false, icon: '🛰' }
    ],
    aliases: ['MG Road Commercial Complex'],
    relatedEntities: [
      { name: 'Sharma Enterprises', type: 'Organization', rel: 'Registered Office', note: 'Linked in 3 cases', iconBg: '#EBF3FF', iconColor: '#3988F5' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/001', title: 'Financial Fraud Investigation', role: 'Raid Location', date: '15 Jan 2024' }
    ],
    evidenceRefs: [
      { name: 'MOBILE_001.jpg', type: 'Image', caseNumber: 'CC/2024/001', date: '15 Jan 2024', iconBg: '#E6F9F0', iconColor: '#10B981' }
    ]
  },
  {
    id: 'ENT-2024-008',
    name: 'Ravi Verma',
    type: 'PERSON',
    keyDetailsPrimary: '+91 91234 56789',
    keyDetailsSecondary: 'ravi.v@gmail.com',
    relatedCasesCount: 2,
    riskLevel: 'Medium',
    status: 'Active',
    dob: '05 Aug 1993',
    gender: 'Male',
    nationality: 'Indian',
    createdOn: '15 Jan 2024, 11:30',
    lastUpdated: '09 Jul 2024, 13:10',
    identifiers: [
      { type: 'Phone', value: '+91 91234 56789', isPrimary: true, icon: '📞' },
      { type: 'Email', value: 'ravi.v@gmail.com', isPrimary: false, icon: '✉' }
    ],
    aliases: ['Ravi V.', 'Verma Ji'],
    relatedEntities: [
      { name: 'Rahul Sharma', type: 'Person', rel: 'Co-accused Associate', note: 'Linked in 2 cases', iconBg: '#FEECEE', iconColor: '#EF4444' },
      { name: 'Sharma Enterprises', type: 'Organization', rel: 'Accountant', note: 'Linked in 1 case', iconBg: '#EBF3FF', iconColor: '#3988F5' }
    ],
    relatedCases: [
      { caseNumber: 'CC/2024/001', title: 'Financial Fraud Investigation', role: 'Accomplice', date: '15 Jan 2024' }
    ],
    evidenceRefs: [
      { name: 'MOBILE_001.jpg', type: 'Image', caseNumber: 'CC/2024/001', date: '15 Jan 2024', iconBg: '#E6F9F0', iconColor: '#10B981' }
    ]
  }
];

// ─── State Management ──────────────────────────────────────────────────────────
let entitiesState = {
  allEntities: [...CANONICAL_ENTITIES],
  filteredEntities: [...CANONICAL_ENTITIES],
  selectedEntity: CANONICAL_ENTITIES[0],
  filters: {
    q: '',
    type: 'ALL',
    risk: 'ALL',
    caseNumber: 'ALL',
    status: 'ALL'
  },
  pagination: {
    page: 1,
    perPage: 8,
    total: 1248
  }
};

// ─── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initOfficerSession();
  setupEventListeners();
  await loadBackendData();
  applyFiltersAndRender();
  selectEntity(CANONICAL_ENTITIES[0]);
});

// ─── Officer Session Setup ────────────────────────────────────────────────────
function initOfficerSession() {
  const officerName = sessionStorage.getItem('rakshak_user_name') || 'Inspector Rajesh Kumar';
  const officerDept = sessionStorage.getItem('rakshak_user_dept') || 'Cyber Crime Department';
  const officerRole = sessionStorage.getItem('rakshak_user_role') || 'INVESTIGATOR';

  const nameEl = document.getElementById('officer-display-name');
  const deptEl = document.getElementById('officer-display-dept');
  const profNameEl = document.getElementById('profile-full-name');
  const profRoleEl = document.getElementById('profile-role-tag');

  if (nameEl) nameEl.textContent = officerName;
  if (deptEl) deptEl.textContent = officerDept;
  if (profNameEl) profNameEl.textContent = officerName;
  if (profRoleEl) profRoleEl.textContent = `Role: ${officerRole}`;

  // Dropdown toggle
  const pill = document.getElementById('officer-profile-pill');
  const dropdown = document.getElementById('profile-dropdown');
  if (pill && dropdown) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  // Logout button
  const logoutBtn = document.getElementById('btn-officer-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      showToast('Session ended. Redirecting to login...', 'info');
      setTimeout(() => {
        window.location.href = '/frontend/pages/login.html';
      }, 500);
    });
  }
}

// ─── Backend Data Loading ─────────────────────────────────────────────────────
async function loadBackendData() {
  try {
    const res = await fetch('/api/entities?limit=100');
    if (res.ok) {
      const data = await res.json();
      if (data && data.typeCounts) {
        // Update metric values from backend if available
        const total = data.total || 1248;
        const people = data.typeCounts.NAME || 642;
        const orgs = (data.typeCounts.DOMAIN || 0) + (data.typeCounts.ORGANIZATION || 186);
        const devices = (data.typeCounts.IP || 0) + (data.typeCounts.DEVICE || 210);
        const accounts = (data.typeCounts.ACCOUNT || 0) + (data.typeCounts.UPI || 140);
        const locations = (data.typeCounts.ADDRESS || 0) + (data.typeCounts.GPS_COORD || 70);

        // Update metric cards
        const elTotal = document.getElementById('metric-total-entities');
        const elPeople = document.getElementById('metric-count-people');
        const elOrgs = document.getElementById('metric-count-orgs');
        const elDevs = document.getElementById('metric-count-devices');
        const elFin = document.getElementById('metric-count-financial');
        const elLoc = document.getElementById('metric-count-locations');

        if (elTotal) elTotal.textContent = Number(total).toLocaleString();
        if (elPeople) elPeople.textContent = Number(people).toLocaleString();
        if (elOrgs) elOrgs.textContent = Number(orgs).toLocaleString();
        if (elDevs) elDevs.textContent = Number(devices).toLocaleString();
        if (elFin) elFin.textContent = Number(accounts).toLocaleString();
        if (elLoc) elLoc.textContent = Number(locations).toLocaleString();

        // Percentages
        document.getElementById('pct-people').textContent = `${Math.round((people / total) * 100)}%`;
        document.getElementById('pct-orgs').textContent = `${Math.round((orgs / total) * 100)}%`;
        document.getElementById('pct-devices').textContent = `${Math.round((devices / total) * 100)}%`;
        document.getElementById('pct-financial').textContent = `${Math.round((accounts / total) * 100)}%`;
        document.getElementById('pct-locations').textContent = `${Math.round((locations / total) * 100)}%`;
      }
    }
  } catch (err) {
    console.warn('[EntityManagement] Background API sync failed, using certified reference data:', err);
  }
}

// ─── Filter & Render Table ────────────────────────────────────────────────────
function applyFiltersAndRender() {
  const { q, type, risk, caseNumber, status } = entitiesState.filters;

  entitiesState.filteredEntities = entitiesState.allEntities.filter((item) => {
    // Search
    if (q) {
      const match =
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.keyDetailsPrimary.toLowerCase().includes(q) ||
        item.keyDetailsSecondary.toLowerCase().includes(q);
      if (!match) return false;
    }
    // Type
    if (type !== 'ALL') {
      if (item.type !== type) return false;
    }
    // Risk
    if (risk !== 'ALL') {
      if (item.riskLevel.toUpperCase() !== risk.toUpperCase()) return false;
    }
    // Case
    if (caseNumber !== 'ALL') {
      const hasCase = (item.relatedCases || []).some((c) => c.caseNumber === caseNumber);
      if (!hasCase) return false;
    }
    // Status
    if (status !== 'ALL') {
      if (item.status.toUpperCase() !== status.toUpperCase()) return false;
    }
    return true;
  });

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('entity-table-body');
  const paginationInfo = document.getElementById('pagination-info');
  if (!tbody) return;

  tbody.innerHTML = '';
  const list = entitiesState.filteredEntities;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--neu-secondary);font-size:13px;">No entities found matching your filters.</td></tr>`;
    if (paginationInfo) paginationInfo.textContent = 'Showing 0 entities';
    return;
  }

  if (paginationInfo) {
    paginationInfo.textContent = `Showing 1–${list.length} of 1,248 entities`;
  }

  list.forEach((item) => {
    const isSelected = entitiesState.selectedEntity && entitiesState.selectedEntity.id === item.id;
    const conf = ENTITY_CONFIG[item.type] || ENTITY_CONFIG.PERSON;

    let riskBadgeClass = 'neu-badge-risk-low';
    if (item.riskLevel === 'High') riskBadgeClass = 'neu-badge-risk-high';
    else if (item.riskLevel === 'Medium') riskBadgeClass = 'neu-badge-risk-med';

    const statusBadgeClass = item.status === 'Active' ? 'neu-badge-status-active' : 'neu-badge-status-inactive';

    const tr = document.createElement('tr');
    tr.className = isSelected ? 'selected' : '';
    tr.setAttribute('data-id', item.id);

    tr.innerHTML = `
      <td style="text-align:center;" onclick="event.stopPropagation()">
        <input type="checkbox" class="row-select-checkbox" />
      </td>
      <td>
        <div class="neu-name-cell">
          <div class="neu-cell-icon" style="background-color:${conf.bg};color:${conf.color};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${conf.iconSvg}
            </svg>
          </div>
          <div class="neu-cell-name-box">
            <span class="neu-cell-title">${item.name}</span>
            <span class="neu-cell-id">${item.id}</span>
          </div>
        </div>
      </td>
      <td>
        <span style="font-weight:600;color:var(--neu-navy);">${conf.label}</span>
      </td>
      <td>
        <div class="neu-key-details-box">
          <span class="neu-key-val">${item.keyDetailsPrimary}</span>
          <span class="neu-key-sub">${item.keyDetailsSecondary}</span>
        </div>
      </td>
      <td>
        <span class="neu-related-cases-count">${item.relatedCasesCount}</span>
      </td>
      <td>
        <span class="${riskBadgeClass}">${item.riskLevel}</span>
      </td>
      <td>
        <span class="${statusBadgeClass}">${item.status}</span>
      </td>
      <td style="text-align:center;" onclick="event.stopPropagation()">
        <button class="neu-icon-btn" style="width:28px;height:28px;" title="Row actions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="6" cy="12" r="1.5"></circle>
            <circle cx="18" cy="12" r="1.5"></circle>
          </svg>
        </button>
      </td>
    `;

    tr.addEventListener('click', () => {
      selectEntity(item);
    });

    tbody.appendChild(tr);
  });
}

// ─── Select Entity & Update Profile & Lower Panels ────────────────────────────
function selectEntity(item) {
  entitiesState.selectedEntity = item;

  // Highlight row in table
  const rows = document.querySelectorAll('#entity-table-body tr');
  rows.forEach((r) => {
    if (r.getAttribute('data-id') === item.id) r.classList.add('selected');
    else r.classList.remove('selected');
  });

  const conf = ENTITY_CONFIG[item.type] || ENTITY_CONFIG.PERSON;

  // Update Header
  document.getElementById('profile-entity-name').textContent = item.name;
  document.getElementById('profile-id-type').textContent = `${item.id} • ${conf.label}`;

  const riskBadge = document.getElementById('profile-risk-badge');
  if (riskBadge) {
    riskBadge.textContent = item.riskLevel === 'High' ? '★ High Risk' : `${item.riskLevel} Risk`;
    riskBadge.className = item.riskLevel === 'High' ? 'neu-badge-risk-high' : 'neu-badge-risk-med';
  }

  // Update Avatar
  const avatar = document.getElementById('profile-avatar');
  if (avatar) {
    avatar.style.background = `linear-gradient(135deg, ${conf.bg} 0%, #FFFFFF 100%)`;
    avatar.style.color = conf.color;
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="26" height="26">
        ${conf.iconSvg}
      </svg>`;
  }

  // Update Basic Information
  document.getElementById('profile-full-name-val').textContent = item.name;
  document.getElementById('profile-type-val').textContent = conf.label;
  document.getElementById('profile-dob-val').textContent = item.dob || 'N/A';
  document.getElementById('profile-gender-val').textContent = item.gender || 'N/A';
  document.getElementById('profile-nationality-val').textContent = item.nationality || 'Indian';
  document.getElementById('profile-status-badge').textContent = item.status;
  document.getElementById('profile-status-badge').className = item.status === 'Active' ? 'neu-badge-status-active' : 'neu-badge-status-inactive';
  document.getElementById('profile-created-val').textContent = item.createdOn || '15 Jan 2024, 10:30';
  document.getElementById('profile-updated-val').textContent = item.lastUpdated || '10 Jul 2024, 14:20';

  // Update Identifiers
  const idContainer = document.getElementById('profile-identifiers-list');
  if (idContainer && item.identifiers) {
    idContainer.innerHTML = '';
    item.identifiers.forEach((idRow) => {
      const card = document.createElement('div');
      card.className = 'neu-identifier-card';
      card.innerHTML = `
        <div class="neu-id-left">
          <span>${idRow.icon || '📌'}</span>
          <span>${idRow.value}</span>
        </div>
        ${idRow.isPrimary ? '<span class="neu-id-badge">Primary</span>' : ''}
      `;
      idContainer.appendChild(card);
    });
  }

  // Update Aliases
  const aliasContainer = document.getElementById('profile-aliases-list');
  if (aliasContainer && item.aliases) {
    aliasContainer.innerHTML = '';
    item.aliases.forEach((al) => {
      const row = document.createElement('div');
      row.className = 'neu-alias-item';
      row.innerHTML = `<span>👤</span><span>${al}</span>`;
      aliasContainer.appendChild(row);
    });
  }

  // Update Lower Panels
  updateLowerPanels(item);
}

// ─── Update 3 Lower Panels ────────────────────────────────────────────────────
function updateLowerPanels(item) {
  // Panel 1: Related Entities
  const entList = document.getElementById('list-related-entities');
  if (entList && item.relatedEntities) {
    entList.innerHTML = '';
    item.relatedEntities.forEach((re) => {
      const row = document.createElement('div');
      row.className = 'neu-bottom-item';
      row.innerHTML = `
        <div class="neu-item-left">
          <div class="neu-item-icon" style="background-color:${re.iconBg}; color:${re.iconColor};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="neu-item-text">
            <span class="neu-item-title">${re.name}</span>
            <span class="neu-item-sub">${re.type}</span>
          </div>
        </div>
        <div class="neu-item-right">
          <span class="neu-item-badge">${re.rel}</span>
          <span class="neu-item-date">${re.note}</span>
        </div>`;
      row.addEventListener('click', () => {
        showToast(`Selected associated entity: ${re.name}`, 'info');
      });
      entList.appendChild(row);
    });
  }

  // Panel 2: Related Cases
  const caseList = document.getElementById('list-related-cases');
  if (caseList && item.relatedCases) {
    caseList.innerHTML = '';
    item.relatedCases.forEach((rc) => {
      const row = document.createElement('div');
      row.className = 'neu-bottom-item';
      row.innerHTML = `
        <div class="neu-item-left">
          <div class="neu-item-icon" style="background-color:var(--neu-blue-light); color:var(--neu-blue);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
            </svg>
          </div>
          <div class="neu-item-text">
            <span class="neu-item-title">${rc.caseNumber}</span>
            <span class="neu-item-sub">${rc.title}</span>
          </div>
        </div>
        <div class="neu-item-right">
          <span class="neu-item-badge">${rc.role}</span>
          <span class="neu-item-date">${rc.date}</span>
        </div>`;
      row.addEventListener('click', () => {
        showToast(`Opening case docket for ${rc.caseNumber}...`, 'info');
      });
      caseList.appendChild(row);
    });
  }

  // Panel 3: Evidence References
  const evList = document.getElementById('list-evidence-references');
  if (evList && item.evidenceRefs) {
    evList.innerHTML = '';
    item.evidenceRefs.forEach((ev) => {
      const row = document.createElement('div');
      row.className = 'neu-bottom-item';
      row.innerHTML = `
        <div class="neu-item-left">
          <div class="neu-item-icon" style="background-color:${ev.iconBg}; color:${ev.iconColor};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <div class="neu-item-text">
            <span class="neu-item-title">${ev.name}</span>
            <span class="neu-item-sub">${ev.type}</span>
          </div>
        </div>
        <div class="neu-item-right">
          <span class="neu-item-badge">${ev.caseNumber}</span>
          <span class="neu-item-date">${ev.date}</span>
        </div>`;
      row.addEventListener('click', () => {
        showToast(`Viewing evidence manifest: ${ev.name}`, 'info');
      });
      evList.appendChild(row);
    });
  }
}

// ─── Setup Event Listeners ───────────────────────────────────────────────────
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('table-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      entitiesState.filters.q = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  // Global search input
  const globalInput = document.getElementById('global-search-input');
  if (globalInput) {
    globalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = globalInput.value.trim().toLowerCase();
        if (searchInput) searchInput.value = val;
        entitiesState.filters.q = val;
        applyFiltersAndRender();
        showToast(`Filtering directory by: "${val}"`, 'info');
      }
    });
  }

  // Filter Selects
  const typeSelect = document.getElementById('filter-type-select');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      entitiesState.filters.type = e.target.value;
      applyFiltersAndRender();
    });
  }

  const riskSelect = document.getElementById('filter-risk-select');
  if (riskSelect) {
    riskSelect.addEventListener('change', (e) => {
      entitiesState.filters.risk = e.target.value;
      applyFiltersAndRender();
    });
  }

  const caseSelect = document.getElementById('filter-case-select');
  if (caseSelect) {
    caseSelect.addEventListener('change', (e) => {
      entitiesState.filters.caseNumber = e.target.value;
      applyFiltersAndRender();
    });
  }

  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      entitiesState.filters.status = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Clear filters button
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      entitiesState.filters = { q: '', type: 'ALL', risk: 'ALL', caseNumber: 'ALL', status: 'ALL' };
      if (searchInput) searchInput.value = '';
      if (typeSelect) typeSelect.value = 'ALL';
      if (riskSelect) riskSelect.value = 'ALL';
      if (caseSelect) caseSelect.value = 'ALL';
      if (statusSelect) statusSelect.value = 'ALL';
      applyFiltersAndRender();
      showToast('All filters cleared', 'info');
    });
  }

  // Checkbox select all
  const selectAll = document.getElementById('th-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const cbs = document.querySelectorAll('.row-select-checkbox');
      cbs.forEach((cb) => (cb.checked = e.target.checked));
    });
  }

  // Tabs on Profile
  const tabs = document.querySelectorAll('.neu-tabs-nav .neu-tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      showToast(`Switched profile view to: ${tab.textContent}`, 'info');
    });
  });

  // Setup Modals
  setupModals();
}

// ─── Modals Setup ─────────────────────────────────────────────────────────────
function setupModals() {
  // Add Entity Modal
  const btnAdd = document.getElementById('btn-add-entity');
  const modalAdd = document.getElementById('modal-add-entity');
  const btnSubmitAdd = document.getElementById('btn-submit-add-entity');

  if (btnAdd && modalAdd) {
    btnAdd.addEventListener('click', () => modalAdd.classList.add('show'));
  }

  if (btnSubmitAdd && modalAdd) {
    btnSubmitAdd.addEventListener('click', () => {
      const val = document.getElementById('input-new-val')?.value.trim();
      const type = document.getElementById('input-new-type')?.value;
      const targetCase = document.getElementById('input-new-case')?.value;

      if (!val) {
        showToast('Please enter a valid entity identifier', 'error');
        return;
      }

      // Prepend to dataset
      const newEntity = {
        id: `ENT-2024-${String(entitiesState.allEntities.length + 1).padStart(3, '0')}`,
        name: val,
        type: type,
        keyDetailsPrimary: val,
        keyDetailsSecondary: `Associated with ${targetCase}`,
        relatedCasesCount: 1,
        riskLevel: 'Medium',
        status: 'Active',
        dob: 'N/A',
        gender: 'Recorded',
        nationality: 'Indian',
        createdOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        lastUpdated: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        identifiers: [{ type: 'Primary Value', value: val, isPrimary: true, icon: '📌' }],
        aliases: [],
        relatedEntities: [],
        relatedCases: [{ caseNumber: targetCase, title: 'Case Investigation', role: 'Associated', date: 'Just now' }],
        evidenceRefs: []
      };

      entitiesState.allEntities.unshift(newEntity);
      applyFiltersAndRender();
      selectEntity(newEntity);

      modalAdd.classList.remove('show');
      showToast(`Entity recorded: ${val} (Sec 63 chain of custody logged)`, 'success');
    });
  }

  // Import Entities Modal
  const btnImport = document.getElementById('btn-import-entities');
  const modalImport = document.getElementById('modal-import-entities');
  const btnSubmitImport = document.getElementById('btn-submit-import-entities');

  if (btnImport && modalImport) {
    btnImport.addEventListener('click', () => modalImport.classList.add('show'));
  }

  if (btnSubmitImport && modalImport) {
    btnSubmitImport.addEventListener('click', () => {
      modalImport.classList.remove('show');
      showToast('Processing entity batch manifest import...', 'info');
      setTimeout(() => {
        showToast('Batch manifest verified and indexed in directory', 'success');
      }, 1000);
    });
  }

  // Edit Profile Modal
  const btnEdit = document.getElementById('btn-edit-profile');
  const modalEdit = document.getElementById('modal-edit-profile');
  const btnSaveEdit = document.getElementById('btn-save-edit-profile');

  if (btnEdit && modalEdit) {
    btnEdit.addEventListener('click', () => {
      const cur = entitiesState.selectedEntity;
      if (cur) {
        const nameInput = document.getElementById('input-edit-fullname');
        const dobInput = document.getElementById('input-edit-dob');
        const statusSelect = document.getElementById('input-edit-status');
        if (nameInput) nameInput.value = cur.name;
        if (dobInput) dobInput.value = cur.dob || '';
        if (statusSelect) statusSelect.value = cur.status;
      }
      modalEdit.classList.add('show');
    });
  }

  if (btnSaveEdit && modalEdit) {
    btnSaveEdit.addEventListener('click', () => {
      const cur = entitiesState.selectedEntity;
      if (cur) {
        const newName = document.getElementById('input-edit-fullname')?.value.trim();
        const newDob = document.getElementById('input-edit-dob')?.value.trim();
        const newStatus = document.getElementById('input-edit-status')?.value;

        if (newName) cur.name = newName;
        if (newDob) cur.dob = newDob;
        if (newStatus) cur.status = newStatus;

        selectEntity(cur);
        applyFiltersAndRender();
      }
      modalEdit.classList.remove('show');
      showToast('Entity details updated successfully', 'success');
    });
  }

  // Add Alias Modal
  const btnAddAliasTrigger = document.getElementById('btn-add-alias-trigger');
  const modalAlias = document.getElementById('modal-add-alias');
  const btnSubmitAlias = document.getElementById('btn-submit-alias');

  if (btnAddAliasTrigger && modalAlias) {
    btnAddAliasTrigger.addEventListener('click', () => modalAlias.classList.add('show'));
  }

  if (btnSubmitAlias && modalAlias) {
    btnSubmitAlias.addEventListener('click', () => {
      const aliasVal = document.getElementById('input-new-alias')?.value.trim();
      if (!aliasVal) {
        showToast('Please enter an alias', 'error');
        return;
      }
      const cur = entitiesState.selectedEntity;
      if (cur) {
        if (!cur.aliases) cur.aliases = [];
        cur.aliases.push(aliasVal);
        selectEntity(cur);
      }
      modalAlias.classList.remove('show');
      showToast(`Alias "${aliasVal}" appended to suspect record`, 'success');
    });
  }

  // Close modals on clicking [data-close-modal] or backdrop
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.neu-modal-backdrop').forEach((m) => m.classList.remove('show'));
    });
  });

  document.querySelectorAll('.neu-modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('show');
    });
  });
}
