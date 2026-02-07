/**
 * @habitualos/frontend-utils - auth-remote.js
 * Remote auth/user lookups via /api/users.
 *
 * Routes used:
 *   GET /api/users?email=<email>  -> lookup by _email (unauthenticated; used by signin)
 *   GET /api/users?docId=<uid>    -> get users/<uid> (requires auth; must be self)
 */

/**
 * Find a user by email (used by signin). Unauthenticated lookup.
 * @returns {Object|null} User object with .id on success, or null
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

/**
 * Get a user by ID. Requires an authenticated session.
 * @returns {Object|null} User object with .id on success, or null
 */
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
