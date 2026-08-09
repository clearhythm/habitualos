const { getUser } = require('./_services/db-users.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { userId } = event.queryStringParameters || {};
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };

  try {
    const user = await getUser(userId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastRestaurantId: user?.lastRestaurantId || null })
    };
  } catch (error) {
    log('error', '[user-restaurant-get] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
