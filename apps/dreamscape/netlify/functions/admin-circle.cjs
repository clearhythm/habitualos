const { query } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const connections = await query({ collection: 'connections' });
  if (!connections?.length) return { statusCode: 200, body: JSON.stringify({ members: [] }) };

  // collect unique userIds from all connections
  const userIds = [...new Set(connections.flatMap(c => [c._userAId, c._userBId]))];

  const sessionQueries = userIds.map(uid =>
    query({ collection: 'sessions', where: [`_userId::eq::${uid}`], orderBy: 'startedAt::desc', limit: 1 })
      .then(rows => ({ uid, last: rows?.[0] || null }))
  );
  const allSessionCounts = userIds.map(uid =>
    query({ collection: 'sessions', where: [`_userId::eq::${uid}`] })
      .then(rows => ({ uid, count: (rows || []).length }))
  );

  const [lastSessions, counts] = await Promise.all([
    Promise.all(sessionQueries),
    Promise.all(allSessionCounts),
  ]);

  const lastByUser = Object.fromEntries(lastSessions.map(r => [r.uid, r.last]));
  const countByUser = Object.fromEntries(counts.map(r => [r.uid, r.count]));

  const members = userIds.map(uid => {
    const last = lastByUser[uid];
    return {
      userId: uid,
      name: last?._name || uid,
      joinedAt: null,
      lastPracticedAt: last?.startedAt || null,
      sessions: countByUser[uid] || 0,
    };
  });

  return { statusCode: 200, body: JSON.stringify({ members }) };
};
