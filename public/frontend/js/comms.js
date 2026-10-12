/**
 * Rakshak — Communication Intelligence Page Script
 * Displays call transcriptions and chat translations.
 */

import { getCaseCommunications, getCases, ACTIVE_CASE_ID, setActiveCaseId } from './api.js';
import { escapeHtml, renderEntityChip, formatUTC } from './utils.js';
import { initLayout } from './layout.js';

// ─── State ────────────────────────────────────────────────────────────────────
let transcriptions = [];
let chatTranslations = [];
let selectedItem = null;
let selectedType = null; // 'transcript' | 'chat'

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  await fetchComms();
  initTabs();
});

// ─── Fetch Communications ─────────────────────────────────────────────────────
async function fetchComms() {
  const container = document.getElementById('comm-detail');
  if (container) {
    container.innerHTML = '<div class="loading-row"><span class="spinner"></span> Loading communications…</div>';
  }

  try {
    let caseId = ACTIVE_CASE_ID;
    if (!caseId) {
      const urlParams = new URLSearchParams(window.location.search);
      caseId = urlParams.get('caseId') || urlParams.get('id') ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('rakshak_active_case_id') : '') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('rakshak_active_case') : '');
    }
    if (!caseId) {
      try {
        const cRes = await getCases({ limit: 1 });
        if (cRes?.cases?.length > 0) {
          caseId = cRes.cases[0].id || cRes.cases[0].caseNumber;
          setActiveCaseId(caseId);
        }
      } catch (_) {}
    }

    if (!caseId) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📡</div>
            <div class="empty-state-title">No Case Selected</div>
            <div class="empty-state-text">Select or register an active investigation case to analyze communication transcripts.</div>
          </div>`;
      }
      return;
    }

    const data = await getCaseCommunications(caseId);
    transcriptions = data?.transcriptions || [];
    chatTranslations = data?.chatTranslations || [];
    renderTranscriptList();
    renderChatList();
    // Auto-select first item
    if (transcriptions.length > 0) selectTranscript(transcriptions[0]);
    else if (chatTranslations.length > 0) selectChat(chatTranslations[0]);
    else showEmptyDetail();
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <div class="empty-state-title">Communications unavailable</div>
          <div class="empty-state-text">Could not load communication intelligence data.</div>
        </div>`;
    }
    console.error(err);
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('[data-comm-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-comm-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.commTab;
      document.querySelectorAll('[data-comm-pane]').forEach(p => {
        p.style.display = p.dataset.commPane === tab ? '' : 'none';
      });
    });
  });
}

// ─── Transcript List ──────────────────────────────────────────────────────────
function renderTranscriptList() {
  const container = document.getElementById('transcript-list');
  if (!container) return;

  if (transcriptions.length === 0) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:11px">No call transcriptions available.</div>';
    return;
  }

  container.innerHTML = transcriptions.map((t, i) => `
    <div class="comm-item" data-index="${i}" data-type="transcript" role="button" tabindex="0">
      <div class="comm-item-title">📞 ${escapeHtml(t.fileName || 'Call Recording')}</div>
      <div class="comm-item-sub">${escapeHtml(t.fileType || '')} · ${escapeHtml(t.originalLanguage || '')} → ${escapeHtml(t.targetLanguage || '')}</div>
      <div style="display:flex;gap:4px;margin-top:4px">
        <span class="badge badge-blue" style="border:1px solid">${escapeHtml(String(t.speakerCount || 2))} Speakers</span>
        <span class="badge badge-green" style="border:1px solid">${Math.round((t.confidence || 0) * 100)}% Conf</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.comm-item').forEach(item => {
    item.addEventListener('click', () => {
      container.querySelectorAll('.comm-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');
      selectTranscript(transcriptions[parseInt(item.dataset.index)]);
    });
  });
}

// ─── Chat List ────────────────────────────────────────────────────────────────
function renderChatList() {
  const container = document.getElementById('chat-list');
  if (!container) return;

  if (chatTranslations.length === 0) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:11px">No chat translations available.</div>';
    return;
  }

  container.innerHTML = chatTranslations.map((ct, i) => `
    <div class="comm-item" data-index="${i}" data-type="chat" role="button" tabindex="0">
      <div class="comm-item-title">💬 ${escapeHtml(ct.fileName || 'Chat Export')}</div>
      <div class="comm-item-sub">${escapeHtml(ct.fileType || '')} · ${escapeHtml(ct.originalLanguage || '')}</div>
      <div style="display:flex;gap:4px;margin-top:4px">
        <span class="badge badge-blue" style="border:1px solid">${(ct.messages || []).length} Messages</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.comm-item').forEach(item => {
    item.addEventListener('click', () => {
      container.querySelectorAll('.comm-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');
      selectChat(chatTranslations[parseInt(item.dataset.index)]);
    });
  });
}

