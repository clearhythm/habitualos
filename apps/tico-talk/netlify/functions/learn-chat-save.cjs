const { saveLearnChat } = require('./_services/db-learn-chats.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    if (!restaurantId) return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    if (!section) return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    if (!Array.isArray(messages)) return { statusCode: 400, body: JSON.stringify({ error: 'messages array is required' }) };
    if (!action) return { statusCode: 400, body: JSON.stringify({ error: 'action is required' }) };

    const { chatId: savedId } = await saveLearnChat({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd });
    log('debug', '[learn-chat-save] saved', savedId, 'action:', action, 'section:', section);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, chatId: savedId }) };
  } catch (error) {
    log('error', '[learn-chat-save] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
