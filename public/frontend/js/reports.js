/**
 * Rakshak — Phase 8: Reports, Officer Access Control & Audit Logs
 * Comprehensive frontend controller powering the 8-panel workspace.
 */

import { initLayout } from './layout.js';
import {
  getReportsAnalytics,
  getReports,
  generateReport,
  downloadReport,
  getScheduledReports,
  createScheduledReport,
  getOfficers,
  createOfficer,
  updateOfficer,
  getAuditLogs,
  exportAuditLogs,
  login,
  logout,
  getAuthMe,
} from './api.js';
import { showToast, escapeHtml } from './utils.js';

// ─── Module State ─────────────────────────────────────────────────────────────
const state = {
  currentOfficer: null,
  analytics: null,
  recentReports: [],
  scheduledReports: [],
  officers: [],
  auditLogs: [],
  auditPagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  auditFilters: { user: '', module: '', action: '' },
  selectedReportType: 'CASE_REPORT',
  selectedEntityTab: 'ALL',
};

// ─── SVG Chart Helpers ────────────────────────────────────────────────────────

/**
 * Render circular SVG Donut Chart with legend
 */
function renderDonutChart(containerId, legendId, items, centerVal, centerLabel) {
  const container = document.getElementById(containerId);
  const legend = document.getElementById(legendId);
  if (!container) return;

  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // ~314.159
  let currentOffset = 0;

  // Build SVG circles
  let svgPaths = '';
  items.forEach((item) => {
    const fraction = item.count / total;
    const strokeDash = fraction * circumference;
    const strokeSpace = circumference - strokeDash;
    svgPaths += `
      <circle
        cx="65" cy="65" r="${radius}"
        fill="transparent"
        stroke="${item.color}"
        stroke-width="16"
        stroke-dasharray="${strokeDash} ${strokeSpace}"
        stroke-dashoffset="${-currentOffset}"
        transform="rotate(-90 65 65)"
      >
        <title>${escapeHtml(item.label)}: ${item.count} (${item.pct}%)</title>
      </circle>
    `;
    currentOffset += strokeDash;
  });

  container.innerHTML = `
    <svg width="130" height="130" viewBox="0 0 130 130">
      <!-- Background track -->
      <circle cx="65" cy="65" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.06)" stroke-width="16"></circle>
      ${svgPaths}
    </svg>
    <div class="donut-center-text">
      <div class="donut-center-val">${escapeHtml(String(centerVal))}</div>
      <div class="donut-center-label">${escapeHtml(centerLabel)}</div>
    </div>
  `;

  if (legend) {
    legend.innerHTML = items.map(item => `
      <div class="donut-legend-item">
        <div class="donut-legend-color">
          <span class="legend-swatch" style="background:${item.color}"></span>
          <span>${escapeHtml(item.label)}</span>
        </div>
        <div class="donut-legend-val">${item.count} <span style="font-size:9px;color:#64748b">(${item.pct}%)</span></div>
      </div>
    `).join('');
  }
}

/**
 * Render 7-day Multi-line SVG Trend Chart
 */
