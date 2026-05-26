/**
 * generateId(prefix) — generates a locally-unique ID.
 * Format: {prefix}-{timestamp}-{random6}
 * Mirrors the pattern used by db-core's uniqueId on the server.
 */
export function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function generateReflectChatId() {
  return generateId('rc');
}
