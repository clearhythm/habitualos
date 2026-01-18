// Utility functions for HabitualOS

// Public function for anything that needs a generic unique ID
export function generateUniqueId() {
  return generateShortUniqueId();
}

// Generates a short, unique 8-char Base36 string (timestamp + random)
function generateShortUniqueId() {
  const timestamp = Math.floor(Date.now() / 1000);      // seconds
  const randomPart = Math.floor(Math.random() * 1000);  // 0–999
  return (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

// Generates a unique User ID with "u-" prefix
export function generateUserId() {
  return 'u-' + generateUniqueId();
}

// Generates a unique Practice ID with "p-" prefix
export function generatePracticeId() {
  return 'p-' + generateUniqueId();
}

// -----------------------------
// URL Utilities
// -----------------------------

/**
 * Build URL with query params
 * Handles empty/absent params gracefully
 * Uses URLSearchParams for safe encoding
 */
export function buildUrl(base, params) {
  const qs = new URLSearchParams(params || {}).toString();
  return qs ? `${base}?${qs}` : base;
}

// -----------------------------
// Formatting Utilities
// -----------------------------

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
 * Format runtime as relative time ("X days ago", "X hours ago", etc.)
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

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Get icon for artifact type
 */
export function getArtifactIcon(type) {
  const icons = {
    markdown: '📄',
    code: '💻',
    image: '🖼️',
    data: '📊'
  };
  return icons[type] || '📄';
}

/**
 * Get action ID from current URL
 * URL format: /do/action/UUID
 */
export function getActionIdFromUrl() {
  const pathParts = window.location.pathname.split('/').filter(p => p);
  if (pathParts[0] === 'do' && pathParts[1] === 'action' && pathParts[2]) {
    return pathParts[2];
  }
  return null;
}
