/**
 * Rakshak — Dashboard Page Script
 * Loads real data from /api/cases and /api/clusters to populate the
 * investigation overview dashboard. All values shown are from live DB.
 */

import {
  getCases,
  getClusters,
  getCaseEvidence,
  ACTIVE_CASE_ID,
} from './api.js';
import {
  escapeHtml,
  formatIST,
  relativeTime,
  formatINR,
} from './utils.js';
import { initLayout } from './layout.js';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout({ activePage: 'dashboard' });
  updateClock();
  setInterval(updateClock, 1000);

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadDashboard());
  }

  await loadDashboard();
});

function updateClock() {
  const el = document.getElementById('header-time');
  if (el) {
    el.textContent = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  }
}

// ─── Main Load ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }

  try {
    // Fire all requests in parallel
    const [casesResult, clustersResult, evidenceResult] = await Promise.allSettled([
      getCases(),
      getClusters(),
      getCaseEvidence(ACTIVE_CASE_ID),
    ]);

    const cases = casesResult.status === 'fulfilled' ? (casesResult.value?.cases || []) : null;
    const clusters = clustersResult.status === 'fulfilled' ? (clustersResult.value?.clusters || []) : null;
    const evidence = evidenceResult.status === 'fulfilled' ? (evidenceResult.value?.evidence || []) : null;

    // Update dashboard subtitle
    const subtitle = document.getElementById('dashboard-subtitle');
    if (subtitle) {
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      subtitle.textContent = `Last refreshed: ${now} IST`;
    }

    populateMetrics(cases, evidence, clusters);
    populateCasesTable(cases);
    populateAlerts(clusters);

  } catch (err) {
    console.error('[Dashboard] Load error:', err);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻ Refresh';
    }
  }
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
function populateMetrics(cases, evidence, clusters) {
  // Total Cases
  const totalCasesEl = document.getElementById('metric-total-cases');
  const caseFooterEl = document.getElementById('metric-cases-footer');
  if (totalCasesEl) {
    if (cases !== null) {
      totalCasesEl.textContent = cases.length;
      if (caseFooterEl) {
        const open = cases.filter(c => c.status === 'OPEN').length;
        const active = cases.filter(c => c.status === 'UNDER_INQUIRY').length;
        caseFooterEl.innerHTML = `<span style="color:var(--text-accent)">${open} Open</span>&nbsp;·&nbsp;${active} Under Inquiry`;
      }
    } else {
      totalCasesEl.textContent = '—';
      if (caseFooterEl) caseFooterEl.textContent = 'API unavailable';
    }
  }

  // Evidence Items
  const totalEvEl = document.getElementById('metric-total-evidence');
  const evFooterEl = document.getElementById('metric-evidence-footer');
  if (totalEvEl) {
    if (evidence !== null) {
      totalEvEl.textContent = evidence.length;
      if (evFooterEl) {
        const cats = new Set(evidence.map(e => e.evidenceCategory)).size;
        evFooterEl.textContent = `Across ${cats} categories · BSA §63 preserved`;
      }
    } else {
      totalEvEl.textContent = '—';
      if (evFooterEl) evFooterEl.textContent = 'API unavailable';
    }
  }

  // Extracted Entities — derive from cases _count if available
  const totalEntEl = document.getElementById('metric-total-entities');
  const entFooterEl = document.getElementById('metric-entities-footer');
  if (totalEntEl) {
    if (cases !== null) {
      const totalEntities = cases.reduce((sum, c) => sum + (c._count?.entities || 0), 0);
      totalEntEl.textContent = totalEntities;
      if (entFooterEl) entFooterEl.textContent = 'UPI · Phone · IFSC · UTR · Domain';
    } else {
      totalEntEl.textContent = '—';
      if (entFooterEl) entFooterEl.textContent = 'API unavailable';
    }
  }

  // Clusters
  const totalClEl = document.getElementById('metric-total-clusters');
  const clFooterEl = document.getElementById('metric-clusters-footer');
  if (totalClEl) {
    if (clusters !== null) {
      totalClEl.textContent = clusters.length;
      if (clFooterEl) {
        const confirmed = clusters.filter(c => c.confidence === 'CONFIRMED').length;
        const probable = clusters.filter(c => c.confidence === 'PROBABLE').length;
        if (clusters.length > 0) {
          clFooterEl.innerHTML = confirmed > 0
            ? `<span style="color:var(--status-danger)">${confirmed} CONFIRMED</span>&nbsp;·&nbsp;${probable} Probable`
            : `${probable} Probable · Cross-jurisdiction`;
        } else {
          clFooterEl.textContent = 'No clusters detected';
        }
      }
    } else {
      totalClEl.textContent = '—';
      if (clFooterEl) clFooterEl.textContent = 'API unavailable';
    }
  }
}

// ─── Cases Table ──────────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS = {
  Task_Scam:       { label: 'Task Scam',        color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)' },
  Digital_Arrest:  { label: 'Digital Arrest',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)'  },
  Investment_Fraud:{ label: 'Investment Fraud', color: '#c084fc', bg: 'rgba(192,132,252,0.1)', border: 'rgba(192,132,252,0.3)' },
  KYC_Freeze:      { label: 'KYC Freeze',       color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)'  },
  Romance_Scam:    { label: 'Romance Scam',     color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)'  },
};

