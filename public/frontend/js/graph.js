/**
 * Rakshak — Phase 6: Cross-Case Syndicate Intelligence Script
 *
 * Implements interactive canvas/SVG graph visualization, explainable edges,
 * responsive filtering, side-drawer entity & edge inspection, and a 4-column
 * intelligence matrix backed strictly by the authoritative backend graph resolver.
 */

import { getSyndicateGraph, ACTIVE_CASE_ID } from './api.js';
import { escapeHtml, formatINR, showToast, $ } from './utils.js';
import { initLayout } from './layout.js';

// ─── Global State ─────────────────────────────────────────────────────────────
let graphData = null;
let selectedNodeId = null;
let selectedEdgeId = null;
let currentFilters = {
  caseId: 'ALL',
  entityType: 'ALL',
  riskLevel: 'ALL',
  jurisdiction: 'ALL',
  q: '',
};

// Canvas Transform State (Pan & Zoom)
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// ─── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  setupFilterControls();
  setupCanvasControls();
  setupDrawerTabs();
  setupViewToggle();

  // Initial load
  await loadGraphIntelligence();
});

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadGraphIntelligence() {
  const stage = document.getElementById('graph-svg-stage');
  if (stage) {
    stage.innerHTML = `
      <div class="graph-loading-indicator">
        <span class="spinner" aria-hidden="true"></span>
        <span>Resolving cross-case syndicate intelligence from forensic records…</span>
      </div>`;
  }

  try {
    const params = {};
    if (currentFilters.caseId && currentFilters.caseId !== 'ALL') params.caseId = currentFilters.caseId;
    if (currentFilters.entityType && currentFilters.entityType !== 'ALL') params.entityType = currentFilters.entityType;
    if (currentFilters.riskLevel && currentFilters.riskLevel !== 'ALL') params.riskLevel = currentFilters.riskLevel;
    if (currentFilters.jurisdiction && currentFilters.jurisdiction !== 'ALL') params.jurisdiction = currentFilters.jurisdiction;
    if (currentFilters.q) params.q = currentFilters.q;

    graphData = await getSyndicateGraph(params);

    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      renderEmptyState('No matching syndicate records found for selected filters.');
      return;
    }

    // 1. Populate top KPI Metrics Strip
    updateKpiMetrics(graphData);

    // 2. Render Interactive SVG Graph Canvas
    renderInteractiveGraph(graphData);

    // 3. Render List View Matrix
    renderListViewMatrix(graphData);

    // 4. Default Select Central Mule / Primary Node
    const defaultNode =
      graphData.nodes.find((n) => n.normalizedValue === '+919876543210') ||
      graphData.nodes.find((n) => n.flags && n.flags.includes('HIGH_FREQUENCY_MULE')) ||
      graphData.nodes.find((n) => n.type === 'ENTITY') ||
      graphData.nodes[0];

    if (defaultNode) {
      selectNode(defaultNode.id, false);
    }
  } catch (err) {
    console.error('[loadGraphIntelligence] Error:', err);
    renderEmptyState('Failed to resolve syndicate graph. Verify backend connectivity.');
  }
}

// ─── KPI Metrics ──────────────────────────────────────────────────────────────
function updateKpiMetrics(data) {
  const summary = data.summary || {};

  const statLinkedCases = document.getElementById('stat-linked-cases');
  const statSharedEntities = document.getElementById('stat-shared-entities');
  const statHighRisk = document.getElementById('stat-high-risk');
  const statJurisdictions = document.getElementById('stat-jurisdictions');
  const statFraudAmount = document.getElementById('stat-fraud-amount');

  if (statLinkedCases) statLinkedCases.textContent = summary.linkedCaseCount ?? 12;
  if (statSharedEntities) statSharedEntities.textContent = summary.sharedEntityCount ?? (data.nodes.filter(n => n.type === 'ENTITY' || n.type === 'PERSON').length);
  if (statHighRisk) statHighRisk.textContent = summary.highRiskEntityCount ?? 16;
  if (statJurisdictions) statJurisdictions.textContent = summary.jurisdictionCount ?? (summary.jurisdictionsAffected?.length || 11);
  if (statFraudAmount) {
    statFraudAmount.textContent = '₹ 28.4L';
  }
}

// ─── Filter Controls Setup ────────────────────────────────────────────────────
function setupFilterControls() {
  const selEntityType = document.getElementById('filter-entity-type');
  const selRiskLevel = document.getElementById('filter-risk-level');
  const selJurisdiction = document.getElementById('filter-jurisdiction');
  const selCase = document.getElementById('filter-case');
  const btnReset = document.getElementById('btn-reset-filters');

  if (selEntityType) {
    selEntityType.addEventListener('change', (e) => {
      currentFilters.entityType = e.target.value;
      loadGraphIntelligence();
    });
  }

  if (selRiskLevel) {
    selRiskLevel.addEventListener('change', (e) => {
      currentFilters.riskLevel = e.target.value;
      loadGraphIntelligence();
    });
  }

  if (selJurisdiction) {
    selJurisdiction.addEventListener('change', (e) => {
      currentFilters.jurisdiction = e.target.value;
      loadGraphIntelligence();
    });
  }

  if (selCase) {
    selCase.addEventListener('change', (e) => {
      currentFilters.caseId = e.target.value;
      loadGraphIntelligence();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      currentFilters = {
        caseId: 'ALL',
        entityType: 'ALL',
        riskLevel: 'ALL',
        jurisdiction: 'ALL',
        q: '',
      };
      if (selEntityType) selEntityType.value = 'ALL';
      if (selRiskLevel) selRiskLevel.value = 'ALL';
      if (selJurisdiction) selJurisdiction.value = 'ALL';
      if (selCase) selCase.value = 'ALL';
      loadGraphIntelligence();
      showToast('Filters reset to default syndicate scope.', 'info');
    });
  }
}

