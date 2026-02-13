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

// Hardcoded for now — single user, single discovery agent
const DISCOVERY_CONFIGS = [
  { userId: 'u-mgpqwa49', agentId: 'agent-mk3jq2dqjbfy' }
];

exports.handler = async (event) => {
  console.log('[discovery-scheduled] Starting scheduled discovery run');

  const results = [];

  for (const config of DISCOVERY_CONFIGS) {
    const { userId, agentId } = config;
    console.log(`[discovery-scheduled] Running for agent=${agentId}, user=${userId}`);

    try {
      const result = await runDiscovery({ agentId, userId });
      console.log(`[discovery-scheduled] Complete: ${result.draftIds.length} drafts, ${result.errors.length} errors`);
      results.push({ agentId, success: true, drafts: result.draftIds.length, errors: result.errors });
    } catch (err) {
      console.error(`[discovery-scheduled] Error for agent=${agentId}:`, err.message);
      results.push({ agentId, success: false, error: err.message });
    }
  }

  console.log('[discovery-scheduled] All runs complete:', JSON.stringify(results));

  return {
    statusCode: 200,
    body: JSON.stringify({ results })
  };
};
