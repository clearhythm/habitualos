/**
 * @habitualos/frontend-utils - auth-remote.js
 * Remote auth/user lookups via /api/users.
 */

export async function getRemoteUserByEmail(email) {
  try {
    const url = `/api/users?email=${encodeURIComponent(String(email || "").trim())}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch (err) {
    console.error("getRemoteUserByEmail failed", err);
    return null;
  }
}

export async function getRemoteUserById(userId) {
  try {
    const url = `/api/users?docId=${encodeURIComponent(String(userId || ""))}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch (err) {
    console.error("getRemoteUserById failed", err);
    return null;
  }
}
