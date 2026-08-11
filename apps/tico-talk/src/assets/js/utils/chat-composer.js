// Generic behaviors for a chat-style textarea + send button pair — auto-
// resize, Enter-submits-on-desktop, and keeping a send button's disabled
// state in sync with whether there's anything to send. Not tied to any
// particular chat feature.

// Reset to auto first so scrollHeight re-measures from a collapsed
// state, otherwise it only ever grows.
export function initAutoResizeTextarea(textarea, onResize) {
  textarea?.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = `${this.scrollHeight}px`;
    onResize?.();
  });
}

// Desktop: Enter submits. Mobile (coarse pointer): Enter inserts a
// newline, matching native textarea behavior. Shift+Enter always inserts
// a newline on both.
export function initEnterToSubmit(textarea, form) {
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = window.matchMedia('(pointer: coarse)').matches;
      if (!isMobile) {
        e.preventDefault();
        form.requestSubmit();
      }
    }
  });
}

export function updateSendButtonState(textarea, button) {
  button.disabled = textarea.value.trim().length === 0;
}
