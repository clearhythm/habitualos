const { markSectionLearned } = require('./_services/db-learn-progress.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, toolUse, section, restaurantId } = JSON.parse(event.body || '{}');
    if (!toolUse || !toolUse.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'toolUse is required' }) };
    }

    if (toolUse.name === 'mark_section_learned') {
      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
      }
      if (!restaurantId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
      }
      if (!section) {
        return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
      }
      await markSectionLearned(userId, restaurantId, section);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { learned: true, section } })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolUse.name}` }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
