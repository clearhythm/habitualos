const { getReceivedNotes } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('note.unreadCheck', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');
  const notes = await getReceivedNotes(userId);
  const hasUnread = notes.some(n => n.unlockedAt && !n.readAt);
  return { hasUnread };
});
