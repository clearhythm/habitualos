//
// netlify/functions/_services/db-action-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Action Chats) for Firestore.
// Manages chat messages for actions.
//
// Responsibilities:
//   - createChatMessage(id, data) - Store message
//   - getChatMessagesByAction(actionId, userId) - Get conversation history
//
// Schema:
//   {
//     id: "ac-{uuid}",
//     _userId: "u-xyz789",
//     actionId: "action-abc123",
//     role: "user",  // "user", "assistant"
//     content: "How should I...",
//     timestamp: "2026-01-05T10:30:00Z",
//     _createdAt: Firestore.Timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Create a chat message
 * @param {string} id - Message ID (with or without "ac-" prefix)
 * @param {Object} data - Message data
 * @returns {Promise<Object>} Result with id
 */
exports.createChatMessage = async (id, data) => {
  const formattedId = id?.startsWith('ac-') ? id : `ac-${id}`;

  await dbCore.create({
    collection: 'action-chats',
    id: formattedId,
    data
  });

  return { id: formattedId };
};

/**
 * Get chat messages for an action
 * @param {string} actionId - Action ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of chat messages sorted by timestamp
 */
exports.getChatMessagesByAction = async (actionId, userId) => {
  const allChats = await dbCore.query({
    collection: 'action-chats',
    where: `_userId::eq::${userId}`
  });

  return allChats
    .filter(c => c.actionId === actionId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};
