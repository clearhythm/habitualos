/**
 * packages/chat-storage/db-chats.cjs
 * ------------------------------------------------------
 * Generic chat CRUD operations for any chat collection.
 * Apps configure the collection name and ID prefix.
 *
 * Schema:
 *   {
 *     id: "{prefix}-abc123",
 *     _userId: "u-xyz789",
 *     messages: [
 *       { role: "assistant", content: "...", timestamp: "..." },
 *       { role: "user", content: "...", timestamp: "..." }
 *     ],
 *     savedAt: ISO string,
 *     _createdAt: Firestore timestamp,
 *     _updatedAt: Firestore timestamp (optional)
 *   }
 */

const dbCore = require('@habitualos/db-core');

/**
 * Creates a chat service for a specific collection.
 * @param {Object} config
 * @param {string} config.collection - Firestore collection name
 * @param {string} config.idPrefix - ID prefix (e.g., 'wc', 'rc')
 */
function createChatService({ collection, idPrefix }) {

  /**
   * Generate a chat ID with the configured prefix
   */
  function generateChatId() {
    const timestamp = Math.floor(Date.now() / 1000);
    const randomPart = Math.floor(Math.random() * 1000);
    return idPrefix + '-' + (timestamp * 1000 + randomPart).toString(36).slice(-8);
  }

  /**
   * Get all chats for a specific user (newest first)
   * @param {string} userId - User ID to query
   * @returns {Promise<Array>} Array of chat documents
   */
  async function getChatsByUserId(userId) {
    const results = await dbCore.query({
      collection,
      where: `_userId::eq::${userId}`
    });

    // Sort by savedAt descending (newest first)
    return results.sort((a, b) => {
      const timeA = new Date(a.savedAt).getTime();
      const timeB = new Date(b.savedAt).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Get a single chat by ID
   * @param {string} id - Chat ID
   * @returns {Promise<Object|null>} Chat document or null
   */
  async function getChat(id) {
    return await dbCore.getById({ collection, id });
  }

  /**
   * Create a new chat
   * @param {string} id - Chat ID (with prefix)
   * @param {Object} data - Chat data
   * @returns {Promise<Object>} Result with id
   */
  async function createChat(id, data) {
    const formattedId = id?.startsWith(idPrefix + '-') ? id : `${idPrefix}-${id}`;

    await dbCore.create(
      { collection, id: formattedId, data }
    );

    return { id: formattedId };
  }

  /**
   * Get chat count for a user
   * @param {string} userId - User ID to query
   * @returns {Promise<number>} Count of chats
   */
  async function getChatCount(userId) {
    const chats = await getChatsByUserId(userId);
    return chats.length;
  }

  /**
   * Append messages to existing chat
   * @param {string} id - Chat ID
   * @param {Array} newMessages - New messages to append
   * @returns {Promise<Object>} Result with id
   */
  async function appendToChat(id, newMessages) {
    const { db, FieldValue } = require('@habitualos/db-core');
    const chatRef = db.collection(collection).doc(id);

    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      throw new Error(`Chat ${id} not found in ${collection}`);
    }

    const currentData = chatDoc.data();
    const updateData = {
      messages: [...(currentData.messages || []), ...newMessages],
      savedAt: new Date().toISOString(),
      _updatedAt: FieldValue.serverTimestamp()
    };

    await chatRef.update(updateData);

    return { id };
  }

  return {
    generateChatId,
    getChatsByUserId,
    getChat,
    createChat,
    getChatCount,
    appendToChat
  };
}

module.exports = { createChatService };
