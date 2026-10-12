/**
 * Rakshak v3.0 — Main Forensic Investigation Dashboard Controller
 * Implements light-neumorphic dashboard, live database metrics,
 * SVG case activity trend, evidence distribution donut, and secure session management.
 */

import {
  getCurrentOfficerSession,
  logoutOfficer,
  getCases,
  getEvidence,
  getEntities,
  getClusters,
  setActiveCaseId,
} from './api.js';
import {
  escapeHtml,
  formatIST,
  relativeTime,
} from './utils.js';

document.addEventListener('DOMContentLoaded', initDashboard);

let currentOfficer = null;
let cachedCases = [];
let cachedEvidenceData = null;
let selectedDaysRange = 30;

async function initDashboard() {
  // ─── 1. Authenticate & Enforce Session Guard ────────────────────────────────
  try {
    const session = await getCurrentOfficerSession();
    if (!session || !session.authenticated || !session.officer) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/frontend/pages/login.html?returnUrl=${returnUrl}`);
      return;
    }
    currentOfficer = session.officer;
  } catch (_) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/frontend/pages/login.html?returnUrl=${returnUrl}`);
    return;
  }

  // ─── 2. Setup Shell UI (Header, Officer, Time) ──────────────────────────────
  setupOfficerProfile(currentOfficer);
  setupLiveClock();
  setupGlobalSearch();
  setupSidebarPermissions(currentOfficer);

  // ─── 3. Bind Time Range Selector ────────────────────────────────────────────
  const timeSelect = document.getElementById('activity-time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      selectedDaysRange = parseInt(e.target.value, 10) || 30;
      renderCaseActivityTrend(cachedCases, selectedDaysRange);
    });
  }

  // ─── 4. Load Live Dashboard Data ────────────────────────────────────────────
  await loadDashboardData();
}

// ─── Clock and Date Presentation ──────────────────────────────────────────────
function setupLiveClock() {
  function updateTime() {
    const now = new Date();
    const dateDayEl = document.getElementById('live-date-day');
    const dateTimeEl = document.getElementById('live-date-time');

    if (dateDayEl) {
      // e.g. "Thursday, 16 Oct 2025"
      const dayOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
      dateDayEl.textContent = now.toLocaleDateString('en-IN', dayOptions);
    }
    if (dateTimeEl) {
      // e.g. "10:24 AM"
      const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
      dateTimeEl.textContent = now.toLocaleTimeString('en-IN', timeOptions);
    }
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// ─── Officer Profile and Greeting Setup ────────────────────────────────────────
function setupOfficerProfile(officer) {
  const nameEl = document.getElementById('officer-display-name');
  const deptEl = document.getElementById('officer-display-dept');
  const greetingEl = document.getElementById('welcome-heading');
  const welcomeSubEl = document.getElementById('welcome-sub');

  // Time-based contextual greeting
  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const officerName = officer.name || 'Officer';
  const officerDept = officer.unit || officer.jurisdiction || 'Investigation Unit';

  if (greetingEl) {
    greetingEl.textContent = `${greetingWord}, ${officerName}`;
  }
  if (welcomeSubEl) {
    welcomeSubEl.textContent = `Welcome to RAKSHAK • ${officerDept}`;
  }

  if (nameEl) nameEl.textContent = officerName;
  if (deptEl) deptEl.textContent = officerDept;

  // Dropdown card details
  const profileFullName = document.getElementById('profile-full-name');
  const profileBadgeNum = document.getElementById('profile-badge-num');
  const profileRoleTag = document.getElementById('profile-role-tag');
  const profileJur = document.getElementById('profile-jurisdiction');

  if (profileFullName) profileFullName.textContent = `${officer.designation || 'Officer'} ${officer.name}`;
  if (profileBadgeNum) profileBadgeNum.textContent = `Badge: ${officer.badgeNumber || 'N/A'}`;
  if (profileRoleTag) profileRoleTag.textContent = `Role: ${officer.role || 'INVESTIGATOR'}`;
  if (profileJur) profileJur.textContent = officer.jurisdiction || 'Department Scoped';

  // Sidebar Department Card
  const sidebarDeptTitle = document.getElementById('sidebar-dept-title');
  const sidebarDeptSub = document.getElementById('sidebar-dept-sub');
  if (sidebarDeptTitle) sidebarDeptTitle.textContent = officer.unit || 'Cyber Crime Branch';
  if (sidebarDeptSub) sidebarDeptSub.textContent = officer.jurisdiction || 'Delhi Police';

  // Toggle dropdown on click
  const profilePill = document.getElementById('officer-profile-pill');
  const dropdown = document.getElementById('profile-dropdown');

  if (profilePill && dropdown) {
    profilePill.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.classList.contains('show');
      dropdown.classList.toggle('show', !isVisible);
      profilePill.setAttribute('aria-expanded', String(!isVisible));
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
      profilePill.setAttribute('aria-expanded', 'false');
    });
  }

  // Logout handler
  const logoutBtn = document.getElementById('btn-officer-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logoutOfficer();
      } catch (_) {}
      window.location.href = '/frontend/pages/login.html?loggedOut=1';
    });
  }
}

