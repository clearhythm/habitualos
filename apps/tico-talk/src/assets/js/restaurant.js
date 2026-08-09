// Shared restaurant-selection utility — used by nav.njk's switcher and by
// every page that renders restaurant-tagged content (learn.js, and the
// menu/drinks/menu-review reference pages).
const STORAGE_KEY = 'tico-current-restaurant';

export function getCurrentRestaurantId(fallbackId) {
  try {
    return localStorage.getItem(STORAGE_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function setCurrentRestaurantId(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export function applyRestaurantFilter(containerSelector, restaurantId) {
  document.querySelectorAll(`${containerSelector}[data-restaurant]`).forEach((el) => {
    el.hidden = el.dataset.restaurant !== restaurantId;
  });
}

// Resolves which restaurant to use on first load for a device with no
// local preference yet: localStorage is the fast path (unchanged
// behavior once a device has picked once); if empty, this is a new
// device for this user, so ask the server for their last-visited
// restaurant before falling back to fallbackId. Always leaves
// localStorage populated afterward so subsequent calls on this device
// take the fast synchronous path via getCurrentRestaurantId.
export async function resolveInitialRestaurantId(userId, fallbackId) {
  let stored;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { stored = null; }
  if (stored) return stored;

  let resolved = fallbackId;
  try {
    const response = await fetch(`/api/user-restaurant-get?userId=${encodeURIComponent(userId)}`);
    if (response.ok) {
      const { lastRestaurantId } = await response.json();
      if (lastRestaurantId) resolved = lastRestaurantId;
    }
  } catch {
    // network hiccup — fall back to fallbackId, same as a brand-new user
  }

  setCurrentRestaurantId(resolved);
  return resolved;
}

// Fire-and-forget — records the switcher's selection so a future visit
// from another device can default to it. Never blocks the caller.
export function saveLastRestaurant(userId, restaurantId) {
  fetch('/api/user-restaurant-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, restaurantId })
  }).catch(() => {});
}
