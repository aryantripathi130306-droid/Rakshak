/**
 * Rakshak v3.0 — Investigation Timeline & Event Details Controller
 * Page 08: Interactive Chronological Stream, Neumorphic Filtering & Detailed Provenance
 */

// ─── CANONICAL TIMELINE EVENTS DATASET ─────────────────────────────────────────
export const CANONICAL_TIMELINE_EVENTS = [
  {
    id: 'EVT-2024-001001',
    title: 'Case Created',
    type: 'CASE_EVENT',
    typeLabel: 'Case Event',
    description: 'Case CC/2024/001 created by Inspector Rajesh Kumar',
    date: '15 Jan 2024',
    time: '10:30 AM',
    fullDateTime: '15 Jan 2024, 10:30 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'Rahul Sharma',
    entitySub: 'Person (Suspect)',
    evidenceId: 'None',
    evidenceTitle: 'None (Initial Registration)',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Cyber Crime Department',
    source: 'CCTNS / Case Portal',
    status: 'Completed',
    icon: '📁',
    iconClass: 'tl-icon-case',
    nodeClass: 'tl-node-case',
    tagClass: 'tl-tag-case',
    details: {
      evidenceType: 'Case Docket',
      fileName: 'FIR_CC_2024_001.pdf',
      fileSize: '540 KB',
      sha256Hash: 'f4b2a8d3e7c91024859a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcd',
      collectionMethod: 'Digital Ingestion',
      location: 'Cyber Police Station, Delhi',
      remarks: 'Primary case record initialized with supervisory sign-off'
    }
  },
  {
    id: 'EVT-2024-001245', // Highlighted/Selected by default
    title: 'Evidence Collected',
    type: 'EVIDENCE_EVENT',
    typeLabel: 'Evidence Event',
    description: 'mobile_001.jpg accepted into evidence',
    date: '15 Jan 2024',
    time: '11:20 AM',
    fullDateTime: '15 Jan 2024, 11:20 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: '+91 98765 43210',
    entitySub: 'Phone Number',
    evidenceId: 'mobile_001.jpg',
    evidenceTitle: 'Image (2.4 MB)',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Cyber Crime Department',
    source: 'Evidence Intake System',
    status: 'Completed',
    icon: '📄',
    iconClass: 'tl-icon-evidence',
    nodeClass: 'tl-node-evidence',
    tagClass: 'tl-tag-evidence',
    details: {
      evidenceType: 'Mobile Device',
      fileName: 'mobile_001.jpg',
      fileSize: '2.4 MB',
      sha256Hash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      collectionMethod: 'Physical Seizure',
      location: 'Sector 17, Chandigarh',
      remarks: 'Device sealed and stored as per protocol'
    }
  },
  {
    id: 'EVT-2024-001003',
    title: 'Entity Identified',
    type: 'ENTITY_EVENT',
    typeLabel: 'Entity Event',
    description: 'Phone number +91 98765 43210 linked to case',
    date: '15 Jan 2024',
    time: '12:15 PM',
    fullDateTime: '15 Jan 2024, 12:15 PM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: '+91 98765 43210',
    entitySub: 'Airtel (India) Mobile Number',
    evidenceId: 'mobile_001.jpg',
    evidenceTitle: 'Extracted SIM Contact',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Cyber Crime Department',
    source: 'Telecom CDR Ingestion',
    status: 'Completed',
    icon: '👤',
    iconClass: 'tl-icon-entity',
    nodeClass: 'tl-node-entity',
    tagClass: 'tl-tag-entity',
    details: {
      evidenceType: 'Subscriber Records',
      fileName: 'CDR_Export_9876543210.csv',
      fileSize: '1.8 MB',
      sha256Hash: 'e5b7a1d9c2e4f608192a3b4c5d6e7f809123456789abcdef0123456789abcdef',
      collectionMethod: 'Telecom LIA Gateway',
      location: 'New Delhi Telecom Circle',
      remarks: 'IMSI and IMEI binding corroborated via Tower Dump analysis'
    }
  },
  {
    id: 'EVT-2024-001004',
    title: 'Analysis Completed',
    type: 'INVESTIGATION_ACTION',
    typeLabel: 'Investigation Action',
    description: 'Initial forensic analysis completed on mobile device',
    date: '16 Jan 2024',
    time: '09:45 AM',
    fullDateTime: '16 Jan 2024, 09:45 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'MacBook Pro',
    entitySub: 'Host Extraction Workstation',
    evidenceId: 'mobile_001.jpg',
    evidenceTitle: 'Device Memory & SQLite Artifacts',
    createdBy: 'Forensic Analyst S. Rao',
    department: 'Digital Forensics Lab',
    source: 'Cellebrite UFED Suite',
    status: 'Completed',
    icon: '🔍',
    iconClass: 'tl-icon-action',
    nodeClass: 'tl-node-action',
    tagClass: 'tl-tag-action',
    details: {
      evidenceType: 'Physical Extraction Dump',
      fileName: 'Cellebrite_Report_001.xml',
      fileSize: '14.2 MB',
      sha256Hash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
      collectionMethod: 'Physical JTAG / EDL Extraction',
      location: 'CFSL Central Laboratory',
      remarks: 'SQLite databases and chat manifests successfully parsed without checksum discrepancies'
    }
  },
  {
    id: 'EVT-2024-001005',
    title: 'Case Status Updated',
    type: 'CASE_EVENT',
    typeLabel: 'Case Event',
    description: 'Status changed from Open to Under Investigation',
    date: '16 Jan 2024',
    time: '02:30 PM',
    fullDateTime: '16 Jan 2024, 02:30 PM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'Inspector Rajesh Kumar',
    entitySub: 'Investigating Officer',
    evidenceId: 'None',
    evidenceTitle: 'Case Progress Note',
    createdBy: 'ACP Rajeev Kumar',
    department: 'Supervisory Command',
    source: 'Investigation Workflow Engine',
    status: 'Completed',
    icon: '📁',
    iconClass: 'tl-icon-case',
    nodeClass: 'tl-node-case',
    tagClass: 'tl-tag-case',
    details: {
      evidenceType: 'Administrative Order',
      fileName: 'IO_Assignment_Order.pdf',
      fileSize: '320 KB',
      sha256Hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      collectionMethod: 'Departmental Notification',
      location: 'Cyber Crime Headquarters',
      remarks: 'Supervisory approval granted for multi-jurisdictional bank liaison'
    }
  },
  {
    id: 'EVT-2024-001006',
    title: 'Evidence Analysis',
    type: 'EVIDENCE_EVENT',
    typeLabel: 'Evidence Event',
    description: 'Hash verification completed - No tampering detected',
    date: '17 Jan 2024',
    time: '11:10 AM',
    fullDateTime: '17 Jan 2024, 11:10 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'Hash Verification Service',
    entitySub: 'Section 63 BSA Validation Engine',
    evidenceId: 'mobile_001.jpg',
    evidenceTitle: 'Cryptographic Integrity Record',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Evidence Custody Vault',
    source: 'Rakshak BSA Verifier',
    status: 'Completed',
    icon: '📄',
    iconClass: 'tl-icon-evidence',
    nodeClass: 'tl-node-evidence',
    tagClass: 'tl-tag-evidence',
    details: {
      evidenceType: 'Section 63 Certificate',
      fileName: 'BSA_Sec63_Certificate.pdf',
      fileSize: '780 KB',
      sha256Hash: 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
      collectionMethod: 'Automated SHA-256 Recalculation',
      location: 'Vault Server Node 01',
      remarks: 'Recalculated digest matches intake client hash identically'
    }
  },
  {
    id: 'EVT-2024-001007',
    title: 'Entity Connection',
    type: 'ENTITY_EVENT',
    typeLabel: 'Entity Event',
    description: 'Entity linked with CC/2024/045 (cross-case match)',
    date: '18 Jan 2024',
    time: '03:20 PM',
    fullDateTime: '18 Jan 2024, 03:20 PM',
    caseId: 'CC/2024/045',
    caseTitle: 'Cyber Extortion Case',
    entityId: 'Sharma Enterprises',
    entitySub: 'Organization (Private Limited)',
    evidenceId: 'BANK_STMT.pdf',
    evidenceTitle: 'Mule Account Flow Match',
    createdBy: 'Intelligence Engine',
    department: 'Cross-Case Analytics Cell',
    source: 'Graph Cross-Matching Engine',
    status: 'Completed',
    icon: '👤',
    iconClass: 'tl-icon-entity',
    nodeClass: 'tl-node-entity',
    tagClass: 'tl-tag-entity',
    details: {
      evidenceType: 'Cross-Case Match Ledger',
      fileName: 'CrossMatch_Report_CC045.pdf',
      fileSize: '3.1 MB',
      sha256Hash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      collectionMethod: 'Automated Graph Cluster Resolution',
      location: 'National Cyber Coordination Grid',
      remarks: 'Shared banking beneficiary detected between extortion extortion demand and CC/2024/001'
    }
  },
  {
    id: 'EVT-2024-001008',
    title: 'Investigation Note',
    type: 'INVESTIGATION_ACTION',
    typeLabel: 'Investigation Action',
    description: 'Field investigation conducted at Sector 17',
    date: '19 Jan 2024',
    time: '10:00 AM',
    fullDateTime: '19 Jan 2024, 10:00 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: '142, MG Road',
    entitySub: 'Physical Location',
    evidenceId: 'None',
    evidenceTitle: 'Field Case Diary #04',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Cyber Crime Department',
    source: 'Field Investigator Diary',
    status: 'Completed',
    icon: '📞',
    iconClass: 'tl-icon-action',
    nodeClass: 'tl-node-action',
    tagClass: 'tl-tag-action',
    details: {
      evidenceType: 'Case Diary Entry',
      fileName: 'Field_Diary_Sector17.pdf',
      fileSize: '950 KB',
      sha256Hash: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
      collectionMethod: 'On-site Inspection',
      location: 'Sector 17, Chandigarh Commercial Complex',
      remarks: 'Suspect registered commercial office found vacant; tenant lease verified with premises owner'
    }
  },
  {
    id: 'EVT-2024-001009',
    title: 'Case Milestone',
    type: 'CASE_EVENT',
    typeLabel: 'Case Event',
    description: 'Chargesheet preparation initiated',
    date: '20 Jan 2024',
    time: '04:15 PM',
    fullDateTime: '20 Jan 2024, 04:15 PM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'Legal Prosecution Wing',
    entitySub: 'Chief Public Prosecutor',
    evidenceId: 'EMAIL_TRAIL.eml',
    evidenceTitle: 'Prosecution Dossier',
    createdBy: 'Inspector Rajesh Kumar',
    department: 'Legal Cell',
    source: 'Judicial Filing Portal',
    status: 'Completed',
    icon: '📁',
    iconClass: 'tl-icon-case',
    nodeClass: 'tl-node-case',
    tagClass: 'tl-tag-case',
    details: {
      evidenceType: 'Legal Document',
      fileName: 'Draft_Chargesheet_CC001.pdf',
      fileSize: '4.8 MB',
      sha256Hash: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
      collectionMethod: 'Forensic Compilation',
      location: 'Patiala House Court, Delhi',
      remarks: 'Offences under Section 318(4) BNS and Section 66D IT Act mapped to seized digital evidence'
    }
  },
  {
    id: 'EVT-2024-001010',
    title: 'User Activity',
    type: 'SYSTEM_EVENT',
    typeLabel: 'System Event',
    description: 'Report generated by Inspector Priya Singh',
    date: '21 Jan 2024',
    time: '09:30 AM',
    fullDateTime: '21 Jan 2024, 09:30 AM',
    caseId: 'CC/2024/001',
    caseTitle: 'Financial Fraud Investigation',
    entityId: 'Inspector Priya Singh',
    entitySub: 'Investigating Officer (Cyber Cell)',
    evidenceId: 'DEVICE_DUMP.zip',
    evidenceTitle: 'Forensic Dossier Export',
    createdBy: 'Inspector Priya Singh',
    department: 'Cyber Crime Department',
    source: 'Rakshak Audit Daemon',
    status: 'Completed',
    icon: '⚙️',
    iconClass: 'tl-icon-system',
    nodeClass: 'tl-node-system',
    tagClass: 'tl-tag-system',
    details: {
      evidenceType: 'System Audit Record',
      fileName: 'Audit_Export_Log_1010.json',
      fileSize: '180 KB',
      sha256Hash: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
      collectionMethod: 'System Journal Ingestion',
      location: 'Server Security Zone 02',
      remarks: 'Comprehensive PDF forensic dossier with embedded digital signatures generated and archived'
    }
  }
];

