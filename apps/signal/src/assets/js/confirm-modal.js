/**
 * confirm-modal.js
 * Powers the shared confirm-modal.njk component.
 * Exposes window.confirmModal() as a Promise-based replacement for window.confirm().
 *
 * Usage (from any other module):
 *   const ok = await window.confirmModal('Delete this evaluation?');
 *   if (ok) { ... }
 *
 *   // Custom button label:
 *   const ok = await window.confirmModal('Remove this item?', { confirmLabel: 'Remove' });
 */

const overlay   = document.getElementById('confirm-modal');
const messageEl = document.getElementById('confirm-modal-message');
const okBtn     = document.getElementById('confirm-modal-ok');
const cancelBtn = document.getElementById('confirm-modal-cancel');

let _resolve = null;

function close(result) {
  overlay.hidden = true;
  document.removeEventListener('keydown', onKeydown);
  if (_resolve) { _resolve(result); _resolve = null; }
}

function onKeydown(e) {
  if (e.key === 'Escape') close(false);
  if (e.key === 'Enter')  close(true);
}

okBtn.addEventListener('click', () => close(true));
cancelBtn.addEventListener('click', () => close(false));
overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

window.confirmModal = function(message, { confirmLabel = 'Delete' } = {}) {
  messageEl.textContent = message;
  okBtn.textContent = confirmLabel;
  overlay.hidden = false;
  okBtn.focus();
  document.addEventListener('keydown', onKeydown);
  return new Promise(resolve => { _resolve = resolve; });
};
