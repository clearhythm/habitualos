// Shared page script for /menu/ and /menu-review/ — every restaurant's
// content is baked into the page at build time (same pattern as the
// Learn picker); this just shows the currently-selected one, resolving
// cross-device on a device's first visit.
//
// /menu/ also has an in-page Food/Drinks toggle (both baked into the DOM,
// filtered client-side — same reasoning as restaurant filtering: this
// app bakes menu content at build time on purpose, to avoid a live
// fetch path duplicating a source of truth that already exists) and a
// "Train" link (menu-review has neither): rather than dropping into the
// picker, Train jumps straight to the first section this restaurant
// hasn't learned yet — the categories on the page, food then drinks, in
// their real order, cross-referenced against the same learned-section
// tracking the picker itself uses. Falls back to the first category if
// everything's already learned, so it's never a dead link. Lands on the
// teach phase, not drill — skipping straight into cold Q&A would bypass
// the "study the section first" step the app's own two-phase design
// depends on (see docs/DESIGN.md's Menu & Off-Menu mechanic).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId, applyRestaurantFilter } from './restaurant.js';
import { getLearnedSections } from './learned-sections.js';

const CONTENT_TYPE_KEY = 'tico-current-content-type';

function getCurrentContentType() {
  try {
    return localStorage.getItem(CONTENT_TYPE_KEY) || 'food';
  } catch {
    return 'food';
  }
}

function setCurrentContentType(type) {
  try { localStorage.setItem(CONTENT_TYPE_KEY, type); } catch {}
}

function applyContentTypeFilter(contentType) {
  // Scoped to .menu-content-panel specifically — the toggle's own option
  // buttons also carry a data-content-type attribute (to identify which
  // is which on click), and a bare [data-content-type] selector here
  // would match and hide those too.
  document.querySelectorAll('.menu-content-panel[data-content-type]').forEach((el) => {
    el.hidden = el.dataset.contentType !== contentType;
  });
  document.querySelectorAll('.page-title-switcher').forEach((wrapper) => {
    const label = contentType === 'drink' ? 'Drinks' : 'Food';
    const trigger = wrapper.querySelector('.page-title-switcher__label');
    if (trigger) trigger.textContent = label;
    wrapper.querySelectorAll('.content-type-switcher__option').forEach((opt) => {
      opt.classList.toggle('is-current', opt.dataset.contentType === contentType);
    });
  });
}

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
  applyContentTypeFilter(getCurrentContentType());
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
// wiring needed. Open/close mirrors the sidemenu restaurant switcher
// exactly (navigation.js); selecting an option filters in place, no
// navigation, same as switching restaurants.
function closeSwitcher(wrapper) {
  wrapper.classList.remove('is-open');
  wrapper.querySelector('.content-type-switcher').hidden = true;
  wrapper.querySelector('.page-title-switcher__trigger')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  const option = e.target.closest('.content-type-switcher__option');
  const trigger = e.target.closest('.page-title-switcher__trigger');

  if (option) {
    const contentType = option.dataset.contentType;
    setCurrentContentType(contentType);
    applyContentTypeFilter(contentType);
    if (openSwitcher) closeSwitcher(openSwitcher);
    return;
  }

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
