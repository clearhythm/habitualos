//
// netlify/functions/_services/db-learn-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Chats) for Firestore.
// Full conversation log for /learn/ drill sessions — distinct from
// db-learn-progress.cjs's boolean mastery flag. One doc per section-drill
// "chat life," saved at a boundary (learned / exited / abandoned), not
// per turn — see apps/tico-talk/plans/REVIEW-tico-learn-ticket2.md and
// tico-learn-ticket3.md's "Why boundary-triggered, not per-turn."
//
// Schema:
//   learn-chats/{chatId}
//   {
//     _chatId, _userId, section,
//     messages: [{role, content, timestamp}, ...],
//     action: 'learned' | 'exited' | 'abandoned',
//     conversationStart: Firestore timestamp,
//     conversationEnd: Firestore timestamp,
//   }
// ------------------------------------------------------

const { create, get, uniqueId, Timestamp } = require('@habitualos/db-core');

const COLLECTION = 'learn-chats';

function toTimestamp(iso) {
  if (!iso) return null;
  try { return Timestamp.fromDate(new Date(iso)); } catch { return null; }
}

/**
 * Save (upsert) a learn chat. If chatId is provided (client-generated,
 * the normal case — see src/assets/js/collections/learn-chats.js), uses
 * it so repeat saves for the same "chat life" overwrite rather than
 * duplicate.
 * @returns {Promise<{chatId: string}>}
 */
exports.saveLearnChat = async ({ chatId, userId, section, messages, action, conversationStart, conversationEnd }) => {
  const id = chatId || uniqueId('lc');
  await create({
    collection: COLLECTION,
    id,
    data: {
      _chatId: id,
      _userId: userId,
      section,
      messages,
      action,
      conversationStart: toTimestamp(conversationStart),
      conversationEnd: toTimestamp(conversationEnd),
    }
  });
  return { chatId: id };
};

/**
 * Fetch one chat by ID, validating ownership — used by the load-time
 * verify/retry safety net (learn-chat-get.cjs).
 * @returns {Promise<Object|null>}
 */
exports.getLearnChat = async (chatId, userId) => {
  const doc = await get({ collection: COLLECTION, id: chatId });
  if (!doc || doc._userId !== userId) return null;
  return doc;
};
