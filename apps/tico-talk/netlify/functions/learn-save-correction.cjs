const { addRestaurantNote } = require('./_services/db-restaurant-notes.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, text, scope, section } = JSON.parse(event.body || '{}');
    if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    if (!text || !text.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'text is required' }) };
    if (!['restaurant', 'section'].includes(scope)) return { statusCode: 400, body: JSON.stringify({ error: 'scope must be "restaurant" or "section"' }) };
    if (scope === 'section' && !section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required when scope is "section"' }) };

    const note = await addRestaurantNote(restaurantId, text.trim(), { scope, section });
    log('debug', '[learn-save-correction] saved note', note.id, 'restaurant:', restaurantId, 'scope:', scope);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, note }) };
  } catch (error) {
    log('error', '[learn-save-correction] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
