//
// netlify/functions/_services/db-learn-progress.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Progress) for Firestore.
// Tracks per-item, per-fact-type coverage for the Menu drill's two-pass
// (Basics -> Complete) model — see apps/tico-talk/plans/tico-learn-ticket5.md.
//
// One doc per (user, restaurant) pair — not one doc per user with
// restaurant as a nested object key. Matches this app's id-generation
// convention (see _utils/data-utils.cjs's generateProgressId(), same
// pattern as db-learn-chats.cjs's generateChatId()):
//
//   learn-progress/{lp-xxxxx}
//   {
//     _progressId: "lp-xxxxx",      // mirrors the doc id — useful in
//                                    // queries/lookups, survives being
//                                    // flattened into a plain object
//     _userId: "u-...",
//     _restaurantId: "margaritaville",
//     sections: {
//       _lastTrained: "Starters" | null,  // sibling key, NOT a section —
//                                          // see getLearnProgress below
//       "Starters": {
//         "chips-and-salsa": { "ingredients": true, "dietary": true, "pricing": true },
//         "guacamole":       { "ingredients": true }
//       },
//       "Tacos": {
//         "baja-fish-tacos": { "ingredients": true }
//       }
//     },
//     _createdAt, _updatedAt
//   }
//
// _lastTrained lives inside `sections` (not at the doc's top level)
// because it's semantically about which section it points into, not doc
// identity — getLearnProgress is the one place that destructures it back
// out, so no other caller (client tier rollup, Ticket 7) ever needs to
// filter it out of `sections` itself.
// ------------------------------------------------------

const { create, query } = require('@habitualos/db-core');
const { generateProgressId } = require('../_utils/data-utils.cjs');

const COLLECTION = 'learn-progress';

/**
 * Resolve the (user, restaurant) pair to its progress doc, or null if one
 * doesn't exist yet. db-core has no compound queries, so this queries by
 * _userId and filters to _restaurantId in JS.
 * @returns {Promise<Object|null>}
 */
async function findProgressDoc(userId, restaurantId) {
  const docs = await query({ collection: COLLECTION, where: `_userId::eq::${userId}` });
  return docs.find((d) => d._restaurantId === restaurantId) || null;
}

/**
 * Mark one fact type, for one item, within a section, as covered for this
 * user at this restaurant. Resolves the doc first (find-or-create) since
 * the doc id is a generated lp- id, not derivable from (userId,
 * restaurantId) directly. Relies on Firestore's real recursive merge on
 * nested map fields (confirmed: db-core's create() does ref.set(data,
 * {merge: true}), which deep-merges nested maps) — sibling items/fact-types
 * /sections are untouched by this write.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 * @param {string} itemId
 * @param {'ingredients'|'dietary'|'pricing'} factType
 */
exports.markFactLearned = async (userId, restaurantId, sectionName, itemId, factType) => {
  const existing = await findProgressDoc(userId, restaurantId);
  const data = { sections: { [sectionName]: { [itemId]: { [factType]: true } } } };
  if (existing) {
    return create({ collection: COLLECTION, id: existing._progressId, data });
  }
  const id = generateProgressId();
  return create({
    collection: COLLECTION,
    id,
    data: { _progressId: id, _userId: userId, _restaurantId: restaurantId, ...data }
  });
};

/**
 * Set the "last trained" pointer for this user at this restaurant — drives
 * the browse list's Training pill. Same find-or-create shape as
 * markFactLearned; writes into the same `sections` map as a sibling key.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 */
exports.setLastTrained = async (userId, restaurantId, sectionName) => {
  const existing = await findProgressDoc(userId, restaurantId);
  const data = { sections: { _lastTrained: sectionName } };
  if (existing) {
    return create({ collection: COLLECTION, id: existing._progressId, data });
  }
  const id = generateProgressId();
  return create({
    collection: COLLECTION,
    id,
    data: { _progressId: id, _userId: userId, _restaurantId: restaurantId, ...data }
  });
};

/**
 * Read back a user's full progress for one restaurant. Never returns null
 * — a never-yet-trained restaurant gets an empty-but-valid shape.
 * @param {string} userId
 * @param {string} restaurantId
 * @returns {Promise<{sections: Object, lastTrained: string|null}>}
 */
exports.getLearnProgress = async (userId, restaurantId) => {
  const doc = await findProgressDoc(userId, restaurantId);
  const { _lastTrained, ...sections } = doc?.sections || {};
  return { sections, lastTrained: _lastTrained || null };
};