function getStatusClass(status) {
  const map = {
    'OPEN':            'open',
    'UNDER_INQUIRY':   'under_inquiry',
    'CHARGESHEETED':   'chargesheeted',
    'CLOSED':          'closed',
  };
  return map[status] || 'open';
}

function getStatusLabel(status) {
  const map = {
    'OPEN':           'OPEN',
    'UNDER_INQUIRY':  'UNDER INQUIRY',
    'CHARGESHEETED':  'CHARGESHEETED',
    'CLOSED':         'CLOSED',
  };
  return map[status] || status;
}

function populateCasesTable(cases) {
  const body = document.getElementById('cases-table-body');
  const countBadge = document.getElementById('cases-count-badge');

  if (!body) return;

  if (cases === null) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">Cases API unavailable</div>
        <div class="empty-state-text">Could not load case list from backend. Check server connectivity.</div>
      </div>`;
    return;
  }

  if (countBadge) countBadge.textContent = `${cases.length} case${cases.length !== 1 ? 's' : ''}`;

  if (cases.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-title">No cases registered</div>
        <div class="empty-state-text">Register a case to begin ingesting evidence and linking entities.</div>
      </div>`;
    return;
  }

  // Show the 10 most recent
  const recent = cases.slice(0, 10);

  const rows = recent.map(c => {
    const incidentCfg = INCIDENT_TYPE_LABELS[c.incidentType] || { label: c.incidentType, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' };
    const statusClass = getStatusClass(c.status);
    const statusLabel = getStatusLabel(c.status);
    const evidenceCount = c._count?.evidence ?? '—';
    const entityCount = c._count?.entities ?? '—';
    const updated = c.updatedAt ? relativeTime(c.updatedAt) : '—';
    const amount = c.amountDefrauded ? formatINR(c.amountDefrauded) : '—';

    return `
      <tr onclick="window.location.href='/frontend/pages/index.html'"
          title="Open evidence vault for case ${escapeHtml(c.caseNumber)}"
          tabindex="0"
          role="row">
        <td>
          <span class="case-id-cell">#${escapeHtml(c.caseNumber)}</span>
        </td>
        <td style="color:var(--text-secondary);font-size:11px;max-width:160px">
          <span class="truncate" style="display:block;max-width:160px" title="${escapeHtml(c.complainantName)}">
            ${escapeHtml(c.complainantName)}
          </span>
        </td>
        <td>
          <span class="case-type-badge" style="color:${incidentCfg.color};background:${incidentCfg.bg};border-color:${incidentCfg.border}">
            ${escapeHtml(incidentCfg.label)}
          </span>
        </td>
        <td style="color:var(--text-muted);font-size:11px">
          ${escapeHtml(c.jurisdiction || '—')}
        </td>
        <td>
          <span class="case-status-cell ${statusClass}">${statusLabel}</span>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted)">
          <span title="${evidenceCount} evidence items">📎 ${evidenceCount}</span>
          &nbsp;<span title="${entityCount} extracted entities">🔗 ${entityCount}</span>
        </td>
        <td style="color:var(--text-muted);font-size:10px;font-family:'JetBrains Mono',monospace">
          ${updated}
        </td>
      </tr>`;
  }).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr>
          <th scope="col">Case No.</th>
          <th scope="col">Complainant</th>
          <th scope="col">Incident Type</th>
          <th scope="col">Jurisdiction</th>
          <th scope="col">Status</th>
          <th scope="col">Assets</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Syndicate Alerts ─────────────────────────────────────────────────────────
function populateAlerts(clusters) {
  const container = document.getElementById('alerts-body');
  if (!container) return;

  if (clusters === null) {
    container.innerHTML = `
      <div class="empty-state" style="padding:16px">
        <div class="empty-state-icon" style="font-size:20px">⚠</div>
        <div class="empty-state-title" style="font-size:12px">Cluster API unavailable</div>
      </div>`;
    return;
  }

  if (clusters.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:20px">
        <div class="empty-state-icon" style="font-size:20px">🕸</div>
        <div class="empty-state-title" style="font-size:12px">No syndicate clusters detected</div>
        <div class="empty-state-text" style="font-size:11px">Upload more evidence to cross-link entities across cases.</div>
      </div>`;
    return;
  }

  const CONFIDENCE_LEVEL = { CONFIRMED: 'danger', PROBABLE: 'warning', POTENTIAL: 'warning' };

  const items = clusters.map(cl => {
    const iconClass = CONFIDENCE_LEVEL[cl.confidence] || 'warning';
    const icon = cl.confidence === 'CONFIRMED' ? '🔴' : '🟡';
    const caseCount = cl.memberCaseCount || cl.linkedCases?.length || '?';
    const totalFraud = cl.totalFraudAmount ? formatINR(cl.totalFraudAmount) : null;

    return `
      <a class="alert-item" href="/frontend/pages/graph.html"
         title="Investigate cluster: ${escapeHtml(cl.name)}">
        <div class="alert-icon ${iconClass}">${icon}</div>
        <div class="alert-info">
          <div class="alert-title">${escapeHtml(cl.name)}</div>
          <div class="alert-meta">
            ${escapeHtml(cl.confidence)} · ${caseCount} case${caseCount !== 1 ? 's' : ''} linked
            ${totalFraud ? `&nbsp;·&nbsp;${escapeHtml(totalFraud)} at risk` : ''}
          </div>
        </div>
      </a>`;
  }).join('');

  container.innerHTML = items;
}
