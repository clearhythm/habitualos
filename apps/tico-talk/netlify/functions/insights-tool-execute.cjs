// POST /api/insights-tool-execute — called by the shared chat-stream edge
// function whenever the model invokes one of the four tools defined in
// insights-chat-init.cjs. Thin dispatch to _services/insights-data.cjs;
// no business logic lives here.

const { getServerPerformance, getRevenueTrends, getShiftBreakdown, getItemPopularity } = require('./_services/insights-data.cjs');
const { log } = require('./_utils/log.cjs');

const HANDLERS = {
  get_server_performance: () => getServerPerformance(),
  get_revenue_trends: () => getRevenueTrends(),
  get_shift_breakdown: (input) => getShiftBreakdown(input || {}),
  get_item_popularity: (input) => getItemPopularity(input || {})
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toolUse } = JSON.parse(event.body || '{}');
    const handler = HANDLERS[toolUse?.name];
    if (!handler) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolUse?.name}` }) };
    }

    const result = handler(toolUse.input);
    log('debug', '[insights-tool-execute]', toolUse.name, toolUse.input);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    };
  } catch (error) {
    log('error', '[insights-tool-execute] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
