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

// Create a pending connection (invite sent, not yet accepted).
// Returns _connectionId — passed through the magic link URL so sign-in can activate it.
// No-ops and returns existing id if a connection already exists between the pair.
async function createPendingConnection({ initiatedBy, receivedBy, inviterName, inviteeName, inviteeEmail, _source }) {
  const existing = await _findExisting(initiatedBy, receivedBy);
  if (existing) return existing._connectionId;

  const _connectionId = uniqueId('c');
  await create({
    collection: COL,
    id: _connectionId,
    data: {
      _connectionId,
      status:       'pending',
      _source:      _source || 'link',
      initiatedBy,
      receivedBy,
      inviterName:  inviterName  || null,
      inviteeName:  inviteeName  || null,
      inviteeEmail: inviteeEmail || null,
          },
  });
  return _connectionId;
}

// Activate a pending connection.
async function activateConnection(_connectionId) {
  await patch({ collection: COL, id: _connectionId, data: { status: 'active' } });
}

// Get a single connection by id.
async function getConnection(_connectionId) {
  const rows = await query({ collection: COL, where: [`_connectionId::eq::${_connectionId}`] });
  return (rows || [])[0] || null;
}

// Ensure an active connection exists (direct path — no pending step).
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
