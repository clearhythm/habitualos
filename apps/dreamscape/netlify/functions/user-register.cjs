const { upsertUser, getUser, updateUser } = require('./collections/users.cjs');
const { getConnection, activateConnection, ensureConnection } = require('./collections/connections.cjs');
const { assignSlug } = require('./collections/slugs.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('user.register', 'POST', async (event, { userId, name, chime, connectUserId, connId }) => {
  if (!userId || !userId.startsWith('u-')) throw new Error('invalid userId');
  log('debug', '[user-register] userId:', userId, 'connId:', connId, 'name:', name);

  if (connId) {
    // Join flow: name/chime already saved at email submission — just activate the connection
    const conn = await getConnection(connId);
    if (!conn) throw new Error('connection not found: ' + connId);

    await activateConnection(connId);
    log('debug', '[user-register] activated connection', connId);
    return { ok: true, connectName: conn.inviterName };
  }

  // Direct path: settings saves + already-signed-in join
  await upsertUser({ userId, name: name || '', joinedAt: Date.now() });

  const updates = {};
  if (name)  { updates._name = name; updates.slug = await assignSlug(userId, name); }
  if (chime) { updates.chime = chime; }
  if (Object.keys(updates).length) await updateUser(userId, updates);

  if (connectUserId && connectUserId !== userId) {
    await ensureConnection({ initiatedBy: userId, receivedBy: connectUserId });
    log('debug', '[user-register] connected', userId, '↔', connectUserId);
  }

  return { ok: true };
});
