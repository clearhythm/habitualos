/**
 * modal.js
 * Powers modal.njk macro instances (small type).
 *
 * Usage from any module on a page that includes the confirm macro:
 *   const ok = await window.modal('Delete this evaluation?');
 *   const ok = await window.modal('Remove?', { confirmLabel: 'Remove' });
 *
 * Multiple modals on one page: give each a unique id,
 * then target by id: window.modal_my-id('message').
 */

function initModal(overlay) {
  const messageEl = overlay.querySelector('[id$="-message"]');
  const okBtn     = overlay.querySelector('[data-modal-ok]');
  const cancelBtn = overlay.querySelector('[data-modal-cancel]');

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

// Wire up all small modals on this page
const modals = document.querySelectorAll('.modal-overlay--small');
modals.forEach(overlay => {
  window[`modal_${overlay.id}`] = initModal(overlay);
});

// Convenience: window.modal() targets the first one
if (modals.length) {
  window.modal = window[`modal_${modals[0].id}`];
}
