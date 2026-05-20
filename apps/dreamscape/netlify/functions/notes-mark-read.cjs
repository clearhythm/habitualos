const { markNotesRead } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('note.markRead', 'POST', async (event, { userId, fromUserId }) => {
  if (!userId || !fromUserId) throw new Error('userId and fromUserId required');
  const marked = await markNotesRead({ userId, fromUserId });
  return { marked };
});
