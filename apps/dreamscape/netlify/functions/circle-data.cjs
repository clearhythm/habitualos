const { getConnectionsForUser, otherId } = require('./collections/connections.cjs');
const { getUser }               = require('./collections/users.cjs');
const { getReceivedNotes, getSentNotes } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

const tsToMs = (ts) => ts?.toMillis() ?? 0;

exports.handler = handle('circle.load', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');

  const [connections, receivedNotes, sentNotes] = await Promise.all([
    getConnectionsForUser(userId),
    getReceivedNotes(userId),
    getSentNotes(userId),
  ]);

  const memberIds = connections.map(c => otherId(c, userId));
  const members = await Promise.all(memberIds.map(getUser));

  const circle = members.filter(Boolean).map(m => {
    const lastPracticedMs = tsToMs(m.lastPracticedAt);
    return {
      userId: m._userId,
      name: m._name,
      lastPracticedAt: lastPracticedMs || null,
      daysSince: lastPracticedMs ? Math.floor((Date.now() - lastPracticedMs) / 86400000) : null,
    };
  });

  return {
    circle,
    receivedNotes: receivedNotes.map(n => ({
      _noteId: n._noteId, _fromUserId: n._fromUserId, _fromName: n._fromName,
      text: n.text, sentAt: tsToMs(n.sentAt), unlockedAt: tsToMs(n.unlockedAt) || null, readAt: tsToMs(n.readAt) || null,
    })),
    sentNotes: sentNotes.map(n => ({
      _noteId: n._noteId, _toUserId: n._toUserId, text: n.text, sentAt: tsToMs(n.sentAt),
    })),
  };
});
