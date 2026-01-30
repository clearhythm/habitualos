/**
 * POST /api/discovery-run
 *
 * Triggers the discovery pipeline for an agent.
 * Searches for companies matching the agent's goal and user feedback patterns.
 *
 * Request body:
 *   { userId: "u-...", agentId: "agent-..." }
 *
 * Response:
 *   {
 *     success: true,
 *     draftIds: ["draft-..."],
 *     searchQueries: ["query 1", "query 2"],
 *     errors: []
 *   }
 */

const { runDiscovery } = require('./_utils/discovery-pipeline.cjs');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { userId, agentId } = body;

    // Validate required fields
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'userId is required' })
      };
    }

    if (!agentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'agentId is required' })
      };
    }

    console.log(`[discovery-run] Starting for agent=${agentId}, user=${userId}`);

    // Run discovery pipeline
    const result = await runDiscovery({ agentId, userId });

    console.log(`[discovery-run] Complete:`, {
      draftIds: result.draftIds.length,
      queries: result.searchQueries.length,
      errors: result.errors.length
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ...result
      })
    };

  } catch (err) {
    console.error('[discovery-run] Error:', err);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
