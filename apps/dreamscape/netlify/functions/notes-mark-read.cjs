const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { userId, fromUserId } = JSON.parse(event.body || '{}');
  if (!userId || !fromUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId and fromUserId required' }) };
  }

  const marked = await api.markNotesRead({ userId, fromUserId });
  return { statusCode: 200, body: JSON.stringify({ marked }) };
};
