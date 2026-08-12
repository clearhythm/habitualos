// Busts the warm-instance in-memory caches in db-restaurants.cjs and
// db-restaurant-notes.cjs. Needed because those caches have no TTL — a
// Firestore edit (menu data, restaurant notes) is otherwise invisible
// until the function instance cold-starts. GET, no body, safe to call
// anytime: it only forces the next read to hit Firestore again.
const { resetCache: resetRestaurants } = require('./_services/db-restaurants.cjs');
const { resetCache: resetNotes } = require('./_services/db-restaurant-notes.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  resetRestaurants();
  resetNotes();

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
