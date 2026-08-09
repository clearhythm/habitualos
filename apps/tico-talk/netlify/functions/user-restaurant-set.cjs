const { setLastRestaurant } = require('./_services/db-users.cjs');
const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, restaurantId } = JSON.parse(event.body || '{}');
    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid userId' }) };
    }
    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    }

    try {
      await getRestaurant(restaurantId);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown restaurant: ${restaurantId}` }) };
    }

    await setLastRestaurant(userId, restaurantId);
    log('debug', '[user-restaurant-set] saved', userId, '->', restaurantId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    log('error', '[user-restaurant-set] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
