const { create, patch, query, remove, uniqueId } = require('@habitualos/db-core');

const COL = 'connections';

function otherId(conn, userId) {
  return conn.initiatedBy === userId ? conn.receivedBy : conn.initiatedBy;
}

async function _findExisting(userIdA, userIdB) {
  const [asInit, asRecv] = await Promise.all([
    query({ collection: COL, where: [`initiatedBy::eq::${userIdA}`] }),
    query({ collection: COL, where: [`receivedBy::eq::${userIdA}`] }),
  ]);
  return [...(asInit || []), ...(asRecv || [])].find(
    c => c.initiatedBy === userIdB || c.receivedBy === userIdB
  ) || null;
}

async function createPendingConnection({ initiatedBy, receivedBy, _source }) {
  const existing = await _findExisting(initiatedBy, receivedBy);
  if (existing) return existing._connectionId;

  const _connectionId = uniqueId('c');
  await create({
    collection: COL,
    id: _connectionId,
    data: { _connectionId, status: 'pending', _source: _source || 'link', initiatedBy, receivedBy },
  });
  return _connectionId;
}

async function activateConnection(_connectionId) {
  await patch({ collection: COL, id: _connectionId, data: { status: 'active' } });
}

async function getConnection(_connectionId) {
  const rows = await query({ collection: COL, where: [`_connectionId::eq::${_connectionId}`] });
  return (rows || [])[0] || null;
}

async function ensureConnection({ initiatedBy, receivedBy }) {
  const existing = await _findExisting(initiatedBy, receivedBy);
  if (existing) {
    if (existing.status !== 'active') {
      await patch({ collection: COL, id: existing._connectionId, data: { status: 'active' } });
    }
    return;
  }
  const _connectionId = uniqueId('c');
  await create({
    collection: COL,
    id: _connectionId,
    data: { _connectionId, status: 'active', initiatedBy, receivedBy },
  });
}

// Returns active connections only. Treats missing status as active for backwards compat.
async function getConnectionsForUser(userId) {
  const [asInit, asRecv] = await Promise.all([
    query({ collection: COL, where: [`initiatedBy::eq::${userId}`] }),
    query({ collection: COL, where: [`receivedBy::eq::${userId}`] }),
  ]);
  return [...(asInit || []), ...(asRecv || [])].filter(c => c.status !== 'pending');
}

async function deleteConnectionsForUser(userId) {
  const connections = await getConnectionsForUser(userId);
  await Promise.all(connections.map(c => remove({ collection: COL, id: c._connectionId })));
}

module.exports = { createPendingConnection, activateConnection, getConnection, ensureConnection, getConnectionsForUser, otherId, deleteConnectionsForUser };
