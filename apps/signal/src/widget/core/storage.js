// core/storage.js — visitor ID and owner session persistence

const VISITOR_KEY = 'signal_visitor_id';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function ownerKey(signalId) {
  return `signal_owner_${signalId}`;
}

export function getOwnerSession(signalId) {
  try {
    const raw = localStorage.getItem(ownerKey(signalId));
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(ownerKey(signalId));
      return null;
    }
    return data; // { userId, signalId, displayName }
  } catch {
    return null;
  }
}

export function setOwnerSession(userId, signalId, displayName) {
  const payload = {
    data: { userId, signalId, displayName },
    expiresAt: Date.now() + TTL_MS,
  };
  localStorage.setItem(ownerKey(signalId), JSON.stringify(payload));
}

export function clearOwnerSession(signalId) {
  localStorage.removeItem(ownerKey(signalId));
}