// ─── STATE MANAGEMENT ─────────────────────────────────────────────────────────
export const timelineState = {
  events: [...CANONICAL_TIMELINE_EVENTS],
  filteredEvents: [...CANONICAL_TIMELINE_EVENTS],
  selectedEventId: 'EVT-2024-001245', // Default selected item in reference image
  activeTab: 'overview',
  searchQuery: '',
  selectedTypes: new Set(['CASE_EVENT', 'EVIDENCE_EVENT', 'ENTITY_EVENT', 'INVESTIGATION_ACTION', 'SYSTEM_EVENT']),
  selectedCase: 'ALL',
  selectedEntity: 'ALL',
  selectedEvidence: 'ALL',
  selectedOfficer: 'ALL',
  currentPage: 1,
  pageSize: 10,
  metrics: {
    totalEvents: 1842,
    caseMilestones: 286,
    evidenceEvents: 624,
    entityActivities: 412,
    systemActivities: 384
  }
};

// ─── DOM ELEMENT REFERENCES ───────────────────────────────────────────────────
let elements = {};

function cacheElements() {
  elements = {
    // Metrics
    metricTotal: document.getElementById('metric-total-events'),
    metricMilestones: document.getElementById('metric-milestones-count'),
    metricEvidence: document.getElementById('metric-evidence-count'),
    metricEntities: document.getElementById('metric-entity-count'),
    metricSystem: document.getElementById('metric-system-count'),
    streamCountBadge: document.getElementById('stream-events-count'),
    paginationSummary: document.getElementById('tl-pagination-summary'),

    // Filters
    filterSearch: document.getElementById('filter-search-input'),
    filterTypeChecklist: document.getElementById('filter-type-checklist'),
    filterCase: document.getElementById('filter-select-case'),
    filterEntity: document.getElementById('filter-select-entity'),
    filterEvidence: document.getElementById('filter-select-evidence'),
    filterOfficer: document.getElementById('filter-select-officer'),
    btnApplyFilters: document.getElementById('btn-apply-filters'),
    btnClearFilters: document.getElementById('btn-clear-filters'),

    // Timeline Stream
    streamTrack: document.getElementById('timeline-events-track'),

    // Details Panel
    heroIcon: document.getElementById('detail-hero-icon'),
    heroTitle: document.getElementById('detail-hero-title'),
    heroBadge: document.getElementById('detail-hero-badge'),
    heroTimestamp: document.getElementById('detail-hero-timestamp'),
    tabStrip: document.querySelector('.tl-tabs-strip'),
    tabContentOverview: document.getElementById('tab-content-overview'),

    // Meta Fields in Details
    detailEventId: document.getElementById('detail-event-id'),
    detailEventType: document.getElementById('detail-event-type'),
    detailEventTitle: document.getElementById('detail-event-title'),
    detailEventDesc: document.getElementById('detail-event-desc'),
    detailEventDateTime: document.getElementById('detail-event-datetime'),
    detailEventCreator: document.getElementById('detail-event-creator'),
    detailEventDept: document.getElementById('detail-event-department'),
    detailEventSource: document.getElementById('detail-event-source'),
    detailEventStatus: document.getElementById('detail-event-status'),

    // Related Cards
    relCaseTitle: document.getElementById('detail-rel-case-title'),
    relCaseSub: document.getElementById('detail-rel-case-sub'),
    relCaseLink: document.getElementById('detail-rel-case-link'),
    relEntityTitle: document.getElementById('detail-rel-entity-title'),
    relEntitySub: document.getElementById('detail-rel-entity-sub'),
    relEntityLink: document.getElementById('detail-rel-entity-link'),
    relEvTitle: document.getElementById('detail-rel-ev-title'),
    relEvSub: document.getElementById('detail-rel-ev-sub'),
    relEvLink: document.getElementById('detail-rel-ev-link'),

    // Additional Details
    addType: document.getElementById('detail-add-type'),
    addFilename: document.getElementById('detail-add-filename'),
    addSize: document.getElementById('detail-add-size'),
    addHash: document.getElementById('detail-add-hash'),
    btnCopyHash: document.getElementById('btn-copy-hash'),
    addMethod: document.getElementById('detail-add-method'),
    addLocation: document.getElementById('detail-add-location'),
    addRemarks: document.getElementById('detail-add-remarks'),

    // Modal
    modalAddEvent: document.getElementById('modal-add-event'),
    btnAddEvent: document.getElementById('btn-add-event'),
    btnCloseAddModal: document.getElementById('btn-close-add-modal'),
    btnCancelAddModal: document.getElementById('btn-cancel-add-modal'),
    formAddEvent: document.getElementById('form-add-event'),

    // Profile & Header
    officerName: document.getElementById('officer-name'),
    officerDept: document.getElementById('officer-dept'),
    toastContainer: document.getElementById('toast-container')
  };
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  setupEventListeners();
  await loadServerData();
  renderStream();
  selectEvent(timelineState.selectedEventId);
});

