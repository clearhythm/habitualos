const { getRecentPracticeLogs } = require('./collections/practice-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('admin.sessions', 'GET', async () => {
  const sessions = await getRecentPracticeLogs(20);
  return { sessions };
});
