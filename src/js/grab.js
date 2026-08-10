// "Import" page — pulls a track/playlist/album from YouTube, YouTube Music,
// or SoundCloud (content you own) via the Python/yt-dlp engine in
// downloader/, spawned from the main process (see main.js's grab:start
// handler). Desktop-only: there's no equivalent Python runtime story on
// mobile, same reasoning as the offline-downloads feature's isDesktop gate.

import { isDesktop } from './platform.js';
import { t } from './i18n.js';

const OUTPUT_DIR_KEY = 'jellywave:grabOutputDir';

// Survives navigating away from and back to this view mid-download --
// the IPC listener below is attached once for the app's lifetime and keeps
// updating this regardless of which view is currently mounted.
const state = {
  running: false,
  logLines: [],
  progressDone: 0,
  progressTotal: 0,
  statusText: ''
};

// DOM refs for the currently-mounted instance of this view, or null when
// a different view is showing -- refreshUi() no-ops until re-mounted.
let refs = null;
let listenerAttached = false;

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function ensureListener() {
  if (listenerAttached || !window.api?.grab) return;
  listenerAttached = true;
  window.api.grab.onEvent((data) => {
    if (data.type === 'log') {
      state.logLines.push(data.message);
    } else if (data.type === 'progress') {
      state.progressDone = data.done;
      state.progressTotal = data.total;
      state.statusText = t('grab.progressStatus', { done: data.done, total: data.total });
    } else if (data.type === 'done') {
      state.running = false;
      const ok = data.count - data.failedCount;
      state.statusText = t('grab.doneStatus', { done: ok, total: data.count });
      state.logLines.push(state.statusText);
    } else if (data.type === 'error') {
      state.running = false;
      state.logLines.push(`⚠ ${data.message}`);
    }
    refreshUi();
  });
}

function refreshUi() {
  if (!refs) return;
  refs.logBox.innerHTML = state.logLines.map((line) => `<div class="grab-log-line">${escapeHtml(line)}</div>`).join('');
  refs.logBox.scrollTop = refs.logBox.scrollHeight;
  const pct = state.progressTotal ? Math.round((state.progressDone / state.progressTotal) * 100) : 0;
  refs.progressFill.style.width = `${pct}%`;
  refs.progressWrap.hidden = !state.running && !state.logLines.length;
  refs.statusText.textContent = state.statusText;
  refs.startBtn.hidden = state.running;
  refs.cancelBtn.hidden = !state.running;
  refs.urlInput.disabled = state.running;
  refs.browseBtn.disabled = state.running;
}

export async function renderGrab() {
  const viewRoot = document.getElementById('view-root');
  viewRoot.innerHTML = '';
  viewRoot.appendChild(el('div', 'view-title', t('grab.title')));
  viewRoot.appendChild(el('div', 'grab-subtitle', t('grab.subtitle')));

  if (!isDesktop) {
    refs = null;
    viewRoot.appendChild(el('div', 'empty-state', t('grab.desktopOnly')));
    return;
  }

  ensureListener();

  const card = el('div', 'grab-card');

  const urlField = el('label', 'grab-field', `<span>${escapeHtml(t('grab.urlLabel'))}</span>`);
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = t('grab.urlPlaceholder');
  urlField.appendChild(urlInput);
  card.appendChild(urlField);

  const folderField = el('label', 'grab-field', `<span>${escapeHtml(t('grab.folderLabel'))}</span>`);
  const folderRow = el('div', 'grab-folder-row');
  const folderInput = document.createElement('input');
  folderInput.type = 'text';
  folderInput.readOnly = true;
  folderInput.value = localStorage.getItem(OUTPUT_DIR_KEY) || '';
  folderInput.placeholder = t('grab.folderPlaceholder');
  const browseBtn = el('button', 'btn-secondary', escapeHtml(t('grab.browse')));
  browseBtn.type = 'button';
  folderRow.appendChild(folderInput);
  folderRow.appendChild(browseBtn);
  folderField.appendChild(folderRow);
  card.appendChild(folderField);

  const btnRow = el('div', 'grab-btn-row');
  const startBtn = el('button', 'btn-primary', escapeHtml(t('grab.start')));
  startBtn.type = 'button';
  const cancelBtn = el('button', 'btn-secondary', escapeHtml(t('grab.cancel')));
  cancelBtn.type = 'button';
  cancelBtn.hidden = true;
  btnRow.appendChild(startBtn);
  btnRow.appendChild(cancelBtn);
  card.appendChild(btnRow);

  const progressWrap = el('div', 'grab-progress-wrap');
  const progressBar = el('div', 'grab-progress-bar');
  const progressFill = el('div', 'grab-progress-fill');
  progressBar.appendChild(progressFill);
  const statusText = el('div', 'grab-status');
  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(statusText);
  card.appendChild(progressWrap);

  const logBox = el('div', 'grab-log');
  card.appendChild(logBox);

  viewRoot.appendChild(card);

  refs = { urlInput, folderInput, browseBtn, startBtn, cancelBtn, progressWrap, progressFill, statusText, logBox };

  browseBtn.addEventListener('click', async () => {
    const chosen = await window.api.grab.pickFolder();
    if (chosen) {
      folderInput.value = chosen;
      localStorage.setItem(OUTPUT_DIR_KEY, chosen);
    }
  });

  startBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    const dir = folderInput.value.trim();
    if (!url || !dir) {
      state.logLines.push(t('grab.missingFields'));
      refreshUi();
      return;
    }
    state.running = true;
    state.logLines = [];
    state.progressDone = 0;
    state.progressTotal = 0;
    state.statusText = t('grab.starting');
    refreshUi();
    window.api.grab.start(url, dir);
  });

  cancelBtn.addEventListener('click', () => {
    window.api.grab.cancel();
    state.running = false;
    state.statusText = t('grab.cancelled');
    state.logLines.push(state.statusText);
    refreshUi();
  });

  refreshUi();
}