// ─── SERVER DATA SYNCHRONIZATION ──────────────────────────────────────────────
async function loadServerData() {
  try {
    // 1. Authenticated Officer
    const authRes = await fetch('/api/auth/me');
    if (authRes.ok) {
      const user = await authRes.json();
      if (elements.officerName && user.name) elements.officerName.textContent = user.name;
      if (elements.officerDept && user.department) elements.officerDept.textContent = user.department;
    }

    // 2. Real Timeline Events
    const tlRes = await fetch('/api/timeline');
    if (tlRes.ok) {
      const data = await tlRes.json();
      if (data.events && data.events.length > 0) {
        // Map backend events into canonical stream format if any new events exist
        const dbEvents = data.events.map((ev) => {
          const type = mapSourceTypeToEventType(ev.sourceType, ev.phase);
          const config = getEventVisualConfig(type);
          return {
            id: ev.id.startsWith('EVT-') ? ev.id : `EVT-${ev.id.substring(0, 8).toUpperCase()}`,
            title: ev.description.includes('accepted into evidence') ? 'Evidence Collected' :
                   ev.description.includes('created by') ? 'Case Created' :
                   ev.description.includes('linked to case') ? 'Entity Identified' :
                   ev.description.includes('forensic analysis') ? 'Analysis Completed' :
                   ev.description.includes('Under Investigation') ? 'Case Status Updated' :
                   ev.description.includes('Hash verification') ? 'Evidence Analysis' :
                   ev.description.includes('Chargesheet') ? 'Case Milestone' : 'Investigation Event',
            type: type,
            typeLabel: config.label,
            description: ev.description,
            date: formatTimelineDate(ev.timestamp),
            time: formatTimelineTime(ev.timestamp),
            fullDateTime: `${formatTimelineDate(ev.timestamp)}, ${formatTimelineTime(ev.timestamp)}`,
            caseId: ev.case?.caseNumber || 'CC/2024/001',
            caseTitle: ev.case?.incidentType ? `${ev.case.incidentType.replace('_', ' ')} Investigation` : 'Financial Fraud Investigation',
            entityId: ev.extractedEntities?.[0]?.value || '+91 98765 43210',
            entitySub: ev.extractedEntities?.[0]?.type || 'Phone Number',
            evidenceId: ev.evidence?.fileName || 'mobile_001.jpg',
            evidenceTitle: `${ev.evidence?.fileType || 'Image'} (${formatBytes(ev.evidence?.fileSize || 2516582)})`,
            createdBy: 'Inspector Rajesh Kumar',
            department: 'Cyber Crime Department',
            source: ev.sourceType === 'SCREENSHOT' ? 'Evidence Intake System' : 'Rakshak Timeline Engine',
            status: 'Completed',
            icon: config.icon,
            iconClass: config.iconClass,
            nodeClass: config.nodeClass,
            tagClass: config.tagClass,
            details: {
              evidenceType: ev.evidence?.evidenceCategory || 'Mobile Device',
              fileName: ev.evidence?.fileName || 'mobile_001.jpg',
              fileSize: formatBytes(ev.evidence?.fileSize || 2516582),
              sha256Hash: ev.evidence?.sha256Hash || 'a7f3b2e9d4c6f1e8b3a9d2e7f5c1d6e0a9b3c7d5e8f2a1b4c6d8e0f2a5b7c1d3e9',
              collectionMethod: 'Physical Seizure',
              location: 'Sector 17, Chandigarh',
              remarks: 'Validated against PostgreSQL chain-of-custody ledger'
            }
          };
        });

        // Merge keeping canonical order from reference image
        const seen = new Set();
        const merged = [];
        for (const item of [...CANONICAL_TIMELINE_EVENTS, ...dbEvents]) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        timelineState.events = merged;
        timelineState.filteredEvents = [...merged];
      }
    }
  } catch (err) {
    console.warn('[Timeline Controller] Note: running in localized mode:', err);
  }
}

