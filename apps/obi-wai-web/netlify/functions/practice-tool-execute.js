require('dotenv').config();
const { getPracticesByUserId } = require('./_services/db-practices.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

/**
 * POST /api/practice-tool-execute
 *
 * Executes tool calls on behalf of the Obi-Wai streaming chat edge function.
 * Called by the chat-stream edge function when Claude uses a tool.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, toolUse } = JSON.parse(event.body);

    if (!userId || !toolUse) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId and toolUse required' })
      };
    }

    const [practiceLogs, practices] = await Promise.all([
      getPracticeLogsByUserId(userId),
      getPracticesByUserId(userId)
    ]);

    let result;

    if (toolUse.name === 'get_practice_history') {
      let logs = practiceLogs;
      if (toolUse.input.practice_name) {
        const pattern = new RegExp(toolUse.input.practice_name, 'i');
        logs = logs.filter(l => pattern.test(l.practice_name));
      }
      const limit = Math.min(toolUse.input.limit || 15, 50);
      result = logs.slice(0, limit).map(l => ({
        date: l.timestamp,
        practice: l.practice_name,
        duration: l.duration,
        reflection: l.reflection || null,
        wisdom: l.obi_wan_message || null
      }));
    } else if (toolUse.name === 'get_practice_detail') {
      const pattern = new RegExp(toolUse.input.practice_name, 'i');
      const definition = practices.find(p => pattern.test(p.name || p.practice_name));
      const logs = practiceLogs.filter(l => pattern.test(l.practice_name));
      result = {
        definition: definition || null,
        log_count: logs.length,
        logs: logs.slice(0, 20).map(l => ({
          date: l.timestamp,
          duration: l.duration,
          reflection: l.reflection || null,
          wisdom: l.obi_wan_message || null
        }))
      };
    } else {
      result = { error: `Unknown tool: ${toolUse.name}` };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    };

  } catch (error) {
    console.error('[practice-tool-execute] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};
