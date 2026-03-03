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
const { runArticleDiscovery } = require('./_utils/article-pipeline.cjs');

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
    const body = JSON.parse(event.body || '{}');
    const { userId, agentId } = body;

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

    // Run both pipelines
    const [companies, articles] = await Promise.all([
      runDiscovery({ agentId, userId }),
      runArticleDiscovery({ agentId, userId })
    ]);

    console.log(`[discovery-run] Complete: ${companies.draftIds.length} companies, ${articles.draftIds.length} articles`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        companies,
        articles
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
