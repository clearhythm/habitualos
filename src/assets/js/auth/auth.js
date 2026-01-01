//
// auth.js - HabitualOS
// ------------------------------------------------------
// Client-side session store & getters.
// Single source of truth for "am I signed in?" based on localStorage.
// ------------------------------------------------------
//
import { generateUserId } from "/assets/js/utils/utils.js";

// Keys & Constants
const LOCAL_STORAGE_KEY = "user";

// TEMPORARY: Hardcoded userId for testing across localhost and dev server
// This ensures the same data is visible regardless of domain
const HARDCODED_USER_ID = "u-mgpqwa49";

// -----------------------------
// User Initialization
// -----------------------------

/**
 * Initialize user - ensures user exists in localStorage
 *
 * This is the main entry point for user management. Call this when your page loads
 * to ensure a user exists. It will:
 * 1. Get existing user from localStorage OR create a new guest user if none exists
 * 2. Return the userId for immediate use
 *
 * Usage:
 *   const userId = initializeUser();
 *   // userId is ready to use immediately
 *
 * @returns {string|null} The userId (e.g., "u-abc123"), or null if initialization failed
 */
export function initializeUser() {
  // TEMPORARY: Return hardcoded userId for testing across environments
  // This bypasses localStorage to ensure same data across localhost and dev server
  return HARDCODED_USER_ID;

  /* Original implementation (commented out for testing):
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
  */
}

// -----------------------------
// Get Full User Object & Attributes
// -----------------------------
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

export function getUserId(user = null) {
  const u = user || getLocalUser();
  return u?._userId || u?.id || u?.uid || null;
}

/**
 * Update the userId in localStorage
 * Useful for device linking where userId changes
 *
 * @param {string} newUserId - The new userId to set
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

// -----------------------------
// Guest Creation
// -----------------------------
export function createLocalUser() {
  const userId = generateUserId();
  const user = {
    _userId: userId,
    _createdAt: new Date().toISOString()
  };

  // save user to localStorage for local persistence
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    console.log("Created local user:", userId);
  } catch (e) {
    console.error("createLocalUser: failed to write user", e);
  }
  return user;
}
