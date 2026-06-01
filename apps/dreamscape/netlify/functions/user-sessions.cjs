const { getPracticeLogsForUser } = require('./collections/practice-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('sessions.getForUser', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');
  return getPracticeLogsForUser(userId);
});