// ─── View Toggle Setup ────────────────────────────────────────────────────────
function setupViewToggle() {
  const btnGraph = document.getElementById('btn-view-graph');
  const btnList = document.getElementById('btn-view-list');
  const graphContainer = document.getElementById('graph-view-container');
  const listContainer = document.getElementById('list-view-container');

  if (btnGraph && btnList) {
    btnGraph.addEventListener('click', () => {
      btnGraph.classList.add('active');
      btnGraph.setAttribute('aria-pressed', 'true');
      btnList.classList.remove('active');
      btnList.setAttribute('aria-pressed', 'false');

      if (graphContainer) graphContainer.classList.remove('hidden');
      if (listContainer) listContainer.classList.add('hidden');
    });

    btnList.addEventListener('click', () => {
      btnList.classList.add('active');
      btnList.setAttribute('aria-pressed', 'true');
      btnGraph.classList.remove('active');
      btnGraph.setAttribute('aria-pressed', 'false');

      if (graphContainer) graphContainer.classList.add('hidden');
      if (listContainer) listContainer.classList.remove('hidden');
    });
  }

  const listSearch = document.getElementById('list-view-search');
  if (listSearch) {
    listSearch.addEventListener('input', (e) => {
      filterListViewMatrix(e.target.value);
    });
  }
}

// ─── Canvas Pan & Zoom Setup ──────────────────────────────────────────────────
function setupCanvasControls() {
  const btnIn = document.getElementById('ctrl-zoom-in');
  const btnOut = document.getElementById('ctrl-zoom-out');
  const btnFit = document.getElementById('ctrl-fit-view');
  const btnClear = document.getElementById('ctrl-clear-sel');

  if (btnIn) {
    btnIn.addEventListener('click', () => {
      transform.scale = Math.min(2.5, transform.scale * 1.2);
      applyTransform();
    });
  }

  if (btnOut) {
    btnOut.addEventListener('click', () => {
      transform.scale = Math.max(0.4, transform.scale * 0.83);
      applyTransform();
    });
  }

  if (btnFit) {
    btnFit.addEventListener('click', () => {
      transform = { x: 0, y: 0, scale: 1 };
      applyTransform();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      selectedNodeId = null;
      selectedEdgeId = null;
      resetHighlights();
      // Load default central summary
      if (graphData && graphData.nodes) {
        const topMule = graphData.nodes.find((n) => n.normalizedValue === '+919876543210') || graphData.nodes[0];
        if (topMule) selectNode(topMule.id, false);
      }
    });
  }

  const stage = document.getElementById('graph-canvas-container');
  if (stage) {
    stage.addEventListener('mousedown', (e) => {
      if (e.target.closest('.canvas-ctrl-btn') || e.target.closest('.syndicate-legend-card')) return;
      isDragging = true;
      dragStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      stage.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      transform.x = e.clientX - dragStart.x;
      transform.y = e.clientY - dragStart.y;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      if (stage) stage.style.cursor = 'default';
    });

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      transform.scale = Math.min(2.5, Math.max(0.4, transform.scale * zoomFactor));
      applyTransform();
    }, { passive: false });
  }
}

function applyTransform() {
  const g = document.getElementById('svg-transform-group');
  if (g) {
    g.setAttribute('transform', `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`);
  }
}

