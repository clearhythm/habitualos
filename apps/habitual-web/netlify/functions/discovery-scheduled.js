/**
 * Scheduled function: Discovery Pipeline
 *
 * Runs company and article discovery pipelines on weekday mornings.
 * Finds companies and articles matching the career agent's goal and user
 * feedback patterns, creates drafts for review, and queues review actions.
 *
 * Schedule: Weekdays at 1pm UTC (5am PT)
 *
 * Required env vars:
 *   DISCOVERY_USER_ID  — user ID to run discovery for
 *   DISCOVERY_AGENT_ID — discovery agent ID
 */

const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');
const { runArticleDiscovery } = require('./_utils/article-pipeline.cjs');

exports.handler = async (event) => {
  console.log('[discovery-scheduled] Starting scheduled discovery run');

  const userId = process.env.DISCOVERY_USER_ID;
  const agentId = process.env.DISCOVERY_AGENT_ID;

  if (!userId || !agentId) {
    console.warn('[discovery-scheduled] Missing DISCOVERY_USER_ID or DISCOVERY_AGENT_ID — aborting');
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  console.log(`[discovery-scheduled] Running for agent=${agentId}, user=${userId}`);

  const results = {};

  // Company discovery
  try {
    const result = await runDiscovery({ agentId, userId });
    console.log(`[discovery-scheduled] Companies: ${result.draftIds.length} drafts, ${result.errors.length} errors`);
    results.companies = { success: true, drafts: result.draftIds.length, errors: result.errors };
  } catch (err) {
    console.error('[discovery-scheduled] Company pipeline error:', err.message);
    results.companies = { success: false, error: err.message };
  }

  // Article discovery
  try {
    const result = await runArticleDiscovery({ agentId, userId });
    console.log(`[discovery-scheduled] Articles: ${result.draftIds.length} drafts, ${result.errors.length} errors`);
    results.articles = { success: true, drafts: result.draftIds.length, errors: result.errors };
  } catch (err) {
    console.error('[discovery-scheduled] Article pipeline error:', err.message);
    results.articles = { success: false, error: err.message };
  }

  console.log('[discovery-scheduled] Complete:', JSON.stringify(results));

  return {
    statusCode: 200,
    body: JSON.stringify({ results })
  };
};
