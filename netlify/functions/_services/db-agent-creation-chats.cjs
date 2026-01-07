//
// netlify/functions/_services/db-agent-creation-chats.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agent Creation Chats) for Firestore.
// Stores conversation history from agent creation flow.
//
// Responsibilities:
//   - getAgentCreationChatsByUserId(userId) - Get all agent creation chats for a user
//   - getAgentCreationChatByAgentId(agentId) - Get chat that created a specific agent
//   - createAgentCreationChat(id, data) - Create a new agent creation chat
//
// Schema:
//   {
//     id: "acc-abc123",
//     _userId: "u-xyz789",
//     messages: [
//       { role: "assistant", content: "...", timestamp: "..." },
//       { role: "user", content: "...", timestamp: "..." }
//     ],
//     agentId: "agent-xyz" (reference to created agent),
//     _createdAt: Firestore timestamp,
//     _updatedAt: Firestore timestamp (optional)
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

/**
 * Get all agent creation chats for a specific user (newest first)
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of agent creation chat documents
 */
exports.getAgentCreationChatsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'agent-creation-chats',
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
 * Get agent creation chat by agent ID
 * @param {string} agentId - Agent ID to find chat for
 * @returns {Promise<Object|null>} Agent creation chat document or null
 */
exports.getAgentCreationChatByAgentId = async (agentId) => {
  const results = await dbCore.query({
    collection: 'agent-creation-chats',
    where: `agentId::eq::${agentId}`
  });

  return results.length > 0 ? results[0] : null;
};

/**
 * Create a new agent creation chat
 * @param {string} id - Agent creation chat ID (with "acc-" prefix)
 * @param {Object} data - Agent creation chat data
 * @returns {Promise<Object>} Result with id
 */
exports.createAgentCreationChat = async (id, data) => {
  const formattedId = id?.startsWith('acc-') ? id : `acc-${id}`;

  await dbCore.create({
    collection: 'agent-creation-chats',
    id: formattedId,
    data
  });

  return { id: formattedId };
};
