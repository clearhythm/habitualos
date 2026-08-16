import { get } from '../api.js';
import { log } from '../utils/log.js';

// Menu content (categories + items) is fetched on demand and cached in
// localStorage rather than baked into the page at build time for every
// restaurant — see /api/restaurant-menu-get and _services/db-restaurants.cjs
// on the server side. A 24h TTL is enough for now (menu content is
// staff-edited, not user-generated, so it rarely changes); a real
// invalidation hook (e.g. tied to the "flag this info as wrong"
// correction flow) can replace this later if that turns out to matter.
const TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(restaurantId) {
  return `tico-menu-cache-${restaurantId}`;
}

// Drops every cached restaurant's menu (not just the current one — a
// phone that's switched restaurants could have more than one stale
// entry), forcing the next getRestaurantMenu call for each to refetch.
// Manual escape hatch for the 24h TTL above (see /stats/'s "Refresh menu
// data" button) — staff shouldn't have to know how to clear site data on
// their own phone to see a menu correction land immediately.
export function clearMenuCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('tico-menu-cache-'))
    .forEach((key) => localStorage.removeItem(key));
}

export async function getRestaurantMenu(restaurantId) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(restaurantId)) || 'null');
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      log('debug', '[restaurant-menus] cache hit', { restaurantId });
      return cached.data;
    }
  } catch {
    // corrupt/inaccessible localStorage — fall through to a fresh fetch
  }

  log('debug', '[restaurant-menus] fetching', { restaurantId });
  const data = await get(`/api/restaurant-menu-get?restaurantId=${encodeURIComponent(restaurantId)}`);
  try {
    localStorage.setItem(cacheKey(restaurantId), JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    // localStorage full/unavailable — data still returned, just won't be cached
  }
  return data;
}