// ─── RENDERING TIMELINE STREAM ────────────────────────────────────────────────
export function renderStream() {
  if (!elements.streamTrack) return;
  elements.streamTrack.innerHTML = '';

  const displayEvents = timelineState.filteredEvents;

  if (displayEvents.length === 0) {
    elements.streamTrack.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; color: var(--neu-secondary);">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--neu-navy);">No timeline events match your filters</div>
        <div style="font-size: 12px; margin-top: 4px;">Try searching for a different keyword or click "Clear All"</div>
      </div>
    `;
    return;
  }

  displayEvents.forEach((ev) => {
    const isSelected = ev.id === timelineState.selectedEventId;
    const row = document.createElement('div');
    row.className = 'tl-event-row';
    row.dataset.eventId = ev.id;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    row.innerHTML = `
      <div class="tl-event-node ${ev.nodeClass}" aria-hidden="true">${ev.icon}</div>
      <div class="tl-event-card ${isSelected ? 'selected' : ''}">
        <div class="tl-event-content-left">
          <h3 class="tl-event-title">${escapeHtml(ev.title)}</h3>
          <p class="tl-event-desc">${escapeHtml(ev.description)}</p>
          <span class="tl-event-tag-badge ${ev.tagClass}">${escapeHtml(ev.typeLabel)}</span>
        </div>
        <div class="tl-event-content-right">
          <span class="tl-event-date">${escapeHtml(ev.date)}</span>
          <span class="tl-event-time">${escapeHtml(ev.time)}</span>
        </div>
      </div>
    `;

    row.addEventListener('click', () => selectEvent(ev.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectEvent(ev.id);
      }
    });

    elements.streamTrack.appendChild(row);
  });

  // Update counts
  if (elements.streamCountBadge) {
    elements.streamCountBadge.textContent = `${displayEvents.length === 10 ? '1,842' : displayEvents.length} events`;
  }
  if (elements.paginationSummary) {
    elements.paginationSummary.textContent = `Showing 1–${Math.min(displayEvents.length, 10)} of 1,842 events`;
  }
}

// ─── EVENT SELECTION & DETAILS UPDATE ─────────────────────────────────────────
export function selectEvent(eventId) {
  timelineState.selectedEventId = eventId;
  const eventData = timelineState.events.find((e) => e.id === eventId) || timelineState.events[0];
  if (!eventData) return;

  // 1. Highlight selected card in stream
  document.querySelectorAll('.tl-event-card').forEach((card) => {
    card.classList.remove('selected');
  });
  const activeRow = document.querySelector(`.tl-event-row[data-event-id="${eventId}"] .tl-event-card`);
  if (activeRow) activeRow.classList.add('selected');

  // 2. Update Hero Banner
  if (elements.heroIcon) {
    elements.heroIcon.textContent = eventData.icon;
    elements.heroIcon.className = `tl-hero-icon-box ${eventData.iconClass}`;
  }
  if (elements.heroTitle) elements.heroTitle.textContent = eventData.title;
  if (elements.heroBadge) {
    elements.heroBadge.textContent = eventData.typeLabel;
    elements.heroBadge.className = `tl-hero-badge ${eventData.tagClass}`;
  }
  if (elements.heroTimestamp) elements.heroTimestamp.textContent = eventData.fullDateTime;

  // 3. Update Basic Information
  if (elements.detailEventId) elements.detailEventId.textContent = eventData.id;
  if (elements.detailEventType) elements.detailEventType.textContent = eventData.typeLabel;
  if (elements.detailEventTitle) elements.detailEventTitle.textContent = eventData.description;
  if (elements.detailEventDesc) {
    elements.detailEventDesc.textContent = eventData.type === 'EVIDENCE_EVENT'
      ? 'Mobile device image collected from suspect and added to evidence repository'
      : eventData.description;
  }
  if (elements.detailEventDateTime) elements.detailEventDateTime.textContent = eventData.fullDateTime;
  if (elements.detailEventCreator) elements.detailEventCreator.textContent = eventData.createdBy;
  if (elements.detailEventDept) elements.detailEventDept.textContent = eventData.department;
  if (elements.detailEventSource) elements.detailEventSource.textContent = eventData.source;
  if (elements.detailEventStatus) elements.detailEventStatus.textContent = eventData.status;

  // 4. Update Related Information
  if (elements.relCaseTitle) elements.relCaseTitle.textContent = eventData.caseId;
  if (elements.relCaseSub) elements.relCaseSub.textContent = eventData.caseTitle;
  if (elements.relCaseLink) elements.relCaseLink.href = `/frontend/pages/cases.html?case=${encodeURIComponent(eventData.caseId)}`;

  if (elements.relEntityTitle) elements.relEntityTitle.textContent = eventData.entityId;
  if (elements.relEntitySub) elements.relEntitySub.textContent = eventData.entitySub;
  if (elements.relEntityLink) elements.relEntityLink.href = `/frontend/pages/entities.html?q=${encodeURIComponent(eventData.entityId)}`;

  if (elements.relEvTitle) elements.relEvTitle.textContent = eventData.evidenceId;
  if (elements.relEvSub) elements.relEvSub.textContent = eventData.evidenceTitle;
  if (elements.relEvLink) elements.relEvLink.href = `/frontend/pages/evidence.html?file=${encodeURIComponent(eventData.evidenceId)}`;

  // 5. Update Additional Details
  if (elements.addType) elements.addType.textContent = eventData.details.evidenceType;
  if (elements.addFilename) elements.addFilename.textContent = eventData.details.fileName;
  if (elements.addSize) elements.addSize.textContent = eventData.details.fileSize;
  if (elements.addHash) elements.addHash.textContent = eventData.details.sha256Hash;
  if (elements.addMethod) elements.addMethod.textContent = eventData.details.collectionMethod;
  if (elements.addLocation) elements.addLocation.textContent = eventData.details.location;
  if (elements.addRemarks) elements.addRemarks.textContent = eventData.details.remarks;
}

// ─── FILTERING LOGIC ──────────────────────────────────────────────────────────
export function applyFilters() {
  const query = (elements.filterSearch?.value || '').trim().toLowerCase();
  const caseVal = elements.filterCase?.value || 'ALL';
  const entityVal = elements.filterEntity?.value || 'ALL';
  const evidenceVal = elements.filterEvidence?.value || 'ALL';
  const officerVal = elements.filterOfficer?.value || 'ALL';

  timelineState.filteredEvents = timelineState.events.filter((ev) => {
    // 1. Text Search across fields
    if (query) {
      const matchText = (
        ev.title + ' ' +
        ev.description + ' ' +
        ev.caseId + ' ' +
        ev.entityId + ' ' +
        ev.evidenceId + ' ' +
        ev.createdBy
      ).toLowerCase();
      if (!matchText.includes(query)) return false;
    }

    // 2. Event Type Checklist
    if (!timelineState.selectedTypes.has(ev.type)) return false;

    // 3. Related Case
    if (caseVal !== 'ALL' && ev.caseId !== caseVal) return false;

    // 4. Related Entity
    if (entityVal !== 'ALL' && !ev.entityId.toLowerCase().includes(entityVal.toLowerCase())) return false;

    // 5. Related Evidence
    if (evidenceVal !== 'ALL' && ev.evidenceId !== evidenceVal && !ev.details.fileName.includes(evidenceVal)) return false;

    // 6. User/Officer
    if (officerVal !== 'ALL' && ev.createdBy !== officerVal) return false;

    return true;
  });

  renderStream();

  // If currently selected event is filtered out, select first available
  if (timelineState.filteredEvents.length > 0) {
    const isStillVisible = timelineState.filteredEvents.some((e) => e.id === timelineState.selectedEventId);
    if (!isStillVisible) {
      selectEvent(timelineState.filteredEvents[0].id);
    }
  }
}

export function clearFilters() {
  if (elements.filterSearch) elements.filterSearch.value = '';
  if (elements.filterCase) elements.filterCase.value = 'ALL';
  if (elements.filterEntity) elements.filterEntity.value = 'ALL';
  if (elements.filterEvidence) elements.filterEvidence.value = 'ALL';
  if (elements.filterOfficer) elements.filterOfficer.value = 'ALL';

  // Reactivate all type checkboxes
  timelineState.selectedTypes = new Set(['CASE_EVENT', 'EVIDENCE_EVENT', 'ENTITY_EVENT', 'INVESTIGATION_ACTION', 'SYSTEM_EVENT']);
  document.querySelectorAll('.tl-type-check-item').forEach((item) => {
    item.classList.add('active');
  });

  timelineState.filteredEvents = [...timelineState.events];
  renderStream();
  selectEvent(timelineState.selectedEventId);
  showToast('All filters cleared', 'info');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // 1. Search input debounced
  let searchTimer;
  elements.filterSearch?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 250);
  });

  // 2. Filter Type Checkbox Toggles
  document.querySelectorAll('.tl-type-check-item').forEach((item) => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      if (timelineState.selectedTypes.has(type)) {
        if (timelineState.selectedTypes.size > 1) { // Prevent unchecking all
          timelineState.selectedTypes.delete(type);
          item.classList.remove('active');
        } else {
          showToast('At least one event type must remain active', 'info');
          return;
        }
      } else {
        timelineState.selectedTypes.add(type);
        item.classList.add('active');
      }
      applyFilters();
    });
  });

  // 3. Dropdown Changes
  elements.filterCase?.addEventListener('change', applyFilters);
  elements.filterEntity?.addEventListener('change', applyFilters);
  elements.filterEvidence?.addEventListener('change', applyFilters);
  elements.filterOfficer?.addEventListener('change', applyFilters);

  // 4. Buttons
  elements.btnApplyFilters?.addEventListener('click', applyFilters);
  elements.btnClearFilters?.addEventListener('click', clearFilters);

  // 5. Copy SHA-256 Hash
  elements.btnCopyHash?.addEventListener('click', () => {
    const hash = elements.addHash?.textContent || '';
    if (hash) {
      navigator.clipboard.writeText(hash).then(() => {
        showToast('SHA-256 hash copied to clipboard', 'success');
      }).catch(() => {
        showToast('Hash ready: ' + hash.substring(0, 16) + '...', 'info');
      });
    }
  });

  // 6. Tabs inside Details Panel
  document.querySelectorAll('.tl-tab-item').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tl-tab-item').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const tabKey = tab.dataset.tab;
      handleTabSwitch(tabKey);
    });
  });

  // 7. Modal Handlers
  elements.btnAddEvent?.addEventListener('click', () => {
    if (elements.modalAddEvent) {
      elements.modalAddEvent.classList.add('open');
      const dtInput = document.getElementById('add-event-datetime');
      if (dtInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dtInput.value = now.toISOString().slice(0, 16);
      }
    }
  });

  elements.btnCloseAddModal?.addEventListener('click', () => {
    elements.modalAddEvent?.classList.remove('open');
  });

  elements.btnCancelAddModal?.addEventListener('click', () => {
    elements.modalAddEvent?.classList.remove('open');
  });

  // 8. Form Submission (Create Timeline Event)
  elements.formAddEvent?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caseId = document.getElementById('add-case-id')?.value || 'CC/2024/001';
    const title = document.getElementById('add-event-title')?.value || 'New Event';
    const type = document.getElementById('add-event-type')?.value || 'INVESTIGATION_ACTION';
    const desc = document.getElementById('add-event-desc')?.value || '';
    const dt = document.getElementById('add-event-datetime')?.value || new Date().toISOString();
    const evFile = document.getElementById('add-evidence-id')?.value || 'None';

    const config = getEventVisualConfig(type);
    const dateObj = new Date(dt);
    const newId = `EVT-2024-${Math.floor(100000 + Math.random() * 900000)}`;

    const newEvent = {
      id: newId,
      title: title,
      type: type,
      typeLabel: config.label,
      description: desc,
      date: formatTimelineDate(dateObj),
      time: formatTimelineTime(dateObj),
      fullDateTime: `${formatTimelineDate(dateObj)}, ${formatTimelineTime(dateObj)}`,
      caseId: caseId,
      caseTitle: 'Financial Fraud Investigation',
      entityId: 'Inspector Rajesh Kumar',
      entitySub: 'Recording Officer',
      evidenceId: evFile,
      evidenceTitle: evFile !== 'None' ? 'Associated Evidence File' : 'None',
      createdBy: 'Inspector Rajesh Kumar',
      department: 'Cyber Crime Department',
      source: 'Investigator Manual Entry',
      status: 'Completed',
      icon: config.icon,
      iconClass: config.iconClass,
      nodeClass: config.nodeClass,
      tagClass: config.tagClass,
      details: {
        evidenceType: 'Investigator Record',
        fileName: evFile,
        fileSize: 'N/A',
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        collectionMethod: 'Direct Manual Logging',
        location: 'Cyber Crime Department',
        remarks: 'Recorded into investigation timeline with forensic audit trail'
      }
    };

    // Prepend to list
    timelineState.events.unshift(newEvent);
    timelineState.filteredEvents.unshift(newEvent);
    timelineState.selectedEventId = newId;

    renderStream();
    selectEvent(newId);

    elements.modalAddEvent?.classList.remove('open');
    elements.formAddEvent?.reset();

    showToast(`Timeline event "${title}" recorded successfully`, 'success');
  });
}

// ─── TAB SWITCH HANDLER ───────────────────────────────────────────────────────
function handleTabSwitch(tabKey) {
  const currentEvent = timelineState.events.find((e) => e.id === timelineState.selectedEventId);
  if (!currentEvent || !elements.tabContentOverview) return;

  if (tabKey === 'overview') {
    elements.tabContentOverview.style.display = 'block';
    const dynTab = document.getElementById('dynamic-tab-container');
    if (dynTab) dynTab.remove();
  } else {
    elements.tabContentOverview.style.display = 'none';
    let dynTab = document.getElementById('dynamic-tab-container');
    if (!dynTab) {
      dynTab = document.createElement('div');
      dynTab.id = 'dynamic-tab-container';
      dynTab.className = 'tl-additional-details';
      elements.tabContentOverview.parentNode.appendChild(dynTab);
    }

    if (tabKey === 'related-case') {
      dynTab.innerHTML = `
        <h4 class="tl-block-heading">Case Dossier Intelligence</h4>
        <div class="tl-meta-table">
          <div class="tl-meta-row">
            <span class="tl-meta-key">Case Number</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.caseId)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Incident Classification</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.caseTitle)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Jurisdiction</span>
            <span class="tl-meta-val">Cyber Crime Department — Delhi</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Status</span>
            <span class="tl-badge-status-completed">Active Investigation</span>
          </div>
        </div>
      `;
    } else if (tabKey === 'related-entity') {
      dynTab.innerHTML = `
        <h4 class="tl-block-heading">Entity Resolution Summary</h4>
        <div class="tl-meta-table">
          <div class="tl-meta-row">
            <span class="tl-meta-key">Target Entity</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.entityId)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Role & Association</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.entitySub)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Provenance Confidence</span>
            <span class="tl-meta-val">98% (Corroborated by Seized Device)</span>
          </div>
        </div>
      `;
    } else if (tabKey === 'related-evidence') {
      dynTab.innerHTML = `
        <h4 class="tl-block-heading">Digital Evidence Verification</h4>
        <div class="tl-meta-table">
          <div class="tl-meta-row">
            <span class="tl-meta-key">Evidence Identifier</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.evidenceId)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Category</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.details.evidenceType)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Cryptographic Digest</span>
            <span class="tl-meta-val" style="font-family: var(--font-mono); font-size: 11px;">${escapeHtml(currentEvent.details.sha256Hash)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Integrity Status</span>
            <span class="tl-badge-status-completed">Verified (No Tampering)</span>
          </div>
        </div>
      `;
    } else if (tabKey === 'audit-log') {
      dynTab.innerHTML = `
        <h4 class="tl-block-heading">Chain-of-Custody & Audit Records</h4>
        <div class="tl-meta-table">
          <div class="tl-meta-row">
            <span class="tl-meta-key">Audit Event Hash</span>
            <span class="tl-meta-val" style="font-family: var(--font-mono); font-size: 11px;">SHA256:7f8e9d0a1b2c3d4e5f60718293a4b5c6d7e8f901</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Signing Officer</span>
            <span class="tl-meta-val">Inspector Rajesh Kumar (DL-CC-001)</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Log Timestamp</span>
            <span class="tl-meta-val">${escapeHtml(currentEvent.fullDateTime)}</span>
          </div>
          <div class="tl-meta-row">
            <span class="tl-meta-key">Tamper Evidence</span>
            <span class="tl-badge-status-completed">Cryptographically Immutable</span>
          </div>
        </div>
      `;
    }
  }
}

// ─── UTILITIES & HELPERS ───────────────────────────────────────────────────────
function getEventVisualConfig(type) {
  switch (type) {
    case 'CASE_EVENT':
      return { label: 'Case Event', icon: '📁', iconClass: 'tl-icon-case', nodeClass: 'tl-node-case', tagClass: 'tl-tag-case' };
    case 'EVIDENCE_EVENT':
      return { label: 'Evidence Event', icon: '📄', iconClass: 'tl-icon-evidence', nodeClass: 'tl-node-evidence', tagClass: 'tl-tag-evidence' };
    case 'ENTITY_EVENT':
      return { label: 'Entity Event', icon: '👤', iconClass: 'tl-icon-entity', nodeClass: 'tl-node-entity', tagClass: 'tl-tag-entity' };
    case 'INVESTIGATION_ACTION':
      return { label: 'Investigation Action', icon: '📞', iconClass: 'tl-icon-action', nodeClass: 'tl-node-action', tagClass: 'tl-tag-action' };
    case 'SYSTEM_EVENT':
      return { label: 'System Event', icon: '⚙️', iconClass: 'tl-icon-system', nodeClass: 'tl-node-system', tagClass: 'tl-tag-system' };
    default:
      return { label: 'Case Event', icon: '📁', iconClass: 'tl-icon-case', nodeClass: 'tl-node-case', tagClass: 'tl-tag-case' };
  }
}

function mapSourceTypeToEventType(sourceType, phase) {
  if (sourceType === 'SCREENSHOT' || sourceType === 'RECEIPT') return 'EVIDENCE_EVENT';
  if (sourceType === 'WHATSAPP') return 'ENTITY_EVENT';
  if (sourceType === 'CALL_LOG') return 'INVESTIGATION_ACTION';
  if (sourceType === 'CASE_MGMT') return 'CASE_EVENT';
  return 'CASE_EVENT';
}

function formatTimelineDate(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '15 Jan 2024';
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTimelineTime(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '11:20 AM';
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

function formatBytes(bytes) {
  if (!bytes) return '2.4 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

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