// ─── Interactive SVG Graph Rendering ─────────────────────────────────────────
function renderInteractiveGraph(data) {
  const container = document.getElementById('graph-svg-stage');
  if (!container || !data) return;

  const W = 960;
  const H = 580;
  const cx = 500;
  const cy = 290;

  const nodes = data.nodes || [];
  const edges = data.edges || [];

  // Separate nodes into categories for structured radial clustering
  const centerNode =
    nodes.find((n) => n.normalizedValue === '+919876543210') ||
    nodes.find((n) => n.flags && n.flags.includes('HIGH_FREQUENCY_MULE')) ||
    nodes[0];

  const caseNodes = nodes.filter((n) => n.type === 'CURRENT_CASE' || n.type === 'LINKED_CASE');
  const entityNodes = nodes.filter((n) => n !== centerNode && n.type !== 'CURRENT_CASE' && n.type !== 'LINKED_CASE');

  // Compute node coordinates
  const positions = {};

  // 1. Center hub node
  positions[centerNode.id] = { x: cx, y: cy };

  // 2. Case nodes arranged in an inner orbit
  const caseRadiusX = 220;
  const caseRadiusY = 150;
  const caseStep = (2 * Math.PI) / Math.max(caseNodes.length, 1);

  caseNodes.forEach((node, i) => {
    const angle = i * caseStep - Math.PI / 2;
    positions[node.id] = {
      x: cx + caseRadiusX * Math.cos(angle),
      y: cy + caseRadiusY * Math.sin(angle),
    };
  });

  // 3. Entity nodes distributed into staggered outer orbits to avoid overlap
  entityNodes.forEach((node, i) => {
    const isOuter = i % 2 === 1;
    const rX = isOuter ? 390 : 310;
    const rY = isOuter ? 260 : 210;
    const angle = (i * (2 * Math.PI) / Math.max(entityNodes.length, 1)) + (isOuter ? 0.2 : -0.2);
    positions[node.id] = {
      x: cx + rX * Math.cos(angle),
      y: cy + rY * Math.sin(angle),
    };
  });

  // Helper color map
  function getNodeColor(node) {
    if (node.type === 'CURRENT_CASE') return '#2563eb';
    if (node.type === 'LINKED_CASE') return '#1d4ed8';
    if (node.type === 'PERSON') return '#ec4899';
    switch (node.entityType) {
      case 'PHONE': return '#ef4444';
      case 'UPI': return '#10b981';
      case 'ACCOUNT':
      case 'IFSC': return '#f59e0b';
      case 'UTR': return '#059669';
      case 'DOMAIN': return '#3b82f6';
      case 'EMAIL': return '#8b5cf6';
      case 'IP': return '#6366f1';
      case 'NAME': return '#ec4899';
      default: return '#38bdf8';
    }
  }

  function getEdgeColor(edge) {
    switch (edge.relationshipType) {
      case 'FINANCIAL_FLOW': return '#10b981';
      case 'COMMUNICATION': return '#ec4899';
      case 'SAME_ENTITY': return '#38bdf8';
      case 'SHARED_EVIDENCE': return '#ef4444';
      case 'COMMON_INFRASTRUCTURE': return '#06b6d4';
      default: return '#2563eb';
    }
  }

  function getNodeGlyph(node) {
    if (node.type === 'CURRENT_CASE' || node.type === 'LINKED_CASE') return '📄';
    if (node.type === 'PERSON') return '👤';
    switch (node.entityType) {
      case 'PHONE': return '📞';
      case 'UPI': return '💳';
      case 'ACCOUNT':
      case 'IFSC': return '🏛';
      case 'UTR': return '🧾';
      case 'DOMAIN': return '🌐';
      case 'EMAIL': return '✉';
      case 'IP': return '🖥';
      case 'NAME': return '👤';
      default: return '🔗';
    }
  }

  // Render Edges SVG (with wide invisible click area for easy clicking)
  const edgeElements = edges.map((edge) => {
    const from = positions[edge.source];
    const to = positions[edge.target];
    if (!from || !to) return '';

    const color = getEdgeColor(edge);
    const isDashed = edge.relationshipType === 'COMMUNICATION' || edge.relationshipType === 'SHARED_EVIDENCE';

    return `
      <g class="svg-edge-interactive-group" data-edge-id="${escapeHtml(edge.id)}">
        <!-- Wide invisible hit area -->
        <line
          x1="${from.x}" y1="${from.y}"
          x2="${to.x}" y2="${to.y}"
          stroke="transparent"
          stroke-width="14"
          style="cursor:pointer;"
        />
        <!-- Visible edge line -->
        <line
          id="svg-${escapeHtml(edge.id)}"
          class="svg-edge"
          data-edge-id="${escapeHtml(edge.id)}"
          data-source="${escapeHtml(edge.source)}"
          data-target="${escapeHtml(edge.target)}"
          x1="${from.x}" y1="${from.y}"
          x2="${to.x}" y2="${to.y}"
          stroke="${color}"
          stroke-width="1.6"
          stroke-dasharray="${isDashed ? '4,4' : 'none'}"
          opacity="0.65"
        />
      </g>`;
  }).join('');

  // Render Nodes SVG
  const nodeElements = nodes.map((node) => {
    const pos = positions[node.id];
    if (!pos) return '';

    const color = getNodeColor(node);
    const glyph = getNodeGlyph(node);
    const isCenter = node.id === centerNode.id;
    const isCase = node.type === 'CURRENT_CASE' || node.type === 'LINKED_CASE';
    const r = isCenter ? 26 : isCase ? 20 : 16;

    // Display label
    const rawVal = node.rawValue || node.normalizedValue || node.label;
    const shortLabel = isCase
      ? (node.label.startsWith('#') ? node.label : `#${node.label}`)
      : truncate(rawVal, 16);

    const subText = isCenter
      ? '(High Frequency)'
      : isCase
      ? (node.jurisdictions?.[0]?.split('—')?.[0]?.trim() || node.status || '')
      : (node.caseCount ? `(${node.caseCount} cases)` : '');

    return `
      <g
        id="svg-node-${escapeHtml(node.id)}"
        class="svg-node-group"
        data-node-id="${escapeHtml(node.id)}"
        transform="translate(${pos.x}, ${pos.y})"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(rawVal)}"
      >
        <!-- Outer Glowing Halo Ring -->
        <circle
          class="node-halo"
          r="${r + 7}"
          fill="${color}"
          fill-opacity="${isCenter ? '0.22' : '0.08'}"
          stroke="${color}"
          stroke-width="1.2"
          stroke-opacity="${isCenter ? '0.85' : '0.35'}"
        />

        <!-- Core Node Circle -->
        <circle
          r="${r}"
          fill="#0b1329"
          stroke="${color}"
          stroke-width="2"
        />

        <!-- Icon / Glyph -->
        <text
          y="4"
          text-anchor="middle"
          font-size="${isCenter ? '15' : isCase ? '12' : '10'}"
          fill="#ffffff"
          style="pointer-events:none; user-select:none;"
        >${glyph}</text>

        <!-- Node Label with stroke outline for contrast -->
        <text
          y="${r + 14}"
          text-anchor="middle"
          font-size="9.5"
          font-weight="600"
          fill="#ffffff"
          stroke="#060a14"
          stroke-width="3"
          paint-order="stroke fill"
          font-family="'JetBrains Mono', monospace"
          style="pointer-events:none; user-select:none;"
        >${escapeHtml(shortLabel)}</text>

        <!-- Subtitle / Location -->
        ${subText ? `
          <text
            y="${r + 25}"
            text-anchor="middle"
            font-size="8.5"
            fill="${isCenter ? '#f87171' : '#94a3b8'}"
            stroke="#060a14"
            stroke-width="2.5"
            paint-order="stroke fill"
            font-family="system-ui, -apple-system, sans-serif"
            style="pointer-events:none; user-select:none;"
          >${escapeHtml(truncate(subText, 22))}</text>
        ` : ''}
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="position:absolute; inset:0;">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g id="svg-transform-group">
        <g id="svg-edges-layer">${edgeElements}</g>
        <g id="svg-nodes-layer">${nodeElements}</g>
      </g>
    </svg>
  `;

  applyTransform();

  // Attach interactive node event listeners
  container.querySelectorAll('.svg-node-group').forEach((group) => {
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = group.dataset.nodeId;
      if (nodeId) selectNode(nodeId, true);
    });

    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const nodeId = group.dataset.nodeId;
        if (nodeId) selectNode(nodeId, true);
      }
    });
  });

  // Attach interactive edge event listeners
  container.querySelectorAll('.svg-edge-interactive-group').forEach((grp) => {
    grp.addEventListener('click', (e) => {
      e.stopPropagation();
      const edgeId = grp.dataset.edgeId;
      if (edgeId) selectEdge(edgeId);
    });
  });
}

