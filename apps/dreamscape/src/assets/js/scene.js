import { log } from './utils/log.js';

// Tier thresholds — from Witness-Scene-Tiers spec
// 0: bare sky
// 1: celestial (sun/moon/stars)
// 2: mountains (left + right)
// 3: river/stream
// 4: tree (foreground)
// 5: birds in tree
const TIER_ELEMENT_SELECTORS = {
  1: '.scene-celestial',
  // 2: mountains removed — controlled by stoneLevel (data-stones), not binary tier
  3: '.scene-river',
  4: '.scene-tree',
  5: '.scene-birds',
};

export function getStoredTier() {
  const v = localStorage.getItem('dp-scene-tier');
  return v !== null ? Math.min(5, Math.max(0, parseInt(v, 10))) : 0;
}

function saveStoredTier(tier) {
  localStorage.setItem('dp-scene-tier', String(tier));
}

// preview: true = just show the tier visually, no animate-in, no save (for URL param testing)
export function initScene({ tier, stoneLevel = 0, overrideHour = null, preview = false }) {
  const backdrop = document.querySelector('.scene-backdrop');
  if (!backdrop) return;

  backdrop.dataset.tier   = String(tier);
  backdrop.dataset.stones = String(Math.min(5, Math.max(0, stoneLevel)));
  log('debug', '[scene] tier', tier, '| stones', stoneLevel, preview ? '(preview)' : '');

  if (!preview) {
    const prevTier  = getStoredTier();
    const isNewTier = tier > prevTier;

    if (isNewTier && tier > 0) {
      const selector = TIER_ELEMENT_SELECTORS[tier];
      if (selector) {
        const el = backdrop.querySelector(selector);
        if (el) {
          el.classList.add('scene-element--new');
          el.addEventListener('animationend', () => el.classList.remove('scene-element--new'), { once: true });
        }
      }
      saveStoredTier(tier);
      log('debug', '[scene] new tier unlocked:', tier);
    }
  }

  const hour = overrideHour ?? (new Date().getHours() + new Date().getMinutes() / 60);
  _updateCelestial(backdrop, hour, tier);
}

function _updateCelestial(backdrop, hour, tier) {
  if (tier < 1) return;

  const isDay   = hour >= 6 && hour < 20;
  const sunEl   = backdrop.querySelector('.scene-sun');
  const moonEl  = backdrop.querySelector('.scene-moon');
  const starsEl = backdrop.querySelector('.scene-stars');

  if (sunEl)   sunEl.hidden   = !isDay;
  if (moonEl)  moonEl.hidden  = isDay;
  if (starsEl) starsEl.hidden = isDay;
  // Position is handled entirely by CSS — orbs are always centered, half-buried at bottom
}
