const { create, get, patch, uniqueId } = require('@habitualos/db-core');

const COL = 'invitations';

// _source: 'link' — user followed a join/{slug} link
//           'email' — inviter sent a direct email invite (future)
async function createInvitation({ _source, inviterUserId, inviterName, inviteeName, inviteeEmail, chime }) {
  const inviteId = uniqueId('inv');
  await create({
    collection: COL,
    id: inviteId,
    data: {
      inviteId,
      _source,
      inviterUserId:  inviterUserId  || null,
      inviterName:    inviterName    || null,
      inviteeName:    inviteeName    || null,
      inviteeEmail:   inviteeEmail   || null,
      chime:          chime          || null,
      status:         'pending',
      createdAt:      Date.now(),
      acceptedAt:     null,
      acceptedByUserId: null,
    },
  });
  return inviteId;
}

async function getInvitation(inviteId) {
  return get({ collection: COL, id: inviteId });
}

async function updateInvitation(inviteId, data) {
  return patch({ collection: COL, id: inviteId, data });
}

module.exports = { createInvitation, getInvitation, updateInvitation };
