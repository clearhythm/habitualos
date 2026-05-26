const { getReflectChat } = require('./collections/reflect-chats.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('reflect.chat.get', 'GET', async (event, params) => {
  const { chatId, userId } = event.queryStringParameters || {};
  if (!chatId) throw new Error('chatId required');
  if (!userId) throw new Error('userId required');

  const chat = await getReflectChat(chatId, userId);
  return { found: !!chat };
});
