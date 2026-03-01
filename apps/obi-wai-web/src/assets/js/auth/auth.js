/**
 * @habitualos/frontend-utils - auth.js
 * Client-side session store & user management.
 * Single source of truth for "am I signed in?" based on localStorage.
 */

import { generateUserId } from "/assets/js/utils/utils.js";

const LOCAL_STORAGE_KEY = "user";

// -----------------------------
// Sign In / Out
// -----------------------------
export function signIn(user, refresh = true, redirectUrl = null) {
  if (!user || typeof user !== "object") {
    console.error("signIn() called without a valid user object.");
    return;
  }

  if (!getUserId(user)) {
    console.error("signIn() failed: missing _userId.");
    return;
  }

  const normalized = {
    _userId: getUserId(user),
    _email: getEmail(user),
    _createdAt: getCreatedAt(user),
    profile: {
      firstName: getFirstName(user),
      lastName: getLastName(user)
    }
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));

  if (redirectUrl) {
    window.location.href = redirectUrl;
  } else if (refresh) {
    location.reload();
  }
}

export function signOut(refresh = true, redirectUrl = null) {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  if (redirectUrl) {
    window.location.href = redirectUrl;
  } else if (refresh) {
    location.reload();
  }
}

export function isSignedIn() {
  return !!getUserId();
}

// -----------------------------
// User Initialization
// -----------------------------

/**
 * Initialize user - ensures user exists in localStorage.
 * Creates a new guest user if none exists.
 * @returns {string|null} The userId (e.g., "u-abc123"), or null if failed
 */
export function initializeUser() {
  let user = getLocalUser();
  if (!user) {
    user = createLocalUser();
  }

  const userId = getUserId(user);
  if (!userId) {
    console.error("Could not initialize user");
    return null;
  }

  return userId;
}

// -----------------------------
// Get Full User Object & Attributes
// -----------------------------
export function getLocalUser() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return (u && typeof u === "object") ? u : null;
  } catch (e) {
    console.error("Failed to parse local user", e);
    return null;
  }
}

// -----------------------------
// Field Helpers (accept optional user override)
// -----------------------------
export function getUserId(user = null) {
  const u = user || getLocalUser();
  return u?._userId || u?.id || u?.uid || null;
}

export function getEmail(user = null) {
  const u = user || getLocalUser();
  return u?._email || u?.email || null;
}

export function getFirstName(user = null) {
  const u = user || getLocalUser();
  return u?.profile?.firstName || null;
}

export function getLastName(user = null) {
  const u = user || getLocalUser();
  return u?.profile?.lastName || null;
}

export function getFullName(user = null) {
  const first = getFirstName(user);
  const last = getLastName(user);
  return first && last ? `${first} ${last}` : first || last || null;
}

export function getFriendlyName(user = null) {
  return getFullName(user) || "friend";
}

export function getCreatedAt(user = null) {
  const u = user || getLocalUser();
  return u?._createdAt || null;
}

// -----------------------------
// Setters
// -----------------------------

/**
 * Update the userId in localStorage.
 * Useful for device linking where userId changes.
 */
export function setUserId(newUserId) {
  try {
    const user = getLocalUser();
    if (!user) {
      console.warn("No user found in localStorage to update");
      return;
    }
    user._userId = newUserId;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Failed to update userId in localStorage", e);
  }
}

// -----------------------------
// Guest Creation
// -----------------------------
export function createLocalUser() {
  const userId = generateUserId();
  const user = {
    _userId: userId,
    _createdAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("createLocalUser: failed to write user", e);
  }
  return user;
}
