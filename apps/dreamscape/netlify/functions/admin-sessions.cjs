const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const sessions = await api.getRecentSessions(20);
  return { statusCode: 200, body: JSON.stringify({ sessions }) };
};
