/**
 * Scheduled function: Discovery Pipeline
 *
 * Runs the company discovery pipeline on weekday mornings.
 * Finds companies matching the career agent's goal and user feedback patterns,
 * creates drafts for review, and queues a review action.
 *
 * Schedule: Weekdays at 1pm UTC (5am PT)
 */

const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');

exports.handler = async (event) => {
  console.log('[discovery-scheduled] Starting scheduled discovery run');

  const userId = process.env.DISCOVERY_USER_ID;
  const agentId = process.env.DISCOVERY_AGENT_ID;

  if (!userId || !agentId) {
    console.warn('[discovery-scheduled] Missing DISCOVERY_USER_ID or DISCOVERY_AGENT_ID — aborting');
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  console.log(`[discovery-scheduled] Running for agent=${agentId}, user=${userId}`);

  let result;
  try {
    result = await runDiscovery({ agentId, userId });
    console.log(`[discovery-scheduled] Complete: ${result.draftIds.length} drafts, ${result.errors.length} errors`);
  } catch (err) {
    console.error(`[discovery-scheduled] Error for agent=${agentId}:`, err.message);
    return { statusCode: 200, body: JSON.stringify({ agentId, success: false, error: err.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ agentId, success: true, drafts: result.draftIds.length, errors: result.errors })
  };
};
