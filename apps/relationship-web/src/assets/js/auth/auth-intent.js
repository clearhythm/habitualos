/**
 * @habitualos/frontend-utils - auth-intent.js
 * Return-to (intended path) helpers for sign-in redirects.
 */

export function saveIntendedPath(path = location.pathname + location.search) {
  try { sessionStorage.setItem("nextPath", path); } catch {}
  document.cookie = `nextPath=${encodeURIComponent(path)}; Path=/; Max-Age=900; SameSite=Lax`;
}

export function readIntendedPath() {
  const urlNext = new URLSearchParams(location.search).get("next");
  if (urlNext) return urlNext;

  const m = (document.cookie || "").match(/(?:^|;\s*)nextPath=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);

  try { return sessionStorage.getItem("nextPath") || "/"; } catch { return "/"; }
}

export function clearIntendedPath() {
  try { sessionStorage.removeItem("nextPath"); } catch {}
  document.cookie = "nextPath=; Path=/; Max-Age=0; SameSite=Lax";
}

export function redirectToSignIn(intended = location.pathname + location.search) {
  saveIntendedPath(intended);
  const nextParam = encodeURIComponent(intended);
  location.href = `/signin/?next=${nextParam}`;
}
