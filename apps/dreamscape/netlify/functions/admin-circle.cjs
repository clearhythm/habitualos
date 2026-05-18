const { query } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const users = await query({ collection: 'users' });
  if (!users?.length) return { statusCode: 200, body: JSON.stringify({ members: [] }) };

  const sessionQueries = users.map(u =>
    query({ collection: 'sessions', where: [`_userId::eq::${u._userId}`], orderBy: 'startedAt::desc', limit: 1 })
      .then(rows => ({ uid: u._userId, last: rows?.[0] || null }))
  );

  const lastSessions = await Promise.all(sessionQueries);
  const lastByUser = Object.fromEntries(lastSessions.map(r => [r.uid, r.last]));

  const members = users.map(u => {
    const last = lastByUser[u._userId];
    return {
      userId: u._userId,
      name: u._name,
      joinedAt: u.joinedAt || null,
      lastPracticedAt: last?.startedAt || null,
    };
  });

  return { statusCode: 200, body: JSON.stringify({ members }) };
};