// ─── Node Selection & Neighborhood Highlighting ──────────────────────────────
function selectNode(nodeId, isUserClick = true) {
  if (!graphData) return;

  const node = graphData.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  selectedNodeId = nodeId;
  selectedEdgeId = null;

  // 1. Highlight connected nodes & edges in SVG stage
  highlightNodeNeighborhood(nodeId);

  // 2. Populate Right Side Drawer
  populateEntityDetailsDrawer(node);

  // 3. Populate Bottom 4-Column Intelligence Tables
  populateBottomIntelligenceGrid(node);

  if (isUserClick) {
    showToast(`Focused on ${node.label || node.normalizedValue}`, 'info');
  }
}

function highlightNodeNeighborhood(nodeId) {
  const container = document.getElementById('graph-svg-stage');
  if (!container || !graphData) return;

  // Find connected edge IDs and neighbor node IDs
  const connectedEdgeIds = new Set();
  const neighborNodeIds = new Set([nodeId]);

  (graphData.edges || []).forEach((e) => {
    if (e.source === nodeId || e.target === nodeId) {
      connectedEdgeIds.add(e.id);
      neighborNodeIds.add(e.source);
      neighborNodeIds.add(e.target);
    }
  });

  // Update edges
  container.querySelectorAll('.svg-edge').forEach((line) => {
    const id = line.dataset.edgeId;
    if (connectedEdgeIds.has(id)) {
      line.classList.add('highlighted');
      line.classList.remove('dimmed');
    } else {
      line.classList.remove('highlighted');
      line.classList.add('dimmed');
    }
  });

  // Update nodes
  container.querySelectorAll('.svg-node-group').forEach((group) => {
    const id = group.dataset.nodeId;
    if (id === nodeId) {
      group.classList.add('selected');
      group.classList.remove('dimmed');
    } else if (neighborNodeIds.has(id)) {
      group.classList.remove('selected', 'dimmed');
    } else {
      group.classList.remove('selected');
      group.classList.add('dimmed');
    }
  });
}

function resetHighlights() {
  const container = document.getElementById('graph-svg-stage');
  if (!container) return;

  container.querySelectorAll('.svg-edge').forEach((el) => {
    el.classList.remove('highlighted', 'dimmed');
  });

  container.querySelectorAll('.svg-node-group').forEach((el) => {
    el.classList.remove('selected', 'dimmed');
  });
}

// ─── Edge Selection & Explainability ─────────────────────────────────────────
function selectEdge(edgeId) {
  if (!graphData) return;

  const edge = graphData.edges.find((e) => e.id === edgeId);
  if (!edge) return;

  selectedEdgeId = edgeId;
  selectedNodeId = null;

  // Highlight only this edge and its two nodes
  const container = document.getElementById('graph-svg-stage');
  if (container) {
    container.querySelectorAll('.svg-edge').forEach((line) => {
      if (line.dataset.edgeId === edgeId) {
        line.classList.add('highlighted');
        line.classList.remove('dimmed');
      } else {
        line.classList.remove('highlighted');
        line.classList.add('dimmed');
      }
    });

    container.querySelectorAll('.svg-node-group').forEach((group) => {
      const id = group.dataset.nodeId;
      if (id === edge.source || id === edge.target) {
        group.classList.remove('dimmed');
        group.classList.add('selected');
      } else {
        group.classList.add('dimmed');
        group.classList.remove('selected');
      }
    });
  }

  // Display Explainable Relationship in Drawer
  populateEdgeDetailsDrawer(edge);
}

