const { saveReflectChat } = require('./collections/reflect-chats.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('reflect.chat.save', 'POST', async (event, { chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration }) => {
  if (!userId) throw new Error('userId required');
  if (!Array.isArray(messages)) throw new Error('messages array required');
  if (!action) throw new Error('action required');

  const { chatId: savedId } = await saveReflectChat({ chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration });
  return { ok: true, chatId: savedId };
});
