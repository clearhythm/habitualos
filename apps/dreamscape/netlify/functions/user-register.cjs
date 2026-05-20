const { upsertUser, updateUser } = require('./collections/users.cjs');
const { assignSlug } = require('./collections/slugs.cjs');
const { ensureConnection } = require('./collections/connections.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('user.register', 'POST', async (event, { userId, name, chime, connectUserId }) => {
  if (!userId || !userId.startsWith('u-')) throw new Error('invalid userId');

  log('debug', '[user-register] userId:', userId, 'name:', name, 'connectUserId:', connectUserId);

  await upsertUser({ userId, name: name || '', joinedAt: Date.now() });

  const updates = {};
  if (name) updates._name = name;
  if (chime) updates.chime = chime;

  if (name) {
    const slug = await assignSlug(userId, name);
    updates.slug = slug;
  }

  if (Object.keys(updates).length) {
    await updateUser(userId, updates);
  }

  if (connectUserId && connectUserId !== userId) {
    await ensureConnection({ userAId: userId, userBId: connectUserId, initiatedBy: userId });
    log('debug', '[user-register] connected', userId, '↔', connectUserId);
  }

  return { ok: true };
});
