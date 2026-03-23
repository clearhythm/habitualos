/**
 * API base URL resolver.
 *
 * Defaults to relative paths (works in production and netlify dev).
 * Set window.__API_BASE to override — useful for testing against a specific server.
 *
 * Example:
 *   window.__API_BASE = 'http://localhost:8888';  // point dashboard at local functions
 */

const BASE = (typeof window !== 'undefined' && window.__API_BASE) || '';

export function apiUrl(path) {
  return `${BASE}${path}`;
}
