// Shared page script for /menu/food/, /menu/drinks/, /menu-review/ —
// every restaurant's content is baked into the page at build time (same
// pattern as the Learn picker); this just shows the currently-selected
// one, resolving cross-device on a device's first visit.
//
// Also wires up the "Train" link on /menu/food/ and /menu/drinks/
// (menu-review has none): rather than dropping into the picker, it jumps
// straight to the first section this restaurant hasn't learned yet — the categories
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

// ─── In-page Food/Drinks toggle ──────────────────────────────────────────
// One .page-title-switcher exists per restaurant block (only one visible
// at a time, same as everything else on this page) — event delegation
// so it works regardless of how many restaurants exist, no per-instance
// wiring needed. Mirrors the sidemenu restaurant switcher's open/close
// pattern (navigation.js) exactly.
function closeSwitcher(wrapper) {
  wrapper.classList.remove('is-open');
  wrapper.querySelector('.content-type-switcher').hidden = true;
  wrapper.querySelector('.page-title-switcher__trigger')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  const trigger = e.target.closest('.page-title-switcher__trigger');

  if (trigger) {
    const wrapper = trigger.closest('.page-title-switcher');
    const willOpen = wrapper.querySelector('.content-type-switcher').hidden;
    if (openSwitcher) closeSwitcher(openSwitcher);
    if (willOpen) {
      wrapper.classList.add('is-open');
      wrapper.querySelector('.content-type-switcher').hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  if (openSwitcher && !openSwitcher.contains(e.target)) closeSwitcher(openSwitcher);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  if (openSwitcher) closeSwitcher(openSwitcher);
});
