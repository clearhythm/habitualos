const { create, query, remove, uniqueId } = require('@habitualos/db-core');

const COL = 'connections';

async function ensureConnection({ userAId, userBId, initiatedBy }) {
  const [a, b] = [userAId, userBId].sort();
  const existing = await query({ collection: COL, where: [`_userAId::eq::${a}`] });
  if ((existing || []).some(c => c._userBId === b)) return;
  const connId = uniqueId('conn');
  await create({
    collection: COL,
    id: connId,
    data: { _connId: connId, _userAId: a, _userBId: b, _initiatedBy: initiatedBy },
  });
}

async function getConnectionsForUser(userId) {
  const [asA, asB] = await Promise.all([
    query({ collection: COL, where: [`_userAId::eq::${userId}`] }),
    query({ collection: COL, where: [`_userBId::eq::${userId}`] }),
  ]);
  return [...(asA || []), ...(asB || [])];
}

async function deleteConnectionsForUser(userId) {
  const connections = await getConnectionsForUser(userId);
  await Promise.all(connections.map(c => remove({ collection: COL, id: c._connId })));
}

module.exports = { ensureConnection, getConnectionsForUser, deleteConnectionsForUser };
