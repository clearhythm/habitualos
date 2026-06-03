const { query, remove } = require('@habitualos/db-core');

const COL = 'practice-logs';

async function getLatestPracticeLog(userId) {
  const rows = await query({ collection: COL, where: [`_userId::eq::${userId}`] });
  if (!rows?.length) return null;
  return rows.reduce((latest, row) => (row._startedAt > (latest?._startedAt ?? 0) ? row : latest), null);
}

async function getRecentPracticeLogs(limit = 20) {
  return query({ collection: COL, orderBy: '_startedAt::desc', limit }) || [];
}

async function getPracticeLogsForUser(userId) {
  return query({ collection: COL, where: [`_userId::eq::${userId}`] }) || [];
}

async function deletePracticeLogsForUser(userId) {
  const logs = await getPracticeLogsForUser(userId);
  await Promise.all(logs.map(l => remove({ collection: COL, id: l._practiceId })));
}

module.exports = { getLatestPracticeLog, getRecentPracticeLogs, getPracticeLogsForUser, deletePracticeLogsForUser };
