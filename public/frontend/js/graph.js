/**
 * Rakshak v3.0 — Intelligence & Cross-Case Analysis (Case-to-Case Cross-Cluster Graph)
 *
 * Renders authorized Case nodes, CaseCluster visual groupings (ClusterMembership),
 * and EntityLink cross-case connections with status discrimination, parallel-edge curves,
 * real backend diagnostics, and interactive Case/Link inspection + Analyst Review.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAuthHeaders() {
  let token = null;
  try {
    if (typeof localStorage !== 'undefined') token = localStorage.getItem('rakshak_token');
  } catch (_) {}
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'neu-toast';
  const color = type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3988F5';
  const icon =
    type === 'success'
      ? `<polyline points="20 6 9 17 4 12"></polyline>`
      : type === 'error'
      ? `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`
      : `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`;
  toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">${icon}</svg><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ─── Styling Maps ─────────────────────────────────────────────────────────────
const CASE_STATUS_STYLE = {
  OPEN: { fill: '#EBF3FF', stroke: '#1E66CF', text: '#1E3A8A' },
  UNDER_INQUIRY: { fill: '#FEF6E8', stroke: '#F59E0B', text: '#92400E' },
  CHARGESHEETED: { fill: '#FEECEE', stroke: '#EF4444', text: '#991B1B' },
  CLOSED: { fill: '#E6F9F0', stroke: '#10B981', text: '#065F46' },
};

const LINK_STATUS_STYLE = {
  CONFIRMED: { stroke: '#1E66CF', width: 2.6, dash: '', label: 'Confirmed' },
  UNDER_REVIEW: { stroke: '#F59E0B', width: 2.2, dash: '8 4', label: 'Under Review' },
  CANDIDATE: { stroke: '#64748B', width: 1.7, dash: '4 4', label: 'Candidate' },
  REJECTED: { stroke: '#EF4444', width: 1.3, dash: '2 4', label: 'Rejected' },
  REVOKED: { stroke: '#94A3B8', width: 1.3, dash: '2 4', label: 'Revoked' },
};

const ENTITY_COLORS = {
  PHONE: '#36C98F',
  UPI: '#3988F5',
  ACCOUNT: '#0EA5E9',
  EMAIL: '#9461F5',
  DOMAIN: '#F5B544',
  IP: '#EC4899',
  IFSC: '#6366F1',
  NAME: '#EF4444',
  UTR: '#14B8A6',
  TELEGRAM: '#0284C7',
  OTHER: '#64748B',
};

// ─── State ────────────────────────────────────────────────────────────────────
const graphState = {
  nodes: [],
  edges: [],
  clusters: [],
  entityTypeCounts: {},
  departments: [],
  summary: null,
  diagnostics: null,
  loadState: 'loading', // 'loading' | 'ready' | 'empty' | 'auth_error' | 'api_error' | 'render_error'
  errorMessage: '',
  errorStatus: 0,
  selectedCaseId: null,
  selectedEdgeId: null,
  filtersInitialized: false,
  filters: {
    clusterId: 'ALL',
    departmentId: 'ALL',
    incidentType: 'ALL',
    caseStatus: 'ALL',
    entityType: 'ALL',
    confidenceCategory: 'ALL',
    statuses: ['CONFIRMED', 'UNDER_REVIEW', 'CANDIDATE'],
    includeGeneric: false,
    search: '',
  },
  transform: { x: 440, y: 270, scale: 1 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  const authed = await initOfficerSession();
  if (!authed) {
    renderGraph();
    return;
  }
  await loadIntelligenceData();
  renderGraph();
});

async function initOfficerSession() {
  const nameEl = document.getElementById('officer-display-name');
  const deptEl = document.getElementById('officer-display-dept');
  const profNameEl = document.getElementById('profile-full-name');
  const profBadgeEl = document.getElementById('profile-badge-num');
  const profRoleEl = document.getElementById('profile-role-tag');
  const profJurisEl = document.getElementById('profile-jurisdiction');

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', headers: getAuthHeaders() });
    if (res.status === 401 || res.status === 403) {
      graphState.loadState = 'auth_error';
      graphState.errorStatus = res.status;
      graphState.errorMessage = 'Active officer session required to access cross-case intelligence.';
      if (nameEl) nameEl.textContent = 'Sign In Required';
      if (deptEl) deptEl.textContent = 'Unauthenticated';
      return false;
    }
    if (res.ok) {
      const data = await res.json();
      const off = data.officer || data;
      if (off?.name) {
        sessionStorage.setItem('rakshak_user_name', off.name);
        sessionStorage.setItem('rakshak_user_dept', off.unit || off.jurisdiction || 'Cyber Crime Unit');
        sessionStorage.setItem('rakshak_user_role', off.role || 'INVESTIGATOR');
      }
      if (nameEl) nameEl.textContent = off.name || 'Officer';
      if (deptEl) deptEl.textContent = off.unit || off.jurisdiction || 'Cyber Crime Unit';
      if (profNameEl) profNameEl.textContent = off.name || 'Officer';
      if (profBadgeEl) profBadgeEl.textContent = `Badge: ${off.badgeNumber || '—'}`;
      if (profRoleEl) profRoleEl.textContent = `Role: ${off.role || 'INVESTIGATOR'}`;
      if (profJurisEl) profJurisEl.textContent = off.jurisdiction || '—';
      return true;
    }
  } catch (err) {
    graphState.loadState = 'api_error';
    graphState.errorMessage = `Unable to reach authentication service: ${err.message}`;
    return false;
  }
  return true;
}

// ─── Load Backend Graph Data ──────────────────────────────────────────────────
async function loadIntelligenceData() {
  graphState.loadState = 'loading';
  try {
    const params = new URLSearchParams({ caseId: 'ALL', limit: '150' });
    const f = graphState.filters;
    if (f.clusterId !== 'ALL') params.set('clusterId', f.clusterId);
    if (f.departmentId !== 'ALL') params.set('departmentId', f.departmentId);
    if (f.incidentType !== 'ALL') params.set('incidentType', f.incidentType);
    if (f.caseStatus !== 'ALL') params.set('caseStatus', f.caseStatus);
    if (f.entityType !== 'ALL') params.set('entityType', f.entityType);
    if (f.confidenceCategory !== 'ALL') params.set('confidenceCategory', f.confidenceCategory);
    if (f.statuses.length > 0) params.set('statuses', f.statuses.join(','));
    if (f.includeGeneric) params.set('includeGeneric', 'true');
    if (f.search) params.set('q', f.search);

    const res = await fetch(`/api/graph?${params.toString()}`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      graphState.loadState = 'auth_error';
      graphState.errorStatus = res.status;
      const errBody = await res.json().catch(() => ({}));
      graphState.errorMessage = errBody.error || 'Access denied by authorization policy.';
      return;
    }

    if (!res.ok) {
      graphState.loadState = 'api_error';
      graphState.errorStatus = res.status;
      const errBody = await res.json().catch(() => ({}));
      graphState.errorMessage = errBody.error || `Graph API returned HTTP ${res.status}.`;
      return;
    }

    const data = await res.json();
    graphState.nodes = Array.isArray(data.nodes) ? data.nodes : [];
    graphState.edges = Array.isArray(data.edges) ? data.edges : [];
    graphState.clusters = Array.isArray(data.clusters) ? data.clusters : [];
    graphState.entityTypeCounts = data.entityTypeCounts || {};
    graphState.departments = Array.isArray(data.departments) ? data.departments : [];
    graphState.summary = data.summary || null;
    graphState.diagnostics = data.diagnostics || null;

    if (!graphState.filtersInitialized) {
      populateFilterDropdowns();
      graphState.filtersInitialized = true;
    }

    updateMetricCards();
    computeGraphLayout();
    renderDonutChart();
    renderRecentLinks();
    renderCrossCaseInsights();

    if (graphState.nodes.length === 0 || graphState.edges.length === 0) {
      graphState.loadState = graphState.nodes.length === 0 ? 'empty' : 'ready';
    } else {
      graphState.loadState = 'ready';
    }
  } catch (err) {
    graphState.loadState = 'api_error';
    graphState.errorMessage = err instanceof Error ? err.message : String(err);
  }
}

function populateFilterDropdowns() {
  const clusterSel = document.getElementById('select-cluster-filter');
  if (clusterSel) {
    clusterSel.innerHTML = `<option value="ALL">Cluster: All Clusters (${graphState.clusters.length})</option>`;
    graphState.clusters.forEach((cl) => {
      const opt = document.createElement('option');
      opt.value = cl.id;
      opt.textContent = `${cl.name} (${cl.memberCaseIds.length})`;
      clusterSel.appendChild(opt);
    });
  }

  const deptSel = document.getElementById('select-dept-filter');
  if (deptSel) {
    deptSel.innerHTML = `<option value="ALL">Dept: All Authorized (${graphState.departments.length})</option>`;
    graphState.departments.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.code} — ${d.name}`;
      deptSel.appendChild(opt);
    });
  }

  const incSel = document.getElementById('select-incident-filter');
  if (incSel) {
    const types = Array.from(new Set(graphState.nodes.map((n) => n.incidentType).filter(Boolean))).sort();
    incSel.innerHTML = `<option value="ALL">Incident: All Types</option>`;
    types.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.replace(/_/g, ' ');
      incSel.appendChild(opt);
    });
  }

  const entSel = document.getElementById('select-entitytype-filter');
  if (entSel) {
    const eTypes = Object.keys(graphState.entityTypeCounts).sort();
    entSel.innerHTML = `<option value="ALL">Entity Type: All</option>`;
    eTypes.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = `${t} (${graphState.entityTypeCounts[t]})`;
      entSel.appendChild(opt);
    });
  }
}

function updateMetricCards() {
  const s = graphState.summary;
  if (!s) return;

  const entEl = document.getElementById('metric-total-entities');
  const subEntEl = document.getElementById('subtext-total-entities');
  const conEl = document.getElementById('metric-total-connections');
  const subConEl = document.getElementById('subtext-total-connections');
  const cluEl = document.getElementById('metric-potential-clusters');
  const revEl = document.getElementById('metric-high-risk-entities');

  if (entEl) entEl.textContent = `${s.visibleCases} / ${s.totalEntities}`;
  if (subEntEl) subEntEl.textContent = `${s.visibleCases} cases • ${s.totalEntities} identifiers`;
  if (conEl) conEl.textContent = String(s.totalConnections);
  if (subConEl) subConEl.textContent = `${s.confirmedLinkCount} confirmed • ${s.totalEntityLinksInScope} in scope`;
  if (cluEl) cluEl.textContent = String(s.activeClusters);
  if (revEl) revEl.textContent = String(s.requiresReviewCount);

  const cConf = document.getElementById('count-status-confirmed');
  const cRev = document.getElementById('count-status-review');
  const cCand = document.getElementById('count-status-candidate');
  if (cConf) cConf.textContent = String(s.confirmedLinkCount);
  if (cRev) cRev.textContent = String(s.underReviewLinkCount);
  if (cCand) cCand.textContent = String(s.candidateLinkCount);
}

// ─── Spatial Cluster-Aware Layout ─────────────────────────────────────────────
function computeGraphLayout() {
  const nodes = graphState.nodes;
  if (nodes.length === 0) return;

  const clusters = graphState.clusters;
  const nodeClusterIdx = new Map();
  clusters.forEach((cl, idx) => {
    (cl.memberCaseIds || []).forEach((cid) => {
      if (!nodeClusterIdx.has(cid)) nodeClusterIdx.set(cid, idx);
    });
  });

  const groups = new Map();
  nodes.forEach((n) => {
    const gKey = nodeClusterIdx.has(n.id) ? `cluster_${nodeClusterIdx.get(n.id)}` : 'unclustered';
    if (!groups.has(gKey)) groups.set(gKey, []);
    groups.get(gKey).push(n);
  });

  const groupEntries = Array.from(groups.entries());
  const numGroups = groupEntries.length;
  const groupRadius = numGroups > 1 ? 210 : 0;

  groupEntries.forEach(([, members], gIdx) => {
    const gAngle = (gIdx / Math.max(1, numGroups)) * Math.PI * 2 - Math.PI / 2;
    const gx = Math.cos(gAngle) * groupRadius;
    const gy = Math.sin(gAngle) * groupRadius;
    const localR = members.length <= 1 ? 0 : Math.max(75, members.length * 26);

    members.forEach((n, mIdx) => {
      const mAngle = (mIdx / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 4;
      n.x = Math.round(gx + Math.cos(mAngle) * localR);
      n.y = Math.round(gy + Math.sin(mAngle) * localR);
    });
  });
}

function fitGraphToScreen() {
  const svg = document.getElementById('graph-svg-stage');
  if (!svg || graphState.nodes.length === 0) {
    graphState.transform = { x: 440, y: 270, scale: 1 };
    return;
  }
  const rect = svg.getBoundingClientRect();
  const w = rect.width || 880;
  const h = rect.height || 540;
  const xs = graphState.nodes.map((n) => n.x);
  const ys = graphState.nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 100;
  const maxX = Math.max(...xs) + 100;
  const minY = Math.min(...ys) - 90;
  const maxY = Math.max(...ys) + 90;
  const spanW = Math.max(200, maxX - minX);
  const spanH = Math.max(200, maxY - minY);
  const scale = Math.min(1.25, Math.max(0.45, Math.min((w - 220) / spanW, (h - 60) / spanH)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  graphState.transform = {
    x: w / 2 + 80 - cx * scale,
    y: h / 2 - cy * scale,
    scale,
  };
}

// ─── SVG Graph Rendering ──────────────────────────────────────────────────────
function renderGraph() {
  const clustersLayer = document.getElementById('graph-clusters-layer');
  const edgesLayer = document.getElementById('graph-edges-layer');
  const nodesLayer = document.getElementById('graph-nodes-layer');
  const viewport = document.getElementById('graph-viewport-group');
  if (!edgesLayer || !nodesLayer || !viewport) return;

  try {
    if (clustersLayer) clustersLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    nodesLayer.innerHTML = '';

    // Handle non-ready states explicitly (never hide auth/API errors as empty state)
    if (graphState.loadState === 'auth_error') {
      viewport.setAttribute('transform', 'translate(480, 260) scale(1)');
      nodesLayer.innerHTML = `
        <text x="0" y="-14" text-anchor="middle" fill="#EF4444" font-size="14" font-weight="700">Authentication Required (${graphState.errorStatus || 401})</text>
        <text x="0" y="10" text-anchor="middle" fill="var(--neu-secondary)" font-size="12">${escapeHtml(graphState.errorMessage)}</text>
        <a href="/frontend/pages/login.html"><text x="0" y="34" text-anchor="middle" fill="#1E66CF" font-size="12" font-weight="600" style="text-decoration:underline;cursor:pointer;">Sign in as Officer →</text></a>
      `;
      return;
    }

    if (graphState.loadState === 'api_error') {
      viewport.setAttribute('transform', 'translate(480, 260) scale(1)');
      nodesLayer.innerHTML = `
        <text x="0" y="-12" text-anchor="middle" fill="#EF4444" font-size="14" font-weight="700">Graph API Error ${graphState.errorStatus ? `(HTTP ${graphState.errorStatus})` : ''}</text>
        <text x="0" y="12" text-anchor="middle" fill="var(--neu-secondary)" font-size="11.5">${escapeHtml(graphState.errorMessage)}</text>
      `;
      return;
    }

    if (graphState.nodes.length === 0 || (graphState.edges.length === 0 && graphState.diagnostics)) {
      const d = graphState.diagnostics || {};
      if (graphState.nodes.length === 0) {
        viewport.setAttribute('transform', 'translate(480, 240) scale(1)');
        nodesLayer.innerHTML = `
          <text x="0" y="-24" text-anchor="middle" fill="var(--neu-navy)" font-size="14" font-weight="700">No verified cross-case links are available for the selected filters.</text>
          <text x="0" y="2" text-anchor="middle" fill="var(--neu-secondary)" font-size="11.5">Cases: ${d.availableCasesCount ?? 0} • EntityLinks: ${d.availableEntityLinksCount ?? 0} • Active Clusters: ${d.activeClustersCount ?? 0} • Memberships: ${d.clusterMembershipsCount ?? 0} • Excluded: ${d.excludedByFiltersCount ?? 0}</text>
          <text x="0" y="24" text-anchor="middle" fill="var(--neu-secondary)" font-size="11">Cross-case links must be generated via entity resolution or adjusted filters.</text>
        `;
        return;
      }
    }

    viewport.setAttribute(
      'transform',
      `translate(${graphState.transform.x}, ${graphState.transform.y}) scale(${graphState.transform.scale})`
    );

    const nodeMap = new Map(graphState.nodes.map((n) => [n.id, n]));

    // Determine highlighted neighborhood when a Case or Edge is selected
    const highlightedNodeIds = new Set();
    const highlightedEdgeIds = new Set();
    const hasSelection = Boolean(graphState.selectedCaseId || graphState.selectedEdgeId);

    if (graphState.selectedCaseId) {
      highlightedNodeIds.add(graphState.selectedCaseId);
      graphState.edges.forEach((e) => {
        if (e.sourceCaseId === graphState.selectedCaseId || e.targetCaseId === graphState.selectedCaseId) {
          highlightedEdgeIds.add(e.id);
          highlightedNodeIds.add(e.sourceCaseId);
          highlightedNodeIds.add(e.targetCaseId);
        }
      });
    } else if (graphState.selectedEdgeId) {
      const selEdge = graphState.edges.find((e) => e.id === graphState.selectedEdgeId);
      if (selEdge) {
        highlightedEdgeIds.add(selEdge.id);
        highlightedNodeIds.add(selEdge.sourceCaseId);
        highlightedNodeIds.add(selEdge.targetCaseId);
      }
    }

    // 1. Render CaseCluster subtle group boundaries
    if (clustersLayer) {
      graphState.clusters.forEach((cl) => {
        const members = (cl.memberCaseIds || []).map((id) => nodeMap.get(id)).filter(Boolean);
        if (members.length < 2) return;
        const pad = 54;
        const minX = Math.min(...members.map((m) => m.x)) - pad;
        const maxX = Math.max(...members.map((m) => m.x)) + pad;
        const minY = Math.min(...members.map((m) => m.y)) - pad;
        const maxY = Math.max(...members.map((m) => m.y)) + pad;

        const gCl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', minX);
        rect.setAttribute('y', minY);
        rect.setAttribute('width', maxX - minX);
        rect.setAttribute('height', maxY - minY);
        rect.setAttribute('rx', '20');
        rect.setAttribute('fill', 'rgba(57, 136, 245, 0.045)');
        rect.setAttribute('stroke', '#93C5FD');
        rect.setAttribute('stroke-width', '1.4');
        rect.setAttribute('stroke-dasharray', '6 4');
        gCl.appendChild(rect);

        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', minX + 12);
        lbl.setAttribute('y', minY + 16);
        lbl.setAttribute('fill', '#1E66CF');
        lbl.setAttribute('font-size', '10');
        lbl.setAttribute('font-weight', '700');
        lbl.textContent = `CLUSTER: ${cl.name} (${cl.confidence})`;
        gCl.appendChild(lbl);
        clustersLayer.appendChild(gCl);
      });
    }

    // 2. Group parallel edges so multiple shared identifiers never overlap
    const pairGroups = new Map();
    graphState.edges.forEach((edge) => {
      const a = edge.sourceCaseId < edge.targetCaseId ? edge.sourceCaseId : edge.targetCaseId;
      const b = edge.sourceCaseId < edge.targetCaseId ? edge.targetCaseId : edge.sourceCaseId;
      const key = `${a}__${b}`;
      if (!pairGroups.has(key)) pairGroups.set(key, []);
      pairGroups.get(key).push(edge);
    });

    // 3. Render Edges
    pairGroups.forEach((group) => {
      group.forEach((edge, idx) => {
        const src = nodeMap.get(edge.sourceCaseId);
        const tgt = nodeMap.get(edge.targetCaseId);
        if (!src || !tgt) return;

        const st = LINK_STATUS_STYLE[edge.status] || LINK_STATUS_STYLE.CANDIDATE;
        const isHighlighted = !hasSelection || highlightedEdgeIds.has(edge.id);
        const isSelected = graphState.selectedEdgeId === edge.id;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const offsetIdx = idx - (group.length - 1) / 2;
        const curveOffset = offsetIdx * 42;
        const cx = (src.x + tgt.x) / 2 + nx * curveOffset;
        const cy = (src.y + tgt.y) / 2 + ny * curveOffset;

        const gEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gEdge.setAttribute('class', 'graph-edge-group');
        gEdge.setAttribute('style', `cursor:pointer;opacity:${isHighlighted ? 1 : 0.16};`);

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', `M ${src.x} ${src.y} Q ${cx} ${cy} ${tgt.x} ${tgt.y}`);
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', isSelected ? '#1E3A8A' : st.stroke);
        pathEl.setAttribute('stroke-width', isSelected ? st.width + 1.4 : st.width);
        if (st.dash) pathEl.setAttribute('stroke-dasharray', st.dash);
        gEdge.appendChild(pathEl);

        // Midpoint label on quadratic Bezier (t=0.5)
        const mx = 0.25 * src.x + 0.5 * cx + 0.25 * tgt.x;
        const my = 0.25 * src.y + 0.5 * cy + 0.25 * tgt.y;
        const labelStr = `${edge.entityType}: ${edge.maskedValue}`;
        const pillW = Math.min(148, Math.max(72, labelStr.length * 6.2 + 12));

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', mx - pillW / 2);
        rect.setAttribute('y', my - 9);
        rect.setAttribute('width', pillW);
        rect.setAttribute('height', '18');
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', '#FFFFFF');
        rect.setAttribute('stroke', st.stroke);
        rect.setAttribute('stroke-width', isSelected ? '1.6' : '1');
        gEdge.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mx);
        text.setAttribute('y', my + 3);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9.5');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#172B4D');
        text.textContent = labelStr;
        gEdge.appendChild(text);

        gEdge.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectEdge(edge);
        });

        edgesLayer.appendChild(gEdge);
      });
    });

    // 4. Render Case Nodes
    graphState.nodes.forEach((node) => {
      const style = CASE_STATUS_STYLE[node.status] || CASE_STATUS_STYLE.OPEN;
      const isSelected = graphState.selectedCaseId === node.id;
      const isHighlighted = !hasSelection || highlightedNodeIds.has(node.id);
      const radius = node.linkedCaseCount > 0 ? 25 : 21;

      const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gNode.setAttribute('class', `graph-node-group ${isSelected ? 'selected' : ''}`);
      gNode.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      gNode.setAttribute('data-case-id', node.id);
      gNode.setAttribute('style', `cursor:pointer;opacity:${isHighlighted ? 1 : 0.22};`);

      if (isSelected) {
        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('r', radius + 7);
        halo.setAttribute('class', 'graph-node-center-halo');
        gNode.appendChild(halo);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', isSelected ? '#1E66CF' : style.fill);
      circle.setAttribute('stroke', isSelected ? '#FFFFFF' : style.stroke);
      circle.setAttribute('stroke-width', isSelected ? '3' : '2.4');
      circle.setAttribute('filter', 'drop-shadow(0 3px 6px rgba(166, 180, 200, 0.45))');
      gNode.appendChild(circle);

      // Link count badge inside circle
      const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      countText.setAttribute('x', 0);
      countText.setAttribute('y', 4);
      countText.setAttribute('text-anchor', 'middle');
      countText.setAttribute('font-size', '11');
      countText.setAttribute('font-weight', '800');
      countText.setAttribute('fill', isSelected ? '#FFFFFF' : style.text);
      countText.textContent = `${node.linkedCaseCount}L`;
      gNode.appendChild(countText);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 0);
      label.setAttribute('y', radius + 15);
      label.setAttribute('class', 'graph-node-text-label');
      label.textContent = node.caseNumber;
      gNode.appendChild(label);

      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', 0);
      sub.setAttribute('y', radius + 27);
      sub.setAttribute('class', 'graph-node-text-case');
      sub.textContent = `${(node.incidentType || '').replace(/_/g, ' ')} • ${node.status}`;
      gNode.appendChild(sub);

      gNode.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectCaseNode(node);
      });

      nodesLayer.appendChild(gNode);
    });

    // Empty-links overlay notice when Cases exist but 0 links match filters
    if (graphState.edges.length === 0 && graphState.diagnostics) {
      const d = graphState.diagnostics;
      const notice = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      notice.setAttribute('x', 0);
      notice.setAttribute('y', -220);
      notice.setAttribute('text-anchor', 'middle');
      notice.setAttribute('fill', '#B45309');
      notice.setAttribute('font-size', '11.5');
      notice.setAttribute('font-weight', '600');
      notice.textContent = `No verified cross-case links match current filters (${d.availableEntityLinksCount} total links, ${d.excludedByFiltersCount} excluded).`;
      nodesLayer.appendChild(notice);
    }
  } catch (err) {
    graphState.loadState = 'render_error';
    nodesLayer.innerHTML = `<text x="0" y="0" text-anchor="middle" fill="#EF4444" font-size="13">Graph render failed: ${escapeHtml(err.message)}</text>`;
  }
}

// ─── Selection Handlers ───────────────────────────────────────────────────────
function setOverviewRow(idx, keyText, valHtml) {
  const kEl = document.getElementById(`meta-key-${idx}`);
  const ids = [
    '',
    'meta-entity-type',
    'meta-aliases',
    'meta-phones',
    'meta-emails',
    'meta-linked-cases',
    'meta-risk-score',
    'meta-first-seen',
    'meta-last-seen',
    'meta-notes',
  ];
  const vEl = document.getElementById(ids[idx]);
  if (kEl) kEl.textContent = keyText;
  if (vEl) vEl.innerHTML = valHtml;
}

function selectCaseNode(c) {
  graphState.selectedCaseId = c.id;
  graphState.selectedEdgeId = null;
  renderGraph();

  const nameEl = document.getElementById('entity-display-name');
  const subEl = document.getElementById('entity-type-and-id');
  const badgeEl = document.getElementById('entity-risk-badge');
  if (nameEl) nameEl.textContent = c.caseNumber;
  if (subEl) subEl.textContent = `${(c.incidentType || '').replace(/_/g, ' ')} • ${c.jurisdiction}`;
  if (badgeEl) {
    badgeEl.textContent = c.status;
    badgeEl.className = c.linkedCaseCount > 0 ? 'neu-badge-risk' : 'neu-badge-medium';
  }

  const connectedEdges = graphState.edges.filter((e) => e.sourceCaseId === c.id || e.targetCaseId === c.id);
  const peerNames = Array.from(
    new Set(connectedEdges.map((e) => (e.sourceCaseId === c.id ? e.targetCaseNumber : e.sourceCaseNumber)))
  );

  setOverviewRow(1, 'Incident Type', escapeHtml((c.incidentType || '').replace(/_/g, ' ')));
  setOverviewRow(2, 'Case Status', escapeHtml(c.status));
  setOverviewRow(3, 'Jurisdiction', escapeHtml(c.jurisdiction || '—'));
  setOverviewRow(4, 'Department', escapeHtml(c.departmentName ? `${c.departmentCode} — ${c.departmentName}` : 'Authorized Scope'));
  setOverviewRow(5, 'Linked Cases', `${c.linkedCaseCount} (${escapeHtml(peerNames.join(', ') || 'None')})`);
  setOverviewRow(6, 'Clusters', escapeHtml((c.clusterNames || []).join(', ') || 'Unclustered'));
  setOverviewRow(7, 'Identifiers & Evidence', `${c.entityCount} entities • ${c.evidenceCount} exhibits`);
  setOverviewRow(8, 'Shared Entity Types', escapeHtml((c.sharedEntityTypes || []).join(', ') || 'None'));
  setOverviewRow(
    9,
    'Case Workspace',
    `<a href="/frontend/pages/case-detail.html?caseId=${encodeURIComponent(c.id)}" style="color:#1E66CF;font-weight:600;text-decoration:none;">Open Case Detail →</a>`
  );

  populateCaseTabs(c, connectedEdges);
}

function selectEdge(edge) {
  graphState.selectedEdgeId = edge.id;
  graphState.selectedCaseId = null;
  renderGraph();

  const nameEl = document.getElementById('entity-display-name');
  const subEl = document.getElementById('entity-type-and-id');
  const badgeEl = document.getElementById('entity-risk-badge');
  if (nameEl) nameEl.textContent = `${edge.sourceCaseNumber} ↔ ${edge.targetCaseNumber}`;
  if (subEl) subEl.textContent = `${edge.entityType}: ${edge.maskedValue} • ${edge.linkType}`;
  if (badgeEl) {
    badgeEl.textContent = edge.status;
    badgeEl.className = edge.status === 'CONFIRMED' ? 'neu-badge-risk' : 'neu-badge-medium';
  }

  setOverviewRow(1, 'Entity & Link Type', `${escapeHtml(edge.entityType)} • ${escapeHtml(edge.linkType)}`);
  setOverviewRow(2, 'Review Status', escapeHtml(edge.status));
  setOverviewRow(3, 'Match Rule', escapeHtml(edge.matchRule));
  setOverviewRow(4, 'Masked Identifier', `<code>${escapeHtml(edge.maskedValue)}</code>`);
  setOverviewRow(
    5,
    'Connected Cases',
    `<a href="/frontend/pages/case-detail.html?caseId=${encodeURIComponent(edge.sourceCaseId)}" style="color:#1E66CF;">${escapeHtml(edge.sourceCaseNumber)}</a> ↔ <a href="/frontend/pages/case-detail.html?caseId=${encodeURIComponent(edge.targetCaseId)}" style="color:#1E66CF;">${escapeHtml(edge.targetCaseNumber)}</a>`
  );
  setOverviewRow(6, 'Confidence Category', escapeHtml(edge.confidenceCategory));
  setOverviewRow(
    7,
    'Evidence Provenance',
    `${[edge.sourceEvidenceId, edge.targetEvidenceId].filter(Boolean).length} linked exhibit(s)`
  );
  setOverviewRow(8, 'Review Rationale', escapeHtml(edge.reviewRationale || edge.limitations || 'Pending analyst review'));
  setOverviewRow(9, 'Explanation', escapeHtml(edge.explanation));

  populateEdgeTabs(edge);
}

function populateCaseTabs(c, connectedEdges) {
  const connEl = document.getElementById('entity-connections-list');
  const connTab = document.getElementById('tab-btn-connections');
  if (connTab) connTab.textContent = `Connections (${connectedEdges.length})`;
  if (connEl) {
    connEl.innerHTML = connectedEdges.length === 0
      ? `<div style="padding:16px;font-size:12px;color:var(--neu-secondary);text-align:center;">No active EntityLink edges for this case.</div>`
      : '';
    connectedEdges.forEach((e) => {
      const peerNum = e.sourceCaseId === c.id ? e.targetCaseNumber : e.sourceCaseNumber;
      const row = document.createElement('div');
      row.className = 'neu-link-item';
      row.innerHTML = `
        <div class="neu-link-left">
          <div class="neu-link-text">
            <span class="neu-link-title">${escapeHtml(c.caseNumber)} ↔ ${escapeHtml(peerNum)}</span>
            <span class="neu-link-sub">${escapeHtml(e.entityType)}: ${escapeHtml(e.maskedValue)} • ${escapeHtml(e.status)}</span>
          </div>
        </div>
        <span class="neu-link-date" style="color:var(--neu-blue);font-weight:600;font-size:11px;">Inspect Link</span>`;
      row.addEventListener('click', () => selectEdge(e));
      connEl.appendChild(row);
    });
  }

  const casesEl = document.getElementById('entity-cases-list');
  const casesTab = document.getElementById('tab-btn-cases');
  const peerIds = Array.from(new Set(connectedEdges.map((e) => (e.sourceCaseId === c.id ? e.targetCaseId : e.sourceCaseId))));
  if (casesTab) casesTab.textContent = `Linked Cases (${peerIds.length})`;
  if (casesEl) {
    casesEl.innerHTML = peerIds.length === 0
      ? `<div style="padding:16px;font-size:12px;color:var(--neu-secondary);text-align:center;">No directly linked cases.</div>`
      : '';
    peerIds.forEach((pid) => {
      const peer = graphState.nodes.find((n) => n.id === pid);
      if (!peer) return;
      const row = document.createElement('div');
      row.className = 'neu-link-item';
      row.innerHTML = `
        <div class="neu-link-left">
          <div class="neu-link-text">
            <span class="neu-link-title">${escapeHtml(peer.caseNumber)}</span>
            <span class="neu-link-sub">${escapeHtml(peer.incidentType.replace(/_/g, ' '))} • ${escapeHtml(peer.jurisdiction)}</span>
          </div>
        </div>
        <a href="/frontend/pages/case-detail.html?caseId=${encodeURIComponent(peer.id)}" class="neu-link-date" style="color:var(--neu-blue);text-decoration:none;">Open Case →</a>`;
      casesEl.appendChild(row);
    });
  }

  const evEl = document.getElementById('entity-evidence-list');
  const evTab = document.getElementById('tab-btn-evidence');
  const evs = c.evidenceSummary || [];
  if (evTab) evTab.textContent = `Evidence (${evs.length})`;
  if (evEl) {
    evEl.innerHTML = evs.length === 0
      ? `<div style="padding:16px;font-size:12px;color:var(--neu-secondary);text-align:center;">No evidence exhibits recorded for this case.</div>`
      : '';
    evs.forEach((ev) => {
      const row = document.createElement('div');
      row.className = 'neu-link-item';
      row.innerHTML = `
        <div class="neu-link-left">
          <div class="neu-link-text">
            <span class="neu-link-title">${escapeHtml(ev.fileName)}</span>
            <span class="neu-link-sub">${escapeHtml(ev.evidenceCategory)} • ${escapeHtml(ev.status)}</span>
          </div>
        </div>
        <a href="/frontend/pages/evidence.html" class="neu-link-date" style="color:var(--neu-blue);text-decoration:none;">Vault →</a>`;
      evEl.appendChild(row);
    });
  }

  const tlEl = document.getElementById('entity-timeline-list');
  const tl = c.timelineSummary || [];
  if (tlEl) {
    tlEl.innerHTML = tl.length === 0
      ? `<div style="padding:16px;font-size:12px;color:var(--neu-secondary);text-align:center;">No timeline events recorded for this case.</div>`
      : '';
    tl.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'neu-link-item';
      row.innerHTML = `
        <div class="neu-link-left">
          <div class="neu-link-text">
            <span class="neu-link-title">${escapeHtml(t.description)}</span>
            <span class="neu-link-sub">${escapeHtml(t.phase)} • ${new Date(t.timestamp).toLocaleString('en-IN')}</span>
          </div>
        </div>`;
      tlEl.appendChild(row);
    });
  }

  // Reset review tab prompt when a Case is selected
  const revInfo = document.getElementById('review-link-info');
  if (revInfo) revInfo.textContent = 'Select a connection line on the graph to review an EntityLink.';
}

function populateEdgeTabs(edge) {
  const revInfo = document.getElementById('review-link-info');
  const revStat = document.getElementById('review-current-status');
  const revRule = document.getElementById('review-match-rule');
  const revLim = document.getElementById('review-limitations');
  if (revInfo) revInfo.textContent = `Reviewing Link: ${edge.sourceCaseNumber} ↔ ${edge.targetCaseNumber} (${edge.entityType}: ${edge.maskedValue})`;
  if (revStat) revStat.textContent = edge.status;
  if (revRule) revRule.textContent = edge.matchRule;
  if (revLim) revLim.textContent = edge.limitations || 'None noted';

  const histEl = document.getElementById('link-decision-history-list');
  const histTab = document.getElementById('tab-btn-history');
  const revs = edge.reviews || [];
  if (histTab) histTab.textContent = `History (${revs.length})`;
  if (histEl) {
    histEl.innerHTML = revs.length === 0
      ? `<div style="font-size:12px;color:var(--neu-secondary);text-align:center;">No review decision history recorded for this link.</div>`
      : '';
    revs.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'neu-link-item';
      item.innerHTML = `
        <div class="neu-link-text">
          <span class="neu-link-title">${escapeHtml(r.fromStatus)} → ${escapeHtml(r.toStatus)} (${escapeHtml(r.reviewerName)})</span>
          <span class="neu-link-sub">${escapeHtml(r.rationale)} • ${new Date(r.reviewedAt).toLocaleString('en-IN')}</span>
        </div>`;
      histEl.appendChild(item);
    });
  }
}

// ─── Lower Panels ─────────────────────────────────────────────────────────────
function renderDonutChart() {
  const svg = document.getElementById('donut-svg');
  const totalEl = document.getElementById('donut-center-total');
  const legendEl = document.getElementById('donut-legend-container');
  if (!svg || !legendEl) return;

  const entries = Object.entries(graphState.entityTypeCounts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (totalEl) totalEl.textContent = String(total);

  svg.innerHTML = `<circle cx="50" cy="50" r="36" fill="transparent" stroke="#E2E8F0" stroke-width="16" />`;
  if (total === 0) {
    legendEl.innerHTML = `<div style="font-size:12px;color:var(--neu-secondary);">No entities in authorized scope.</div>`;
    return;
  }

  const circ = 2 * Math.PI * 36;
  let offset = 0;
  legendEl.innerHTML = '';

  entries.slice(0, 6).forEach(([type, count]) => {
    const color = ENTITY_COLORS[type] || ENTITY_COLORS.OTHER;
    const len = (count / total) * circ;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '36');
    c.setAttribute('fill', 'transparent');
    c.setAttribute('stroke', color);
    c.setAttribute('stroke-width', '16');
    c.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${circ.toFixed(1)}`);
    c.setAttribute('stroke-dashoffset', (-offset).toFixed(1));
    svg.appendChild(c);
    offset += len;

    const row = document.createElement('div');
    row.className = 'neu-legend-row';
    row.innerHTML = `
      <div class="neu-legend-left">
        <span class="neu-legend-dot" style="background-color:${color};"></span>
        <span>${escapeHtml(type)}</span>
      </div>
      <span class="neu-legend-pct">${Math.round((count / total) * 100)}% (${count})</span>`;
    legendEl.appendChild(row);
  });
}

function renderRecentLinks() {
  const container = document.getElementById('recent-links-container');
  if (!container) return;
  container.innerHTML = '';
  if (graphState.edges.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--neu-secondary);font-size:11.5px;">No cross-case EntityLink records match the current filters.</div>`;
    return;
  }
  graphState.edges.slice(0, 6).forEach((edge) => {
    const st = LINK_STATUS_STYLE[edge.status] || LINK_STATUS_STYLE.CANDIDATE;
    const item = document.createElement('div');
    item.className = 'neu-link-item';
    item.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-icon" style="background:${st.stroke}1A;color:${st.stroke};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </div>
        <div class="neu-link-text">
          <span class="neu-link-title">${escapeHtml(edge.sourceCaseNumber)} ↔ ${escapeHtml(edge.targetCaseNumber)}</span>
          <span class="neu-link-sub">${escapeHtml(edge.entityType)}: ${escapeHtml(edge.maskedValue)} • ${escapeHtml(edge.status)}</span>
        </div>
      </div>
      <span class="neu-link-date" style="color:${st.stroke};font-weight:700;font-size:10.5px;">${escapeHtml(edge.status)}</span>`;
    item.addEventListener('click', () => selectEdge(edge));
    container.appendChild(item);
  });
}

function renderCrossCaseInsights() {
  const container = document.getElementById('insights-container');
  if (!container) return;
  container.innerHTML = '';

  if (graphState.clusters.length === 0 && graphState.edges.length === 0) {
    container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--neu-secondary);font-size:12px;">No active syndicate clusters or cross-case links detected in authorized scope.</div>`;
    return;
  }

  graphState.clusters.slice(0, 4).forEach((cl) => {
    const item = document.createElement('div');
    item.className = 'neu-link-item';
    item.innerHTML = `
      <div class="neu-link-left">
        <div class="neu-link-text">
          <span class="neu-link-title">${escapeHtml(cl.name)}</span>
          <span class="neu-link-sub">${cl.memberCaseIds.length} member cases • ${escapeHtml(cl.confidence)} (${escapeHtml(cl.status)})</span>
        </div>
      </div>
      <span class="neu-link-date" style="color:#1E66CF;font-weight:600;font-size:11px;">Filter</span>`;
    item.addEventListener('click', async () => {
      graphState.filters.clusterId = cl.id;
      const sel = document.getElementById('select-cluster-filter');
      if (sel) sel.value = cl.id;
      await loadIntelligenceData();
      fitGraphToScreen();
      renderGraph();
    });
    container.appendChild(item);
  });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // Officer dropdown & logout
  const pill = document.getElementById('officer-profile-pill');
  const dropdown = document.getElementById('profile-dropdown');
  if (pill && dropdown) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  const logoutBtn = document.getElementById('btn-officer-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      try { localStorage.removeItem('rakshak_token'); } catch (_) {}
      window.location.href = '/frontend/pages/login.html';
    });
  }

  // Pan & Zoom
  const svgStage = document.getElementById('graph-svg-stage');
  if (svgStage) {
    svgStage.addEventListener('mousedown', (e) => {
      if (e.target.closest('.graph-node-group') || e.target.closest('.graph-edge-group')) return;
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
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      graphState.transform.scale = Math.min(2.5, Math.max(0.35, graphState.transform.scale * factor));
      renderGraph();
    });
  }

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    graphState.transform.scale = Math.min(2.5, graphState.transform.scale * 1.15);
    renderGraph();
  });
  document.getElementById('btn-graph-zoom-in-header')?.addEventListener('click', () => {
    graphState.transform.scale = Math.min(2.5, graphState.transform.scale * 1.15);
    renderGraph();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    graphState.transform.scale = Math.max(0.35, graphState.transform.scale * 0.85);
    renderGraph();
  });
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
    fitGraphToScreen();
    renderGraph();
    showToast('Graph fitted to viewport', 'info');
  });
  document.getElementById('btn-clear-selection')?.addEventListener('click', () => {
    graphState.selectedCaseId = null;
    graphState.selectedEdgeId = null;
    renderGraph();
  });

  // Fullscreen
  const btnFullscreen = document.getElementById('btn-graph-fullscreen');
  const graphPanel = document.getElementById('panel-relationship-graph');
  if (btnFullscreen && graphPanel) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) graphPanel.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    });
  }

  // Filters
  const applyFilters = async () => {
    const statusCbs = document.querySelectorAll('.neu-status-cb');
    graphState.filters.statuses = Array.from(statusCbs)
      .filter((cb) => cb.checked)
      .map((cb) => cb.getAttribute('data-status'));
    graphState.filters.includeGeneric = Boolean(document.getElementById('cb-include-generic')?.checked);
    graphState.filters.clusterId = document.getElementById('select-cluster-filter')?.value || 'ALL';
    graphState.filters.departmentId = document.getElementById('select-dept-filter')?.value || 'ALL';
    graphState.filters.incidentType = document.getElementById('select-incident-filter')?.value || 'ALL';
    graphState.filters.caseStatus = document.getElementById('select-casestatus-filter')?.value || 'ALL';
    graphState.filters.entityType = document.getElementById('select-entitytype-filter')?.value || 'ALL';
    graphState.filters.confidenceCategory = document.getElementById('select-confidence-filter')?.value || 'ALL';
    await loadIntelligenceData();
    fitGraphToScreen();
    renderGraph();
  };

  document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);
  document.getElementById('select-cluster-filter')?.addEventListener('change', applyFilters);
  document.getElementById('select-dept-filter')?.addEventListener('change', applyFilters);

  document.getElementById('btn-reset-filters')?.addEventListener('click', async () => {
    document.querySelectorAll('.neu-status-cb').forEach((cb) => {
      const st = cb.getAttribute('data-status');
      cb.checked = st === 'CONFIRMED' || st === 'UNDER_REVIEW' || st === 'CANDIDATE';
    });
    const genCb = document.getElementById('cb-include-generic');
    if (genCb) genCb.checked = false;
    ['select-cluster-filter', 'select-dept-filter', 'select-incident-filter', 'select-casestatus-filter', 'select-entitytype-filter', 'select-confidence-filter'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = 'ALL';
    });
    const searchEl = document.getElementById('global-search-input');
    if (searchEl) searchEl.value = '';
    graphState.filters.search = '';
    await applyFilters();
    showToast('Filters reset', 'info');
  });

  // Search
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        graphState.filters.search = globalSearchInput.value.trim();
        await loadIntelligenceData();
        fitGraphToScreen();
        renderGraph();
      }
    });
  }
  document.getElementById('btn-graph-search')?.addEventListener('click', () => globalSearchInput?.focus());

  // Tabs
  const tabBtns = document.querySelectorAll('.neu-tabs-nav .neu-tab-btn');
  const tabPanes = document.querySelectorAll('.neu-tab-content');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.getAttribute('data-tab'));
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Analyst Review Submission (POST /api/entities/links/:id/review)
  document.getElementById('btn-submit-review')?.addEventListener('click', async () => {
    if (!graphState.selectedEdgeId) {
      showToast('Select a connection edge on the graph first.', 'error');
      return;
    }
    const edge = graphState.edges.find((e) => e.id === graphState.selectedEdgeId);
    const toStatus = document.getElementById('review-decision-action')?.value;
    const rationale = (document.getElementById('review-rationale-text')?.value || '').trim();
    if (!rationale) {
      showToast('Mandatory review rationale is required.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/entities/links/${encodeURIComponent(edge.id)}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ toStatus, rationale, expectedVersion: edge.version }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body.error || 'Review submission failed.', 'error');
        return;
      }
      showToast(`Link transitioned to ${toStatus}`, 'success');
      document.getElementById('review-rationale-text').value = '';
      await loadIntelligenceData();
      renderGraph();
      const updated = graphState.edges.find((e) => e.id === edge.id);
      if (updated) selectEdge(updated);
    } catch (err) {
      showToast(`Review error: ${err.message}`, 'error');
    }
  });

  // Modals (Run Analysis, Export)
  document.getElementById('btn-run-analysis')?.addEventListener('click', () => {
    document.getElementById('modal-run-analysis')?.classList.add('show');
  });
  document.getElementById('btn-execute-analysis')?.addEventListener('click', async () => {
    document.getElementById('modal-run-analysis')?.classList.remove('show');
    showToast('Running entity resolution across authorized cases...', 'info');
    try {
      const targetCase = graphState.selectedCaseId || graphState.nodes[0]?.id;
      if (targetCase) {
        await fetch('/api/entities/resolve', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ caseId: targetCase }),
        });
      }
      await loadIntelligenceData();
      fitGraphToScreen();
      renderGraph();
      showToast('Cross-case graph refreshed from database', 'success');
    } catch (err) {
      showToast(`Resolution failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-export-results')?.addEventListener('click', () => {
    document.getElementById('modal-export-results')?.classList.add('show');
  });
  document.getElementById('btn-submit-export')?.addEventListener('click', () => {
    const format = document.getElementById('select-export-format')?.value || 'JSON';
    document.getElementById('modal-export-results')?.classList.remove('show');
    downloadExport(format);
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.neu-modal-backdrop').forEach((m) => m.classList.remove('show'));
    });
  });
}

function downloadExport(format) {
  if (format === 'JSON') {
    const payload = {
      project: 'Rakshak v3.0 Cross-Case Cross-Cluster Intelligence',
      generatedAt: new Date().toISOString(),
      summary: graphState.summary,
      nodes: graphState.nodes,
      edges: graphState.edges,
      clusters: graphState.clusters,
    };
    const url = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rakshak_cross_case_graph_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Graph JSON exported', 'success');
  } else if (format === 'SVG') {
    const svgEl = document.getElementById('graph-svg-stage');
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rakshak_cross_case_graph_${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Vector SVG exported', 'success');
    }
  } else {
    showToast(`Export prepared in ${format} format`, 'info');
  }
}
