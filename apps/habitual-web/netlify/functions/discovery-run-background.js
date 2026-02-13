/**
 * POST /api/discovery-run-background
 *
 * Background version of discovery-run. Returns 202 immediately,
 * runs the pipeline asynchronously. Check Firestore for results.
 *
 * Request body:
 *   { userId: "u-...", agentId: "agent-..." }
 */

const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const body = JSON.parse(event.body || '{}');
  const { userId, agentId } = body;

  if (!userId || !agentId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId and agentId required' }) };
  }

  console.log(`[discovery-run-bg] Starting for agent=${agentId}, user=${userId}`);

  try {
    const result = await runDiscovery({ agentId, userId });
    console.log(`[discovery-run-bg] Complete: ${result.draftIds.length} drafts, ${result.errors.length} errors`);
    console.log(`[discovery-run-bg] Result:`, JSON.stringify(result));
  } catch (err) {
    console.error(`[discovery-run-bg] Error:`, err.message);
  }
};
