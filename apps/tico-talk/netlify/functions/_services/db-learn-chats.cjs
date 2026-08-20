//
// netlify/functions/_services/db-learn-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Learn Chats) for Firestore.
// Full conversation log for /learn/ drill sessions — distinct from
// db-learn-progress.cjs's fact-coverage tracking. One doc per section-
// drill "chat life," saved at a boundary (learned / exited / abandoned),
// not per turn — see apps/tico-talk/plans/REVIEW-tico-learn-ticket2.md and
// tico-learn-ticket3.md's "Why boundary-triggered, not per-turn." A
// browser's own copy of the conversation lives in localStorage, good for
// 24h (see SECTION_STATE_TTL_MS in src/assets/js/learn-practice.js) —
// this collection is the backup write that fires right as an expiring
// local copy is about to be cleared, not a continuous sync.
//
// Schema:
//   learn-chats/{chatId}
//   {
//     _chatId, _userId, restaurantId, section,
//     messages: [{role, content, timestamp}, ...],
//     action: 'covered' | 'exited' | 'milestone' | 'abandoned',
//     conversationStart: Firestore timestamp,
//     conversationEnd: Firestore timestamp,
//   }
// 'milestone': a status threshold crossed mid-session (Training ->
// Warming Up -> Getting Hot, see passStatusLabel in
// src/assets/js/learn-coverage.js) — an explicit, deliberate write
// trigger beyond the two session-boundary actions. 'abandoned': the local
// copy hit its 24h TTL and is about to be cleared (see
// flushAbandonedChat in src/assets/js/learn-practice.js) — the write that
// keeps a stale-but-real conversation from just disappearing.
// ------------------------------------------------------

const { create, get, Timestamp } = require('@habitualos/db-core');
const { generateChatId } = require('../_utils/data-utils.cjs');

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
exports.saveLearnChat = async ({ chatId, userId, restaurantId, section, messages, action, conversationStart, conversationEnd }) => {
  const id = chatId || generateChatId();
  await create({
    collection: COLLECTION,
    id,
    data: {
      _chatId: id,
      _userId: userId,
      restaurantId,
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
