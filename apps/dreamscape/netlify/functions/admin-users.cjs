const { getAllUsers } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');

const tsToMs = (ts) => ts?.toMillis() ?? 0;

exports.handler = handle('admin.users', 'GET', async () => {
  const users = await getAllUsers();
  const members = users.map(u => ({
    userId: u._userId,
    name: u._name,
    joinedAt: tsToMs(u.joinedAt) || null,
    lastPracticedAt: tsToMs(u.lastPracticedAt) || null,
  }));
  return { members };
});
