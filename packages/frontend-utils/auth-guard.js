/**
 * @habitualos/frontend-utils - auth-guard.js
 * One-liner guards for protected pages.
 *
 * Usage:
 *   import { requireSignIn } from '@habitualos/frontend-utils/auth-guard.js';
 *   if (!requireSignIn()) return; // redirects to /signin
 */

import { isSignedIn } from "./auth.js";
import { redirectToSignIn } from "./auth-intent.js";

/**
 * Synchronous guard using client state (localStorage-based).
 * Redirects to /signin if not signed in.
 * @returns {boolean} true if signed in, false if redirecting
 */
export function requireSignIn(intended = location.pathname + location.search) {
  if (!isSignedIn()) {
    redirectToSignIn(intended);
    return false;
  }
  return true;
}

/**
 * Async guard for future server-session verification.
 * @param {Function} fetchSession - async function returning { user }
 * @returns {Promise<boolean>} true if signed in, false if redirecting
 */
export async function requireSignInAsync(fetchSession, intended = location.pathname + location.search) {
  try {
    const { user } = await fetchSession();
    if (!user) {
      redirectToSignIn(intended);
      return false;
    }
    return true;
  } catch {
    redirectToSignIn(intended);
    return false;
  }
}
