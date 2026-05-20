const { getRecentSessions } = require('./collections/sessions.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('admin.sessions', 'GET', async () => {
  const sessions = await getRecentSessions(20);
  return { sessions };
});
