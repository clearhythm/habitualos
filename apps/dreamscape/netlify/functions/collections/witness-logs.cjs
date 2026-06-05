const { create, query, remove, uniqueId } = require('@habitualos/db-core');
const { getConnectionsForUser, otherId } = require('./connections.cjs');
const { getLatestPracticeLog } = require('./practice-logs.cjs');
const { getUser } = require('./users.cjs');
const { log } = require('../_utils/log.cjs');

const COL = 'witness-logs';

const tsToMs = (ts) => ts?.toMillis() ?? 0;

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
  return Math.max(...rows.map(r => tsToMs(r._createdAt)));
}

async function getWitnessedStatus(userId) {
  const [lastWitnessedAt, user] = await Promise.all([
    getLastWitnessedAt(userId),
    getUser(userId),
  ]);
  const hasUnseen = !!lastWitnessedAt && lastWitnessedAt > tsToMs(user?.lastWitnessSeen);
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
    if (!session._practiceId) continue;
    if (witnessedIds.has(session._practiceId)) continue;
    const ts = session._startedAt;
    const lastPracticedAt = typeof ts === 'number' ? ts
      : ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : null);
    queue.push({
      practiceLogId: session._practiceId,
      userId: user._userId,
      name: user._name,
      lastPracticedAt,
      chime: user.chime ?? null,
    });
  }
  return queue;
}

async function getUnseenWitnesses(userId) {
  const [rows, user] = await Promise.all([
    query({ collection: COL, where: [`practicerId::eq::${userId}`] }),
    getUser(userId),
  ]);
  const lastSeen = tsToMs(user?.lastWitnessSeen);
  const unseen = (rows || []).filter(r => tsToMs(r._createdAt) > lastSeen);
  const seen = new Set();
  const unique = unseen.filter(r => {
    if (seen.has(r.witnessId)) return false;
    seen.add(r.witnessId);
    return true;
  });
  const witnesses = await Promise.all(unique.map(r => getUser(r.witnessId)));
  return witnesses.filter(Boolean).map(w => ({ name: w._name }));
}

async function deleteWitnessLogsForUser(witnessId) {
  const rows = await query({ collection: COL, where: [`witnessId::eq::${witnessId}`] }) || [];
  await Promise.all(rows.map(r => remove({ collection: COL, id: r._witnessLogId })));
}

module.exports = { createWitnessLog, getActiveWitnessQueue, getWitnessedStatus, getUnseenWitnesses, deleteWitnessLogsForUser };
