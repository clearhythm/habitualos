// TEMPORARY STUB (Ticket 2) — Ticket 3 replaces this with real calls to
// /api/learn-chat-save and /api/learn-chat-get (netlify/functions), mirroring
// apps/dreamscape/src/assets/js/collections/reflect-chats.js. Until then,
// section chat persistence to Firestore is a no-op — everything above this
// (localStorage save/load/TTL, the three boundary call-sites) works and is
// testable now; only the actual Firestore write is missing.

export function saveLearnChatBeacon() {
  return false; // "not queued" — flushSectionChat falls back to saveLearnChat()
}

export async function saveLearnChat() {
  return { ok: false, stub: true };
}

export async function getLearnChat() {
  return { found: false };
}
