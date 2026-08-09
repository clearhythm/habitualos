import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId, setCurrentRestaurantId, saveLastRestaurant } from './restaurant.js';

// Fade in nav-bar background once page content scrolls under it
function updateNavBar() {
  const navBar = document.getElementById('nav-bar');
  if (navBar) navBar.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateNavBar, { passive: true });

// Restaurant switcher — populate the trigger label with the actual
// current restaurant (falls back to the first restaurant server-rendered
// into the trigger until this resolves) and wire the popover.
document.addEventListener('DOMContentLoaded', async function() {
  const wrapper = document.querySelector('.sidemenu-venue-switcher');
  const trigger = document.getElementById('restaurant-switcher-trigger');
  const popover = document.getElementById('restaurant-switcher');
  const nameEl = document.getElementById('current-restaurant-name');
  if (!wrapper || !trigger || !popover || !nameEl) return;

  const fallbackId = document.body.dataset.firstRestaurantId;
  const currentId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);

  const options = Array.from(popover.querySelectorAll('.restaurant-switcher__option'));
  const current = options.find((opt) => opt.dataset.restaurantId === currentId);
  if (current) {
    nameEl.textContent = current.textContent;
    options.forEach((opt) => opt.classList.toggle('is-current', opt === current));
  }

  function closeSwitcher() {
    wrapper.classList.remove('is-open');
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    const willOpen = popover.hidden;
    closeSwitcher();
    if (willOpen) {
      popover.hidden = false;
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  options.forEach((opt) => {
    opt.addEventListener('click', function() {
      const restaurantId = opt.dataset.restaurantId;
      const userId = getOrCreateUserId();
      setCurrentRestaurantId(restaurantId);
      saveLastRestaurant(userId, restaurantId);
      nameEl.textContent = opt.textContent;
      options.forEach((o) => o.classList.toggle('is-current', o === opt));
      closeSwitcher();
      // No page reload — every page that renders restaurant-tagged
      // content listens for this and re-filters in place.
      window.dispatchEvent(new CustomEvent('tico:restaurant-changed', { detail: { restaurantId } }));
    });
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeSwitcher();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSwitcher();
  });
});

// Sidemenu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  const navBar = document.getElementById('nav-bar');
  const toggle = document.getElementById('sidemenu-toggle');
  const overlay = document.getElementById('sidemenu-overlay');

  // Set --nav-height from the actual rendered bar height so the
  // page-canvas mixin stays accurate.
  if (navBar) {
    document.documentElement.style.setProperty('--nav-height', navBar.offsetHeight + 'px');
  }

  function closeMenu() {
    document.body.classList.remove('sidemenu-open');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      document.body.classList.toggle('sidemenu-open');
    });
  }

  // Desktop-only overlay (the dimmed area beside the partial panel) closes
  // the menu on click; on mobile the panel fills the screen so this never
  // renders.
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  document.querySelectorAll('.sidemenu-left a[href]').forEach(function(link) {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenu();
  });
});
