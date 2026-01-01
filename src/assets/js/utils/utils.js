// Utility functions for HabitualOS

// Public function for anything that needs a generic unique ID
export function generateUniqueId() {
  return generateShortUniqueId();
}

// Generates a short, unique 8-char Base36 string (timestamp + random)
function generateShortUniqueId() {
  const timestamp = Math.floor(Date.now() / 1000);      // seconds
  const randomPart = Math.floor(Math.random() * 1000);  // 0–999
  return (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

// Generates a unique User ID with "u-" prefix
export function generateUserId() {
  return 'u-' + generateUniqueId();
}

// Generates a unique Practice ID with "p-" prefix
export function generatePracticeId() {
  return 'p-' + generateUniqueId();
}
