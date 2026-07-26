const { getLearnChat } = require('./_services/db-learn-chats.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { chatId, userId } = event.queryStringParameters || {};
  if (!chatId) return { statusCode: 400, body: JSON.stringify({ error: 'chatId is required' }) };
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };

  try {
    const chat = await getLearnChat(chatId, userId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: !!chat }) };
  } catch (error) {
    log('error', '[learn-chat-get] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
