// /profile/ — the shareable-with-management view: who you are, and your
// real Progress (moved here from the old standalone /stats/ page, since
// it's the same data Profile is already for, not a separate concept).
// Includes the Reset control too, as the full original widget (name,
// tier, and Reset together) — resetting a section's progress is a real
// management action (re-training someone), not just a private debug
// tool, so it stays on the shareable page rather than moving to
// /settings/ (which only has the menu-content cache refresh, a
// genuinely different, non-progress utility).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId } from './restaurant.js';
import { getRestaurantMenu } from './collections/restaurant-menus.js';
import { hydrateRestaurantProgress, computeTierBySection, clearFactCoverageCache } from './learn-coverage.js';
import { resetSectionProgress } from './collections/learn-progress.js';
import { clearChatState } from './learn-practice.js';
import { log } from './utils/log.js';

const listEl = document.getElementById('profile-sections');
const venueNameEl = document.getElementById('profile-venue-name');
let currentRestaurantId = null;

// Reads the restaurant's display name from the page's own hidden data
// list (see profile.njk) — restaurant switching is /menu/-only, so
// there's no sidemenu switcher DOM to read this off of.
function getRestaurantName(restaurantId) {
  return document.querySelector(`#profile-restaurant-names [data-restaurant-id="${restaurantId}"]`)?.textContent || '';
}

function tierLabel(tier) {
  if (tier === 'mastered') return 'Mastered';
  if (tier === 'covered') return 'Covered';
  if (tier === 'training') return 'Training';
  return '—';
}

function renderRow(sectionName, tier) {
  const row = document.createElement('div');
  row.className = 'profile-row';

  const name = document.createElement('span');
  name.className = 'profile-row__name';
  name.textContent = sectionName;
  row.appendChild(name);

  const tierEl = document.createElement('span');
  tierEl.className = `profile-row__tier profile-row__tier--${tier}`;
  tierEl.textContent = tierLabel(tier);
  row.appendChild(tierEl);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'profile-row__reset';
  resetBtn.textContent = 'Reset';
  resetBtn.disabled = tier === 'blank';
  resetBtn.addEventListener('click', async () => {
    if (!window.confirm(`Reset all progress for "${sectionName}"? This can't be undone.`)) return;
    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting…';
    try {
      await resetSectionProgress(getOrCreateUserId(), currentRestaurantId, sectionName);
    } catch (err) {
      log('error', '[profile] reset failed', err);
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

(async function () {
  const fallbackId = document.body.dataset.firstRestaurantId;
  currentRestaurantId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);
  await load();
})();

window.addEventListener('tico:restaurant-changed', async (e) => {
  currentRestaurantId = e.detail.restaurantId;
  await load();
});
