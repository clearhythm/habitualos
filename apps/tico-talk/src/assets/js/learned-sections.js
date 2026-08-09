// Client-side mirror of the Firestore learn-progress write (see
// _services/db-learn-progress.cjs) — lets the picker badge learned
// sections, and other pages (the Food/Drinks reference pages' "Train"
// button) route around them, without a network round-trip. Nested by
// restaurant so two restaurants' progress never bleed into each other —
// same reasoning as restaurant.js.
const STORAGE_KEY = 'tico-learned-sections';

export function getLearnedSections(restaurantId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[restaurantId] || {};
  } catch {
    return {};
  }
}

export function markSectionLearnedLocally(restaurantId, sectionName) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[restaurantId] = all[restaurantId] || {};
    all[restaurantId][sectionName] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // non-fatal — the picker just won't show the badge until next real fetch
  }
}
