const { create, query, patch, remove, uniqueId } = require('@habitualos/db-core');

const COL = 'notes';

async function createNote({ fromUserId, fromName, toUserId, text }) {
  const noteId = uniqueId('note');
  await create({
    collection: COL,
    id: noteId,
    data: {
      _noteId: noteId,
      _fromUserId: fromUserId,
      _fromName: fromName || '',
      _toUserId: toUserId,
      text: text.trim(),
      sentAt: new Date(),
      unlockedAt: null,
      readAt: null,
    },
  });
  return noteId;
}

async function getReceivedNotes(userId) {
  return query({ collection: COL, where: [`_toUserId::eq::${userId}`] }) || [];
}

async function getSentNotes(userId) {
  return query({ collection: COL, where: [`_fromUserId::eq::${userId}`] }) || [];
}

async function unlockNotes(userId) {
  const notes = await getReceivedNotes(userId);
  const locked = notes.filter(n => !n.unlockedAt);
  await Promise.all(locked.map(n => patch({ collection: COL, id: n._noteId, data: { unlockedAt: new Date() } })));
  return locked.length;
}

async function markNotesRead({ userId, fromUserId }) {
  const notes = await getReceivedNotes(userId);
  const unread = notes.filter(n => n._fromUserId === fromUserId && n.unlockedAt && !n.readAt);
  await Promise.all(unread.map(n => patch({ collection: COL, id: n._noteId, data: { readAt: new Date() } })));
  return unread.length;
}

async function deleteNotesForUser(userId) {
  const [sent, received] = await Promise.all([getSentNotes(userId), getReceivedNotes(userId)]);
  await Promise.all([...sent, ...received].map(n => remove({ collection: COL, id: n._noteId })));
}

module.exports = { createNote, getReceivedNotes, getSentNotes, unlockNotes, markNotesRead, deleteNotesForUser };
