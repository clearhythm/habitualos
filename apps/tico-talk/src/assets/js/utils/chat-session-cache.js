// Generic localStorage cache for a chat-style session — read/write an
// arbitrary JSON-serializable blob under a caller-computed key, stamped
// with when it was saved. Not tied to any particular chat feature's key
// scheme or session shape; callers own both.

export function loadSessionCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSessionCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {}
}

export function clearSessionCache(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
