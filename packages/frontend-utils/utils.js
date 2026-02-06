/**
 * @habitualos/frontend-utils - utils.js
 * Shared utility functions for HabitualOS browser apps.
 */

// Generates a short, unique 8-char Base36 string (timestamp + random)
function generateShortUniqueId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomPart = Math.floor(Math.random() * 1000);
  return (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

/**
 * Generate a unique ID (generic)
 */
export function generateUniqueId() {
  return generateShortUniqueId();
}

/**
 * Generate a unique User ID with "u-" prefix
 */
export function generateUserId() {
  return 'u-' + generateUniqueId();
}

/**
 * Build URL with query params
 */
export function buildUrl(base, params) {
  const qs = new URLSearchParams(params || {}).toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format state for display (e.g., 'in_progress' -> 'In Progress')
 */
export function formatState(state) {
  if (!state) return 'Unknown';
  return state.split('_').map(capitalize).join(' ');
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format runtime as relative time
 */
export function formatRuntime(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  if (diffMinutes > 0) return `${diffMinutes} min`;
  return 'Just now';
}
