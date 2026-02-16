/**
 * modal.js - Reusable modal component
 *
 * Creates a centered overlay modal with customizable content.
 * Used for sun points awards, confirmations, etc.
 */

/**
 * Create a modal instance
 * @param {Object} options
 * @param {string} options.id - Unique DOM id for the modal
 * @param {string} [options.emoji] - Large emoji displayed at top
 * @param {string} [options.title] - Modal title text
 * @param {string} [options.subtitle] - Subtitle text below title
 * @param {string} [options.contentHtml] - Additional HTML content
 * @param {string} [options.confirmLabel] - Confirm button text (default: "OK")
 * @param {string} [options.dismissLabel] - Dismiss button text (optional, hidden if not set)
 * @returns {{ show: Function, hide: Function, confirmBtn: HTMLElement, dismissBtn: HTMLElement|null, contentEl: HTMLElement, overlay: HTMLElement }}
 */
export function createModal({
  id,
  emoji = '',
  title = '',
  subtitle = '',
  contentHtml = '',
  confirmLabel = 'OK',
  dismissLabel = ''
}) {
  // Remove existing modal with same id
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 1000; align-items: center; justify-content: center;';

  const card = document.createElement('div');
  card.style.cssText = 'background: white; padding: 2.5rem 2rem; border-radius: 12px; text-align: center; max-width: 420px; margin: 0 1rem; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);';

  let html = '';
  if (emoji) html += `<div style="font-size: 2.5rem; margin-bottom: 0.75rem;">${emoji}</div>`;
  if (title) html += `<h3 class="modal-title" style="margin: 0 0 0.5rem 0; font-size: 1.25rem; color: #1e0a3c;">${title}</h3>`;
  if (subtitle) html += `<p class="modal-subtitle" style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #666; line-height: 1.4;">${subtitle}</p>`;
  html += `<div class="modal-content"></div>`;
  html += `<button class="modal-confirm" style="margin-top: 1rem; padding: 0.75rem 2rem; background: #7c3aed; color: white; border: none; border-radius: 24px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);">${confirmLabel}</button>`;
  if (dismissLabel) {
    html += `<button class="modal-dismiss" style="display: block; margin: 1.25rem auto 0; padding: 0.5rem 1rem; background: transparent; color: #999; border: none; font-size: 0.9rem; cursor: pointer; text-decoration: underline;">${dismissLabel}</button>`;
  }

  card.innerHTML = html;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const contentEl = card.querySelector('.modal-content');
  if (contentHtml) contentEl.innerHTML = contentHtml;

  const confirmBtn = card.querySelector('.modal-confirm');
  const dismissBtn = card.querySelector('.modal-dismiss') || null;

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide, confirmBtn, dismissBtn, contentEl, overlay };
}
