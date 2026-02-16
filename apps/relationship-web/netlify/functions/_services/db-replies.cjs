/**
 * db-replies.cjs - Moment Replies Service
 *
 * A "reply" is a loving response from one partner to the other's moment.
 *
 * Collection: moment-replies
 * Ownership: _userId (replier's user ID)
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'moment-replies';

function generateReplyId() {
  return dbCore.uniqueId('reply');
}

/**
 * Create a new reply to a moment
 */
async function createReply({ momentId, userId, repliedBy, content }) {
  const id = generateReplyId();

  await dbCore.create({
    collection: COLLECTION,
    id,
    data: {
      momentId,
      _userId: userId,
      repliedBy: repliedBy || null,
      content: content || '',
      createdAt: new Date().toISOString()
    }
  });

  return { id };
}

/**
 * Get all replies, optionally filtered by moment IDs
 * Returns a map of momentId → reply (first reply only)
 */
async function getRepliesByMomentIds(momentIds) {
  const allReplies = await dbCore.query({
    collection: COLLECTION,
    orderBy: 'createdAt::asc'
  });

  const replyMap = {};
  for (const reply of allReplies) {
    if (momentIds.includes(reply.momentId) && !replyMap[reply.momentId]) {
      replyMap[reply.momentId] = reply;
    }
  }
  return replyMap;
}

/**
 * Get the first reply to a specific moment
 */
async function getReplyForMoment(momentId) {
  const replies = await dbCore.query({
    collection: COLLECTION,
    where: `momentId::eq::${momentId}`,
    orderBy: 'createdAt::asc',
    limit: 1
  });
  return replies.length > 0 ? replies[0] : null;
}

module.exports = {
  generateReplyId,
  createReply,
  getRepliesByMomentIds,
  getReplyForMoment
};
