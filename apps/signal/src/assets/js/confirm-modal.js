/**
 * confirm-modal.js
 * Powers confirm-modal.njk macro instances.
 * Exposes window.confirmModal(message, options) as a Promise-based
 * replacement for window.confirm().
 *
 * Usage from any module on a page that includes the macro:
 *   const ok = await window.confirmModal('Delete this evaluation?');
 *   const ok = await window.confirmModal('Remove?', { confirmLabel: 'Remove', id: 'my-modal' });
 */

function initModal(overlay) {
  const messageEl = overlay.querySelector('[id$="-message"]');
  const okBtn     = overlay.querySelector('[data-confirm-ok]');
  const cancelBtn = overlay.querySelector('[data-confirm-cancel]');

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

  return function open(message, { confirmLabel = okBtn.textContent.trim() } = {}) {
    messageEl.textContent = message;
    okBtn.textContent = confirmLabel;
    overlay.hidden = false;
    okBtn.focus();
    document.addEventListener('keydown', onKeydown);
    return new Promise(resolve => { _resolve = resolve; });
  };
}

// Wire up all modals on this page; default (first) is exposed as window.confirmModal
const modals = document.querySelectorAll('.confirm-modal-overlay');
modals.forEach(overlay => {
  const open = initModal(overlay);
  // Register by id so callers can target a specific modal
  window[`confirmModal_${overlay.id}`] = open;
});

// Convenience: window.confirmModal() always targets the first modal on the page
if (modals.length) {
  window.confirmModal = window[`confirmModal_${modals[0].id}`];
}
