const { query, remove } = require('@habitualos/db-core');

const COL = 'sessions';

async function getLastSessionForUser(userId) {
  const rows = await query({ collection: COL, where: [`_userId::eq::${userId}`], orderBy: 'startedAt::desc', limit: 1 });
  return rows?.[0] || null;
}

async function getRecentSessions(limit = 20) {
  return query({ collection: COL, orderBy: 'startedAt::desc', limit }) || [];
}

async function getSessionsForUser(userId) {
  return query({ collection: COL, where: [`_userId::eq::${userId}`] }) || [];
}

async function deleteSessionsForUser(userId) {
  const sessions = await getSessionsForUser(userId);
  await Promise.all(sessions.map(s => remove({ collection: COL, id: s._sessionId })));
}

module.exports = { getLastSessionForUser, getRecentSessions, getSessionsForUser, deleteSessionsForUser };
