const { create, uniqueId } = require('@habitualos/db-core');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.chat.save', 'POST', async (event, { userId, messages, practiceName, durationMins }) => {
  if (!userId) throw new Error('userId required');
  if (!Array.isArray(messages)) throw new Error('messages array required');

  const chatId = uniqueId('rc');
  await create({
    collection: 'reflect-chats',
    id: chatId,
    data: {
      _chatId: chatId,
      _userId: userId,
      messages,
      practiceName: practiceName || null,
      durationMins: durationMins || null,
      savedAt: new Date().toISOString(),
    },
  });

  log('debug', '[reflect-chat-save] chatId:', chatId, 'userId:', userId, 'messages:', messages.length);

  return { ok: true, chatId };
});
