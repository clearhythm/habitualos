const { updateLastPracticed } = require('./collections/users.cjs');
const { unlockNotes } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('session.complete', 'POST', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');
  await Promise.all([
    updateLastPracticed(userId),
    unlockNotes(userId),
  ]);
  return { ok: true };
});
