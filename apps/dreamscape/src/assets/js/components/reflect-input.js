const SEND_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M8 1.5L12.5 9H10V14.5H6V9H3.5L8 1.5Z"/></svg>`;

/**
 * Render the reflect chat input shell into `container`.
 * Uses the same CSS classes as reflect.njk so styling is always in sync.
 *
 * @param {HTMLElement} container
 * @param {{ placeholder?: string, onTap?: () => void }} opts
 *   onTap: if set, tapping the textarea calls this instead of submitting (tour mode)
 * @returns {() => void} teardown
 */
export function renderReflectInput(container, { placeholder = 'Reply…', onTap } = {}) {
  container.innerHTML = `
    <div class="chat-input-shell">
      <form class="chat-input-row" autocomplete="off">
        <div class="chat-input-wrap">
          <textarea class="chat-textarea" name="message" rows="2" placeholder="${placeholder}" aria-label="Your message"></textarea>
          <div class="chat-input-toolbar">
            <button type="submit" class="chat-send-btn" disabled aria-label="Send">${SEND_ICON}</button>
          </div>
        </div>
      </form>
    </div>`;

  if (onTap) {
    const textarea = container.querySelector('.chat-textarea');
    textarea.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); }, { once: true });
  }

  return () => { container.innerHTML = ''; };
}
