/**
 * POST /api/signal-tool-execute
 * Tool execution stub for Phase 1 (no tools defined).
 * Phase 2+ will add tools for fetching context chunks, etc.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, result: {} })
  };
};
