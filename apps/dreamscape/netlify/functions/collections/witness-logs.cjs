const { create, query, remove, uniqueId } = require('@habitualos/db-core');
const { getConnectionsForUser } = require('./connections.cjs');
const { getLatestPracticeLog } = require('./practice-logs.cjs');
const { getUser } = require('./users.cjs');

const COL = 'witness-logs';

async function createWitnessLog({ userId, witnessedUserId, witnessedPracticeId }) {
  const id = uniqueId('wl');
  await create({
    collection: COL,
    id,
    data: {
      _witnessId: id,
      _userId: userId,
      _createdAt: Date.now(),
      witnessedUserId,
      witnessedPracticeId,
    },
  });
}

async function getWitnessedPracticeIds(userId) {
  const rows = await query({ collection: COL, where: [`_userId::eq::${userId}`] }) || [];
  return new Set(rows.map(r => r.witnessedPracticeId));
}

async function getActiveWitnessQueue(userId) {
  const connections = await getConnectionsForUser(userId);
  const connUserIds = connections.map(c => c._userAId === userId ? c._userBId : c._userAId);

  if (!connUserIds.length) return [];

  const [witnessedIds, ...connData] = await Promise.all([
    getWitnessedPracticeIds(userId),
    ...connUserIds.map(id => Promise.all([getUser(id), getLatestPracticeLog(id)])),
  ]);

  const queue = [];
  for (const [user, session] of connData) {
    if (!user || !session) continue;
    if (witnessedIds.has(session._practiceId)) continue;
    queue.push({
      practiceId: session._practiceId,
      userId: user._userId,
      name: user._name,
      lastPracticedAt: session._startedAt,
      chime: user.chime ?? null,
    });
  }
  return queue;
}

async function deleteWitnessLogsForUser(userId) {
  const rows = await query({ collection: COL, where: [`_userId::eq::${userId}`] }) || [];
  await Promise.all(rows.map(r => remove({ collection: COL, id: r._witnessId })));
}

module.exports = { createWitnessLog, getActiveWitnessQueue, deleteWitnessLogsForUser };