// ─── Sidebar Permissions ──────────────────────────────────────────────────────
function setupSidebarPermissions(officer) {
  // All canonical 10 platform modules remain permanently accessible in sidebar
  const crossDeptLink = document.getElementById('nav-cross-dept');
  const adminLink = document.getElementById('nav-admin');
  const auditLink = document.getElementById('nav-audit');

  if (crossDeptLink) crossDeptLink.style.display = 'flex';
  if (adminLink) adminLink.style.display = 'flex';
  if (auditLink) auditLink.style.display = 'flex';
}

// ─── Global Search ────────────────────────────────────────────────────────────
function setupGlobalSearch() {
  const form = document.getElementById('global-search-form');
  const input = document.getElementById('global-search-input');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        window.location.href = `/frontend/pages/cases.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
}

// ─── Load Dashboard Data from Live APIs ───────────────────────────────────────
async function loadDashboardData() {
  try {
    const [casesRes, evidenceRes, entitiesRes, clustersRes] = await Promise.allSettled([
      getCases({ limit: 20 }),
      getEvidence({ limit: 20 }),
      getEntities({ limit: 10 }),
      getClusters(),
    ]);

    // Cases
    const casesData = casesRes.status === 'fulfilled' ? casesRes.value : null;
    cachedCases = casesData?.cases || [];
    const totalCases = casesData?.total ?? cachedCases.length;

    // Evidence
    cachedEvidenceData = evidenceRes.status === 'fulfilled' ? evidenceRes.value : null;
    const evidenceItems = cachedEvidenceData?.evidence || [];
    const totalEvidence = cachedEvidenceData?.total ?? evidenceItems.length;

    // Entities
    const entitiesData = entitiesRes.status === 'fulfilled' ? entitiesRes.value : null;
    const totalEntities = entitiesData?.total ?? (entitiesData?.entities?.length || 0);

    // Clusters
    const clustersData = clustersRes.status === 'fulfilled' ? clustersRes.value : null;
    const clusters = clustersData?.clusters || [];
    const totalClusters = clusters.length;

    // Populate UI
    populateMetricCards(totalCases, totalEvidence, totalEntities, totalClusters, casesData, cachedEvidenceData);
    renderCaseActivityTrend(cachedCases, selectedDaysRange);
    renderEvidenceDonut(cachedEvidenceData);
    renderRecentCases(cachedCases);
    renderRecentEvidence(evidenceItems);

  } catch (err) {
    console.error('[Dashboard] Error fetching live metrics:', err);
    markMetricsUnavailable();
  }
}

// ─── 4 Metric Cards Population ────────────────────────────────────────────────
function populateMetricCards(casesCount, evCount, entCount, clusterCount, casesData, evidenceData) {
  // Metric 1: Total Cases
  const casesVal = document.getElementById('metric-cases-val');
  const casesSub = document.getElementById('metric-cases-sub');
  if (casesVal) casesVal.textContent = casesData !== null ? casesCount : 'Data unavailable';
  if (casesSub && casesData !== null) {
    const active = cachedCases.filter(c => c.status === 'OPEN' || c.status === 'UNDER_INQUIRY').length;
    casesSub.textContent = `${active} active inquiry${active === 1 ? '' : 's'}`;
  }

  // Metric 2: Evidence Items
  const evVal = document.getElementById('metric-evidence-val');
  const evSub = document.getElementById('metric-evidence-sub');
  if (evVal) evVal.textContent = evidenceData !== null ? evCount : 'Data unavailable';
  if (evSub && evidenceData !== null) {
    const categoryCount = evidenceData.categoryCounts ? Object.keys(evidenceData.categoryCounts).length : 0;
    evSub.textContent = categoryCount > 0 ? `Across ${categoryCount} evidence categor${categoryCount === 1 ? 'y' : 'ies'}` : 'Photos, videos, documents';
  }

  // Metric 3: Persons of Interest
  const entVal = document.getElementById('metric-entities-val');
  if (entVal) entVal.textContent = entCount;

  // Metric 4: Linked Cases
  const clusterVal = document.getElementById('metric-clusters-val');
  if (clusterVal) clusterVal.textContent = clusterCount;
}

function markMetricsUnavailable() {
  ['metric-cases-val', 'metric-evidence-val', 'metric-entities-val', 'metric-clusters-val'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'Data unavailable';
  });
}

// ─── Case Activity Trend (Interactive SVG Bar Chart) ──────────────────────────
function renderCaseActivityTrend(cases, days = 30) {
  const container = document.getElementById('activity-chart-box');
  if (!container) return;

  // Build daily buckets for the selected range ending today
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    buckets.push({ key, label, count: 0 });
  }

  // Aggregate case timestamps into buckets
  (cases || []).forEach(c => {
    if (!c.createdAt) return;
    const caseKey = new Date(c.createdAt).toISOString().split('T')[0];
    const bucket = buckets.find(b => b.key === caseKey);
    if (bucket) bucket.count++;
  });

  const totalActivity = buckets.reduce((sum, b) => sum + b.count, 0);

  // If no activity at all, display clean honest empty state
  if (totalActivity === 0) {
    container.innerHTML = `
      <div class="neu-empty-box">
        <span class="neu-empty-icon">📊</span>
        <span style="font-weight:600;color:var(--neu-navy)">No case activity in this time range</span>
        <span style="font-size:11.5px">Investigations opened will automatically chart here with dual BSA §63 timestamps.</span>
      </div>
    `;
    return;
  }

  // Render SVG Bar Chart
  const svgW = 680;
  const svgH = 200;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = svgW - padLeft - padRight;
  const chartH = svgH - padTop - padBottom;

  const maxVal = Math.max(...buckets.map(b => b.count), 5);
  const barWidth = Math.max(4, Math.min(18, (chartW / buckets.length) * 0.65));
  const stepX = chartW / buckets.length;

  // Y-axis gridlines
  let gridLines = '';
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((maxVal / yTicks) * i);
    const y = padTop + chartH - (val / maxVal) * chartH;
    gridLines += `
      <line x1="${padLeft}" y1="${y}" x2="${svgW - padRight}" y2="${y}" stroke="rgba(166, 180, 200, 0.3)" stroke-dasharray="3 3"></line>
      <text x="${padLeft - 8}" y="${y + 4}" fill="#8495AB" font-size="10" font-family="'JetBrains Mono', monospace" text-anchor="end">${val}</text>
    `;
  }

  // Bars and X labels
  let bars = '';
  let xLabels = '';
  const labelInterval = Math.ceil(buckets.length / 7);

  buckets.forEach((b, idx) => {
    const x = padLeft + idx * stepX + (stepX - barWidth) / 2;
    const h = (b.count / maxVal) * chartH;
    const y = padTop + chartH - h;

    bars += `
      <rect
        x="${x.toFixed(1)}"
        y="${y.toFixed(1)}"
        width="${barWidth.toFixed(1)}"
        height="${Math.max(2, h).toFixed(1)}"
        rx="3"
        ry="3"
        fill="url(#barGradient)"
      >
        <title>${b.label}: ${b.count} case${b.count === 1 ? '' : 's'}</title>
      </rect>
    `;

    if (idx % labelInterval === 0 || idx === buckets.length - 1) {
      xLabels += `
        <text
          x="${(x + barWidth / 2).toFixed(1)}"
          y="${svgH - 8}"
          fill="#8495AB"
          font-size="9.5"
          font-family="'Inter', sans-serif"
          text-anchor="middle"
        >
          ${b.label}
        </text>
      `;
    }
  });

  container.innerHTML = `
    <svg class="neu-chart-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3988F5" />
          <stop offset="100%" stop-color="#88BDFF" stop-opacity="0.6" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
      ${xLabels}
    </svg>
  `;
}

// ─── Evidence Type Distribution (SVG Donut Chart) ─────────────────────────────
function renderEvidenceDonut(evidenceData) {
  const container = document.getElementById('evidence-donut-box');
  if (!container) return;

  const counts = evidenceData?.categoryCounts || {};
  const total = evidenceData?.total || 0;

  // Normalized categories
  const categories = [
    { label: 'Images', key: 'IMAGE', color: '#3988F5', count: counts['IMAGE'] || counts['PHOTO'] || 0 },
    { label: 'Videos', key: 'VIDEO', color: '#10B981', count: counts['VIDEO'] || counts['CCTV'] || 0 },
    { label: 'Documents', key: 'DOCUMENT', color: '#06B6D4', count: counts['DOCUMENT'] || counts['PDF'] || 0 },
    { label: 'Audio', key: 'AUDIO', color: '#F97316', count: counts['AUDIO'] || counts['VOICE'] || 0 },
  ];

  // Calculate Other
  const knownSum = categories.reduce((s, c) => s + c.count, 0);
  const otherCount = Math.max(0, total - knownSum);
  categories.push({ label: 'Other', key: 'OTHER', color: '#8B9EB5', count: otherCount });

  // Calculate percentages
  const effectiveTotal = total > 0 ? total : 1;
  categories.forEach(c => {
    c.pct = total > 0 ? Math.round((c.count / effectiveTotal) * 100) : 0;
  });

  // If no evidence items exist in database
  if (total === 0) {
    container.innerHTML = `
      <div class="neu-donut-chart-box">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="54" fill="transparent" stroke="#D6DFEB" stroke-width="18" stroke-dasharray="4 4"></circle>
        </svg>
        <div class="neu-donut-center">
          <span class="neu-donut-center-num">0</span>
          <span class="neu-donut-center-label">Items</span>
        </div>
      </div>
      <div class="neu-donut-legend">
        <div style="font-size:12px;color:var(--neu-secondary);font-weight:500;line-height:1.4">
          No evidence items ingested yet.<br />
          <span style="font-size:11px;color:var(--neu-muted)">Evidence ingested into the platform will be cryptographically categorized here.</span>
        </div>
        <a href="/frontend/pages/index.html?action=upload" class="neu-view-all-link" style="margin-top:6px">
          Upload Evidence &rarr;
        </a>
      </div>
    `;
    return;
  }

  // Build SVG arcs
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29
  let currentOffset = 0;
  let circlesSvg = '';

  categories.forEach(item => {
    if (item.count === 0) return;
    const fraction = item.count / effectiveTotal;
    const strokeDash = fraction * circumference;
    const strokeSpace = circumference - strokeDash;

    circlesSvg += `
      <circle
        cx="80" cy="80" r="${radius}"
        fill="transparent"
        stroke="${item.color}"
        stroke-width="18"
        stroke-dasharray="${strokeDash.toFixed(2)} ${strokeSpace.toFixed(2)}"
        stroke-dashoffset="${(-currentOffset).toFixed(2)}"
        transform="rotate(-90 80 80)"
      >
        <title>${item.label}: ${item.count} (${item.pct}%)</title>
      </circle>
    `;
    currentOffset += strokeDash;
  });

  const legendRows = categories.map(item => `
    <div class="neu-legend-row">
      <div class="neu-legend-label-wrap">
        <span class="neu-legend-dot" style="background:${item.color}"></span>
        <span>${escapeHtml(item.label)}</span>
      </div>
      <span class="neu-legend-pct">${item.pct}%</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="neu-donut-chart-box">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="${radius}" fill="transparent" stroke="rgba(214, 223, 235, 0.4)" stroke-width="18"></circle>
        ${circlesSvg}
      </svg>
      <div class="neu-donut-center">
        <span class="neu-donut-center-num">${total}</span>
        <span class="neu-donut-center-label">Items</span>
      </div>
    </div>
    <div class="neu-donut-legend">
      ${legendRows}
    </div>
  `;
}

// ─── Recent Cases List ────────────────────────────────────────────────────────
function renderRecentCases(cases) {
  const container = document.getElementById('recent-cases-list');
  if (!container) return;

  if (!cases || cases.length === 0) {
    container.innerHTML = `
      <div class="neu-empty-box">
        <span class="neu-empty-icon">📁</span>
        <span style="font-weight:600;color:var(--neu-navy)">No cases registered yet</span>
        <a href="/frontend/pages/cases.html?action=new" class="neu-view-all-link">Register First Case &rarr;</a>
      </div>
    `;
    return;
  }

  const items = cases.slice(0, 4).map(c => {
    const caseNumber = c.caseNumber || 'CASE-PENDING';
    const title = c.title || c.incidentType?.replace(/_/g, ' ') || 'Investigation';
    const status = c.status || 'OPEN';
    const statusClass = status === 'OPEN' ? 'active' : status === 'UNDER_INQUIRY' ? 'review' : 'closed';
    const statusLabel = status === 'OPEN' ? 'Active' : status === 'UNDER_INQUIRY' ? 'Under Review' : 'Closed';
    const dateFormatted = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

    return `
      <a href="/frontend/pages/cases.html?caseId=${encodeURIComponent(caseNumber)}" class="neu-case-item" data-case="${escapeHtml(caseNumber)}">
        <div class="neu-case-item-left">
          <div class="neu-case-icon-wrap" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
            </svg>
          </div>
          <div class="neu-case-meta">
            <span class="neu-case-num">${escapeHtml(caseNumber)}</span>
            <span class="neu-case-title">${escapeHtml(title)}</span>
          </div>
        </div>
        <div class="neu-case-item-right">
          <span class="neu-status-badge ${statusClass}">${statusLabel}</span>
          <span class="neu-item-date">${dateFormatted}</span>
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = items;

  // Set active case ID on click
  container.querySelectorAll('.neu-case-item').forEach(link => {
    link.addEventListener('click', () => {
      const caseId = link.getAttribute('data-case');
      if (caseId) setActiveCaseId(caseId);
    });
  });
}