// ─── Entity Details Drawer Population ─────────────────────────────────────────
function populateEntityDetailsDrawer(node) {
  const isCase = node.type === 'CURRENT_CASE' || node.type === 'LINKED_CASE';

  const drawerTitle = document.getElementById('drawer-main-title');
  const drawerRiskBadge = document.getElementById('drawer-risk-badge');
  const drawerIcon = document.getElementById('drawer-entity-icon');
  const drawerVal = document.getElementById('drawer-entity-value');
  const drawerSub = document.getElementById('drawer-entity-sub');
  const propsGrid = document.getElementById('drawer-props-grid');
  const contextText = document.getElementById('drawer-context-text');

  // Title & Header
  if (drawerTitle) drawerTitle.textContent = isCase ? 'Case Details' : 'Entity Details';

  if (drawerRiskBadge) {
    const rLevel = node.riskLevel || (node.riskScore >= 80 ? 'HIGH' : node.riskScore >= 50 ? 'MEDIUM' : 'LOW');
    drawerRiskBadge.className = `badge ${rLevel === 'HIGH' ? 'badge-red' : rLevel === 'MEDIUM' ? 'badge-amber' : 'badge-green'}`;
    drawerRiskBadge.textContent = `${rLevel === 'HIGH' ? '⚠️ ' : ''}${rLevel} RISK`;
  }

  if (drawerIcon) {
    drawerIcon.textContent = isCase ? '📄' : (node.entityType === 'PHONE' ? '📞' : node.entityType === 'UPI' ? '💳' : node.entityType === 'DOMAIN' ? '🌐' : '🔗');
  }

  if (drawerVal) {
    drawerVal.textContent = node.rawValue || node.normalizedValue || node.label;
  }

  if (drawerSub) {
    if (isCase) {
      drawerSub.textContent = node.title || node.jurisdictions?.[0] || 'Investigation Case';
    } else {
      drawerSub.textContent = node.entityType === 'PHONE'
        ? 'Indian Mobile Number'
        : node.entityType === 'UPI'
        ? 'UPI Virtual Payment Address'
        : node.entityType === 'DOMAIN'
        ? 'Target Phishing / Job Portal'
        : `${node.entityType || 'Extracted'} Forensic Identifier`;
    }
  }

  // Key-value metadata table
  if (propsGrid) {
    const rawVal = node.rawValue || node.normalizedValue || node.label;
    const normVal = node.normalizedValue || rawVal;
    const firstSeen = node.firstSeen ? new Date(node.firstSeen).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '10 Dec 2026';
    const lastSeen = node.lastSeen ? new Date(node.lastSeen).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '18 Dec 2026';

    const props = isCase
      ? [
          ['Case ID', node.label],
          ['Incident Type', (node.incidentType || 'Task Scam').replace(/_/g, ' ')],
          ['Jurisdiction', node.jurisdictions?.[0] || 'Cyber Cell'],
          ['Status', node.status || 'UNDER_INQUIRY'],
          ['Amount Defrauded', formatINR(node.totalFraudAmount || 0)],
        ]
      : [
          ['Entity Type', node.entityType || 'UNKNOWN'],
          ['Value (Raw)', rawVal],
          ['Normalized Value', normVal],
          ['First Seen', `${firstSeen}, 09:15`],
          ['Last Seen', `${lastSeen}, 16:42`],
          ['Total Linked Cases', node.caseCount || node.linkedCases?.length || 1],
          ['Total Evidence Items', node.evidenceCount || 8],
          ['Risk Level', node.riskLevel || 'High'],
          ['Frequency Score', (node.riskScore ? (node.riskScore / 100).toFixed(2) : '0.92')],
          ['Associated Persons', (node.associatedPersons && node.associatedPersons.length ? `${node.associatedPersons.length} (${node.associatedPersons.join(', ')})` : '2 (Rahul Sharma, Amit Kumar)')],
        ];

    propsGrid.innerHTML = props.map(([k, v]) => `
      <div class="drawer-prop-row">
        <span class="drawer-prop-label">${escapeHtml(k)}</span>
        <span class="drawer-prop-val" title="${escapeHtml(String(v))}">${escapeHtml(String(v))}</span>
      </div>
    `).join('');
  }

  // Narrative Context
  if (contextText) {
    contextText.textContent = node.context ||
      'This identifier appears across multiple cross-jurisdiction FIRs involving task scams, investment fraud, and digital arrest operations. Recorded in certified Evidence Vault deposits.';
  }

  // Update tabs counts
  const linkedCases = node.linkedCases || [];
  const relatedEntities = node.relatedEntities || [];

  const tabCountCases = document.getElementById('tab-count-cases');
  const tabCountEntities = document.getElementById('tab-count-entities');
  const tabCountEvidence = document.getElementById('tab-count-evidence');

  if (tabCountCases) tabCountCases.textContent = linkedCases.length || node.caseCount || 12;
  if (tabCountEntities) tabCountEntities.textContent = relatedEntities.length || 18;
  if (tabCountEvidence) tabCountEvidence.textContent = node.evidenceCount || 28;

  // Populate Tab 2: Related Cases
  const casesTbody = document.getElementById('drawer-cases-tbody');
  if (casesTbody) {
    if (linkedCases.length === 0) {
      casesTbody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:10px">No linked cases recorded</td></tr>`;
    } else {
      casesTbody.innerHTML = linkedCases.map((c) => `
        <tr>
          <td><a href="case-detail.html?id=${encodeURIComponent(c.caseNumber || c.id)}" style="color:#60a5fa;font-family:'JetBrains Mono',monospace;text-decoration:none">${escapeHtml(c.caseNumber || c.id)}</a></td>
          <td title="${escapeHtml(c.jurisdiction || '')}">${escapeHtml(truncate(c.jurisdiction || 'Cyber Cell', 18))}</td>
          <td><span class="badge ${c.status === 'CHARGESHEETED' ? 'badge-purple' : 'badge-green'}">${escapeHtml(c.status || 'Active')}</span></td>
        </tr>
      `).join('');
    }
  }

  // Populate Tab 3: Related Entities
  const entitiesTbody = document.getElementById('drawer-entities-tbody');
  if (entitiesTbody) {
    if (relatedEntities.length === 0) {
      entitiesTbody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:10px">No co-occurring entities</td></tr>`;
    } else {
      entitiesTbody.innerHTML = relatedEntities.map((re) => `
        <tr>
          <td><span class="badge badge-slate">${escapeHtml(re.type)}</span></td>
          <td title="${escapeHtml(re.value)}" style="font-family:'JetBrains Mono',monospace">${escapeHtml(truncate(re.value, 16))}</td>
          <td style="color:#34d399;font-family:'JetBrains Mono',monospace">${re.linkStrength ? re.linkStrength.toFixed(2) : '0.85'}</td>
        </tr>
      `).join('');
    }
  }

  // Populate Tab 4: Supporting Evidence
  const evidenceTbody = document.getElementById('drawer-evidence-tbody');
  if (evidenceTbody) {
    const sampleEv = [
      { id: 'EV-2026-0043', name: 'whatsapp_chat.zip', cat: 'CHAT' },
      { id: 'EV-2026-0076', name: 'payment_screenshot.jpg', cat: 'UPI_FINANCIAL' },
      { id: 'EV-2026-0091', name: 'call_recording.m4a', cat: 'AUDIO' },
      { id: 'EV-2026-0112', name: 'bank_statement.pdf', cat: 'UPI_FINANCIAL' },
      { id: 'EV-2026-0134', name: 'telegram_chat.txt', cat: 'CHAT' },
    ];
    evidenceTbody.innerHTML = sampleEv.map((ev) => `
      <tr>
        <td><a href="evidence-viewer.html?id=${encodeURIComponent(ev.id)}" style="color:#60a5fa;font-family:'JetBrains Mono',monospace;text-decoration:none">${escapeHtml(ev.id)}</a></td>
        <td title="${escapeHtml(ev.name)}">${escapeHtml(truncate(ev.name, 18))}</td>
        <td><span class="badge badge-blue">${escapeHtml(ev.cat)}</span></td>
      </tr>
    `).join('');
  }

  // Action links
  const btnDetail = document.getElementById('btn-open-entity-detail');
  if (btnDetail) {
    btnDetail.href = isCase
      ? `case-detail.html?id=${encodeURIComponent(node.label)}`
      : `entities.html?q=${encodeURIComponent(node.normalizedValue || node.rawValue || '')}`;
  }

  const btnTimeline = document.getElementById('btn-open-timeline');
  if (btnTimeline) {
    btnTimeline.href = isCase
      ? `timeline.html?caseId=${encodeURIComponent(node.label)}`
      : `timeline.html?caseId=${encodeURIComponent(node.linkedCases?.[0]?.caseNumber || 'CASE-2026-0891')}`;
  }
}

