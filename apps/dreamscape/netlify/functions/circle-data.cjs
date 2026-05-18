const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const userId = event.queryStringParameters?.userId;
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const [connections, receivedNotes, sentNotes] = await Promise.all([
    api.getConnectionsForUser(userId),
    api.getReceivedNotes(userId),
    api.getSentNotes(userId),
  ]);

  const memberIds = connections.map(c => c._userAId === userId ? c._userBId : c._userAId);

  const lastSessions = await Promise.all(
    memberIds.map(mid => api.getLastSessionForUser(mid).then(last => ({ mid, last })))
  );
  const lastByUser = Object.fromEntries(lastSessions.map(r => [r.mid, r.last]));

  const circle = memberIds.map(mid => {
    const conn = connections.find(c => c._userAId === mid || c._userBId === mid);
    const last = lastByUser[mid];
    const lastPracticedAt = last?.startedAt || null;
    const daysSince = lastPracticedAt ? Math.floor((Date.now() - lastPracticedAt) / 86400000) : null;
    return { userId: mid, _connId: conn._connId, lastPracticedAt, daysSince };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      circle,
      receivedNotes: receivedNotes.map(n => ({
        _noteId: n._noteId, _fromUserId: n._fromUserId, _fromName: n._fromName,
        text: n.text, sentAt: n.sentAt, unlockedAt: n.unlockedAt, readAt: n.readAt,
      })),
      sentNotes: sentNotes.map(n => ({
        _noteId: n._noteId, _toUserId: n._toUserId, text: n.text, sentAt: n.sentAt,
      })),
    }),
  };
};
