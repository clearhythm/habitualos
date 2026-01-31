//
// netlify/functions/_services/db-actions.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Actions) for Firestore.
// Manages action cards with metrics tracking.
//
// Responsibilities:
//   - createAction(id, data) - Create action + increment agent.totalActions
//   - getActionsByUserId(userId) - List all user's actions
//   - getActionsByAgent(agentId, userId) - Filter by agent
//   - getAction(actionId) - Get single action
//   - updateAction(actionId, updates) - Update action fields
//   - updateActionState(actionId, state, fields) - Update state/timestamps
//   - recordApiCall(actionId, callData) - Track API call + update metrics
//
// Schema:
//   {
//     id: "action-{uuid}",
//     _userId: "u-xyz789",
//     agentId: "agent-abc123",
//     projectId: "project-abc123" | null,  // Optional direct project assignment
//     title: "Create database schema",
//     description: "Design and implement...",
//     state: "open",  // "open", "in_progress", "completed", "dismissed"
//     priority: "high",  // "high", "medium", "low"
//     taskType: "interactive",  // "interactive", "scheduled", "measurement", "manual"
//     assignedTo: "user",  // "user" (blue bar) or "agent" (purple bar)
//     scheduleTime: null,
//     dueDate: "2024-01-15" | null,  // Optional due date (YYYY-MM-DD string)
//     taskConfig: {},
//     metrics: {
//       totalTokens: 3500,
//       totalCost: 0.095,
//       apiCalls: [...]
//     },
//     startedAt: null,
//     completedAt: null,
//     dismissedAt: null,
//     dismissedReason: null,
//     errorMessage: null,
//     _createdAt: Firestore.Timestamp,
//     _updatedAt: Firestore.Timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { incrementAgentActionCount } = require('./db-agents.cjs');

/**
 * Create a new action
 * @param {string} id - Action ID (with or without "action-" prefix)
 * @param {Object} data - Action data
 * @returns {Promise<Object>} Result with id
 */
exports.createAction = async (id, data) => {
  const formattedId = id?.startsWith('action-') ? id : `action-${id}`;

  // Ensure metrics are initialized
  const actionData = {
    ...data,
    metrics: {
      totalTokens: 0,
      totalCost: 0,
      apiCalls: []
    }
  };

  await dbCore.create({
    collection: 'work-actions',
    id: formattedId,
    data: actionData
  });

  // Increment agent's totalActions
  if (data.agentId) {
    await incrementAgentActionCount(data.agentId, 'totalActions', 1);
  }

  return { id: formattedId };
};

/**
 * Get all actions for a user
 * @param {string} userId - User ID to query
 * @returns {Promise<Array>} Array of action documents
 */
exports.getActionsByUserId = async (userId) => {
  return await dbCore.query({
    collection: 'work-actions',
    where: `_userId::eq::${userId}`
  });
};

/**
 * Get actions for a specific agent
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Array>} Array of action documents
 */
exports.getActionsByAgent = async (agentId, userId) => {
  const allActions = await exports.getActionsByUserId(userId);
  return allActions.filter(a => a.agentId === agentId);
};

/**
 * Get a single action by ID
 * @param {string} actionId - Action ID
 * @returns {Promise<Object|null>} Action document or null
 */
exports.getAction = async (actionId) => {
  return await dbCore.get({ collection: 'work-actions', id: actionId });
};

/**
 * Update action state and related timestamps
 * @param {string} actionId - Action ID
 * @param {string} state - New state
 * @param {Object} additionalFields - Additional fields to update
 * @returns {Promise<Object>} Result with id
 */
exports.updateActionState = async (actionId, state, additionalFields = {}) => {
  const updates = { state, ...additionalFields };

  // Set timestamps based on state
  const now = new Date().toISOString();
  if (state === 'in_progress' && !additionalFields.startedAt) {
    updates.startedAt = now;
  } else if (state === 'completed' && !additionalFields.completedAt) {
    updates.completedAt = now;
  } else if (state === 'dismissed' && !additionalFields.dismissedAt) {
    updates.dismissedAt = now;
  }

  return await dbCore.patch({
    collection: 'work-actions',
    id: actionId,
    data: updates
  });
};

/**
 * Update action fields (title, description, priority, projectId, taskConfig)
 * @param {string} actionId - Action ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result with id
 */
exports.updateAction = async (actionId, updates) => {
  return await dbCore.patch({
    collection: 'work-actions',
    id: actionId,
    data: updates
  });
};

/**
 * Record an API call and update action + agent metrics
 * @param {string} actionId - Action ID
 * @param {Object} callData - API call data { timestamp, model, inputTokens, outputTokens, cost, operation }
 * @returns {Promise<void>}
 */
exports.recordApiCall = async (actionId, callData) => {
  // Get current action
  const action = await exports.getAction(actionId);
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  // Update action metrics
  const apiCalls = action.metrics?.apiCalls || [];
  apiCalls.push(callData);

  const totalTokens = (action.metrics?.totalTokens || 0) + (callData.inputTokens + callData.outputTokens);
  const totalCost = (action.metrics?.totalCost || 0) + callData.cost;

  await dbCore.patch({
    collection: 'work-actions',
    id: actionId,
    data: {
      metrics: {
        totalTokens,
        totalCost,
        apiCalls
      }
    }
  });

  // Update agent metrics
  if (action.agentId) {
    const { incrementAgentMetrics } = require('./db-agents.cjs');
    await incrementAgentMetrics(action.agentId, {
      tokens: callData.inputTokens + callData.outputTokens,
      cost: callData.cost
    });
  }
};
