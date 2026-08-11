// Shared coverage arithmetic. The app owns "ordering" — which pass you're
// in, when a pass is complete, when a section is mastered, what happens
// next — but NOT which specific open item gets asked about on a given
// turn. That's the model's free choice: learn-chat-init.cjs hands it the
// open-items list for the current pass, and it reports its own pick back
// via record_fact_result's nextItemId/nextFactType. learn-tool-execute.cjs
// validates that pick against real coverage (falling back to the first
// open item if it's ever invalid/stale) rather than computing it itself.
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

// Every not-yet-covered (item, factType) pair for this pass, in section
// order. Not a single "the" target — just the full open set, for the
// model to freely choose from (learn-chat-init.cjs) and for
// learn-tool-execute.cjs to validate a choice against / fall back to.
function openTargets(section, factCoverage, pass) {
  const types = PASS_FACT_TYPES[pass];
  const open = [];
  section.items.forEach((item) => {
    types.forEach((type) => {
      if (!factCoverage?.[item.id]?.[type]) open.push({ itemId: item.id, factType: type });
    });
  });
  return open;
}

// Only "correct" marks a fact covered — "partial"/"incorrect" leave it
// open to be asked again later, same semantics the client has always used.
function mergeFactResult(factCoverage, itemId, factType, result) {
  if (result !== 'correct') return factCoverage;
  return { ...factCoverage, [itemId]: { ...factCoverage?.[itemId], [factType]: true } };
}

module.exports = { PASS_FACT_TYPES, findSection, derivePass, openTargets, mergeFactResult };