function renderActivityTrendChart(seriesData) {
  const container = document.getElementById('activity-chart-container');
  if (!container) return;

  const days = seriesData.dates || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const n = days.length;
  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 35 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Max value across all 4 series
  const allVals = [
    ...(seriesData.evidenceUploads || []),
    ...(seriesData.entityExtractions || []),
    ...(seriesData.reportsGenerated || []),
    ...(seriesData.userActions || []),
  ];
  const maxVal = Math.max(...allVals, 10);

  const getX = (idx) => padding.left + (idx / (n - 1)) * plotW;
  const getY = (val) => padding.top + plotH - ((val || 0) / maxVal) * plotH;

  const buildPath = (data) => {
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(' ');
  };

  const lines = [
    { name: 'Evidence Uploads', color: '#06b6d4', data: seriesData.evidenceUploads || [] },
    { name: 'Entity Extractions', color: '#10b981', data: seriesData.entityExtractions || [] },
    { name: 'Reports Generated', color: '#f59e0b', data: seriesData.reportsGenerated || [] },
    { name: 'User Actions', color: '#8b5cf6', data: seriesData.userActions || [] },
  ];

  // Grid lines
  let gridLines = '';
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const yVal = Math.round((maxVal / ySteps) * i);
    const yPos = getY(yVal);
    gridLines += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"></line>
      <text x="${padding.left - 6}" y="${yPos + 3}" fill="#64748b" font-size="9" text-anchor="end" font-family="'JetBrains Mono', monospace">${yVal}</text>
    `;
  }

  // X Axis labels
  let xLabels = '';
  days.forEach((day, i) => {
    const xPos = getX(i);
    xLabels += `
      <text x="${xPos}" y="${height - 10}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="'JetBrains Mono', monospace">${day}</text>
    `;
  });

  // Series paths and points
  let pathsAndPoints = '';
  lines.forEach((line) => {
    const d = buildPath(line.data);
    pathsAndPoints += `
      <path d="${d}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    `;
    line.data.forEach((val, i) => {
      pathsAndPoints += `
        <circle cx="${getX(i).toFixed(1)}" cy="${getY(val).toFixed(1)}" r="3.5" fill="${line.color}" stroke="#090e1a" stroke-width="1.5">
          <title>${line.name} (${days[i]}): ${val}</title>
        </circle>
      `;
    });
  });

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${gridLines}
      ${xLabels}
      ${pathsAndPoints}
    </svg>
  `;
}

// ─── UI Render Functions ──────────────────────────────────────────────────────

function renderKPIs(counts) {
  if (!counts) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? String(val) : '0';
  };
  setVal('kpi-total-cases', counts.totalCases);
  setVal('kpi-total-evidence', counts.totalEvidence);
  setVal('kpi-total-entities', counts.totalEntities);
  setVal('kpi-high-risk', counts.highRiskEntities);
  setVal('kpi-total-reports', counts.totalReports);
  setVal('kpi-total-activities', counts.totalActivities);
}

function renderAnalyticsPanels(analytics) {
  if (!analytics) return;
  renderKPIs(analytics.counts);

  // Donut 1: Cases
  renderDonutChart(
    'donut-cases-wrapper',
    'legend-cases',
    analytics.casesByStatus || [],
    analytics.counts.totalCases,
    'CASES'
  );

  // Donut 2: Evidence
  renderDonutChart(
    'donut-evidence-wrapper',
    'legend-evidence',
    analytics.evidenceByCategory || [],
    analytics.counts.totalEvidence,
    'ARTIFACTS'
  );

  // Donut 3: Entities
  renderDonutChart(
    'donut-entities-wrapper',
    'legend-entities',
    analytics.entitiesByType || [],
    analytics.counts.totalEntities,
    'ENTITIES'
  );

  // 7-day Activity Chart
  if (analytics.sevenDayActivity) {
    renderActivityTrendChart(analytics.sevenDayActivity);
  }

  // Top Entities
  renderTopEntitiesTable(analytics.topEntities || []);
}

function renderTopEntitiesTable(entities) {
  const tbody = document.getElementById('tbody-top-entities');
  if (!tbody) return;

  let filtered = entities;
  if (state.selectedEntityTab === 'HIGH') {
    filtered = entities.filter(e => e.riskLevel === 'HIGH');
  } else if (state.selectedEntityTab === 'UPI') {
    filtered = entities.filter(e => e.type === 'UPI_ID');
  } else if (state.selectedEntityTab === 'BANK_ACCOUNT') {
    filtered = entities.filter(e => e.type === 'BANK_ACCOUNT');
  }

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-loading">No entities found for current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#f8fafc">
        ${escapeHtml(e.value)}
      </td>
      <td>
        <span style="font-size:10px; color:#94a3b8; background:rgba(255,255,255,0.05); padding:2px 5px; border-radius:3px">
          ${escapeHtml(e.type)}
        </span>
      </td>
      <td style="font-family:'JetBrains Mono', monospace; font-size:11px">
        ${escapeHtml(e.linkedCases || '1 case')}
      </td>
      <td style="font-family:'JetBrains Mono', monospace; font-weight:600">
        ${e.occurrences}
      </td>
      <td>
        <span class="badge-risk ${escapeHtml(e.riskLevel)}">${escapeHtml(e.riskLevel)}</span>
      </td>
    </tr>
  `).join('');
}

