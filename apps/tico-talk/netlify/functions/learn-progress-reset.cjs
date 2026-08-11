const { resetSection } = require('./_services/db-learn-progress.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, restaurantId, section } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    if (!section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };

    await resetSection(userId, restaurantId, section);
    log('debug', '[learn-progress-reset] reset', section, 'at', restaurantId, 'for', userId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    log('error', '[learn-progress-reset] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
