const { getAllUsers } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('admin.users', 'GET', async () => {
  const users = await getAllUsers();
  const members = users.map(u => ({
    userId: u._userId,
    name: u._name,
    joinedAt: u.joinedAt || null,
    lastPracticedAt: u.lastPracticedAt || null,
  }));
  return { members };
});
