const { markFactLearned, setLastTrained } = require('./_services/db-learn-progress.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, restaurantId, section, itemId, factType, lastTrained } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };

    if (itemId && factType) {
      if (!section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required with itemId/factType' }) };
      await markFactLearned(userId, restaurantId, section, itemId, factType);
      log('debug', '[learn-progress-write] covered', factType, 'for', itemId, 'in', section, 'at', restaurantId);
    }

    if (lastTrained) {
      await setLastTrained(userId, restaurantId, lastTrained);
      log('debug', '[learn-progress-write] lastTrained =', lastTrained, 'at', restaurantId);
    }

    if (!(itemId && factType) && !lastTrained) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Provide itemId+factType and/or lastTrained' }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    log('error', '[learn-progress-write] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
