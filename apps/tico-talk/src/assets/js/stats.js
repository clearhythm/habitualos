// /stats/ — currently just a "reset progress" utility for the current
// restaurant's Menu sections (testing/support, not a trainee-facing
// feature). Lists every section with its current tier and a Reset button
// that clears both the Firestore side (learn-progress-reset.cjs) and the
// two localStorage caches (fact coverage + chat history) — all three
// need clearing, or the untouched ones just refill the cleared ones on
// next hydration (union-merge is monotonic, never removes).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId } from './restaurant.js';
import { getRestaurantMenu, clearMenuCache } from './collections/restaurant-menus.js';
import { hydrateRestaurantProgress, computeTierBySection, clearFactCoverageCache } from './learn-coverage.js';
import { resetSectionProgress } from './collections/learn-progress.js';
import { clearChatState } from './learn-practice.js';
import { log } from './utils/log.js';

const listEl = document.getElementById('stats-sections');
const venueNameEl = document.getElementById('stats-venue-name');
const refreshMenuBtn = document.getElementById('stats-refresh-menu');
let currentRestaurantId = null;

// Reads the restaurant's display name from the page's own hidden data
// list (see stats.njk) — restaurant switching is /menu/-only now, so
// there's no sidemenu switcher DOM to read this off of anymore.
function getRestaurantName(restaurantId) {
  return document.querySelector(`#stats-restaurant-names [data-restaurant-id="${restaurantId}"]`)?.textContent || '';
}

function tierLabel(tier) {
  if (tier === 'mastered') return 'Mastered';
  if (tier === 'covered') return 'Covered';
  if (tier === 'training') return 'Training';
  return '—';
}

function renderRow(sectionName, tier) {
  const row = document.createElement('div');
  row.className = 'stats-row';

  const name = document.createElement('span');
  name.className = 'stats-row__name';
  name.textContent = sectionName;
  row.appendChild(name);

  const tierEl = document.createElement('span');
  tierEl.className = `stats-row__tier stats-row__tier--${tier}`;
  tierEl.textContent = tierLabel(tier);
  row.appendChild(tierEl);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'stats-row__reset';
  resetBtn.textContent = 'Reset';
  resetBtn.disabled = tier === 'blank';
  resetBtn.addEventListener('click', async () => {
    if (!window.confirm(`Reset all progress for "${sectionName}"? This can't be undone.`)) return;
    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting…';
    const userId = getOrCreateUserId();
    try {
      await resetSectionProgress(userId, currentRestaurantId, sectionName);
    } catch (err) {
      log('error', '[stats] reset failed', err);
    }
    clearFactCoverageCache(currentRestaurantId, sectionName);
    clearChatState(currentRestaurantId, sectionName);
    await load();
  });
  row.appendChild(resetBtn);

  return row;
}

async function load() {
  if (venueNameEl) venueNameEl.textContent = getRestaurantName(currentRestaurantId);
  const userId = getOrCreateUserId();
  const [menuData, progress] = await Promise.all([
    getRestaurantMenu(currentRestaurantId),
    hydrateRestaurantProgress(userId, currentRestaurantId)
  ]);
  const tierBySection = computeTierBySection(menuData, progress);
  const allSections = [...(menuData.food || []), ...(menuData.drinks || [])];

  listEl.innerHTML = '';
  if (!allSections.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No sections found for this restaurant.';
    listEl.appendChild(empty);
    return;
  }
  allSections.forEach((category) => {
    listEl.appendChild(renderRow(category.name, tierBySection[category.name] || 'blank'));
  });
}

refreshMenuBtn?.addEventListener('click', async () => {
  refreshMenuBtn.disabled = true;
  refreshMenuBtn.textContent = 'Refreshing…';
  clearMenuCache();
  await load();
  refreshMenuBtn.textContent = 'Refresh menu data';
  refreshMenuBtn.disabled = false;
});

(async function () {
  const fallbackId = document.body.dataset.firstRestaurantId;
  currentRestaurantId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);
  await load();
})();

window.addEventListener('tico:restaurant-changed', async (e) => {
  currentRestaurantId = e.detail.restaurantId;
  await load();
});
