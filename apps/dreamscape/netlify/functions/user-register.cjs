const { upsertUser, updateUser } = require('./_services/db-users.cjs');
const { assignSlug } = require('./_services/db-slugs.cjs');
const { ensureConnection } = require('./_services/db-connections.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const { userId, name, chime, connectUserId } = body;

  if (!userId || !userId.startsWith('u-')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid userId' }) };
  }

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

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};
