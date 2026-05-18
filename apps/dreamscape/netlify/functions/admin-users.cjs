const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const users = await api.getAllUsers();
  if (!users.length) return { statusCode: 200, body: JSON.stringify({ members: [] }) };

  const lastSessions = await Promise.all(
    users.map(u => api.getLastSessionForUser(u._userId).then(last => ({ uid: u._userId, last })))
  );
  const lastByUser = Object.fromEntries(lastSessions.map(r => [r.uid, r.last]));

  const members = users.map(u => ({
    userId: u._userId,
    name: u._name,
    joinedAt: u.joinedAt || null,
    lastPracticedAt: lastByUser[u._userId]?.startedAt || null,
  }));

  return { statusCode: 200, body: JSON.stringify({ members }) };
};
