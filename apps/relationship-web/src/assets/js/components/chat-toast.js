/**
 * @habitualos/frontend-utils - chat-toast.js
 * Inline toast notification component for chat interfaces.
 * Shows a brief message that fades after ~2 seconds.
 */

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {Object} options - Configuration options
 * @param {HTMLElement} [options.container] - Container to append toast to (defaults to body)
 * @param {number} [options.duration=2000] - Duration in ms before fade
 * @param {string} [options.type='success'] - Toast type: 'success', 'error', 'info'
 */
export function showToast(message, options = {}) {
  const {
    container = document.body,
    duration = 2000,
    type = 'success'
  } = options;

  // Remove any existing toasts
  const existing = document.querySelector('.chat-toast');
  if (existing) {
    existing.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'chat-toast';

  // Style based on type
  const colors = {
    success: { bg: '#3b0f80', text: '#fff' },
    error: { bg: '#ef4444', text: '#fff' },
    info: { bg: '#3b82f6', text: '#fff' }
  };
  const color = colors[type] || colors.success;

  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: ${color.bg};
    color: ${color.text};
    padding: 0.75rem 1.5rem;
    border-radius: 24px;
    font-size: 0.95rem;
    font-weight: 500;
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;

  toast.textContent = message;
  container.appendChild(toast);

  // Fade out after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}
