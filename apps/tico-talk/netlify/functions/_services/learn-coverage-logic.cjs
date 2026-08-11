// Shared coverage arithmetic used by both learn-chat-init.cjs (picks the
// target for this turn's question/evaluation) and learn-tool-execute.cjs
// (re-derives that same target, then computes what comes next). Both call
// sites are handed the same factCoverage for a given turn, so as long as
// they use this same deterministic logic they always agree on what's
// being asked about without needing to pass it between them explicitly.
//
// Mirrored client-side in src/assets/js/learn-coverage.js (ESM vs CJS
// means it can't literally be the same file) — keep the two in sync by
// hand if this logic ever changes; it's a handful of lines specifically
// to avoid that risk.

const PASS_FACT_TYPES = { basics: ['ingredients'], complete: ['dietary', 'pricing'] };

function findSection(restaurant, sectionName) {
  return [...restaurant.food, ...restaurant.drinks].find((c) => c.name === sectionName) || null;
}

function derivePass(section, factCoverage) {
  const allIngredientsDone = section.items.every((item) => factCoverage?.[item.id]?.ingredients);
  return allIngredientsDone ? 'complete' : 'basics';
}

// Deterministic, not random: first not-yet-covered (item, factType) pair
// in section/pass order. A fixed, predictable drilling order is the right
// choice for a training tool (systematic coverage, nothing skipped) and
// it means the client can independently re-derive the exact same target
// from the same factCoverage, no extra plumbing needed to keep them in
// sync.
function pickNextTarget(section, factCoverage, pass) {
  const types = PASS_FACT_TYPES[pass];
  for (const item of section.items) {
    for (const type of types) {
      if (!factCoverage?.[item.id]?.[type]) return { itemId: item.id, factType: type };
    }
  }
  return null; // nothing left this pass
}

// Only "correct" marks a fact covered — "partial"/"incorrect" leave it
// open to be asked again later, same semantics the client has always used.
function mergeFactResult(factCoverage, itemId, factType, result) {
  if (result !== 'correct') return factCoverage;
  return { ...factCoverage, [itemId]: { ...factCoverage?.[itemId], [factType]: true } };
}

function isPassMastered(section, factCoverage, pass) {
  return pickNextTarget(section, factCoverage, pass) === null;
}

module.exports = { PASS_FACT_TYPES, findSection, derivePass, pickNextTarget, mergeFactResult, isPassMastered };
