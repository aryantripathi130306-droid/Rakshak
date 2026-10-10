/**
 * Rakshak — API Client
 * Centralised fetch wrapper for all backend API calls.
 * All endpoints point to the existing Next.js backend.
 */

// ─── Base URL ────────────────────────────────────────────────────────────────
// In production, set this to the actual backend origin.
// For local dev (Next.js runs on 3000 by default), use empty string for same-origin.
const API_BASE = '';

/**
 * Default active case — used across the entire frontend.
 * This matches the hardcoded value used in the original React frontend.
 */
export const ACTIVE_CASE_ID = 'CASE-2026-0891';

// ─── Generic Fetch Wrapper ────────────────────────────────────────────────────
/**
 * @param {string} path — API path (e.g. '/api/cases')
 * @param {RequestInit} [options] — fetch options
 * @returns {Promise<any>}
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errData = await res.json();
      errMsg = errData.error || errData.message || errMsg;
    } catch (_) {}
    const err = new Error(errMsg);
    err.status = res.status;
    throw err;
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── Cases API ────────────────────────────────────────────────────────────────

/**
 * GET /api/cases
 * Supports: q, status, type, jurisdiction, sortBy, sortOrder, page, limit
 * @param {Object} [params]
 * @returns {Promise<{ cases: Case[], total: number, page: number, totalPages: number }>}
 */
export async function getCases(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/cases${query}`);
}

/**
 * GET /api/cases/:caseId
 * @param {string} caseId — uuid or caseNumber
 * @returns {Promise<{ case: Case }>}
 */
export async function getCase(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}`);
}

/**
 * POST /api/cases
 * @param {{ incidentType: string, complainantName: string, jurisdiction?: string, ... }} body
 * @returns {Promise<Case>}
 */
export async function createCase(body) {
  return apiFetch('/api/cases', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH /api/cases/:caseId
 * @param {string} caseId — uuid or caseNumber
 * @param {Partial<Case>} updates
 * @returns {Promise<{ case: Case }>}
 */
export async function patchCase(caseId, updates) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}


// ─── Evidence API ─────────────────────────────────────────────────────────────

/**
 * GET /api/evidence
 * @param {Object} [params] - { q, caseId, category, status, sortBy, sortOrder, page, limit }
 * @returns {Promise<{ evidence: EvidenceItem[], total: number, page: number, totalPages: number, categoryCounts: Record<string, number> }>}
 */
export async function getEvidence(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/evidence${query}`);
}

/**
 * GET /api/evidence/:id
 * @param {string} id
 * @returns {Promise<{ evidence: EvidenceDetail }>}
 */
export async function getEvidenceDetail(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}`);
}

/**
 * POST /api/evidence/:id/verify
 * @param {string} id
 * @param {Object} [body]
 * @returns {Promise<ReverifyResponse>}
 */
export async function reverifyEvidence(id, body = {}) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * GET /api/evidence/:id/custody
 * @param {string} id
 * @returns {Promise<{ evidenceId: string, custodyLog: CustodyEvent[] }>}
 */
export async function getEvidenceCustody(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/custody`);
}

/**
 * POST /api/evidence/:id/custody
 * @param {string} id
 * @param {{ eventType: string, actor: string, action: string, result?: string, details?: any }} body
 * @returns {Promise<any>}
 */
export async function logCustodyEvent(id, body) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/custody`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Helper to get download / preview URL for evidence
 * @param {string} id
 * @param {boolean} [preview=false]
 * @returns {string}
 */
export function getEvidenceDownloadUrl(id, preview = false) {
  return `${API_BASE}/api/evidence/${encodeURIComponent(id)}/download${preview ? '?preview=1' : ''}`;
}

/**
 * GET /api/cases/:caseId/evidence
 * @param {string} caseId
 * @returns {Promise<{ caseId: string, evidence: EvidenceItem[] }>}
 */
export async function getCaseEvidence(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/evidence`);
}

/**
 * POST /api/evidence/upload
 * Uploads a single file with SHA-256 integrity verification.
 *
 * @param {File} file
 * @param {string} caseId
 * @param {string} clientHash - SHA-256 hex (64 chars) computed client-side
 * @param {string} [evidenceCategory] - optional category override
 * @returns {Promise<UploadResponse>}
 */
export async function uploadEvidence(file, caseId, clientHash, evidenceCategory) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caseId', caseId);
  formData.append('clientHash', clientHash);
  if (evidenceCategory) {
    formData.append('evidenceCategory', evidenceCategory);
  }

  const res = await fetch(`${API_BASE}/api/evidence/upload`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type for multipart — browser sets it with boundary
  });

  if (!res.ok) {
    let errMsg = `Upload failed: ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch (_) {}
    const err = new Error(errMsg);
    err.status = res.status;
    throw err;
  }

  return res.json();
}


// ─── Timeline API ─────────────────────────────────────────────────────────────

