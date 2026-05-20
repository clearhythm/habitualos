const { createNote } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('note.send', 'POST', async (event, { fromUserId, fromName, toUserId, text }) => {
  if (!fromUserId || !toUserId || !text?.trim()) throw new Error('fromUserId, toUserId, and text required');
  const noteId = await createNote({ fromUserId, fromName, toUserId, text });
  return { noteId };
});
