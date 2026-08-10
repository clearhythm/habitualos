/**
 * Data-Utils.js
 * ------------------------------------------------------
 * One place for this app's client-side id generation, named per entity
 * (mirrors packages/db-core/data-utils.cjs's uniqueId(prefix) on the
 * server — same shape, one file per side).
 * ------------------------------------------------------
 */

/**
 * generateId(prefix) — generates a locally-unique ID.
 * Format: {prefix}-{timestamp}-{random6}
 * Mirrors the pattern used by db-core's uniqueId on the server.
 */
export function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

// Generates a unique learn-chat ID with "lc-" prefix.
export function generateChatId() {
  return generateId('lc');
}