function renderRecentReportsTable(reports) {
  const tbody = document.getElementById('tbody-recent-reports');
  if (!tbody) return;

  const searchInput = document.getElementById('filter-reports-search');
  const term = (searchInput?.value || '').toLowerCase().trim();

  let filtered = reports;
  if (term) {
    filtered = reports.filter(r =>
      r.reportId.toLowerCase().includes(term) ||
      r.caseId.toLowerCase().includes(term) ||
      r.title.toLowerCase().includes(term) ||
      r.type.toLowerCase().includes(term)
    );
  }

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No reports found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const dateStr = new Date(r.createdAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr>
        <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#38bdf8">
          ${escapeHtml(r.reportId)}
        </td>
        <td style="font-family:'JetBrains Mono', monospace">
          ${escapeHtml(r.caseId)}
        </td>
        <td>${escapeHtml(r.type.replace(/_/g, ' '))}</td>
        <td>
          <span style="font-size:10px; font-weight:600; padding:2px 5px; border-radius:3px; background:rgba(255,255,255,0.06); font-family:'JetBrains Mono', monospace">
            ${escapeHtml(r.format)}
          </span>
        </td>
        <td style="font-size:11px; color:#94a3b8; font-family:'JetBrains Mono', monospace">${dateStr}</td>
        <td><span class="badge-status ready">${escapeHtml(r.status)}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-download-report" data-id="${escapeHtml(r.id)}" title="Download Dossier">
            ⬇ Download
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind download buttons
  tbody.querySelectorAll('.btn-download-report').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await handleDownloadReport(id);
    });
  });
}

function renderScheduledReportsTable(schedules) {
  const tbody = document.getElementById('tbody-scheduled-reports');
  if (!tbody) return;

  if (!schedules || schedules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No scheduled reports configured.</td></tr>`;
    return;
  }

  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td style="font-weight:600; color:#f8fafc">${escapeHtml(s.title)}</td>
      <td>
        <span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:3px; background:rgba(56,189,248,0.12); color:#38bdf8; font-family:'JetBrains Mono', monospace">
          ${escapeHtml(s.frequency)}
        </span>
      </td>
      <td style="font-size:10px; font-family:'JetBrains Mono', monospace">${escapeHtml(s.format)}</td>
      <td style="font-size:11px; color:#94a3b8; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(s.recipients)}">
        ${escapeHtml(s.recipients)}
      </td>
      <td><span class="badge-status active">${escapeHtml(s.status)}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="alert('Scheduled task trigger initiated.')" title="Trigger now">
          ▶ Run
        </button>
      </td>
    </tr>
  `).join('');
}

