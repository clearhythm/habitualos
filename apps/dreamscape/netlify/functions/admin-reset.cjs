const { deleteConnectionsForUser } = require('./collections/connections.cjs');
const { deleteNotesForUser } = require('./collections/notes.cjs');
const { deleteSessionsForUser } = require('./collections/sessions.cjs');
const { deleteUser } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');
const { TEST_USER_IDS } = require('./_utils/test-users.cjs');

exports.handler = handle('admin.reset', 'POST', async () => {
  await Promise.all(TEST_USER_IDS.map(async (userId) => {
    await Promise.all([
      deleteConnectionsForUser(userId),
      deleteNotesForUser(userId),
      deleteSessionsForUser(userId),
      deleteUser(userId),
    ]);
  }));
  return { ok: true, deletedFor: TEST_USER_IDS };
});