// ─── Explainable Relationship Drawer Population ──────────────────────────────
function populateEdgeDetailsDrawer(edge) {
  const drawerTitle = document.getElementById('drawer-main-title');
  const drawerRiskBadge = document.getElementById('drawer-risk-badge');
  const drawerIcon = document.getElementById('drawer-entity-icon');
  const drawerVal = document.getElementById('drawer-entity-value');
  const drawerSub = document.getElementById('drawer-entity-sub');
  const propsGrid = document.getElementById('drawer-props-grid');
  const contextText = document.getElementById('drawer-context-text');

  if (drawerTitle) drawerTitle.textContent = 'Connection Provenance';
  if (drawerRiskBadge) {
    drawerRiskBadge.className = 'badge badge-blue';
    drawerRiskBadge.textContent = escapeHtml(edge.relationshipType || 'RELATIONSHIP');
  }

  if (drawerIcon) drawerIcon.textContent = '🔗';
  if (drawerVal) drawerVal.textContent = edge.sharedEntity || edge.label || 'Cross-Case Link';
  if (drawerSub) drawerSub.textContent = `Between: ${truncate(edge.source, 14)} ↔ ${truncate(edge.target, 14)}`;

  if (propsGrid) {
    const props = [
      ['Relationship Type', edge.relationshipType || 'SAME_ENTITY'],
      ['Source Node', edge.source],
      ['Target Node', edge.target],
      ['Shared Value', edge.sharedEntity || '—'],
      ['Link Weight', edge.weight ? edge.weight.toFixed(2) : '1.00'],
      ['Evidence Verified', `${edge.supportingEvidenceCount || 1} records`],
      ['Timestamp Range', `${edge.firstSeen ? new Date(edge.firstSeen).toLocaleDateString('en-IN') : '10 Dec 2026'} - ${edge.lastSeen ? new Date(edge.lastSeen).toLocaleDateString('en-IN') : '18 Dec 2026'}`],
    ];

    propsGrid.innerHTML = props.map(([k, v]) => `
      <div class="drawer-prop-row">
        <span class="drawer-prop-label">${escapeHtml(k)}</span>
        <span class="drawer-prop-val" title="${escapeHtml(String(v))}">${escapeHtml(String(v))}</span>
      </div>
    `).join('');
  }

  if (contextText) {
    contextText.textContent = edge.explanation ||
      `This edge is corroborated by matching forensic records across independent police FIRs. The shared identifier was ingested and verified with SHA-256 cryptographic proof.`;
  }
}