function renderOfficersTable(officers) {
  const tbody = document.getElementById('tbody-officers');
  if (!tbody) return;

  if (!officers || officers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No officers found.</td></tr>`;
    return;
  }

  const isAdmin = state.currentOfficer?.role === 'ADMIN';

  tbody.innerHTML = officers.map(o => {
    const roleLower = o.role.toLowerCase();
    const isSelf = state.currentOfficer?.badgeNumber === o.badgeNumber;
    return `
      <tr>
        <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#f8fafc">
          ${escapeHtml(o.badgeNumber)}
        </td>
        <td style="font-weight:600; color:#f1f5f9">
          ${escapeHtml(o.name)} ${isSelf ? '<span style="font-size:10px;color:#38bdf8">(You)</span>' : ''}
        </td>
        <td style="font-size:11px; color:#94a3b8">${escapeHtml(o.rank)}</td>
        <td>
          ${isAdmin && !isSelf ? `
            <select class="form-select select-sm officer-role-select" data-id="${escapeHtml(o.id)}" style="width:130px">
              <option value="ADMIN" ${o.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
              <option value="INVESTIGATOR" ${o.role === 'INVESTIGATOR' ? 'selected' : ''}>INVESTIGATOR</option>
              <option value="ANALYST" ${o.role === 'ANALYST' ? 'selected' : ''}>ANALYST</option>
              <option value="VIEWER" ${o.role === 'VIEWER' ? 'selected' : ''}>VIEWER</option>
            </select>
          ` : `
            <span class="badge-role ${roleLower}">${escapeHtml(o.role)}</span>
          `}
        </td>
        <td style="font-size:11px; color:#cbd5e1">${escapeHtml(o.jurisdiction)}</td>
        <td>
          <span class="badge-status ${o.status.toLowerCase()}">${escapeHtml(o.status)}</span>
        </td>
        <td>
          ${isAdmin && !isSelf ? `
            <button class="btn btn-secondary btn-sm btn-toggle-officer-status" data-id="${escapeHtml(o.id)}" data-status="${escapeHtml(o.status)}">
              ${o.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
          ` : `
            <span style="font-size:11px; color:#64748b">—</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Bind status toggle and role dropdowns
  tbody.querySelectorAll('.btn-toggle-officer-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const current = btn.getAttribute('data-status');
      const newStatus = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await handleUpdateOfficerStatus(id, newStatus);
    });
  });

  tbody.querySelectorAll('.officer-role-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = sel.getAttribute('data-id');
      const newRole = e.target.value;
      await handleUpdateOfficerRole(id, newRole);
    });
  });
}

function renderAuditLogsTable(data) {
  const tbody = document.getElementById('tbody-audit-logs');
  const infoEl = document.getElementById('audit-pagination-info');
  const pageLabel = document.getElementById('audit-page-label');
  const btnPrev = document.getElementById('btn-audit-prev');
  const btnNext = document.getElementById('btn-audit-next');

  if (!tbody) return;

  const logs = data.logs || [];
  state.auditPagination.total = data.total || logs.length;
  state.auditPagination.totalPages = data.totalPages || 1;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No audit log records match the filters.</td></tr>`;
  } else {
    tbody.innerHTML = logs.map(l => {
      const dateStr = new Date(l.createdAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      return `
        <tr>
          <td style="font-family:'JetBrains Mono', monospace; font-size:11px; color:#94a3b8">${dateStr}</td>
          <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#f8fafc">
            ${escapeHtml(l.officerBadge || 'SYSTEM')}
          </td>
          <td>
            <span style="font-family:'JetBrains Mono', monospace; font-size:10px; font-weight:600; color:#38bdf8; background:rgba(56,189,248,0.1); padding:2px 5px; border-radius:3px">
              ${escapeHtml(l.action)}
            </span>
          </td>
          <td style="font-size:11px; color:#cbd5e1">${escapeHtml(l.details || '—')}</td>
          <td>
            <span style="font-size:10px; font-weight:600; color:#94a3b8; background:rgba(255,255,255,0.05); padding:2px 5px; border-radius:3px">
              ${escapeHtml(l.module)}
            </span>
          </td>
          <td style="font-family:'JetBrains Mono', monospace; font-size:10px; color:#64748b">${escapeHtml(l.ipAddress || '127.0.0.1')}</td>
        </tr>
      `;
    }).join('');
  }

  // Update pagination UI
  const startRec = (state.auditPagination.page - 1) * state.auditPagination.limit + 1;
  const endRec = Math.min(state.auditPagination.page * state.auditPagination.limit, state.auditPagination.total);
  if (infoEl) {
    infoEl.textContent = state.auditPagination.total > 0
      ? `Showing records ${startRec}–${endRec} of ${state.auditPagination.total}`
      : `0 records`;
  }
  if (pageLabel) {
    pageLabel.textContent = `Page ${state.auditPagination.page} of ${state.auditPagination.totalPages}`;
  }
  if (btnPrev) btnPrev.disabled = state.auditPagination.page <= 1;
  if (btnNext) btnNext.disabled = state.auditPagination.page >= state.auditPagination.totalPages;
}

// ─── Actions & Handlers ───────────────────────────────────────────────────────

async function handleGenerateReport() {
  const btn = document.getElementById('btn-generate-report');
  const caseSelect = document.getElementById('select-report-case');
  const typeSelect = document.getElementById('select-report-type-dropdown');
  const formatRadio = document.querySelector('input[name="reportFormat"]:checked');
  const sectionCheckboxes = document.querySelectorAll('input[name="sections"]:checked');

  const caseId = caseSelect?.value;
  const type = typeSelect?.value || state.selectedReportType;
  const format = formatRadio?.value || 'PDF';
  const sections = Array.from(sectionCheckboxes).map(cb => cb.value);

  if (!caseId) {
    showToast('error', 'Please select a valid case');
    return;
  }

  if (btn) {
    btn.disabled = true;
    document.getElementById('btn-generate-icon').textContent = '⏳';
    document.getElementById('btn-generate-label').textContent = 'Generating...';
  }

  try {
    const res = await generateReport({ caseId, type, format, sections });
    showToast('success', `Report generated: ${res.report.reportId}`);

    // Prepend to recent reports list
    state.recentReports.unshift(res.report);
    renderRecentReportsTable(state.recentReports);

    // Refresh analytics KPI counts and audit logs
    loadAnalytics();
    loadAuditLogs();

    // Trigger auto-download
    await handleDownloadReport(res.report.id);
  } catch (err) {
    console.error(err);
    showToast('error', `Generation failed: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      document.getElementById('btn-generate-icon').textContent = '📄';
      document.getElementById('btn-generate-label').textContent = 'Generate Report';
    }
  }
}

async function handleDownloadReport(id) {
  try {
    const blob = await downloadReport(id);
    const report = state.recentReports.find(r => r.id === id);
    const filename = report ? `${report.reportId}.${report.format.toLowerCase()}` : `report-${id}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', `Downloaded ${filename}`);
  } catch (err) {
    console.error(err);
    showToast('error', `Download error: ${err.message}`);
  }
}

async function handleUpdateOfficerRole(id, newRole) {
  try {
    await updateOfficer(id, { role: newRole });
    showToast('success', `Updated role to ${newRole}`);
    await loadOfficers();
    await loadAuditLogs();
  } catch (err) {
    console.error(err);
    showToast('error', `Failed to update role: ${err.message}`);
    await loadOfficers(); // revert dropdown
  }
}

async function handleUpdateOfficerStatus(id, newStatus) {
  try {
    await updateOfficer(id, { status: newStatus });
    showToast('success', `Officer set to ${newStatus}`);
    await loadOfficers();
    await loadAuditLogs();
  } catch (err) {
    console.error(err);
    showToast('error', `Failed to update status: ${err.message}`);
  }
}

async function handleExportAudit(format) {
  try {
    const blob = await exportAuditLogs(state.auditFilters, format);
    const filename = `rakshak_audit_logs_${Date.now()}.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', `Exported audit logs (${format.toUpperCase()})`);
    loadAuditLogs(); // Refresh trail after export log added
  } catch (err) {
    console.error(err);
    showToast('error', `Export failed: ${err.message}`);
  }
}

// ─── Modal Management ─────────────────────────────────────────────────────────

function openLoginModal() {
  const modal = document.getElementById('modal-switch-officer');
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('modal-switch-officer');
  if (modal) modal.style.display = 'none';
  const err = document.getElementById('login-error-msg');
  if (err) err.style.display = 'none';
}

function openAddOfficerModal() {
  if (state.currentOfficer?.role !== 'ADMIN') {
    showToast('error', 'Only ADMIN officers can provision new accounts.');
    return;
  }
  const modal = document.getElementById('modal-add-officer');
  if (modal) modal.style.display = 'flex';
}

function closeAddOfficerModal() {
  const modal = document.getElementById('modal-add-officer');
  if (modal) modal.style.display = 'none';
}

function openAddScheduleModal() {
  const modal = document.getElementById('modal-add-schedule');
  if (modal) modal.style.display = 'flex';
}

function closeAddScheduleModal() {
  const modal = document.getElementById('modal-add-schedule');
  if (modal) modal.style.display = 'none';
}

// ─── Data Loaders ─────────────────────────────────────────────────────────────

async function loadAuth() {
  try {
    const res = await getAuthMe();
    if (res.authenticated && res.officer) {
      state.currentOfficer = res.officer;
    } else {
      // Auto-authenticate as default ACP Vikram Singh (DL-002) for smooth law-enforcement demo flow
      const loginRes = await login('DL-002', 'Rakshak@2026');
      state.currentOfficer = loginRes.officer;
    }
  } catch (err) {
    console.warn('Auth check error, falling back:', err);
  }

  // Update session badge
  const nameEl = document.getElementById('current-officer-name');
  const roleEl = document.getElementById('current-officer-role');
  if (state.currentOfficer) {
    if (nameEl) nameEl.textContent = `${state.currentOfficer.name} (${state.currentOfficer.badgeNumber})`;
    if (roleEl) roleEl.textContent = state.currentOfficer.role;
  }
}

async function loadAnalytics() {
  try {
    const data = await getReportsAnalytics();
    state.analytics = data;
    renderAnalyticsPanels(data);
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

async function loadRecentReports() {
  try {
    const data = await getReports();
    state.recentReports = data.reports || [];
    renderRecentReportsTable(state.recentReports);
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}

async function loadScheduledReports() {
  try {
    const data = await getScheduledReports();
    state.scheduledReports = data.scheduledReports || [];
    renderScheduledReportsTable(state.scheduledReports);
  } catch (err) {
    console.error('Failed to load scheduled reports:', err);
  }
}

async function loadOfficers() {
  try {
    const data = await getOfficers();
    state.officers = data.officers || [];
    renderOfficersTable(state.officers);
  } catch (err) {
    console.error('Failed to load officers:', err);
  }
}

async function loadAuditLogs() {
  try {
    const params = {
      ...state.auditFilters,
      page: state.auditPagination.page,
      limit: state.auditPagination.limit,
    };
    const data = await getAuditLogs(params);
    state.auditLogs = data.logs || [];
    renderAuditLogsTable(data);
  } catch (err) {
    console.error('Failed to load audit logs:', err);
  }
}

// ─── Setup Event Listeners ───────────────────────────────────────────────────

function setupEventListeners() {
  // Report Type Pills
  const pills = document.querySelectorAll('#report-type-pills .type-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const type = pill.getAttribute('data-type');
      state.selectedReportType = type;
      const select = document.getElementById('select-report-type-dropdown');
      if (select) select.value = type;
    });
  });

  const typeDropdown = document.getElementById('select-report-type-dropdown');
  if (typeDropdown) {
    typeDropdown.addEventListener('change', (e) => {
      const type = e.target.value;
      state.selectedReportType = type;
      pills.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-type') === type);
      });
    });
  }

  // View Case button
  const btnViewCase = document.getElementById('btn-view-case');
  if (btnViewCase) {
    btnViewCase.addEventListener('click', () => {
      const caseId = document.getElementById('select-report-case')?.value;
      if (caseId) {
        window.location.href = `/frontend/pages/cases.html?caseId=${encodeURIComponent(caseId)}`;
      }
    });
  }

  // Generate Report CTA
  const btnGen = document.getElementById('btn-generate-report');
  if (btnGen) {
    btnGen.addEventListener('click', handleGenerateReport);
  }

  // Search recent reports
  const searchReports = document.getElementById('filter-reports-search');
  if (searchReports) {
    searchReports.addEventListener('input', () => {
      renderRecentReportsTable(state.recentReports);
    });
  }

  const btnRefreshReports = document.getElementById('btn-refresh-reports');
  if (btnRefreshReports) {
    btnRefreshReports.addEventListener('click', () => {
      loadRecentReports();
      showToast('info', 'Refreshed recent reports list');
    });
  }

  // Quick Action buttons
  const qaCase = document.getElementById('qa-case-summary');
  if (qaCase) {
    qaCase.addEventListener('click', () => {
      document.getElementById('select-report-type-dropdown').value = 'CASE_REPORT';
      handleGenerateReport();
    });
  }

  const qaEv = document.getElementById('qa-evidence-audit');
  if (qaEv) {
    qaEv.addEventListener('click', () => {
      document.getElementById('select-report-type-dropdown').value = 'EVIDENCE_REPORT';
      handleGenerateReport();
    });
  }

  const qaWeekly = document.getElementById('qa-weekly-archive');
  if (qaWeekly) {
    qaWeekly.addEventListener('click', () => {
      document.getElementById('select-report-type-dropdown').value = 'SYNDICATE_REPORT';
      handleGenerateReport();
    });
  }

  // Top Entities Tabs
  const entityTabs = document.querySelectorAll('#entity-risk-tabs .panel-tab-btn');
  entityTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      entityTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedEntityTab = tab.getAttribute('data-tab');
      renderTopEntitiesTable(state.analytics?.topEntities || []);
    });
  });

  // RBAC Tabs
  const rbacTabs = document.querySelectorAll('#rbac-tabs .panel-tab-btn');
  rbacTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      rbacTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById('tab-content-officers').style.display = target === 'OFFICERS' ? 'block' : 'none';
      document.getElementById('tab-content-permissions').style.display = target === 'PERMISSIONS' ? 'block' : 'none';
      document.getElementById('tab-content-requests').style.display = target === 'REQUESTS' ? 'block' : 'none';
    });
  });

  // Audit Filters
  const auditUser = document.getElementById('filter-audit-user');
  const auditModule = document.getElementById('filter-audit-module');
  const auditAction = document.getElementById('filter-audit-action');
  const btnResetAudit = document.getElementById('btn-reset-audit-filters');

  const onAuditFilterChange = () => {
    state.auditFilters.user = auditUser?.value || '';
    state.auditFilters.module = auditModule?.value || '';
    state.auditFilters.action = auditAction?.value || '';
    state.auditPagination.page = 1;
    loadAuditLogs();
  };

  if (auditUser) auditUser.addEventListener('change', onAuditFilterChange);
  if (auditModule) auditModule.addEventListener('change', onAuditFilterChange);
  if (auditAction) auditAction.addEventListener('change', onAuditFilterChange);

  if (btnResetAudit) {
    btnResetAudit.addEventListener('click', () => {
      if (auditUser) auditUser.value = '';
      if (auditModule) auditModule.value = '';
      if (auditAction) auditAction.value = '';
      state.auditFilters = { user: '', module: '', action: '' };
      state.auditPagination.page = 1;
      loadAuditLogs();
    });
  }

  // Audit Pagination
  const btnPrev = document.getElementById('btn-audit-prev');
  const btnNext = document.getElementById('btn-audit-next');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.auditPagination.page > 1) {
        state.auditPagination.page--;
        loadAuditLogs();
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (state.auditPagination.page < state.auditPagination.totalPages) {
        state.auditPagination.page++;
        loadAuditLogs();
      }
    });
  }

  // Audit Export Buttons
  const btnExportCsv = document.getElementById('btn-export-audit-csv');
  const btnExportJson = document.getElementById('btn-export-audit-json');
  if (btnExportCsv) btnExportCsv.addEventListener('click', () => handleExportAudit('csv'));
  if (btnExportJson) btnExportJson.addEventListener('click', () => handleExportAudit('json'));

  // Switch Officer / Login Modal
  const btnSwitchOfficer = document.getElementById('btn-switch-officer');
  const btnCloseLogin = document.getElementById('btn-close-login-modal');
  const btnCancelLogin = document.getElementById('btn-cancel-login');
  const btnSubmitLogin = document.getElementById('btn-submit-login');

  if (btnSwitchOfficer) btnSwitchOfficer.addEventListener('click', openLoginModal);
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLoginModal);
  if (btnCancelLogin) btnCancelLogin.addEventListener('click', closeLoginModal);

  // Quick officer buttons in modal
  document.querySelectorAll('.btn-officer-quick').forEach(b => {
    b.addEventListener('click', () => {
      const badge = b.getAttribute('data-badge');
      const pass = b.getAttribute('data-pass');
      document.getElementById('input-login-badge').value = badge;
      document.getElementById('input-login-password').value = pass;
    });
  });

  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
      const badge = document.getElementById('input-login-badge')?.value?.trim();
      const pass = document.getElementById('input-login-password')?.value;
      const errBox = document.getElementById('login-error-msg');

      if (!badge || !pass) {
        if (errBox) {
          errBox.textContent = 'Please provide both Badge Number and Password';
          errBox.style.display = 'block';
        }
        return;
      }

      try {
        const res = await login(badge, pass);
        state.currentOfficer = res.officer;
        closeLoginModal();
        showToast('success', `Logged in as ${res.officer.name} (${res.officer.role})`);
        loadAuth();
        loadOfficers();
        loadAuditLogs();
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Invalid credentials or inactive officer account';
          errBox.style.display = 'block';
        }
      }
    });
  }

  // Add Officer Modal
  const btnAddOfficer = document.getElementById('btn-add-officer');
  const btnCloseAddOfficer = document.getElementById('btn-close-add-officer-modal');
  const btnCancelAddOfficer = document.getElementById('btn-cancel-add-officer');
  const btnSubmitAddOfficer = document.getElementById('btn-submit-add-officer');

  if (btnAddOfficer) btnAddOfficer.addEventListener('click', openAddOfficerModal);
  if (btnCloseAddOfficer) btnCloseAddOfficer.addEventListener('click', closeAddOfficerModal);
  if (btnCancelAddOfficer) btnCancelAddOfficer.addEventListener('click', closeAddOfficerModal);

  if (btnSubmitAddOfficer) {
    btnSubmitAddOfficer.addEventListener('click', async () => {
      const badgeNumber = document.getElementById('input-officer-badge')?.value?.trim();
      const name = document.getElementById('input-officer-name')?.value?.trim();
      const rank = document.getElementById('input-officer-rank')?.value?.trim();
      const role = document.getElementById('select-officer-role')?.value;
      const jurisdiction = document.getElementById('input-officer-jurisdiction')?.value?.trim();
      const password = document.getElementById('input-officer-password')?.value;
      const errBox = document.getElementById('add-officer-error-msg');

      if (!badgeNumber || !name || !rank || !jurisdiction || !password) {
        if (errBox) {
          errBox.textContent = 'Please fill all required officer fields.';
          errBox.style.display = 'block';
        }
        return;
      }

      try {
        await createOfficer({ badgeNumber, name, rank, role, jurisdiction, password });
        closeAddOfficerModal();
        showToast('success', `Officer account ${badgeNumber} provisioned`);
        loadOfficers();
        loadAuditLogs();
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Failed to create officer';
          errBox.style.display = 'block';
        }
      }
    });
  }

  // Add Schedule Modal
  const btnAddSchedule = document.getElementById('btn-add-schedule');
  const btnCloseSchedule = document.getElementById('btn-close-schedule-modal');
  const btnCancelSchedule = document.getElementById('btn-cancel-schedule');
  const btnSubmitSchedule = document.getElementById('btn-submit-schedule');

  if (btnAddSchedule) btnAddSchedule.addEventListener('click', openAddScheduleModal);
  if (btnCloseSchedule) btnCloseSchedule.addEventListener('click', closeAddScheduleModal);
  if (btnCancelSchedule) btnCancelSchedule.addEventListener('click', closeAddScheduleModal);

  if (btnSubmitSchedule) {
    btnSubmitSchedule.addEventListener('click', async () => {
      const title = document.getElementById('input-schedule-title')?.value?.trim();
      const frequency = document.getElementById('select-schedule-freq')?.value;
      const type = document.getElementById('select-schedule-type')?.value;
      const recipients = document.getElementById('input-schedule-recipients')?.value?.trim();

      if (!title || !recipients) {
        showToast('error', 'Please provide a schedule title and recipients.');
        return;
      }

      try {
        await createScheduledReport({ title, frequency, type, recipients });
        closeAddScheduleModal();
        showToast('success', 'Automated report schedule created');
        loadScheduledReports();
        loadAuditLogs();
      } catch (err) {
        showToast('error', `Failed to create schedule: ${err.message}`);
      }
    });
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function initReportsPage() {
  initLayout({ activePage: 'reports' });
  setupEventListeners();

  await loadAuth();
  await Promise.all([
    loadAnalytics(),
    loadRecentReports(),
    loadScheduledReports(),
    loadOfficers(),
    loadAuditLogs(),
  ]);
}

document.addEventListener('DOMContentLoaded', initReportsPage);
