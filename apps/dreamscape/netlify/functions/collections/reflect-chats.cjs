const { create, get, query, uniqueId, Timestamp } = require('@habitualos/db-core');
const { log } = require('../_utils/log.cjs');

const COL = 'reflect-chats';

function toTimestamp(iso) {
  if (!iso) return null;
  try { return Timestamp.fromDate(new Date(iso)); } catch { return null; }
}

/**
 * saveReflectChat — writes a reflect chat doc.
 * If chatId is provided (client-generated), uses it. Otherwise generates one.
 * action: 'practice' | 'closed' | 'abandoned'
 */
async function saveReflectChat({ chatId, userId, messages, action, conversationStart, conversationEnd, practiceName, practiceDuration }) {
  const id = chatId || uniqueId('rc');
  await create({
    collection: COL,
    id,
    data: {
      _chatId: id,
      _userId: userId,
      conversationStart: toTimestamp(conversationStart),
      conversationEnd: toTimestamp(conversationEnd),
      messages,
      action,
      practiceName: practiceName || null,
      practiceDuration: practiceDuration || null,
    },
  });
  log('debug', '[reflect-chats] saved chatId:', id, 'userId:', userId, 'action:', action, 'messages:', messages.length);
  return { chatId: id };
}

/**
 * getReflectChat — fetch a single chat by ID, validates ownership.
 */
async function getReflectChat(chatId, userId) {
  const doc = await get({ collection: COL, id: chatId });
  if (!doc || doc._userId !== userId) return null;
  return doc;
}

async function getReflectChatsForUser(userId) {
  return query({ collection: COL, where: [`_userId::eq::${userId}`] }) || [];
}

module.exports = { saveReflectChat, getReflectChat, getReflectChatsForUser };
