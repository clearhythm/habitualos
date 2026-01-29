//
// netlify/functions/_services/db-agent-logs.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Agent Logs) for Firestore.
// Stores structured logs of agent invocations: API calls,
// tool calls/results, signals, and cost tracking.
//
// Responsibilities:
//   - createLog(data) - Write a single invocation log
//   - getLogsByAgent(agentId, userId, filters?) - Query logs for an agent
//
// Schema:
//   {
//     id: "alog-abc123",
//     _userId: "u-...",
//     agentId: "agent-...",
//     actionId: "action-..." | null,
//     source: "agent-chat" | "action-chat" | "task-executor",
//     events: [
//       { type: "api_call", model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, cost_usd, stop_reason },
//       { type: "tool_call", tool_name, tool_input },
//       { type: "tool_result", tool_name, tool_output, success },
//       { type: "signal", signal, data }
//     ],
//     total_input_tokens: number,
//     total_output_tokens: number,
//     total_cost_usd: number,
//     total_duration_ms: number,
//     tools_used: string[],
//     signal_emitted: string | null,
//     _createdAt: Firestore timestamp
//   }
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');
const { generateAgentLogId } = require('../_utils/data-utils.cjs');

/**
 * Create an agent invocation log
 * @param {Object} data - Log data
 * @param {string} data._userId - User ID
 * @param {string} data.agentId - Agent ID
 * @param {string|null} data.actionId - Action ID if applicable
 * @param {string} data.source - Source endpoint
 * @param {Array} data.events - Array of event objects
 * @param {number} data.total_input_tokens - Sum of input tokens
 * @param {number} data.total_output_tokens - Sum of output tokens
 * @param {number} data.total_cost_usd - Sum of costs
 * @param {number} data.total_duration_ms - Total API call time
 * @param {string[]} data.tools_used - List of tool names used
 * @param {string|null} data.signal_emitted - Signal name if one was emitted
 * @returns {Promise<Object>} Created log with id
 */
exports.createLog = async (data) => {
  const id = generateAgentLogId();

  await dbCore.create({
    collection: 'agent-logs',
    id,
    data
  });

  return { id };
};

/**
 * Get logs for an agent (filtered by userId)
 * @param {string} agentId - Agent ID
 * @param {string} userId - User ID for ownership check
 * @param {Object} filters - Optional filters { limit? }
 * @returns {Promise<Array>} Array of logs (newest first)
 */
exports.getLogsByAgent = async (agentId, userId, filters = {}) => {
  let results = await dbCore.query({
    collection: 'agent-logs',
    where: `agentId::eq::${agentId}`
  });

  // Filter by userId (security)
  results = results.filter(log => log._userId === userId);

  // Sort by _createdAt descending (newest first)
  results.sort((a, b) => {
    const timeA = a._createdAt?._seconds || 0;
    const timeB = b._createdAt?._seconds || 0;
    return timeB - timeA;
  });

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    results = results.slice(0, filters.limit);
  }

  return results;
};
