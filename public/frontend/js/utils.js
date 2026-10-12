/**
 * Rakshak — Utility Functions
 * Shared helpers used across pages.
 */

// ─── SHA-256 via Web Crypto API ───────────────────────────────────────────────
/**
 * Computes the SHA-256 hash of a File using the browser's Web Crypto API.
 * @param {File} file
 * @returns {Promise<string>} 64-char lowercase hex string
 */
export async function computeSHA256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Format Helpers ───────────────────────────────────────────────────────────
/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a Date or ISO string to a readable IST timestamp.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatIST(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format to ISO-like UTC without timezone letters.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatUTC(date) {
  return new Date(date).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

/**
 * Format currency in INR.
 * @param {number} amount
 * @returns {string}
 */
export function formatINR(amount) {
  if (!amount) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

/**
 * Truncate a string to maxLength with ellipsis.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 40) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/**
 * Truncate a hash to first N + last N characters.
 * @param {string} hash
 * @param {number} [n=8]
 * @returns {string}
 */
export function truncateHash(hash, n = 8) {
  if (!hash || hash.length <= n * 2 + 2) return hash;
  return `${hash.slice(0, n)}…${hash.slice(-n)}`;
}

// ─── Copy to Clipboard ────────────────────────────────────────────────────────
/**
 * Copy text to clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
/**
 * Show a toast notification.
 * Supports both showToast(type, message) and showToast(message, type).
 * @param {'success'|'error'|'warning'|'info'|string} typeOrMsg
 * @param {string} [msgOrType='info']
 * @param {number} [duration=3000]
 */
export function showToast(typeOrMsg, msgOrType = 'info', duration = 3000) {
  let type = typeOrMsg;
  let message = msgOrType;
  const knownTypes = ['success', 'error', 'warning', 'info'];
  if (!knownTypes.includes(type) && knownTypes.includes(msgOrType)) {
    type = msgOrType;
    message = typeOrMsg;
  }
  if (!knownTypes.includes(type)) {
    type = 'info';
  }

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

export const showNotification = showToast;

// ─── XSS Safety ──────────────────────────────────────────────────────────────
/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Entity Type Styling ──────────────────────────────────────────────────────
const ENTITY_COLORS = {
  UPI:      { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)' },
  PHONE:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)' },
  ACCOUNT:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)' },
  IFSC:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  DOMAIN:   { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.35)' },
  TELEGRAM: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.35)' },
  EMAIL:    { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.35)' },
  NAME:     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  ADDRESS:  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)' },
  IP:       { color: '#e2e8f0', bg: 'rgba(226,232,240,0.08)', border: 'rgba(226,232,240,0.2)'  },
  GPS_COORD:{ color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)' },
  UTR:      { color: '#fcd34d', bg: 'rgba(252,211,77,0.12)',  border: 'rgba(252,211,77,0.35)' },
};

/**
 * Get color config for an entity type.
 * @param {string} type
 * @returns {{ color: string, bg: string, border: string }}
 */
export function getEntityColor(type) {
  return ENTITY_COLORS[type] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
}

/**
 * Render an entity chip HTML string.
 * @param {{ type: string, value: string, confidence?: number }} entity
 * @returns {string}
 */
export function renderEntityChip(entity) {
  const cfg = getEntityColor(entity.type);
  const pct = entity.confidence ? Math.round(entity.confidence * 100) : null;
  return `<span class="entity-chip" style="color:${cfg.color};background:${cfg.bg};border-color:${cfg.border}" title="${escapeHtml(entity.value)}${pct ? ' · ' + pct + '%' : ''}">
    <span>${escapeHtml(entity.type)}</span>
    <span>${escapeHtml(truncate(entity.value, 20))}</span>
  </span>`;
}

// ─── Evidence Category Config ─────────────────────────────────────────────────
export const CATEGORY_CONFIG = {
  CHAT:              { label: 'Chat Log',         icon: '💬', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.3)' },
  UPI_FINANCIAL:     { label: 'UPI / Financial',  icon: '💳', color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
  CALL_LOG:          { label: 'Call / Audio',     icon: '📞', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)' },
  EMAIL:             { label: 'Email Record',     icon: '📧', color: '#c084fc', bg: 'rgba(192,132,252,0.1)',  border: 'rgba(192,132,252,0.3)' },
  PHISHING_EMAIL:    { label: 'Phishing Email',   icon: '⚠',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' },
  IDENTITY_DATA:     { label: 'Identity Data',    icon: '🪪', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)' },
  DOCUMENT:          { label: 'Document',         icon: '📄', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' },
  CRIME_SCENE_PHOTO: { label: 'Scene / ATM',      icon: '📷', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)' },
  AUDIO:             { label: 'Audio Intercept',  icon: '🎙',  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)' },
  VIDEO:             { label: 'Video Footage',    icon: '🎬', color: '#ec4899', bg: 'rgba(236,72,153,0.1)',   border: 'rgba(236,72,153,0.3)' },
  URL_WEB:           { label: 'Web / URL',        icon: '🌐', color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.3)' },
  OTHER:             { label: 'Other Asset',      icon: '📁', color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.3)' },
};

/**
 * Render an evidence category badge HTML string.
 * @param {string} category
 * @returns {string}
 */
export function renderCategoryBadge(category) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.OTHER;
  return `<span class="ev-category-badge" style="color:${cfg.color};background:${cfg.bg};border-color:${cfg.border}">
    <span>${cfg.icon}</span>
    <span>${escapeHtml(cfg.label)}</span>
  </span>`;
}

// ─── Phase Label Colours ──────────────────────────────────────────────────────
export const PHASE_COLORS = {
  CONTACT: '#60a5fa',
  TRUST:   '#a78bfa',
  PAYMENT: '#f87171',
  SEVERED: '#64748b',
  UNKNOWN: '#4a5568',
};

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
/**
 * Query selector shorthand.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Query selector all shorthand.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {NodeListOf<Element>}
 */
export function $$(selector, root = document) {
  return root.querySelectorAll(selector);
}

/**
 * Create element with optional properties.
 * @param {string} tag
 * @param {Object} [props]
 * @returns {HTMLElement}
 */
export function createElement(tag, props = {}) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k === 'textContent') el.textContent = v;
    else el.setAttribute(k, v);
  });
  return el;
}

/**
 * Set element loading state.
 * @param {HTMLElement} el
 * @param {boolean} loading
 * @param {string} [loadingText]
 */
export function setLoading(el, loading, loadingText = 'Loading…') {
  if (loading) {
    el.dataset.originalContent = el.innerHTML;
    el.innerHTML = `<span class="spinner spinner-sm"></span> ${escapeHtml(loadingText)}`;
    el.disabled = true;
  } else {
    el.innerHTML = el.dataset.originalContent || el.innerHTML;
    el.disabled = false;
    delete el.dataset.originalContent;
  }
}

// ─── PDF Download ─────────────────────────────────────────────────────────────
/**
 * Download a JSON object as a file.
 * @param {Object} data
 * @param {string} filename
 */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Relative Time ────────────────────────────────────────────────────────────
/**
 * Get relative time string (e.g. "2 hours ago").
 * @param {string|Date} date
 * @returns {string}
 */
export function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
