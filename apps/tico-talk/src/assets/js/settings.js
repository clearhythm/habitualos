// /settings/ — private account settings, never shown to management (see
// /profile/ for the shareable view). Just a language preference
// (display-only for now — English, no other language is actually built
// yet) and the "refresh menu data" cache-clear utility. The per-section
// progress-reset widget lives on /profile/ instead, as the full thing
// (name, tier, and Reset together) — see profile.js. Refresh is
// genuinely just a menu-content cache utility, not a progress concept,
// so it's fine living here on its own.
import { clearMenuCache } from './collections/restaurant-menus.js';

const refreshMenuBtn = document.getElementById('settings-refresh-menu');

refreshMenuBtn?.addEventListener('click', () => {
  refreshMenuBtn.disabled = true;
  refreshMenuBtn.textContent = 'Refreshing…';
  clearMenuCache();
  setTimeout(() => {
    refreshMenuBtn.textContent = 'Refresh menu data';
    refreshMenuBtn.disabled = false;
  }, 400);
});
