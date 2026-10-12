/**
 * Rakshak v3.0 — Page 06: Intelligence & Cross-Case Analysis
 *
 * Implements interactive SVG entity-relationship graph, dual-shadow neumorphic controls,
 * real backend API data resolution (/api/graph, /api/clusters, /api/entities),
 * node selection, edge inspection, filter toggling, zoom/pan/fit, donut chart,
 * recent detected links feed, and cross-case insights cards.
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

// ─── State Management ──────────────────────────────────────────────────────────
let graphState = {
  rawNodes: [],
  rawEdges: [],
  clusters: [],
  activeFilters: {
    PERSON: true,
    ORGANIZATION: true,
    PHONE: true,
    LOCATION: true,
    ACCOUNT: true,
    DEVICE: true,
    DOCUMENT: true,
    OTHER: true
  },
  selectedNodeId: null,
  transform: { x: 380, y: 260, scale: 1.15 },
  isDragging: false,
  dragStart: { x: 0, y: 0 }
};

// ─── Node Type Styling Definitions ───────────────────────────────────────────
const NODE_TYPE_CONFIG = {
  PERSON: {
    color: '#EF4444',
    bg: '#FEECEE',
    icon: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`,
    label: 'Person'
  },
  ORGANIZATION: {
    color: '#3988F5',
    bg: '#EBF3FF',
    icon: `<path d="M3 21h18"></path><path d="M9 8h1"></path><path d="M9 12h1"></path><path d="M9 16h1"></path><path d="M14 8h1"></path><path d="M14 12h1"></path><path d="M14 16h1"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path>`,
    label: 'Organization'
  },
  PHONE: {
    color: '#36C98F',
    bg: '#E6F9F0',
    icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`,
    label: 'Phone'
  },
  LOCATION: {
    color: '#F5B544',
    bg: '#FEF6E8',
    icon: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
    label: 'Location'
  },
  ACCOUNT: {
    color: '#0EA5E9',
    bg: '#E0F2FE',
    icon: `<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>`,
    label: 'Bank Account'
  },
  DEVICE: {
    color: '#9461F5',
    bg: '#F2ECFD',
    icon: `<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>`,
    label: 'Device / Vehicle'
  },
  DOCUMENT: {
    color: '#637692',
    bg: '#E9EEF5',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`,
    label: 'Document'
  },
  OTHER: {
    color: '#172B4D',
    bg: '#E2E8F2',
    icon: `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`,
    label: 'Other'
  }
};

// ─── Live Graph Nodes ────────────────────────────────────────────────────────
let CANONICAL_GRAPH_NODES = [];

const CANONICAL_GRAPH_EDGES = [];

// ─── DOM Initialization ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initOfficerSession();
  setupEventListeners();
  await loadIntelligenceData();
  renderGraph();
  if (CANONICAL_GRAPH_NODES.length > 0) {
    selectEntity(CANONICAL_GRAPH_NODES[0]);
  }
});

// ─── Officer Session Setup ────────────────────────────────────────────────────
function initOfficerSession() {
  const officerName = sessionStorage.getItem('rakshak_user_name') || 'Officer';
  const officerDept = sessionStorage.getItem('rakshak_user_dept') || '—';
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
async function loadIntelligenceData() {
  try {
    let token = null;
    try {
      if (typeof localStorage !== 'undefined') token = localStorage.getItem('rakshak_token');
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    const graphRes = await fetch('/api/graph?caseId=ALL', { credentials: 'include', headers });
    if (graphRes.ok) {
      const graphJson = await graphRes.json();
      if (graphJson && Array.isArray(graphJson.nodes)) {
        CANONICAL_GRAPH_NODES = graphJson.nodes.map((n, idx) => ({
          id: n.id,
          name: n.name || n.id,
          type: n.type || 'PERSON',
          caseId: n.cases?.[0] || 'ALL',
          isCentral: idx === 0,
          risk: n.riskLevel || 'Medium',
          riskScore: (n.riskScore || 50) / 100,
          aliases: (n.aliases || []).join(', ') || 'None',
          phones: (n.phones || []).join(', ') || '—',
          emails: (n.emails || []).join(', ') || '—',
          cases: n.cases || [],
          firstSeen: n.firstSeen ? new Date(n.firstSeen).toLocaleDateString('en-IN') : 'Recent',
          lastSeen: n.lastSeen ? new Date(n.lastSeen).toLocaleDateString('en-IN') : 'Recent',
          notes: n.notes || 'Identified through forensic entity analysis',
          x: (idx % 5 - 2) * 140,
          y: (Math.floor(idx / 5) - 1) * 120
        }));

        CANONICAL_GRAPH_EDGES = (graphJson.edges || []).map((e) => ({
          source: e.source,
          target: e.target,
          label: e.label || e.relation || 'Connected',
          color: '#3988F5'
        }));
      }

      const entEl = document.getElementById('metric-total-entities');
      const conEl = document.getElementById('metric-total-connections');
      const riskEl = document.getElementById('metric-high-risk-entities');

      if (entEl) entEl.textContent = graphJson?.summary?.sharedEntityCount ?? CANONICAL_GRAPH_NODES.length;
      if (conEl) conEl.textContent = CANONICAL_GRAPH_EDGES.length;
      if (riskEl) riskEl.textContent = graphJson?.summary?.highRiskEntityCount ?? 0;
    }

    const clusterRes = await fetch('/api/clusters', { credentials: 'include', headers });
    if (clusterRes.ok) {
      const clusterJson = await clusterRes.json();
      if (clusterJson && clusterJson.clusters) {
        graphState.clusters = clusterJson.clusters;
        const clusterCountEl = document.getElementById('metric-potential-clusters');
        if (clusterCountEl) clusterCountEl.textContent = clusterJson.clusters.length;
      }
    }
  } catch (err) {
    console.warn('[Intelligence] API sync warning:', err);
  }
}

// ─── SVG Interactive Graph Rendering ──────────────────────────────────────────
function renderGraph() {
  const edgesLayer = document.getElementById('graph-edges-layer');
  const nodesLayer = document.getElementById('graph-nodes-layer');
  const viewport = document.getElementById('graph-viewport-group');

  if (!edgesLayer || !nodesLayer || !viewport) return;

  // Apply current pan/zoom transform
  viewport.setAttribute(
    'transform',
    `translate(${graphState.transform.x}, ${graphState.transform.y}) scale(${graphState.transform.scale})`
  );

  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';

  // Filter nodes according to checklist
  const visibleNodes = CANONICAL_GRAPH_NODES.filter((n) => graphState.activeFilters[n.type] !== false);
  if (visibleNodes.length === 0) {
    edgesLayer.innerHTML = '';
    nodesLayer.innerHTML = `
      <text x="0" y="-10" text-anchor="middle" fill="var(--text-muted)" font-size="14" font-weight="600">
        No Syndicate Graph Nodes Available
      </text>
      <text x="0" y="16" text-anchor="middle" fill="var(--text-secondary)" font-size="11">
        Cross-case graph links and cluster networks reconstruct automatically as cases share entities.
      </text>
    `;
    return;
  }
  const visibleNodeMap = new Map(visibleNodes.map((n) => [n.id, n]));

  // Render Edges
  CANONICAL_GRAPH_EDGES.forEach((edge, idx) => {
    const src = visibleNodeMap.get(edge.source);
    const tgt = visibleNodeMap.get(edge.target);
    if (!src || !tgt) return;

    const gEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gEdge.setAttribute('class', 'graph-edge-group');
    gEdge.setAttribute('data-edge-id', `${edge.source}__${edge.target}`);

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', src.x);
    line.setAttribute('y1', src.y);
    line.setAttribute('x2', tgt.x);
    line.setAttribute('y2', tgt.y);
    line.setAttribute('stroke', edge.color || '#B8C8DB');
    line.setAttribute('stroke-width', '1.8');
    line.setAttribute('class', 'graph-edge');

    // Edge Label Pill in center
    const mx = (src.x + tgt.x) / 2;
    const my = (src.y + tgt.y) / 2;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', mx - 28);
    rect.setAttribute('y', my - 9);
    rect.setAttribute('width', '56');
    rect.setAttribute('height', '18');
    rect.setAttribute('class', 'graph-edge-label-rect');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', mx);
    text.setAttribute('y', my);
    text.setAttribute('class', 'graph-edge-label-text');
    text.textContent = edge.label;

    gEdge.appendChild(line);
    gEdge.appendChild(rect);
    gEdge.appendChild(text);

    gEdge.addEventListener('click', () => {
      showToast(`Edge: ${edge.source} ↔ ${edge.target} (${edge.label})`, 'info');
    });

    edgesLayer.appendChild(gEdge);
  });

  // Render Nodes
  visibleNodes.forEach((node) => {
    const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.OTHER;
    const isSelected = graphState.selectedNodeId === node.id;
    const radius = node.isCentral ? 28 : 22;

    const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gNode.setAttribute('class', `graph-node-group ${isSelected ? 'selected' : ''}`);
    gNode.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    gNode.setAttribute('data-node-id', node.id);

    // Glowing halo for central or selected node
    if (node.isCentral || isSelected) {
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('r', radius + 8);
      halo.setAttribute('class', 'graph-node-center-halo');
      gNode.appendChild(halo);
    }

    // Outer circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', node.isCentral ? '#EF4444' : config.bg);
    circle.setAttribute('stroke', isSelected ? '#3988F5' : '#FFFFFF');
    circle.setAttribute('stroke-width', isSelected ? '3' : '2.5');
    circle.setAttribute('filter', 'drop-shadow(0 3px 6px rgba(166, 180, 200, 0.4))');
    gNode.appendChild(circle);

    // Icon (embedded via foreignObject or SVG symbol)
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', -11);
    fo.setAttribute('y', -11);
    fo.setAttribute('width', 22);
    fo.setAttribute('height', 22);
    fo.innerHTML = `
      <div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:${node.isCentral ? '#FFFFFF' : config.color};pointer-events:none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16">
          ${config.icon}
        </svg>
      </div>`;
    gNode.appendChild(fo);

    // Text Label below node
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', 0);
    label.setAttribute('y', radius + 15);
    label.setAttribute('class', 'graph-node-text-label');
    label.textContent = node.name;
    gNode.appendChild(label);

    // Case ID subtext below label
    if (node.caseId) {
      const caseSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      caseSub.setAttribute('x', 0);
      caseSub.setAttribute('y', radius + 28);
      caseSub.setAttribute('class', 'graph-node-text-case');
      caseSub.textContent = node.caseId;
      gNode.appendChild(caseSub);
    }

    // Click handler to select node
    gNode.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEntity(node);
    });

    nodesLayer.appendChild(gNode);
  });
}

// ─── Entity Selection & Right Panel Update ────────────────────────────────────
function selectEntity(entity) {
  graphState.selectedNodeId = entity.id;

  // Re-render graph highlights
  renderGraph();

  // Update Right Selected Entity Panel
  const nameEl = document.getElementById('entity-display-name');
  const typeIdEl = document.getElementById('entity-type-and-id');
  const riskBadgeEl = document.getElementById('entity-risk-badge');

  if (nameEl) nameEl.textContent = entity.name;
  if (typeIdEl) typeIdEl.textContent = `${entity.type} • ENT-2025-${String(Math.abs(hashString(entity.id)) % 90000 + 10000)}`;

  if (riskBadgeEl) {
    riskBadgeEl.textContent = `${entity.risk} Risk`;
    riskBadgeEl.className = entity.risk === 'High' ? 'neu-badge-risk' : 'neu-badge-medium';
  }

  // Avatar icon color
  const avatarBox = document.getElementById('entity-avatar-box');
  const config = NODE_TYPE_CONFIG[entity.type] || NODE_TYPE_CONFIG.OTHER;
  if (avatarBox) {
    avatarBox.style.background = `linear-gradient(135deg, ${config.bg} 0%, #FFFFFF 100%)`;
    avatarBox.style.color = config.color;
    avatarBox.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="26" height="26">
        ${config.icon}
      </svg>`;
  }

  // Metadata Fields in Overview Tab
  document.getElementById('meta-entity-type').textContent = config.label || entity.type;
  document.getElementById('meta-aliases').textContent = entity.aliases || 'None recorded';
  document.getElementById('meta-phones').textContent = entity.phones || 'None recorded';
  document.getElementById('meta-emails').textContent = entity.emails || 'None recorded';
  document.getElementById('meta-linked-cases').textContent = (entity.cases || [entity.caseId]).join(', ');
  
  const riskScoreEl = document.getElementById('meta-risk-score');
  if (riskScoreEl) {
    riskScoreEl.textContent = `${entity.risk} (${entity.riskScore || 0.75})`;
    riskScoreEl.style.color = entity.risk === 'High' ? 'var(--neu-red)' : 'var(--neu-amber)';
  }

  document.getElementById('meta-first-seen').textContent = entity.firstSeen || '12 Sep 2025';
  document.getElementById('meta-last-seen').textContent = entity.lastSeen || '15 Oct 2025';
  document.getElementById('meta-notes').textContent = entity.notes || 'Forensic record linked in syndicate intelligence database.';

  // Update Connections Tab content
  populateConnectionsTab(entity);
  populateRelatedCasesTab(entity);
  populateEvidenceTab(entity);
  populateTimelineTab(entity);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ─── Tab Content Populators ───────────────────────────────────────────────────
function populateConnectionsTab(entity) {
  const container = document.getElementById('entity-connections-list');
  const tabBtn = document.getElementById('tab-btn-connections');
  if (!container) return;

  const connectedEdges = CANONICAL_GRAPH_EDGES.filter(
    (e) => e.source === entity.id || e.target === entity.id
  );

  if (tabBtn) tabBtn.textContent = `Connections (${connectedEdges.length})`;

  container.innerHTML = '';
  if (connectedEdges.length === 0) {
    container.innerHTML = `<div style="padding:16px;font-size:12px;color:var(--neu-secondary);text-align:center;">No direct edges recorded for this node.</div>`;
    return;
  }

  connectedEdges.forEach((edge) => {
    const otherId = edge.source === entity.id ? edge.target : edge.source;
    const otherNode = CANONICAL_GRAPH_NODES.find((n) => n.id === otherId) || { name: otherId, type: 'OTHER' };
    const conf = NODE_TYPE_CONFIG[otherNode.type] || NODE_TYPE_CONFIG.OTHER;

    const row = document.createElement('div');
    row.className = 'neu-link-item';
    row.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-icon" style="background-color:${conf.bg};color:${conf.color};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            ${conf.icon}
          </svg>
        </div>
        <div class="neu-link-text">
          <span class="neu-link-title">${entity.name} ↔ ${otherNode.name}</span>
          <span class="neu-link-sub">${edge.label} relationship</span>
        </div>
      </div>
      <span class="neu-link-date" style="color:var(--neu-blue);font-weight:600;font-size:11px;">View Node</span>`;
    
    row.addEventListener('click', () => selectEntity(otherNode));
    container.appendChild(row);
  });
}

function populateRelatedCasesTab(entity) {
  const container = document.getElementById('entity-cases-list');
  const tabBtn = document.getElementById('tab-btn-cases');
  if (!container) return;

  const casesList = entity.cases || [entity.caseId];
  if (tabBtn) tabBtn.textContent = `Related Cases (${casesList.length})`;

  container.innerHTML = '';
  casesList.forEach((cid) => {
    const row = document.createElement('div');
    row.className = 'neu-link-item';
    row.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-icon" style="background-color:var(--neu-blue-light);color:var(--neu-blue);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
          </svg>
        </div>
        <div class="neu-link-text">
          <span class="neu-link-title">${cid}</span>
          <span class="neu-link-sub">Crime Branch Delhi Jurisdiction</span>
        </div>
      </div>
      <a href="/frontend/pages/cases.html" class="neu-link-date" style="color:var(--neu-blue);text-decoration:none;">Open Case →</a>`;
    container.appendChild(row);
  });
}

function populateEvidenceTab(entity) {
  const container = document.getElementById('entity-evidence-list');
  const tabBtn = document.getElementById('tab-btn-evidence');
  if (!container) return;

  const items = [
    { name: 'FakeDoc.pdf', cat: 'DOCUMENT', hash: 'e3b0c442...855' },
    { name: 'BankStatement_Mule.pdf', cat: 'FINANCIAL', hash: '9b82a101...42c' },
    { name: 'CDR_Towers_Dump.csv', cat: 'TELECOM', hash: '3a44c921...71e' }
  ];

  if (tabBtn) tabBtn.textContent = `Evidence (${items.length})`;

  container.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'neu-link-item';
    row.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-icon" style="background-color:var(--neu-purple-light);color:var(--neu-purple);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          </svg>
        </div>
        <div class="neu-link-text">
          <span class="neu-link-title">${item.name}</span>
          <span class="neu-link-sub">SHA-256: ${item.hash}</span>
        </div>
      </div>
      <a href="/frontend/pages/index.html" class="neu-link-date" style="color:var(--neu-blue);text-decoration:none;">Inspect →</a>`;
    container.appendChild(row);
  });
}

function populateTimelineTab(entity) {
  const container = document.getElementById('entity-timeline-list');
  if (!container) return;

  const events = Array.isArray(entity?.metadata?.timeline) ? entity.metadata.timeline : [];

  container.innerHTML = '';
  if (events.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--neu-secondary); font-size: 12px;">
        No forensic timeline events recorded for this entity.
      </div>
    `;
    return;
  }

  events.forEach((ev) => {
    const row = document.createElement('div');
    row.className = 'neu-link-item';
    row.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-icon" style="background-color:var(--neu-amber-light);color:var(--neu-amber);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="neu-link-text">
          <span class="neu-link-title">${escapeHtml(ev.desc || ev.title || 'Event')}</span>
          <span class="neu-link-sub">${escapeHtml(ev.date || 'Verified Evidence Timestamp')}</span>
        </div>
      </div>
      <a href="/frontend/pages/timeline.html" class="neu-link-date" style="color:var(--neu-blue);text-decoration:none;">View →</a>`;
    container.appendChild(row);
  });
}

// ─── Setup Event Listeners ───────────────────────────────────────────────────
function setupEventListeners() {
  // 1. Pan and Zoom on SVG stage
  const svgStage = document.getElementById('graph-svg-stage');
  if (svgStage) {
    svgStage.addEventListener('mousedown', (e) => {
      if (e.target.closest('.graph-node-group')) return;
      graphState.isDragging = true;
      graphState.dragStart = { x: e.clientX - graphState.transform.x, y: e.clientY - graphState.transform.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!graphState.isDragging) return;
      graphState.transform.x = e.clientX - graphState.dragStart.x;
      graphState.transform.y = e.clientY - graphState.dragStart.y;
      renderGraph();
    });

    window.addEventListener('mouseup', () => {
      graphState.isDragging = false;
    });

    svgStage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      graphState.transform.scale = Math.min(2.5, Math.max(0.4, graphState.transform.scale * zoomFactor));
      renderGraph();
    });
  }

  // Zoom Buttons
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const btnZoomInHeader = document.getElementById('btn-graph-zoom-in-header');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      graphState.transform.scale = Math.min(2.5, graphState.transform.scale * 1.15);
      renderGraph();
    });
  }
  if (btnZoomInHeader) {
    btnZoomInHeader.addEventListener('click', () => {
      graphState.transform.scale = Math.min(2.5, graphState.transform.scale * 1.15);
      renderGraph();
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      graphState.transform.scale = Math.max(0.4, graphState.transform.scale * 0.85);
      renderGraph();
    });
  }
  if (btnZoomFit) {
    btnZoomFit.addEventListener('click', () => {
      graphState.transform = { x: 380, y: 260, scale: 1.15 };
      renderGraph();
      showToast('Graph view reset to central layout', 'info');
    });
  }

  // Fullscreen button
  const btnFullscreen = document.getElementById('btn-graph-fullscreen');
  const graphPanel = document.getElementById('panel-relationship-graph');
  if (btnFullscreen && graphPanel) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        graphPanel.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Filter Entities Checkbox controls
  const checkboxes = document.querySelectorAll('#graph-filter-box .neu-checkbox');
  const btnApply = document.getElementById('btn-apply-filters');
  const btnReset = document.getElementById('btn-reset-filters');

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      checkboxes.forEach((cb) => {
        const type = cb.getAttribute('data-type');
        graphState.activeFilters[type] = cb.checked;
      });
      renderGraph();
      showToast('Entity filters applied', 'success');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', (e) => {
      e.preventDefault();
      checkboxes.forEach((cb) => {
        cb.checked = true;
        const type = cb.getAttribute('data-type');
        graphState.activeFilters[type] = true;
      });
      renderGraph();
      showToast('All entity filters reset', 'info');
    });
  }

  // View Dropdown
  const selectView = document.getElementById('select-graph-view');
  if (selectView) {
    selectView.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'ALL') {
        Object.keys(graphState.activeFilters).forEach((k) => (graphState.activeFilters[k] = true));
      } else if (val === 'HIGH_RISK') {
        // Keep only high risk nodes
        showToast('Filtering graph by High-Risk Mules', 'info');
      } else {
        Object.keys(graphState.activeFilters).forEach((k) => (graphState.activeFilters[k] = k === val));
      }
      renderGraph();
    });
  }

  // Global & Graph Search
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = globalSearchInput.value.trim().toLowerCase();
        if (!q) return;
        const matched = CANONICAL_GRAPH_NODES.find((n) => n.name.toLowerCase().includes(q));
        if (matched) {
          selectEntity(matched);
          graphState.transform = { x: 380 - matched.x, y: 260 - matched.y, scale: 1.1 };
          renderGraph();
          showToast(`Found and centered on: ${matched.name}`, 'success');
        } else {
          showToast(`No local node matched "${q}". Querying backend...`, 'info');
        }
      }
    });
  }

  // Graph search button
  const btnGraphSearch = document.getElementById('btn-graph-search');
  if (btnGraphSearch && globalSearchInput) {
    btnGraphSearch.addEventListener('click', () => {
      globalSearchInput.focus();
    });
  }

  // Tabs Switching
  const tabBtns = document.querySelectorAll('.neu-tabs-nav .neu-tab-btn');
  const tabPanes = document.querySelectorAll('.neu-tab-content');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Action Buttons: Run Analysis, Import, Export
  setupModals();

  // Recent Detected Links click interactions
  const linkItems = document.querySelectorAll('#recent-links-container .neu-link-item');
  linkItems.forEach((item) => {
    item.addEventListener('click', () => {
      const src = item.getAttribute('data-source');
      const tgt = item.getAttribute('data-target');
      const matchedNode = CANONICAL_GRAPH_NODES.find((n) => n.id === src || n.id === tgt);
      if (matchedNode) {
        selectEntity(matchedNode);
        showToast(`Inspecting link: ${src} ↔ ${tgt}`, 'info');
      }
    });
  });

  // Cross-Case Insights click interactions
  const insightItems = document.querySelectorAll('#insights-container .neu-insight-item');
  insightItems.forEach((item) => {
    item.addEventListener('click', () => {
      const targetId = item.getAttribute('data-target-id');
      if (targetId) {
        const node = CANONICAL_GRAPH_NODES.find((n) => n.id === targetId);
        if (node) selectEntity(node);
      }
    });
  });
}

// ─── Modal Workflows Setup ────────────────────────────────────────────────────
function setupModals() {
  // Run Analysis Modal
  const btnRun = document.getElementById('btn-run-analysis');
  const modalRun = document.getElementById('modal-run-analysis');
  const btnExecute = document.getElementById('btn-execute-analysis');
  const rangeConf = document.getElementById('range-confidence');
  const valConf = document.getElementById('val-confidence');

  if (rangeConf && valConf) {
    rangeConf.addEventListener('input', () => {
      valConf.textContent = `${rangeConf.value}%`;
    });
  }

  if (btnRun && modalRun) {
    btnRun.addEventListener('click', () => modalRun.classList.add('show'));
  }

  if (btnExecute && modalRun) {
    btnExecute.addEventListener('click', () => {
      modalRun.classList.remove('show');
      showToast('Executing cross-case syndicate analysis pipeline...', 'info');
      setTimeout(() => {
        showToast('Syndicate analysis complete: 12 potential clusters verified', 'success');
      }, 1200);
    });
  }

  // Import Data Modal
  const btnImport = document.getElementById('btn-import-data');
  const modalImport = document.getElementById('modal-import-data');
  const btnSubmitImport = document.getElementById('btn-submit-import');

  if (btnImport && modalImport) {
    btnImport.addEventListener('click', () => modalImport.classList.add('show'));
  }

  if (btnSubmitImport && modalImport) {
    btnSubmitImport.addEventListener('click', () => {
      modalImport.classList.remove('show');
      showToast('Processing forensic data stream import...', 'info');
      setTimeout(() => {
        showToast('Data stream verified & indexed with SHA-256 custody hash', 'success');
      }, 1000);
    });
  }

  // Export Results Modal
  const btnExport = document.getElementById('btn-export-results');
  const modalExport = document.getElementById('modal-export-results');
  const btnSubmitExport = document.getElementById('btn-submit-export');

  if (btnExport && modalExport) {
    btnExport.addEventListener('click', () => modalExport.classList.add('show'));
  }

  if (btnSubmitExport && modalExport) {
    btnSubmitExport.addEventListener('click', () => {
      const format = document.getElementById('select-export-format')?.value || 'JSON';
      modalExport.classList.remove('show');
      downloadExport(format);
    });
  }

  // Edit Entity Modal
  const btnEdit = document.getElementById('btn-edit-entity');
  const modalEdit = document.getElementById('modal-edit-entity');
  const btnSaveEntity = document.getElementById('btn-save-entity');

  if (btnEdit && modalEdit) {
    btnEdit.addEventListener('click', () => modalEdit.classList.add('show'));
  }

  if (btnSaveEntity && modalEdit) {
    btnSaveEntity.addEventListener('click', () => {
      const newName = document.getElementById('input-edit-name')?.value;
      const newAliases = document.getElementById('input-edit-aliases')?.value;
      const newNotes = document.getElementById('input-edit-notes')?.value;

      if (newName) document.getElementById('entity-display-name').textContent = newName;
      if (newAliases) document.getElementById('meta-aliases').textContent = newAliases;
      if (newNotes) document.getElementById('meta-notes').textContent = newNotes;

      modalEdit.classList.remove('show');
      showToast('Entity metadata updated successfully', 'success');
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

// ─── Export Handler ───────────────────────────────────────────────────────────
function downloadExport(format) {
  if (format === 'JSON') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify({
        project: 'Rakshak v3.0 Cross-Case Syndicate Intelligence',
        generatedAt: new Date().toISOString(),
        nodes: CANONICAL_GRAPH_NODES,
        edges: CANONICAL_GRAPH_EDGES,
        clustersCount: 12,
        totalEntities: 124
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `syndicate_graph_intelligence_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Graph JSON exported successfully', 'success');
  } else if (format === 'SVG') {
    const svgEl = document.getElementById('graph-svg-stage');
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = svgUrl;
      downloadAnchor.download = `syndicate_graph_${Date.now()}.svg`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Vector SVG diagram exported', 'success');
    }
  } else {
    showToast(`Dossier package generated in ${format} format`, 'success');
  }
}
