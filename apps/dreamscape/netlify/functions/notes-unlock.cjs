const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { userId } = JSON.parse(event.body || '{}');
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const unlocked = await api.unlockNotes(userId);
  return { statusCode: 200, body: JSON.stringify({ unlocked }) };
};
