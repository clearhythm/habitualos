/**
 * @habitualos/frontend-utils - auth.js
 * Client-side session store & user management.
 * Single source of truth for "am I signed in?" based on localStorage.
 */

import { generateUserId } from "../utils/utils.js";

const LOCAL_STORAGE_KEY = "user";

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

/**
 * Get the full user object from localStorage
 */
export function getLocalUser() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const u = JSON.parse(raw);
    return (u && typeof u === "object") ? u : null;
  } catch (e) {
    console.error("Failed to parse local user", e);
    return null;
  }
}

/**
 * Get userId from user object or localStorage
 */
export function getUserId(user = null) {
  const u = user || getLocalUser();
  return u?._userId || u?.id || u?.uid || null;
}

/**
 * Update the userId in localStorage
 * Useful for device linking where userId changes
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
    console.log("Updated userId:", newUserId);
  } catch (e) {
    console.error("Failed to update userId in localStorage", e);
  }
}

/**
 * Create a new local user and save to localStorage
 */
export function createLocalUser() {
  const userId = generateUserId();
  const user = {
    _userId: userId,
    _createdAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    console.log("Created local user:", userId);
  } catch (e) {
    console.error("createLocalUser: failed to write user", e);
  }
  return user;
}
