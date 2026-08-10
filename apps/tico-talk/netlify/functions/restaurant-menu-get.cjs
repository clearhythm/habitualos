const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { restaurantId } = event.queryStringParameters || {};
  if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };

  try {
    const restaurant = await getRestaurant(restaurantId);
    // This function only ever runs on a real roundtrip — a client-side
    // cache hit (collections/restaurant-menus.js's 24h localStorage TTL)
    // never reaches here at all. So this line's presence/absence in the
    // terminal *is* the cache-hit-vs-fetch signal: silence means the
    // client served its own cache, a log line means it didn't.
    log('debug', '[restaurant-menu-get] serving fresh (not a client cache hit)', { restaurantId });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food: restaurant.food, drinks: restaurant.drinks })
    };
  } catch (error) {
    log('error', '[restaurant-menu-get] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
