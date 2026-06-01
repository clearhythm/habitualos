const { create, patch, query, remove, uniqueId } = require('@habitualos/db-core');

const COL = 'connections';

// Create a pending connection (invite sent, not yet accepted).
// Returns connId — passed through the magic link URL so sign-in can activate it.
// No-ops if an active connection already exists between the pair.
// Returns the existing connId if already pending.
async function createPendingConnection({ userAId, userBId, inviterName, inviteeName, inviteeEmail, _source }) {
  const [a, b] = [userAId, userBId].sort();
  const existing = await query({ collection: COL, where: [`_userAId::eq::${a}`] });
  const match = (existing || []).find(c => c._userBId === b);
  if (match) return match._connId; // already pending or active — reuse connId

  const connId = uniqueId('conn');
  await create({
    collection: COL,
    id: connId,
    data: {
      _connId:      connId,
      _userAId:     a,
      _userBId:     b,
      _initiatedBy: userAId,
      _state:       'pending',
      _source:      _source || 'link',
      inviterName:  inviterName  || null,
      inviteeName:  inviteeName  || null,
      inviteeEmail: inviteeEmail || null,
      createdAt:    Date.now(),
      acceptedAt:   null,
    },
  });
  return connId;
}

// Activate a pending connection by connId.
async function activateConnection(connId) {
  await patch({ collection: COL, id: connId, data: { _state: 'active', acceptedAt: Date.now() } });
}

// Get a single connection by id.
async function getConnection(connId) {
  const rows = await query({ collection: COL, where: [`_connId::eq::${connId}`] });
  return (rows || [])[0] || null;
}

// Ensure an active connection exists between two users (direct path, no pending step).
// Activates any existing pending connection rather than creating a duplicate.
async function ensureConnection({ userAId, userBId, initiatedBy }) {
  const [a, b] = [userAId, userBId].sort();
  const existing = await query({ collection: COL, where: [`_userAId::eq::${a}`] });
  const match = (existing || []).find(c => c._userBId === b);

  if (match) {
    if (match._state !== 'active') {
      await patch({ collection: COL, id: match._connId, data: { _state: 'active', acceptedAt: Date.now() } });
    }
    return;
  }

  const connId = uniqueId('conn');
  await create({
    collection: COL,
    id: connId,
    data: { _connId: connId, _userAId: a, _userBId: b, _initiatedBy: initiatedBy, _state: 'active' },
  });
}

// Returns active connections only. Treats missing _state as active for backwards compat.
async function getConnectionsForUser(userId) {
  const [asA, asB] = await Promise.all([
    query({ collection: COL, where: [`_userAId::eq::${userId}`] }),
    query({ collection: COL, where: [`_userBId::eq::${userId}`] }),
  ]);
  return [...(asA || []), ...(asB || [])].filter(c => c._state !== 'pending');
}

async function deleteConnectionsForUser(userId) {
  const connections = await getConnectionsForUser(userId);
  await Promise.all(connections.map(c => remove({ collection: COL, id: c._connId })));
}

module.exports = { createPendingConnection, activateConnection, getConnection, ensureConnection, getConnectionsForUser, deleteConnectionsForUser };
