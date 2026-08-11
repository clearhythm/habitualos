// Business logic for the Menu drill's two-pass (Basics -> Complete) fact
// coverage: localStorage caching/reconciliation and the tier/pass
// arithmetic. Talks to the network only through collections/learn-progress.js
// — nothing here calls fetch directly (see plans/tico-learn-ticket5.md).
//
// Firestore is authoritative, localStorage is a cache: writes go straight
// to Firestore (fire-and-forget), but hydrateSectionCoverage always
// reconciles the local cache against a real read rather than trusting the
// cache alone — a cleared browser or a different device should recover
// real progress, not silently look reset.
import { getLearnProgress, writeLearnProgress } from './collections/learn-progress.js';

export const PASS_FACT_TYPES = { basics: ['ingredients'], complete: ['dietary', 'pricing'] };

function lsCoverageKey(restaurantId, section) {
  return `tico-learn-coverage-${restaurantId}-${section}`;
}

// ─── Per-section coverage cache ──────────────────────────────────────────
export function loadFactCoverageCache(restaurantId, section) {
  try {
    const raw = localStorage.getItem(lsCoverageKey(restaurantId, section));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveFactCoverageCache(restaurantId, section, coverage) {
  try {
    localStorage.setItem(lsCoverageKey(restaurantId, section), JSON.stringify(coverage));
  } catch {
    // localStorage full/unavailable — non-fatal, Firestore still has it
  }
}

// Testing/support utility — clears the local cache side of a section
// reset. Firestore reconciliation is monotonic (union-merge, never
// removes), so the Firestore side must also be cleared separately or
// this cache will just get refilled from there on next hydration — see
// resetSectionProgress in collections/learn-progress.js.
export function clearFactCoverageCache(restaurantId, section) {
  try {
    localStorage.removeItem(lsCoverageKey(restaurantId, section));
  } catch {}
}

// Union merge — safe because coverage is monotonic (a fact, once covered,
// is never uncovered), so merging two coverage maps can only ever add true
// flags, never lose or contradict one.
export function mergeFactCoverage(a, b) {
  const merged = {};
  for (const itemId of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    merged[itemId] = { ...(a || {})[itemId], ...(b || {})[itemId] };
  }
  return merged;
}

/**
 * Reconciles the local cache for one section against Firestore. Callers
 * should paint from loadFactCoverageCache() first for an instant, no-flash
 * render, then call this and re-render with the (possibly richer) result.
 * Falls back to the cache silently if Firestore is unreachable.
 */
export async function hydrateSectionCoverage(userId, restaurantId, section) {
  const cached = loadFactCoverageCache(restaurantId, section);
  try {
    const { sections } = await getLearnProgress(userId, restaurantId);
    const reconciled = mergeFactCoverage(cached, sections?.[section] || {});
    saveFactCoverageCache(restaurantId, section, reconciled);
    return reconciled;
  } catch {
    return cached;
  }
}

/**
 * Full restaurant progress (every section) — for the browse list's
 * tier/pill computation and the Train-link target. No local cache; the
 * browse list already shows a skeleton while menu content loads, same
 * tolerance applies here.
 */
export async function hydrateRestaurantProgress(userId, restaurantId) {
  try {
    return await getLearnProgress(userId, restaurantId);
  } catch {
    return { sections: {}, lastTrained: null };
  }
}

// ─── Writes (fire-and-forget) ────────────────────────────────────────────
export function markFactCovered(userId, restaurantId, section, itemId, factType) {
  writeLearnProgress({ userId, restaurantId, section, itemId, factType }).catch(() => {});
}

export function markLastTrained(userId, restaurantId, section) {
  writeLearnProgress({ userId, restaurantId, lastTrained: section }).catch(() => {});
}

// ─── Coverage arithmetic ──────────────────────────────────────────────────
// sectionItemIds: array of every item id in the section (from menu data).
// sectionProgress: {itemId: {factType: true}} (from factCoverage/Firestore).

// A playful three-state label instead of a literal count — Erik's call:
// exposing the underlying per-item tally (even as dots, even framed nicely)
// felt like "being tracked"; a coarse, Tico-voiced status doesn't reveal
// the mechanism while still giving a sense of forward motion. Bucketed off
// the same done/total passProgress() already computes, just never shown as
// a fraction.
export function passStatusLabel(sectionItemIds, sectionProgress, pass) {
  const { done, total } = passProgress(sectionItemIds, sectionProgress, pass);
  if (!total || done === 0) return 'Training';
  if (done / total < 0.67) return 'Warming Up';
  return 'Getting Hot';
}

export function passForSection(sectionItemIds, sectionProgress) {
  const allIngredientsDone = sectionItemIds.every((id) => sectionProgress?.[id]?.ingredients);
  return allIngredientsDone ? 'complete' : 'basics';
}

export function passProgress(sectionItemIds, sectionProgress, pass) {
  const types = PASS_FACT_TYPES[pass];
  let done = 0;
  const total = sectionItemIds.length * types.length;
  sectionItemIds.forEach((id) => types.forEach((t) => { if (sectionProgress?.[id]?.[t]) done++; }));
  return { done, total };
}

// "Covered," not "Mastered" — every fact got asked and answered correctly
// once. Real mastery (durable retention) is a separate, later concept
// tied to repeated correct Review passes over time, not this.
export function isSectionCovered(sectionItemIds, sectionProgress) {
  return sectionItemIds.length > 0 && sectionItemIds.every((id) => {
    const item = sectionProgress?.[id];
    return item?.ingredients && item?.dietary && item?.pricing;
  });
}

// Browse-list pill state — 'covered' wins outright; 'training' only for
// the single most-recently-entered-Practice section (isLastTrained, passed
// in by the caller); otherwise 'blank'. Kept deliberately quiet: no
// "training" pill for every section with partial, non-active progress.
export function tierForSection(sectionItemIds, sectionProgress, isLastTrained) {
  if (isSectionCovered(sectionItemIds, sectionProgress)) return 'covered';
  if (isLastTrained) return 'training';
  return 'blank';
}

// ─── Menu-data-shaped helpers ─────────────────────────────────────────────
// Pure lookups over a {food, drinks} menu-data object — callers pass their
// own already-loaded data in, this module holds no page state itself.

function itemIdsForSection(menuData, sectionName) {
  const all = [...(menuData?.food || []), ...(menuData?.drinks || [])];
  return all.find((c) => c.name === sectionName)?.items.map((item) => item.id) || [];
}

// One tier per section — for a browse list's initial render.
export function computeTierBySection(menuData, progress) {
  const tierBySection = {};
  [...(menuData?.food || []), ...(menuData?.drinks || [])].forEach((category) => {
    const itemIds = category.items.map((item) => item.id);
    const sectionProgress = progress.sections?.[category.name] || {};
    const isLastTrained = progress.lastTrained === category.name;
    tierBySection[category.name] = tierForSection(itemIds, sectionProgress, isLastTrained);
  });
  return tierBySection;
}

// Tier for one specific section — for live-refreshing a single pill after
// a write, without a full re-fetch/re-render of the browse list.
export function tierForSectionInProgress(menuData, progress, sectionName) {
  const itemIds = itemIdsForSection(menuData, sectionName);
  const sectionProgress = progress.sections?.[sectionName] || {};
  const isLastTrained = progress.lastTrained === sectionName;
  return tierForSection(itemIds, sectionProgress, isLastTrained);
}
