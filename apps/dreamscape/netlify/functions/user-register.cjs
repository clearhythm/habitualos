const { upsertUser, getUser, updateUser } = require('./collections/users.cjs');
const { getInvitation, updateInvitation } = require('./collections/invitations.cjs');
const { assignSlug } = require('./collections/slugs.cjs');
const { ensureConnection } = require('./collections/connections.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('user.register', 'POST', async (event, { userId, name, chime, connectUserId, inviteId }) => {
  if (!userId || !userId.startsWith('u-')) throw new Error('invalid userId');
  log('debug', '[user-register] userId:', userId, 'inviteId:', inviteId, 'name:', name);

  if (inviteId) {
    const invitation = await getInvitation(inviteId);
    if (!invitation) throw new Error('invitation not found: ' + inviteId);

    const existingUser = await getUser(userId);
    const updates = {};

    if (!existingUser?.joinedAt) updates.joinedAt = Date.now();

    // Only apply name/chime if the user doesn't already have them
    if (!existingUser?._name && invitation.inviteeName) {
      updates._name = invitation.inviteeName;
      const slug = await assignSlug(userId, invitation.inviteeName);
      updates.slug = slug;
    }
    if (!existingUser?.chime && invitation.chime) {
      updates.chime = invitation.chime;
    }

    if (Object.keys(updates).length) await updateUser(userId, updates);

    // Connection always runs — that's the point of join
    if (invitation.inviterUserId && invitation.inviterUserId !== userId) {
      await ensureConnection({ userAId: userId, userBId: invitation.inviterUserId, initiatedBy: userId });
      log('debug', '[user-register] connected', userId, '↔', invitation.inviterUserId);
    }

    await updateInvitation(inviteId, { status: 'accepted', acceptedByUserId: userId, acceptedAt: Date.now() });
    return { ok: true, connectName: invitation.inviterName };
  }

  // Direct path: settings saves + already-signed-in join
  await upsertUser({ userId, name: name || '', joinedAt: Date.now() });

  const updates = {};
  if (name) updates._name = name;
  if (chime) updates.chime = chime;
  if (name) {
    const slug = await assignSlug(userId, name);
    updates.slug = slug;
  }
  if (Object.keys(updates).length) await updateUser(userId, updates);

  if (connectUserId && connectUserId !== userId) {
    await ensureConnection({ userAId: userId, userBId: connectUserId, initiatedBy: userId });
    log('debug', '[user-register] connected', userId, '↔', connectUserId);
  }

  return { ok: true };
});
