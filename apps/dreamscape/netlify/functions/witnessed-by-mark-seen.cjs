const { updateUser } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('witnessed.by.markSeen', 'POST', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');
  await updateUser(userId, { lastWitnessSeen: new Date() });
  return { ok: true };
});
