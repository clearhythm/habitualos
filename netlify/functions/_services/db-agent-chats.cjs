//
// netlify/functions/_services/db-agent-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agent Work Chats) for Firestore.
// Stores conversation history from agent work sessions.
//
// Chats are saved when a draft action or asset is generated,
// preserving the context that led to creating deliverables.
//
// Responsibilities:
//   - getAgentChatsByUserId(userId) - Get all agent work chats for a user
//   - getAgentChatsByAgentId(agentId) - Get all chats for a specific agent
//   - createAgentChat(id, data) - Create a new agent work chat
//
// Schema:
//   {
//     id: "agc-abc123",
//     _userId: "u-xyz789",
//     agentId: "agent-xyz",
//     messages: [
//       { role: "assistant", content: "...", timestamp: "..." },
//       { role: "user", content: "...", timestamp: "..." }
//     ],
//     generatedAssets: ["asset-id-1", "asset-id-2"] (optional),
//     generatedActions: ["action-id-1"] (optional),
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Get all agent work chats for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of agent work chat documents
 */
exports.getAgentChatsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'agent-chats',
    where: `_userId::eq::${userId}`
  });

  // Sort by _createdAt descending (newest first)
  return results.sort((a, b) => {
    const aTime = a._createdAt?.toDate?.() || new Date(a._createdAt || 0);
    const bTime = b._createdAt?.toDate?.() || new Date(b._createdAt || 0);
    return bTime - aTime;
  });
};

/**
 * Get all chats for a specific agent (newest first)
 * @param {string} agentId - Agent ID to query
 * @returns {Promise<Array>} Array of agent work chat documents
 */
exports.getAgentChatsByAgentId = async (agentId) => {
  const results = await dbCore.query({
    collection: 'agent-chats',
    where: `agentId::eq::${agentId}`
  });

  // Sort by _createdAt descending (newest first)
  return results.sort((a, b) => {
    const aTime = a._createdAt?.toDate?.() || new Date(a._createdAt || 0);
    const bTime = b._createdAt?.toDate?.() || new Date(b._createdAt || 0);
    return bTime - aTime;
  });
};

/**
 * Create a new agent work chat
 * @param {string} id - Agent chat ID (with "agc-" prefix)
 * @param {Object} data - Agent chat data
 * @returns {Promise<Object>} Result with id
 */
exports.createAgentChat = async (id, data) => {
  const formattedId = id?.startsWith('agc-') ? id : `agc-${id}`;

  await dbCore.create({
    collection: 'agent-chats',
    id: formattedId,
    data
  });

  return { id: formattedId };
};

/**
 * Append messages to existing agent work chat
 * @param {string} id - Agent chat ID
 * @param {Array} newMessages - New messages to append
 * @param {Array} generatedAssets - New asset IDs to add
 * @param {Array} generatedActions - New action IDs to add
 * @returns {Promise<Object>} Result with id
 */
exports.appendToAgentChat = async (id, newMessages, generatedAssets = [], generatedActions = []) => {
  const { db, FieldValue } = require('../_utils/firestore.cjs');
  const chatRef = db.collection('agent-chats').doc(id);

  // Get current document to append to arrays
  const chatDoc = await chatRef.get();
  if (!chatDoc.exists) {
    throw new Error(`Chat ${id} not found`);
  }

  const currentData = chatDoc.data();
  const updates = {
    messages: [...(currentData.messages || []), ...newMessages],
    generatedAssets: [...(currentData.generatedAssets || []), ...generatedAssets],
    generatedActions: [...(currentData.generatedActions || []), ...generatedActions],
    _updatedAt: FieldValue.serverTimestamp()
  };

  await chatRef.update(updates);

  return { id };
};
