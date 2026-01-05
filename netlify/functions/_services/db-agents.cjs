//
// netlify/functions/_services/db-agents.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agents) for Firestore.
// Manages agent definitions and metrics.
//
// Responsibilities:
//   - createAgent(id, data) - Create new agent with initial metrics
//   - getAgentsByUserId(userId) - List all user's agents
//   - getAgent(agentId) - Get single agent
//   - updateAgent(agentId, updates) - Update agent fields
//   - incrementAgentMetrics(agentId, { tokens, cost }) - Atomic metrics updates
//
// Schema:
//   {
//     id: "agent-{uuid}",
//     _userId: "u-xyz789",
//     type: "northstar",  // "northstar", "custom", "delegated" (future)
//     name: "Build SaaS MVP",
//     status: "active",  // "active", "paused", "completed", "archived"
//     instructions: {
//       goal: "Launch a SaaS...",
//       success_criteria: ["..."],
//       timeline: "3 months",
//       format: "northstar"
//     },
//     metrics: {
//       totalActions: 12,
//       completedActions: 5,
//       inProgressActions: 2,
//       totalTokens: 45000,
//       totalCost: 1.23,
//       lastRunAt: "2026-01-05T10:30:00Z"
//     },
//     _createdAt: Firestore.Timestamp,
//     _updatedAt: Firestore.Timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { db, FieldValue } = require('../_utils/firestore.cjs');

/**
 * Create a new agent with initial metrics
 * @param {string} id - Agent ID (with or without "agent-" prefix)
 * @param {Object} data - Agent data
 * @returns {Promise<Object>} Result with id
 */
exports.createAgent = async (id, data) => {
  const formattedId = id?.startsWith('agent-') ? id : `agent-${id}`;

  // Ensure metrics are initialized
  const agentData = {
    ...data,
    metrics: {
      totalActions: 0,
      completedActions: 0,
      inProgressActions: 0,
      totalTokens: 0,
      totalCost: 0,
      lastRunAt: null
    }
  };

  await dbCore.create({
    collection: 'agents',
    id: formattedId,
    data: agentData
  });

  return { id: formattedId };
};

/**
 * Get all agents for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of agent documents
 */
exports.getAgentsByUserId = async (userId) => {
  const results = await dbCore.query({
    collection: 'agents',
    where: `_userId::eq::${userId}`
  });

  // Sort by _updatedAt descending (most recent first)
  return results.sort((a, b) => {
    const aTime = a._updatedAt?.toDate?.() || new Date(a._updatedAt || 0);
    const bTime = b._updatedAt?.toDate?.() || new Date(b._updatedAt || 0);
    return bTime - aTime;
  });
};

/**
 * Get a single agent by ID
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object|null>} Agent document or null
 */
exports.getAgent = async (agentId) => {
  return await dbCore.get({ collection: 'agents', id: agentId });
};

/**
 * Update agent fields
 * @param {string} agentId - Agent ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result with id
 */
exports.updateAgent = async (agentId, updates) => {
  return await dbCore.patch({
    collection: 'agents',
    id: agentId,
    data: updates
  });
};

/**
 * Increment agent metrics atomically
 * @param {string} agentId - Agent ID
 * @param {Object} options - { tokens: number, cost: number }
 * @returns {Promise<void>}
 */
exports.incrementAgentMetrics = async (agentId, { tokens = 0, cost = 0 }) => {
  const ref = db.collection('agents').doc(agentId);

  const updates = {
    'metrics.lastRunAt': new Date().toISOString(),
    _updatedAt: FieldValue.serverTimestamp()
  };

  if (tokens > 0) {
    updates['metrics.totalTokens'] = FieldValue.increment(tokens);
  }

  if (cost > 0) {
    updates['metrics.totalCost'] = FieldValue.increment(cost);
  }

  await ref.update(updates);
};

/**
 * Increment agent action counters
 * @param {string} agentId - Agent ID
 * @param {string} field - Field to increment (totalActions, completedActions, inProgressActions)
 * @param {number} value - Value to increment by (default 1)
 * @returns {Promise<void>}
 */
exports.incrementAgentActionCount = async (agentId, field, value = 1) => {
  await dbCore.increment({
    collection: 'agents',
    id: agentId,
    field: `metrics.${field}`,
    value
  });
};
