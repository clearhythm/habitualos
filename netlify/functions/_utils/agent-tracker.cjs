//
// netlify/functions/_utils/agent-tracker.cjs
// ------------------------------------------------------
// Tracks agent activity during a single invocation.
// Accumulates events in-memory, then flushes one document
// to the agent-logs Firestore collection.
//
// Usage:
//   const { createAgentTracker } = require('./_utils/agent-tracker.cjs');
//   const tracker = createAgentTracker({ userId, agentId, actionId, source: 'agent-chat' });
//
//   tracker.context(label, data);
//   tracker.apiCall({ model, usage, duration_ms });
//   tracker.toolCall(name, input);
//   tracker.toolResult(name, output);
//   tracker.signal(signalName, data);
//   tracker.error(err);
//
//   await tracker.flush();  // writes one doc to Firestore
// ------------------------------------------------------

const { calculateCost } = require('./metrics-calculator.cjs');
const { createLog } = require('../_services/db-agent-logs.cjs');
const { log } = require('./log.cjs');

// Strip undefined values (Firestore rejects them)
const sanitize = (obj) => obj != null ? JSON.parse(JSON.stringify(obj)) : null;

/**
 * Create a tracker for one agent invocation
 * @param {Object} ctx
 * @param {string} ctx.userId - User ID
 * @param {string} ctx.agentId - Agent ID
 * @param {string|null} ctx.actionId - Action ID if applicable
 * @param {string} ctx.source - Source identifier (e.g. 'agent-chat', 'action-chat', 'task-executor')
 * @returns {Object} Tracker with event methods and flush()
 */
function createAgentTracker({ userId = null, agentId = null, actionId = null, source = 'unknown' } = {}) {
  const events = [];
  const context = { userId, agentId, actionId, source };

  return {
    /** Update context after initial creation (e.g. once body is parsed) */
    setContext({ userId, agentId, actionId } = {}) {
      if (userId !== undefined) context.userId = userId;
      if (agentId !== undefined) context.agentId = agentId;
      if (actionId !== undefined) context.actionId = actionId;
    },

    /** Record context included in the invocation (e.g. action context, review context) */
    context(label, data) {
      events.push({ type: 'context', label, data });
    },

    /** Record a Claude API call */
    apiCall({ model, usage, duration_ms = 0, stop_reason = null }) {
      if (!usage) return;
      events.push({
        type: 'api_call',
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_input_tokens || 0,
        cache_creation_tokens: usage.cache_creation_input_tokens || 0,
        duration_ms,
        cost_usd: calculateCost(model, usage.input_tokens, usage.output_tokens),
        stop_reason
      });
    },

    /** Record a tool call (before execution) */
    toolCall(name, input) {
      events.push({ type: 'tool_call', tool_name: name, tool_input: sanitize(input) });
    },

    /** Record a tool result (after execution) */
    toolResult(name, output) {
      events.push({
        type: 'tool_result',
        tool_name: name,
        tool_output: sanitize(output),
        success: output?.success !== false
      });
    },

    /** Record a signal emission */
    signal(signalName, data) {
      events.push({ type: 'signal', signal: signalName, data });
    },

    /** Record an error */
    error(err) {
      events.push({
        type: 'error',
        message: err.message || String(err),
        errorType: err.constructor?.name || 'Error',
        status: err.status || null
      });
    },

    /** Write accumulated events to Firestore as one document */
    async flush() {
      if (events.length === 0 || !context.userId) return;

      try {
        let total_input_tokens = 0;
        let total_output_tokens = 0;
        let total_cost_usd = 0;
        let total_duration_ms = 0;
        const tools_used = [];
        let signal_emitted = null;

        for (const evt of events) {
          if (evt.type === 'api_call') {
            total_input_tokens += evt.input_tokens || 0;
            total_output_tokens += evt.output_tokens || 0;
            total_cost_usd += evt.cost_usd || 0;
            total_duration_ms += evt.duration_ms || 0;
          }
          if (evt.type === 'tool_call' && !tools_used.includes(evt.tool_name)) {
            tools_used.push(evt.tool_name);
          }
          if (evt.type === 'signal') {
            signal_emitted = evt.signal;
          }
        }

        await createLog({
          _userId: context.userId,
          agentId: context.agentId,
          actionId: context.actionId,
          source: context.source,
          events,
          total_input_tokens,
          total_output_tokens,
          total_cost_usd: Math.round(total_cost_usd * 1_000_000) / 1_000_000,
          total_duration_ms,
          tools_used,
          signal_emitted
        });
      } catch (err) {
        log('error', `[${context.source}] Failed to write agent log:`, err);
      }
    }
  };
}

module.exports = { createAgentTracker };
