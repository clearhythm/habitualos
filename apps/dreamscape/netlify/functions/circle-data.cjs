const { getConnectionsForUser, otherId } = require('./collections/connections.cjs');
const { getUser }               = require('./collections/users.cjs');
const { getReceivedNotes, getSentNotes } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('circle.load', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');

  const [connections, receivedNotes, sentNotes] = await Promise.all([
    getConnectionsForUser(userId),
    getReceivedNotes(userId),
    getSentNotes(userId),
  ]);

  const memberIds = connections.map(c => otherId(c, userId));
  const members = await Promise.all(memberIds.map(getUser));

  const circle = members.filter(Boolean).map(m => ({
    userId: m._userId,
    name: m._name,
    lastPracticedAt: m.lastPracticedAt || null,
    daysSince: m.lastPracticedAt
      ? Math.floor((Date.now() - m.lastPracticedAt) / 86400000) : null,
  }));

  return {
    circle,
    receivedNotes: receivedNotes.map(n => ({
      _noteId: n._noteId, _fromUserId: n._fromUserId, _fromName: n._fromName,
      text: n.text, sentAt: n.sentAt, unlockedAt: n.unlockedAt, readAt: n.readAt,
    })),
    sentNotes: sentNotes.map(n => ({
      _noteId: n._noteId, _toUserId: n._toUserId, text: n.text, sentAt: n.sentAt,
    })),
  };
});
