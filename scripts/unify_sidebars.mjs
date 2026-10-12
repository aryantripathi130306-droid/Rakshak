import fs from 'fs';
import path from 'path';

const pagesDir = path.resolve('public/frontend/pages');

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    url: '/frontend/pages/dashboard.html',
    id: 'nav-dashboard',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>`
  },
  {
    key: 'cases',
    label: 'Cases',
    url: '/frontend/pages/cases.html',
    id: 'nav-cases',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>`
  },
  {
    key: 'evidence',
    label: 'Evidence',
    url: '/frontend/pages/evidence.html',
    id: 'nav-evidence',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`
  },
  {
    key: 'reports',
    label: 'Reports',
    url: '/frontend/pages/reports.html',
    id: 'nav-reports',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="12" y1="18" x2="12" y2="12"></line>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>`
  },
  {
    key: 'graph',
    label: 'Intelligence',
    url: '/frontend/pages/graph.html',
    id: 'nav-graph',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>`
  },
  {
    key: 'entities',
    label: 'Entities',
    url: '/frontend/pages/entities.html',
    id: 'nav-entities',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`
  },
  {
    key: 'timeline',
    label: 'Timeline',
    url: '/frontend/pages/timeline.html',
    id: 'nav-timeline',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>`
  },
  {
    key: 'cross-dept',
    label: 'Cross-Department',
    url: '/frontend/pages/cross-dept.html',
    id: 'nav-cross-dept',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"></path>
      <path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"></path>
      <circle cx="8" cy="12" r="2"></circle>
    </svg>`
  },
  {
    key: 'admin',
    label: 'Administration',
    url: '/frontend/pages/admin.html',
    id: 'nav-admin',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>`
  },
  {
    key: 'audit',
    label: 'Audit Logs',
    url: '/frontend/pages/audit.html',
    id: 'nav-audit',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <path d="M16 13H8"></path>
      <path d="M16 17H8"></path>
      <path d="M10 9H8"></path>
    </svg>`
  }
];

function generateNavHtml(activeKey) {
  const itemsHtml = NAV_ITEMS.map((item, idx) => {
    const isActive = item.key === activeKey;
    const activeClasses = isActive ? ' active' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    return `          <!-- ${idx + 1}: ${item.label}${isActive ? ' (Active)' : ''} -->
          <a href="${item.url}" class="neu-nav-item${activeClasses}" id="${item.id}"${ariaCurrent}>
            <span class="neu-nav-icon">
              ${item.svg.trim()}
            </span>
            <span>${item.label}</span>
          </a>`;
  }).join('\n\n');

  return `<nav class="neu-sidebar-nav neu-nav-group" aria-label="Platform Modules">\n${itemsHtml}\n        </nav>`;
}

const PAGE_KEYS = {
  'dashboard.html': 'dashboard',
  'cases.html': 'cases',
  'evidence.html': 'evidence',
  'index.html': 'evidence',
  'reports.html': 'reports',
  'graph.html': 'graph',
  'entities.html': 'entities',
  'timeline.html': 'timeline',
  'cross-dept.html': 'cross-dept',
  'admin.html': 'admin',
  'audit.html': 'audit',
};

for (const [filename, activeKey] of Object.entries(PAGE_KEYS)) {
  const filePath = path.join(pagesDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace <nav ...> ... </nav> inside <aside ...>
  const navRegex = /<nav\s+class="(?:neu-nav-group|neu-sidebar-nav|neu-sidebar-nav neu-nav-group)"[^>]*>[\s\S]*?<\/nav>/;
  if (!navRegex.test(content)) {
    console.error(`Could not find nav in ${filename}`);
    continue;
  }

  const newNavHtml = generateNavHtml(activeKey);
  content = content.replace(navRegex, newNavHtml);

  // Also replace any legacy settings button link to pilot-readiness.html
  content = content.replace(
    /href="\/frontend\/pages\/pilot-readiness\.html"/g,
    'href="/frontend/pages/admin.html"'
  );
  content = content.replace(
    /href="\/frontend\/pages\/onboard-request\.html"/g,
    'href="/frontend/pages/cross-dept.html"'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated sidebar in ${filename} (active: ${activeKey})`);
}
