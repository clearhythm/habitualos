const COOKIE_KEY   = 'dp-next-path';
const SESSION_KEY  = 'dp-next-path';
const COOKIE_MAX   = 900;

export function saveIntendedPath(path) {
  const p = path || window.location.pathname + window.location.search;
  try { sessionStorage.setItem(SESSION_KEY, p); } catch (_) {}
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(p)}; max-age=${COOKIE_MAX}; path=/; SameSite=Lax`;
}

export function readIntendedPath() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('next')) return decodeURIComponent(params.get('next'));

  const cookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE_KEY + '='));
  if (cookie) return decodeURIComponent(cookie.slice(COOKIE_KEY.length + 1));

  try { const s = sessionStorage.getItem(SESSION_KEY); if (s) return s; } catch (_) {}

  return '/';
}

export function clearIntendedPath() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  document.cookie = `${COOKIE_KEY}=; max-age=0; path=/; SameSite=Lax`;
}
