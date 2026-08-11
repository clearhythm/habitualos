//
// netlify/functions/_services/db-learn-progress.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Progress) for Firestore.
// Tracks per-item, per-fact-type coverage for the Menu drill's two-pass
// (Basics -> Complete) model, plus each section's own canonical progress
// tier — see apps/tico-talk/plans/tico-learn-ticket5.md.
//
// One doc per (user, restaurant) pair — not one doc per user with
// restaurant as a nested object key. Doc id is deterministic, not
// randomly generated: `lp-{userId minus its u- prefix}-{restaurantId}`.
// Since the doc is always looked up by exactly this pair, computing the
// id directly means every operation is a plain get/create by known id —
// no query needed to resolve (userId, restaurantId) -> docId first, and
// db-core's create() already merges-if-exists/creates-if-not on its own,
// so there's no separate existence check needed either. (An earlier pass
// at this used a randomly generated id + a query-by-_userId-then-filter
// lookup, matching learn-chats' pattern — reconsidered once it was clear
// the natural key here is stable and always known upfront, unlike a chat
// session's id, which the client has to remember across saves.)
//
//   learn-progress/{lp-xxxxx-restaurantid}
//   {
//     _progressId: "lp-xxxxx-restaurantid",  // mirrors the doc id —
//                                             // still useful even though
//                                             // it's derivable, e.g. if
//                                             // this doc is ever read
//                                             // without its id metadata
//     _userId: "u-xxxxx",
//     _restaurantId: "margaritaville",
//     sections: {
//       _lastTrained: "Starters" | null,  // sibling key, NOT a section —
//                                          // see getLearnProgress below
//       "Starters": {
//         _progress: "Training" | "Covered" | "Mastered",  // the single
//                    // canonical status for this section — set explicitly
//                    // at the three moments it actually changes (see
//                    // setSectionProgress), never re-derived from the
//                    // per-item facts below it. Read directly, not computed.
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
// filter it out of `sections` itself. _progress lives inside each
// section's own object the same way, one level deeper, for the same
// reason: it's about that section, not doc identity. The per-item facts
// stay purely operational data for the drill itself (which facts are
// still open to ask about); _progress is the separate, explicit "what do
// I show the user" field — nothing here ever tries to compute one from
// the other.
// ------------------------------------------------------

const { create, get, FieldValue } = require('@habitualos/db-core');

const COLLECTION = 'learn-progress';

function progressId(userId, restaurantId) {
  return `lp-${userId.replace(/^u-/, '')}-${restaurantId}`;
}

/**
 * Mark one fact type, for one item, within a section, as covered for this
 * user at this restaurant. Relies on Firestore's real recursive merge on
 * nested map fields (confirmed: db-core's create() does ref.set(data,
 * {merge: true}), which deep-merges nested maps) — sibling items/fact-types
 * /sections (including that same section's own _progress field) are
 * untouched by this write, and create() itself handles create-if-new vs.
 * merge-if-exists, so this never needs to check first.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 * @param {string} itemId
 * @param {'ingredients'|'dietary'|'pricing'} factType
 */
exports.markFactLearned = async (userId, restaurantId, sectionName, itemId, factType) => {
  const id = progressId(userId, restaurantId);
  return create({
    collection: COLLECTION,
    id,
    data: {
      _progressId: id,
      _userId: userId,
      _restaurantId: restaurantId,
      sections: { [sectionName]: { [itemId]: { [factType]: true } } }
    }
  });
};

/**
 * Set the "last trained" pointer for this user at this restaurant — drives
 * the browse list's Training pill. Writes into the same `sections` map as
 * a sibling key.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 */
exports.setLastTrained = async (userId, restaurantId, sectionName) => {
  const id = progressId(userId, restaurantId);
  return create({
    collection: COLLECTION,
    id,
    data: {
      _progressId: id,
      _userId: userId,
      _restaurantId: restaurantId,
      sections: { _lastTrained: sectionName }
    }
  });
};

/**
 * Sets a section's canonical progress tier — the single stored value that
 * IS "where this user is" for this section. Written at exactly three
 * moments (see learn-practice.js): entering Practice for a not-yet-
 * covered section ('Training'), finishing every fact for the first time
 * ('Covered'), and completing one Review Pass for the first time
 * ('Mastered'). Never computed from the per-item facts — this is the
 * direct source of truth, they're separate operational data for the
 * drill itself.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 * @param {'Training'|'Covered'|'Mastered'} progress
 */
exports.setSectionProgress = async (userId, restaurantId, sectionName, progress) => {
  const id = progressId(userId, restaurantId);
  return create({
    collection: COLLECTION,
    id,
    data: {
      _progressId: id,
      _userId: userId,
      _restaurantId: restaurantId,
      sections: { [sectionName]: { _progress: progress } }
    }
  });
};

/**
 * Removes one section's coverage entirely for this user at this
 * restaurant — testing/support utility, not a trainee-facing action in
 * this ticket. No-op if there's no progress doc yet. Uses Firestore's
 * FieldValue.delete() sentinel within a merge write to remove just that
 * nested field, not overwrite it with an empty object (which would leave
 * an empty {} behind rather than actually deleting the key). Deleting the
 * whole section object also removes its _progress along with it, since
 * that's nested inside — a reset genuinely starts over, no separate
 * cleanup needed for it. Also clears _lastTrained if it currently points
 * at the section being reset.
 * @param {string} userId
 * @param {string} restaurantId
 * @param {string} sectionName
 */
exports.resetSection = async (userId, restaurantId, sectionName) => {
  const id = progressId(userId, restaurantId);
  const doc = await get({ collection: COLLECTION, id });
  if (!doc) return;
  const data = { sections: { [sectionName]: FieldValue.delete() } };
  if (doc.sections?._lastTrained === sectionName) {
    data.sections._lastTrained = FieldValue.delete();
  }
  return create({ collection: COLLECTION, id, data });
};

/**
 * Read back a user's full progress for one restaurant. Never returns null
 * — a never-yet-trained restaurant gets an empty-but-valid shape.
 * @param {string} userId
 * @param {string} restaurantId
 * @returns {Promise<{sections: Object, lastTrained: string|null}>}
 */
exports.getLearnProgress = async (userId, restaurantId) => {
  const doc = await get({ collection: COLLECTION, id: progressId(userId, restaurantId) });
  const { _lastTrained, ...sections } = doc?.sections || {};
  return { sections, lastTrained: _lastTrained || null };
};
