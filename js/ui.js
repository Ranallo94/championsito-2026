/**
 * CHAMPIONSITO — ui.js
 * Utilities UI: toast, modal, spinner, helpers DOM (porting 1:1 da Formulito/Medusino).
 */

let _toastTimer = null;

export function showToast(msg, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[type] || 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

export function openModal({ title = '', body = '', buttons = [] } = {}) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const closeBtn = document.getElementById('modal-close');

  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  footerEl.innerHTML = '';

  buttons.forEach(({ label, cls = 'btn btn-secondary', onClick }) => {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = label;
    btn.addEventListener('click', () => { if (onClick) onClick(); });
    footerEl.appendChild(btn);
  });

  overlay.style.display = '';
  closeBtn.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.addEventListener('keydown', _escListener);
}

function _escListener(e) { if (e.key === 'Escape') closeModal(); }

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  document.removeEventListener('keydown', _escListener);
}

export function showSpinner(containerId, msg = 'Caricamento…') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${msg}</p></div>`;
}

export function showError(containerId, msg = 'Errore nel caricamento.') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${msg}</p></div>`;
}

export function showEmpty(containerId, msg = 'Nessun dato disponibile.', icon = '📭') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
}

export function html2el(htmlStr) {
  const tpl = document.createElement('template');
  tpl.innerHTML = htmlStr.trim();
  return tpl.content.firstElementChild;
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