// ─── Recent Evidence List ─────────────────────────────────────────────────────
function renderRecentEvidence(evidenceItems) {
  const container = document.getElementById('recent-evidence-list');
  if (!container) return;

  if (!evidenceItems || evidenceItems.length === 0) {
    container.innerHTML = `
      <div class="neu-empty-box">
        <span class="neu-empty-icon">🛡️</span>
        <span style="font-weight:600;color:var(--neu-navy)">No evidence files uploaded yet</span>
        <a href="/frontend/pages/index.html?action=upload" class="neu-view-all-link">Upload Evidence &rarr;</a>
      </div>
    `;
    return;
  }

  const items = evidenceItems.slice(0, 4).map(e => {
    const filename = e.fileName || 'evidence_file.bin';
    const category = e.evidenceCategory || 'DIGITAL';
    const size = e.fileSize || 'Unknown size';
    const dateFormatted = e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

    return `
      <a href="/frontend/pages/index.html" class="neu-ev-item" title="View in Evidence Vault: ${escapeHtml(filename)}">
        <div class="neu-ev-left">
          <div class="neu-ev-thumb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="neu-ev-meta">
            <span class="neu-ev-name">${escapeHtml(filename)}</span>
            <span class="neu-ev-sub">${escapeHtml(category)} &bull; ${escapeHtml(size)}</span>
          </div>
        </div>
        <span class="neu-item-date">${dateFormatted}</span>
      </a>
    `;
  }).join('');

  container.innerHTML = items;
}
