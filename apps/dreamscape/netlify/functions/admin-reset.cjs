const { deleteConnectionsForUser } = require('./collections/connections.cjs');
const { deleteNotesForUser } = require('./collections/notes.cjs');
const { deletePracticeLogsForUser } = require('./collections/practice-logs.cjs');
const { deleteWitnessLogsForUser } = require('./collections/witness-logs.cjs');
const { getAllUsers, deleteUser } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('admin.reset', 'POST', async () => {
  const all = await getAllUsers();
  const testUserIds = all.filter(u => u._userId?.startsWith('tu-')).map(u => u._userId);
  await Promise.all(testUserIds.map(async (userId) => {
    await Promise.all([
      deleteConnectionsForUser(userId),
      deleteNotesForUser(userId),
      deletePracticeLogsForUser(userId),
      deleteWitnessLogsForUser(userId),
      deleteUser(userId),
    ]);
  }));
  return { ok: true, deletedFor: testUserIds };
});
