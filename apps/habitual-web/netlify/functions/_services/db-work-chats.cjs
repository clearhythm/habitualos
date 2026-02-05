//
// netlify/functions/_services/db-work-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Work Chats) for Firestore.
// Single source of truth for Executive Assistant work chat operations.
//
// Responsibilities:
//   - getWorkChatsByUserId(userId) - Get all work chats for a user
//   - createWorkChat(id, data) - Create a new work chat
//   - appendToWorkChat(id, messages) - Append messages to existing chat
//   - getWorkChat(id) - Get a single work chat by ID
//
// Schema:
//   {
//     id: "wc-abc123",
//     _userId: "u-xyz789",
//     messages: [
//       { role: "assistant", content: "...", timestamp: "..." },
//       { role: "user", content: "...", timestamp: "..." }
//     ],
//     savedAt: ISO string,
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp (optional)
//   }
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

/**
 * Get all work chats for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of work chat documents
 */
exports.getWorkChatsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'work-chats',
    where: `_userId::eq::${userId}`
  });

  // Sort by savedAt descending (newest first) in JavaScript
  return results.sort((a, b) => {
    const timeA = new Date(a.savedAt).getTime();
    const timeB = new Date(b.savedAt).getTime();
    return timeB - timeA;
  });
};

/**
 * Get a single work chat by ID
 * @param {string} id - Work chat ID
 * @returns {Promise<Object|null>} Work chat document or null
 */
exports.getWorkChat = async (id) => {
  return await dbCore.getById({ collection: 'work-chats', id });
};

/**
 * Create a new work chat
 * @param {string} id - Work chat ID (with "wc-" prefix)
 * @param {Object} data - Work chat data
 * @returns {Promise<Object>} Result with id
 */
exports.createWorkChat = async (id, data) => {
  const formattedId = id?.startsWith('wc-') ? id : `wc-${id}`;

  await dbCore.create(
    { collection: 'work-chats', id: formattedId, data }
  );

  return { id: formattedId };
};

/**
 * Get work chat count for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<number>} Count of work chats
 */
exports.getWorkChatCount = async (userId) => {
  const chats = await exports.getWorkChatsByUserId(userId);
  return chats.length;
};

/**
 * Append messages to existing work chat
 * @param {string} id - Work chat ID
 * @param {Array} newMessages - New messages to append
 * @returns {Promise<Object>} Result with id
 */
exports.appendToWorkChat = async (id, newMessages) => {
  const { db, FieldValue } = require('@habitualos/db-core');
  const chatRef = db.collection('work-chats').doc(id);

  const chatDoc = await chatRef.get();
  if (!chatDoc.exists) {
    throw new Error(`Work chat ${id} not found`);
  }

  const currentData = chatDoc.data();
  const updateData = {
    messages: [...(currentData.messages || []), ...newMessages],
    savedAt: new Date().toISOString(),
    _updatedAt: FieldValue.serverTimestamp()
  };

  await chatRef.update(updateData);

  return { id };
};
