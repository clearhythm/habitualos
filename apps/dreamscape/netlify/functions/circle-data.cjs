const { query } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const userId = event.queryStringParameters?.userId;
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const [connAsA, connAsB, receivedNotes, sentNotes] = await Promise.all([
    query({ collection: 'connections', where: [`_userAId::eq::${userId}`] }),
    query({ collection: 'connections', where: [`_userBId::eq::${userId}`] }),
    query({ collection: 'notes', where: [`_toUserId::eq::${userId}`] }),
    query({ collection: 'notes', where: [`_fromUserId::eq::${userId}`] }),
  ]);

  const connections = [...(connAsA || []), ...(connAsB || [])];
  const memberIds = connections.map(c => c._userAId === userId ? c._userBId : c._userAId);

  // Get last session per circle member
  const sessionQueries = memberIds.map(mid =>
    query({ collection: 'sessions', where: [`_userId::eq::${mid}`], orderBy: 'startedAt::desc', limit: 1 })
  );
  const memberSessions = await Promise.all(sessionQueries);

  const circle = memberIds.map((mid, i) => {
    const conn = connections.find(c => c._userAId === mid || c._userBId === mid);
    const lastSession = memberSessions[i]?.[0] || null;
    const lastPracticedAt = lastSession?.startedAt || null;
    const daysSince = lastPracticedAt
      ? Math.floor((Date.now() - lastPracticedAt) / 86400000)
      : null;
    return { userId: mid, _connId: conn._connId, lastPracticedAt, daysSince };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      circle,
      receivedNotes: (receivedNotes || []).map(n => ({
        _noteId: n._noteId,
        _fromUserId: n._fromUserId,
        _fromName: n._fromName,
        text: n.text,
        sentAt: n.sentAt,
        unlockedAt: n.unlockedAt,
        readAt: n.readAt,
      })),
      sentNotes: (sentNotes || []).map(n => ({
        _noteId: n._noteId,
        _toUserId: n._toUserId,
        text: n.text,
        sentAt: n.sentAt,
      })),
    }),
  };
};
