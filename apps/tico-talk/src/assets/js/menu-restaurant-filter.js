// Shared page script for /food/, /drinks/, /menu-review/ — every
// restaurant's content is baked into the page at build time (same
// pattern as the Learn picker); this just shows the currently-selected
// one, resolving cross-device on a device's first visit.
//
// Also wires up the "Train" link on /food/ and /drinks/ (menu-review has
// none): rather than dropping into the picker, it jumps straight to the
// first section this restaurant hasn't learned yet — the categories
// visible on the page (food-only or drinks-only, whichever page this is)
// in their real order, cross-referenced against the same learned-section
// tracking the picker itself uses. Falls back to the first category if
// everything's already learned, so it's never a dead link. Lands on the
// teach phase, not drill — skipping straight into cold Q&A would bypass
// the "study the section first" step the app's own two-phase design
// depends on (see docs/DESIGN.md's Menu & Off-Menu mechanic).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId, applyRestaurantFilter } from './restaurant.js';
import { getLearnedSections } from './learned-sections.js';

function updateTrainLink(restaurantId) {
  const section = document.querySelector(`.menu-review__venue[data-restaurant="${restaurantId}"]`);
  const trainLink = section?.querySelector('.page-header__action');
  if (!trainLink) return;

  const categoryNames = Array.from(section.querySelectorAll('.menu-category__name')).map((el) => el.textContent.trim());
  if (!categoryNames.length) return;

  const learned = getLearnedSections(restaurantId);
  const target = categoryNames.find((name) => !learned[name]) || categoryNames[0];
  trainLink.href = `/learn/?section=${encodeURIComponent(target)}&phase=teach`;
}

(async function () {
  const fallbackId = document.body.dataset.firstRestaurantId;
  const currentId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);
  applyRestaurantFilter('.menu-review__venue', currentId);
  updateTrainLink(currentId);
})();

// The nav switcher changes restaurant without reloading — re-filter and
// recompute the Train target in place when that happens while this page
// is open.
window.addEventListener('tico:restaurant-changed', (e) => {
  applyRestaurantFilter('.menu-review__venue', e.detail.restaurantId);
  updateTrainLink(e.detail.restaurantId);
});
