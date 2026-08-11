// Business logic for the Menu drill's two-pass (Basics -> Complete) fact
// coverage: localStorage caching/reconciliation and the pass arithmetic
// that drives which facts are still open to drill. Talks to the network
// only through collections/learn-progress.js — nothing here calls fetch
// directly (see plans/tico-learn-ticket5.md).
//
// Firestore is authoritative, localStorage is a cache: writes go straight
// to Firestore (fire-and-forget), but hydrateSectionCoverage always
// reconciles the local cache against a real read rather than trusting the
// cache alone — a cleared browser or a different device should recover
// real progress, not silently look reset.
//
// A section's DISPLAY tier (Training/Covered/Mastered) is a separate
// concern from the per-item facts below — it's the explicit _progress
// field Firestore stores on each section (see db-learn-progress.cjs),
// never re-derived from the facts. This module doesn't compute it, just
// reads it straight through wherever it's already carrying a section's
// data around.
import { getLearnProgress, writeLearnProgress } from './collections/learn-progress.js';

// 'review' is a third, ungated pass — every fact type at once, mixed
// together, used only for a Covered section's review session (see
// isReviewSession in learn-practice.js). Mirrors the same addition in
// netlify/functions/_services/learn-coverage-logic.cjs.
export const PASS_FACT_TYPES = { basics: ['ingredients'], complete: ['dietary', 'pricing'], review: ['ingredients', 'dietary', 'pricing'] };

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
// flags, never lose or contradict one. Pure per-item {factType: true} data
// only — callers are responsible for keeping anything else (like a
// section's _progress field) out of what they pass in here; see
// hydrateSectionCoverage for how that's kept separate.
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
 *
 * _progress (the section's Training/Covered/Mastered status) isn't per-
 * item coverage, so it's pulled out before merging and put back after —
 * mergeFactCoverage only ever sees plain {factType: true} data, never has
 * to know this field exists. Firestore wins when both sides have it,
 * same authority rule as everything else here.
 */
export async function hydrateSectionCoverage(userId, restaurantId, section) {
  const cached = loadFactCoverageCache(restaurantId, section);
  try {
    const { sections } = await getLearnProgress(userId, restaurantId);
    const remote = sections?.[section] || {};
    const { _progress: cachedProgress, ...cachedItems } = cached || {};
    const { _progress: remoteProgress, ...remoteItems } = remote;
    const reconciled = { ...mergeFactCoverage(cachedItems, remoteItems), _progress: remoteProgress || cachedProgress || null };
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

// progress: 'Training' | 'Covered' | 'Mastered' — see learn-practice.js
// for the three exact moments this gets called.
export function markSectionProgress(userId, restaurantId, section, progress) {
  writeLearnProgress({ userId, restaurantId, section, progress }).catch(() => {});
}

// ─── Coverage arithmetic ──────────────────────────────────────────────────
// sectionItemIds: array of every item id in the section (from menu data).
// sectionProgress: {itemId: {factType: true}, _progress} (from
// factCoverage/Firestore) — the arithmetic below only ever looks up
// specific known item ids, so the extra _progress key riding along is
// harmless to it.

// A playful three-state label instead of a literal count — Erik's call:
// exposing the underlying per-item tally (even as dots, even framed nicely)
// felt like "being tracked"; a coarse, Tico-voiced status doesn't reveal
// the mechanism while still giving a sense of forward motion. Bucketed off
// the same done/total passProgress() already computes, just never shown as
// a fraction. This is the in-drill "how's this pass going" indicator, a
// different thing from the section's stored _progress tier.
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

// Browse-list pill state — reads the section's own stored _progress
// directly (Mastered wins, then Covered), no per-item derivation. Training
// only shows for the single most-recently-entered-Practice section
// (isLastTrained, passed in by the caller) — kept deliberately quiet, not
// every section with a _progress of 'Training' shows a pill, only the
// active one.
export function tierForSection(sectionProgress, isLastTrained) {
  const progress = sectionProgress?._progress;
  if (progress === 'Mastered') return 'mastered';
  if (progress === 'Covered') return 'covered';
  if (progress === 'Training' && isLastTrained) return 'training';
  return 'blank';
}

// One tier per section — for a browse list's initial render.
export function computeTierBySection(menuData, progress) {
  const tierBySection = {};
  [...(menuData?.food || []), ...(menuData?.drinks || [])].forEach((category) => {
    const sectionProgress = progress.sections?.[category.name] || {};
    const isLastTrained = progress.lastTrained === category.name;
    tierBySection[category.name] = tierForSection(sectionProgress, isLastTrained);
  });
  return tierBySection;
}

// Tier for one specific section — for live-refreshing a single pill after
// a write, without a full re-fetch/re-render of the browse list.
export function tierForSectionInProgress(menuData, progress, sectionName) {
  const sectionProgress = progress.sections?.[sectionName] || {};
  const isLastTrained = progress.lastTrained === sectionName;
  return tierForSection(sectionProgress, isLastTrained);
}
