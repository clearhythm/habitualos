const { create, get, patch, query, remove } = require('@habitualos/db-core');

const COL = 'users';

async function upsertUser({ userId, name, joinedAt, inviteToken }) {
  const existing = await get({ collection: COL, id: userId });
  if (!existing) {
    await create({
      collection: COL,
      id: userId,
      data: { _userId: userId, _name: name, joinedAt: joinedAt ?? Date.now(), inviteToken: inviteToken ?? null },
    });
  }
}

async function getUser(userId) {
  return get({ collection: COL, id: userId });
}

async function getAllUsers() {
  return query({ collection: COL }) || [];
}

async function deleteUser(userId) {
  return remove({ collection: COL, id: userId });
}

async function updateUser(userId, data) {
  await patch({ collection: COL, id: userId, data });
}

module.exports = { upsertUser, updateUser, getUser, getAllUsers, deleteUser };
