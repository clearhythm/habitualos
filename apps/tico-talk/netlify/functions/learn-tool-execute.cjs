exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toolUse } = JSON.parse(event.body || '{}');
    if (!toolUse || !toolUse.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'toolUse is required' }) };
    }

    if (toolUse.name === 'mark_section_learned') {
      // TODO (Ticket 3): write to the learn-progress Firestore collection.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { learned: true } })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolUse.name}` }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