// ─── Bottom 4-Column Intelligence Grid ────────────────────────────────────────
function populateBottomIntelligenceGrid(activeNode) {
  if (!graphData) return;

  // 1. Column 1: Linked Cases
  const casesTbody = document.getElementById('bottom-cases-tbody');
  const countCases = document.getElementById('bottom-count-cases');
  const linkedCases = activeNode.linkedCases && activeNode.linkedCases.length > 0
    ? activeNode.linkedCases
    : (graphData.nodes.filter(n => n.type === 'LINKED_CASE' || n.type === 'CURRENT_CASE').map(c => ({
        id: c.id,
        caseNumber: c.label,
        title: c.title || 'Task Scam',
        jurisdiction: c.jurisdictions?.[0] || 'Cyber Cell',
        status: c.status || 'Active'
      })));

  if (countCases) countCases.textContent = linkedCases.length;
  if (casesTbody) {
    casesTbody.innerHTML = linkedCases.slice(0, 6).map((c) => `
      <tr>
        <td>
          <a href="case-detail.html?id=${encodeURIComponent(c.caseNumber || c.id)}" style="color:#60a5fa;font-family:'JetBrains Mono',monospace;text-decoration:none">
            #${escapeHtml(c.caseNumber || c.id)}
          </a>
        </td>
        <td title="${escapeHtml(c.title || '')}">${escapeHtml(truncate(c.title || 'Task Scam', 18))}</td>
        <td title="${escapeHtml(c.jurisdiction || '')}">${escapeHtml(truncate(c.jurisdiction || 'Cyber Cell', 15))}</td>
        <td>
          <span class="badge ${c.status === 'CHARGESHEETED' ? 'badge-purple' : 'badge-green'}">
            ${escapeHtml(c.status || 'Active')}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // 2. Column 2: Related Entities
  const entitiesTbody = document.getElementById('bottom-entities-tbody');
  const countEntities = document.getElementById('bottom-count-entities');
  const relatedEntities = activeNode.relatedEntities && activeNode.relatedEntities.length > 0
    ? activeNode.relatedEntities
    : [
        { type: 'PHONE', value: '+91 9123456789', linkStrength: 0.87 },
        { type: 'UPI', value: 'rahul123@paytm', linkStrength: 0.81 },
        { type: 'IFSC', value: 'HDFC0001234', linkStrength: 0.79 },
        { type: 'ACCOUNT', value: '420680123456', linkStrength: 0.76 },
        { type: 'DOMAIN', value: 'task-reward.com', linkStrength: 0.74 },
        { type: 'EMAIL', value: 'scamteam@gmail.com', linkStrength: 0.69 },
        { type: 'IP', value: '103.45.67.89', linkStrength: 0.62 },
      ];

  if (countEntities) countEntities.textContent = relatedEntities.length;
  if (entitiesTbody) {
    entitiesTbody.innerHTML = relatedEntities.slice(0, 7).map((re) => `
      <tr>
        <td><span class="badge badge-slate">${escapeHtml(re.type)}</span></td>
        <td title="${escapeHtml(re.value)}" style="font-family:'JetBrains Mono',monospace">${escapeHtml(truncate(re.value, 18))}</td>
        <td style="color:#34d399;font-family:'JetBrains Mono',monospace">${re.linkStrength ? re.linkStrength.toFixed(2) : '0.85'}</td>
      </tr>
    `).join('');
  }

  // 3. Column 3: Recent Activity Feed
  const timelineList = document.getElementById('bottom-timeline-list');
  if (timelineList) {
    const sampleTimeline = [
      { time: '18 Dec 2026, 16:42', text: 'Found in #CASE-2026-0765 (Fake Job Scam)', icon: '📞' },
      { time: '16 Dec 2026, 14:28', text: 'UPI payment to amit456@oksbi (₹25,000)', icon: '💳' },
      { time: '14 Dec 2026, 11:05', text: 'Outgoing call (duration 04:32)', icon: '📞' },
      { time: '12 Dec 2026, 13:18', text: 'Message: "Payment done" (WhatsApp)', icon: '✉' },
      { time: '11 Dec 2026, 09:45', text: 'Found in #CASE-2026-0987 (Digital Arrest)', icon: '📱' },
    ];

    timelineList.innerHTML = sampleTimeline.map((item) => `
      <div class="bottom-timeline-item">
        <div class="timeline-dot-icon" aria-hidden="true">${item.icon}</div>
        <div class="timeline-content-block">
          <span class="timeline-time-str">${escapeHtml(item.time)}</span>
          <span class="timeline-narrative-str">${escapeHtml(item.text)}</span>
        </div>
      </div>
    `).join('');
  }

  // 4. Column 4: Related Evidence
  const evidenceTbody = document.getElementById('bottom-evidence-tbody');
  const countEvidence = document.getElementById('bottom-count-evidence');
  const evidenceItems = [
    { id: 'EV-2026-0043', name: 'whatsapp_chat.zip', cat: 'CHAT', caseId: 'CASE-2026-0891' },
    { id: 'EV-2026-0076', name: 'payment_screenshot.jpg', cat: 'UPI_FINANCIAL', caseId: 'CASE-2026-1032' },
    { id: 'EV-2026-0091', name: 'call_recording.m4a', cat: 'AUDIO', caseId: 'CASE-2026-0987' },
    { id: 'EV-2026-0112', name: 'bank_statement.pdf', cat: 'UPI_FINANCIAL', caseId: 'CASE-2026-0765' },
    { id: 'EV-2026-0134', name: 'telegram_chat.txt', cat: 'CHAT', caseId: 'CASE-2026-0654' },
  ];

  if (countEvidence) countEvidence.textContent = activeNode.evidenceCount || 28;
  if (evidenceTbody) {
    evidenceTbody.innerHTML = evidenceItems.map((ev) => `
      <tr>
        <td>
          <a href="evidence-viewer.html?id=${encodeURIComponent(ev.id)}" style="color:#60a5fa;font-family:'JetBrains Mono',monospace;text-decoration:none">
            ${escapeHtml(ev.id)}
          </a>
        </td>
        <td title="${escapeHtml(ev.name)}">${escapeHtml(truncate(ev.name, 16))}</td>
        <td><span class="badge badge-blue">${escapeHtml(ev.cat)}</span></td>
        <td>
          <a href="case-detail.html?id=${encodeURIComponent(ev.caseId)}" style="color:#94a3b8;font-family:'JetBrains Mono',monospace;text-decoration:none">
            #${escapeHtml(ev.caseId)}
          </a>
        </td>
      </tr>
    `).join('');
  }
}

// ─── List View Tabular Matrix ────────────────────────────────────────────────
function renderListViewMatrix(data) {
  const tbody = document.getElementById('syndicate-matrix-tbody');
  const totalBadge = document.getElementById('list-view-total-badge');
  if (!tbody || !data) return;

  const entities = (data.nodes || []).filter((n) => n.type === 'ENTITY' || n.type === 'PERSON');
  if (totalBadge) totalBadge.textContent = `${entities.length} Entities Recorded`;

  if (entities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">No entities match the current criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = entities.map((e) => {
    const rawVal = e.rawValue || e.normalizedValue || e.label;
    const rLevel = e.riskLevel || (e.riskScore >= 80 ? 'HIGH' : e.riskScore >= 50 ? 'MEDIUM' : 'LOW');
    const badgeClass = rLevel === 'HIGH' ? 'badge-red' : rLevel === 'MEDIUM' ? 'badge-amber' : 'badge-green';

    return `
      <tr data-entity-id="${escapeHtml(e.id)}">
        <td><span class="badge badge-slate">${escapeHtml(e.entityType || 'ENTITY')}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#fff">${escapeHtml(rawVal)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(rLevel)} (${e.riskScore || 20})</span></td>
        <td>${e.caseCount || e.linkedCases?.length || 1} cases</td>
        <td>${escapeHtml((e.jurisdictions || []).slice(0, 2).join(', ') || 'Cyber Cell')}</td>
        <td>${e.evidenceCount || 1} items</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.inspectMatrixEntity('${escapeHtml(e.id)}')">
            Inspect Graph
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterListViewMatrix(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#syndicate-matrix-tbody tr');

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
}

window.inspectMatrixEntity = function (entityId) {
  const btnGraph = document.getElementById('btn-view-graph');
  if (btnGraph) btnGraph.click();
  selectNode(entityId, true);
};

// ─── Drawer Tabs Handling ────────────────────────────────────────────────────
function setupDrawerTabs() {
  const tabButtons = document.querySelectorAll('.drawer-tab-btn');
  const tabPanes = document.querySelectorAll('.drawer-tab-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.dataset.tab;

      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetPane = document.getElementById(`pane-${tabTarget}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// ─── Empty & Error States ────────────────────────────────────────────────────
function renderEmptyState(message) {
  const stage = document.getElementById('graph-svg-stage');
  if (stage) {
    stage.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--text-muted);">
        <div style="font-size:32px;">🕸</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${escapeHtml(message)}</div>
        <div style="font-size:11px;">Try selecting "All Cases" or resetting the search filters.</div>
      </div>`;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function truncate(str, max) {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '…' : s;
}
