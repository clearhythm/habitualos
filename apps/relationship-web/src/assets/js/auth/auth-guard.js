/**
 * @habitualos/frontend-utils - auth-guard.js
 * One-liner guards for protected pages.
 */

import { isSignedIn } from "./auth.js";
import { redirectToSignIn } from "./auth-intent.js";

export function requireSignIn(intended = location.pathname + location.search) {
  if (!isSignedIn()) {
    redirectToSignIn(intended);
    return false;
  }
  return true;
}

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