/**
 * GET /api/cases/:caseId/timeline
 * @param {string} caseId
 * @returns {Promise<{ caseId: string, events: TimelineEvent[] }>}
 */
export async function getCaseTimeline(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/timeline`);
}

/**
 * POST /api/cases/:caseId/timeline
 * Ingest raw events and normalise them.
 * @param {string} caseId
 * @param {{ rawTimestamp: string, description: string, sourceType: string, evidenceId: string }[]} events
 * @returns {Promise<any>}
 */
export async function ingestTimelineEvents(caseId, events) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/timeline`, {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

/**
 * GET /api/timeline
 * @param {Object} [params] - { caseId, phase, sourceType, evidenceId, startDate, endDate, q }
 * @returns {Promise<{ events: any[], metrics: any, modusOperandi: any }>}
 */
export async function getTimeline(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/timeline${query}`);
}

/**
 * GET /api/communications
 * @param {Object} [params] - { caseId, evidenceId }
 * @returns {Promise<{ transcriptions: any[], chatTranslations: any[], totalCount: number }>}
 */
export async function getCommunications(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/communications${query}`);
}

// ─── Graph / Syndicate API ────────────────────────────────────────────────────

/**
 * GET /api/cases/:caseId/graph
 * @param {string} caseId
 * @returns {Promise<GraphPayload>}
 */
export async function getCaseGraph(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/graph`);
}

/**
 * GET /api/graph
 * Fetch cross-case syndicate graph intelligence with filters.
 * @param {Object} [params] - { caseId, entityType, riskLevel, jurisdiction, q, startDate, endDate }
 * @returns {Promise<GraphPayload>}
 */
export async function getSyndicateGraph(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) qs.set(k, String(v));
  });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/graph${query}`);
}

// ─── Communications API ───────────────────────────────────────────────────────

/**
 * GET /api/cases/:caseId/communications
 * @param {string} caseId
 * @returns {Promise<{ caseId: string, transcriptions: Transcription[], chatTranslations: ChatTranslation[] }>}
 */
export async function getCaseCommunications(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/communications`);
}

// ─── Dossier API ──────────────────────────────────────────────────────────────

/**
 * GET /api/cases/:caseId/dossier
 * @param {string} caseId
 * @returns {Promise<Dossier>}
 */
export async function getCaseDossier(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/dossier`);
}

// ─── Phase 8: Reports, Auth, RBAC & Audit API ─────────────────────────────────

/**
 * POST /api/auth/login
 * @param {string} badgeNumber
 * @param {string} password
 */
export async function login(badgeNumber, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ badgeNumber, password }),
  });
}

/**
 * POST /api/auth/logout
 */
export async function logout() {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

/**
 * GET /api/auth/me
 */
export async function getAuthMe() {
  return apiFetch('/api/auth/me');
}

/**
 * GET /api/officers
 */
export async function getOfficers() {
  return apiFetch('/api/officers');
}

/**
 * POST /api/officers
 * @param {{ badgeNumber: string, name: string, rank: string, role: string, jurisdiction: string, password: string }} data
 */
export async function createOfficer(data) {
  return apiFetch('/api/officers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PATCH /api/officers/:id
 * @param {string} id
 * @param {{ role?: string, status?: string, jurisdiction?: string }} data
 */
export async function updateOfficer(id, data) {
  return apiFetch(`/api/officers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * GET /api/reports/analytics
 * Returns top KPI metrics, donuts, 7-day activity, and top entities
 */
export async function getReportsAnalytics() {
  return apiFetch('/api/reports/analytics');
}

/**
 * GET /api/reports
 * @param {string} [caseId]
 */
export async function getReports(caseId) {
  const query = caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';
  return apiFetch(`/api/reports${query}`);
}

/**
 * POST /api/reports/generate
 * @param {{ caseId: string, type: string, format: string, sections: string[] }} data
 */
export async function generateReport(data) {
  return apiFetch('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * GET /api/reports/:id/download
 * Triggers file download in browser
 * @param {string} id
 */
export async function downloadReport(id) {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}/download`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Download failed (${res.status})`);
  }
  return res.blob();
}

/**
 * GET /api/reports/scheduled
 */
export async function getScheduledReports() {
  return apiFetch('/api/reports/scheduled');
}

/**
 * POST /api/reports/scheduled
 * @param {{ title: string, frequency: string, type: string, recipients: string }} data
 */
export async function createScheduledReport(data) {
  return apiFetch('/api/reports/scheduled', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * GET /api/audit
 * @param {Object} [params] - { user, module, action, startDate, endDate, page, limit }
 */
export async function getAuditLogs(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) qs.set(k, String(v));
  });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/audit${query}`);
}

/**
 * POST /api/audit/export
 * @param {Object} [params] - filters
 * @param {string} [format='csv'] - 'csv' or 'json'
 */
export async function exportAuditLogs(params = {}, format = 'csv') {
  const res = await fetch('/api/audit/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, format }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Export failed (${res.status})`);
  }
  return res.blob();
}


