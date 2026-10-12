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
 * Active case ID — dynamically resolved from session storage or first active case.
 */
export let ACTIVE_CASE_ID = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('rakshak_active_case_id') : '') || '';

export function setActiveCaseId(id) {
  ACTIVE_CASE_ID = id || '';
  try {
    if (id) {
      sessionStorage.setItem('rakshak_active_case_id', id);
    } else {
      sessionStorage.removeItem('rakshak_active_case_id');
    }
  } catch (_) {}
}

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
 * GET /api/entities
 * @param {Object} [params] - { q, entityType, caseId, evidenceId, verificationStatus, sortBy, sortOrder, page, limit }
 */
export async function getEntities(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/entities${query}`);
}

/**
 * GET /api/entities/:id
 * @param {string} id
 */
export async function getEntityDetail(id) {
  return apiFetch(`/api/entities/${encodeURIComponent(id)}`);
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
 * GET /api/evidence/:id/text
 * @param {string} id
 */
export async function getEvidenceText(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/text`);
}

/**
 * POST /api/evidence/:id/extract — Trigger re-extraction
 * @param {string} id
 */
export async function triggerExtraction(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * POST /api/evidence/:id/ocr — Trigger on-demand forensic OCR
 * @param {string} id
 */
export async function triggerOcr(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/ocr`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * GET /api/evidence/:id/ocr — Fetch OCR processing status & telemetry
 * @param {string} id
 */
export async function getEvidenceOcr(id) {
  return apiFetch(`/api/evidence/${encodeURIComponent(id)}/ocr`);
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

// ─── Clusters API ─────────────────────────────────────────────────────────────
/**
 * GET /api/clusters
 * Returns cross-case syndicate clusters
 */
export async function getClusters() {
  return apiFetch('/api/clusters');
}

/**
 * GET /api/entities?caseId=:caseId
 * Fetch all extracted forensic entities associated with a specific case
 */
export async function getCaseEntities(caseId) {
  return apiFetch(`/api/entities?caseId=${encodeURIComponent(caseId)}`);
}

// ─── Legal Matrix API ─────────────────────────────────────────────────────────
/**
 * GET /api/cases/:caseId/legal
 */
export async function getCaseLegal(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal`);
}

/**
 * POST /api/cases/:caseId/legal
 */
export async function addCaseLegalSection(caseId, data) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE /api/cases/:caseId/legal
 */
export async function deleteCaseLegalSection(caseId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, String(v)); });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal${query}`, {
    method: 'DELETE',
  });
}

/**
 * POST /api/cases/:caseId/legal/map-evidence
 */
export async function mapEvidenceToLegal(caseId, data) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal/map-evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * POST /api/cases/:caseId/legal/review
 */
export async function validateCaseDossier(caseId) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal/review`, {
    method: 'POST',
  });
}

/**
 * GET /api/cases/:caseId/legal/review?format=:format
 */
export async function exportCaseDossier(caseId, format = 'json') {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/legal/review?format=${encodeURIComponent(format)}`);
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
 * @param {string|Object} [params]
 */
export async function getReports(params) {
  if (!params) {
    return apiFetch('/api/reports');
  }
  if (typeof params === 'string') {
    return apiFetch(`/api/reports?caseId=${encodeURIComponent(params)}`);
  }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null && v !== 'ALL') {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? '?' + qs.toString() : '';
  return apiFetch(`/api/reports${query}`);
}

/**
 * GET /api/reports/:id
 * @param {string} id
 */
export async function getReportDetail(id) {
  return apiFetch(`/api/reports/${encodeURIComponent(id)}`);
}

/**
 * PATCH /api/reports/:id
 * @param {string} id
 * @param {Object} data
 */
export async function updateReport(id, data) {
  return apiFetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
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

/**
 * GET /api/clusters/:id
 */
export async function getCluster(clusterId) {
  return apiFetch(`/api/clusters/${encodeURIComponent(clusterId)}`);
}

// ─── Authentication & Session Management (Phase 21) ─────────────────────────

/**
 * POST /api/auth/login
 * @param {string} identifier - Badge number or email
 * @param {string} password - Officer password
 * @returns {Promise<{ success: boolean, token: string, officer: Object, permissions: string[] }>}
 */
export async function loginOfficer(identifier, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

/**
 * POST /api/auth/logout
 * Revokes current session and clears HTTP-only cookie
 */
export async function logoutOfficer() {
  return apiFetch('/api/auth/logout', {
    method: 'POST',
  });
}

/**
 * GET /api/auth/me
 * Retrieves currently active authenticated officer and role permissions
 */
export async function getCurrentOfficerSession() {
  return apiFetch('/api/auth/me');
}

/**
 * POST /api/auth/onboard-request
 * Submit a pending department onboarding request (Non-privileged, creates pending queue item only)
 * @param {Object} data
 */
export async function submitDepartmentOnboardingRequest(data) {
  return apiFetch('/api/auth/onboard-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * GET /api/auth/onboard-requests
 * Retrieve pending department onboarding requests (Requires ADMIN)
 */
export async function getDepartmentOnboardingRequests() {
  return apiFetch('/api/auth/onboard-requests');
}

