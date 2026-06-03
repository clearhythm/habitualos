const { create, query, remove, uniqueId } = require('@habitualos/db-core');
const { getConnectionsForUser, otherId } = require('./connections.cjs');
const { getLatestPracticeLog } = require('./practice-logs.cjs');
const { getUser } = require('./users.cjs');

const COL = 'witness-logs';

async function createWitnessLog({ witnessId, practicerId, practiceLogId }) {
  const id = uniqueId('wl');
  await create({
    collection: COL,
    id,
    data: {
      _witnessLogId: id,
      witnessId,
      practicerId,
      practiceLogId,
      _createdAt: Date.now(),
    },
  });
}

async function getWitnessedPracticeLogIds(witnessId) {
  const rows = await query({ collection: COL, where: [`witnessId::eq::${witnessId}`] }) || [];
  return new Set(rows.map(r => r.practiceLogId));
}

async function getLastWitnessedAt(userId) {
  const rows = await query({ collection: COL, where: [`practicerId::eq::${userId}`] }) || [];
  if (!rows.length) return null;
  return Math.max(...rows.map(r => r._createdAt));
}

async function getWitnessedStatus(userId) {
  const [lastWitnessedAt, user] = await Promise.all([
    getLastWitnessedAt(userId),
    getUser(userId),
  ]);
  const hasUnseen = !!lastWitnessedAt && lastWitnessedAt > (user?.lastWitnessSeen || 0);
  return { hasUnseen, lastWitnessedAt };
}

async function getActiveWitnessQueue(userId) {
  const connections = await getConnectionsForUser(userId);
  const connUserIds = connections.map(c => otherId(c, userId));

  if (!connUserIds.length) return [];

  const [witnessedIds, ...connData] = await Promise.all([
    getWitnessedPracticeLogIds(userId),
    ...connUserIds.map(id => Promise.all([getUser(id), getLatestPracticeLog(id)])),
  ]);

  const queue = [];
  for (const [user, session] of connData) {
    if (!user || !session) continue;
    if (witnessedIds.has(session._practiceLogId)) continue;
    queue.push({
      practiceLogId: session._practiceLogId,
      userId: user._userId,
      name: user._name,
      lastPracticedAt: session._startedAt,
      chime: user.chime ?? null,
    });
  }
  return queue;
}

async function deleteWitnessLogsForUser(witnessId) {
  const rows = await query({ collection: COL, where: [`witnessId::eq::${witnessId}`] }) || [];
  await Promise.all(rows.map(r => remove({ collection: COL, id: r._witnessLogId })));
}

module.exports = { createWitnessLog, getActiveWitnessQueue, getWitnessedStatus, deleteWitnessLogsForUser };
