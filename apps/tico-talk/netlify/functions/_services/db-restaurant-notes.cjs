//
// netlify/functions/_services/db-restaurant-notes.cjs
// ------------------------------------------------------
// Freeform facts supplementing menu data in a drill's system prompt,
// scoped to one restaurant. Within that restaurant, two sub-scopes:
//   - 'restaurant': true regardless of section within this restaurant.
//   - 'section': true only within one section of this restaurant.
// Added live via the flag-and-confirm correction flow.
//
// Schema:
//   restaurant-notes/{noteId}
//   {
//     restaurantId: string,
//     text: string,
//     scope: 'restaurant' | 'section',
//     section: string | null,
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'restaurant-notes';

let cache = null; // Map<restaurantId, Array<note>> | null

exports.getRestaurantNotes = async (restaurantId) => {
  if (!cache) cache = new Map();
  if (cache.has(restaurantId)) return cache.get(restaurantId);
  const notes = await dbCore.query({ collection: COLLECTION, where: `restaurantId::eq::${restaurantId}` });
  cache.set(restaurantId, notes);
  return notes;
};

/**
 * @param {string} restaurantId
 * @param {string} text
 * @param {{scope: 'restaurant'|'section', section?: string}} classification
 */
exports.addRestaurantNote = async (restaurantId, text, { scope, section = null }) => {
  const data = { restaurantId, text, scope, section: scope === 'section' ? section : null };
  const { id } = await dbCore.create({ collection: COLLECTION, data });
  const note = { id, ...data };
  if (!cache) cache = new Map();
  const existing = cache.get(restaurantId) || [];
  cache.set(restaurantId, [...existing, note]);
  return note;
};