// ─── Detail Views ─────────────────────────────────────────────────────────────
function selectTranscript(t) {
  selectedItem = t;
  selectedType = 'transcript';

  const detail = document.getElementById('comm-detail');
  if (!detail) return;

  const segments = t.segments || [];
  const entityChips = (t.extractedEntities || []).map(e => renderEntityChip(e)).join('');

  const segmentsHTML = segments.length > 0
    ? segments.map(seg => {
        const isSuspect = (seg.speaker || '').toLowerCase().includes('suspect') || seg.speaker === 'S2';
        return `
          <div class="transcript-segment">
            <div>
              <span class="transcript-speaker ${isSuspect ? 'suspect' : 'victim'}">
                ${escapeHtml(seg.speaker || 'Unknown')}
              </span>
              <span class="transcript-time">${escapeHtml(seg.startTime || seg.time || '')}</span>
            </div>
            <div class="transcript-text">${escapeHtml(seg.text || seg.originalText || '—')}</div>
            ${seg.translation ? `<div class="transcript-translated">${escapeHtml(seg.translation)}</div>` : ''}
          </div>`;
      }).join('')
    : '<div style="padding:16px;color:var(--text-muted);font-size:11px">No segments available.</div>';

  detail.innerHTML = `
    <!-- Header -->
    <div class="section-header">
      <div class="section-title">
        <span>📞</span>
        <span>${escapeHtml(t.fileName || 'Call Recording')}</span>
        <span class="badge badge-slate" style="border:1px solid">${escapeHtml(t.transcriptionMethod || 'WHISPER_AI')}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge badge-blue" style="border:1px solid">${escapeHtml(t.originalLanguage || '')} → ${escapeHtml(t.targetLanguage || 'en')}</span>
        <span class="badge badge-green" style="border:1px solid">${Math.round((t.confidence || 0) * 100)}% confidence</span>
      </div>
    </div>

    <!-- Entities -->
    ${entityChips ? `
    <div style="padding:8px 12px;border-bottom:1px solid var(--border-subtle);display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0">
      <span style="font-size:9px;color:var(--text-muted);margin-right:4px;align-self:center">ENTITIES:</span>
      ${entityChips}
    </div>` : ''}

    <!-- SHA Reference -->
    <div style="padding:6px 12px;border-bottom:1px solid var(--border-subtle);flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text-muted)">
      BSA §63 · SHA-256: ${escapeHtml((t.sha256Hash || '').slice(0, 20))}…
    </div>

    <!-- Transcript Body -->
    <div style="flex:1;overflow-y:auto">
      ${segmentsHTML}
    </div>
  `;
}

function selectChat(ct) {
  selectedItem = ct;
  selectedType = 'chat';

  const detail = document.getElementById('comm-detail');
  if (!detail) return;

  const messages = ct.messages || [];
  const entityChips = (ct.extractedEntities || []).map(e => renderEntityChip(e)).join('');

  const messagesHTML = messages.length > 0
    ? messages.map(msg => {
        const isSuspect = (msg.sender || '').toLowerCase().includes('suspect')
          || msg.sender === 'S' || msg.direction === 'outbound';
        return `
          <div class="chat-message ${isSuspect ? 'suspect' : ''}">
            <div class="chat-bubble ${isSuspect ? 'suspect-bubble' : 'victim-bubble'}">
              <div>${escapeHtml(msg.text || msg.translated || msg.original || '—')}</div>
              ${msg.original && msg.translated ? `
              <div style="color:var(--text-muted);font-size:9px;margin-top:2px;font-style:italic">
                [${escapeHtml(msg.original)}]
              </div>` : ''}
              <div class="chat-meta">${escapeHtml(msg.sender || '')} · ${escapeHtml(msg.time || msg.timestamp || '')}</div>
            </div>
          </div>`;
      }).join('')
    : '<div style="padding:16px;color:var(--text-muted);font-size:11px">No messages available.</div>';

  detail.innerHTML = `
    <!-- Header -->
    <div class="section-header">
      <div class="section-title">
        <span>💬</span>
        <span>${escapeHtml(ct.fileName || 'Chat Export')}</span>
        <span class="badge badge-slate" style="border:1px solid">${escapeHtml(ct.translationMethod || 'INDIC_TRANS_AI')}</span>
      </div>
      <span class="badge badge-blue" style="border:1px solid">${escapeHtml(ct.originalLanguage || 'Hinglish')} → English</span>
    </div>

    <!-- Entities -->
    ${entityChips ? `
    <div style="padding:8px 12px;border-bottom:1px solid var(--border-subtle);display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0">
      <span style="font-size:9px;color:var(--text-muted);margin-right:4px;align-self:center">ENTITIES:</span>
      ${entityChips}
    </div>` : ''}

    <!-- Chat Body -->
    <div style="flex:1;overflow-y:auto;padding:8px 0">
      ${messagesHTML}
    </div>
  `;
}

function showEmptyDetail() {
  const detail = document.getElementById('comm-detail');
  if (detail) {
    detail.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <div class="empty-state-title">No communication intelligence yet</div>
        <div class="empty-state-text">Upload call recordings or chat exports to begin analysis.</div>
        <a href="index.html" class="btn btn-primary" style="margin-top:8px">⬆ Upload Evidence</a>
      </div>`;
  }
}
