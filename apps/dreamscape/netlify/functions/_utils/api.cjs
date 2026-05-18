const { create, uniqueId } = require('@habitualos/db-core');
const dbUsers       = require('../_services/db-users.cjs');
const dbConnections = require('../_services/db-connections.cjs');
const dbNotes       = require('../_services/db-notes.cjs');
const dbSessions    = require('../_services/db-sessions.cjs');

async function call(action, params, fn) {
  let value, result = 200, error;
  try {
    value = await fn();
  } catch (err) {
    result = 500;
    error = err.message || String(err);
  }
  await create({
    collection: 'api-logs',
    id: uniqueId('log'),
    data: { action, params, result, ...(error ? { error } : {}), createdAt: Date.now() },
  });
  if (error) throw new Error(error);
  return value;
}

const api = {
  // Users
  upsertUser(p)       { return call('user.upsert',              { userId: p.userId },         () => dbUsers.upsertUser(p)); },
  getUser(userId)     { return call('user.get',                 { userId },                   () => dbUsers.getUser(userId)); },
  getAllUsers()        { return call('user.getAll',              {},                           () => dbUsers.getAllUsers()); },
  deleteUser(userId)  { return call('user.delete',              { userId },                   () => dbUsers.deleteUser(userId)); },

  // Connections
  ensureConnection(p)           { return call('connection.ensure',       { userAId: p.userAId, userBId: p.userBId }, () => dbConnections.ensureConnection(p)); },
  getConnectionsForUser(userId) { return call('connection.getForUser',   { userId },           () => dbConnections.getConnectionsForUser(userId)); },
  deleteConnectionsForUser(uid) { return call('connection.deleteForUser',{ userId: uid },      () => dbConnections.deleteConnectionsForUser(uid)); },

  // Notes
  createNote(p)                 { return call('note.create',     { fromUserId: p.fromUserId, toUserId: p.toUserId }, () => dbNotes.createNote(p)); },
  getReceivedNotes(userId)      { return call('note.getReceived',{ userId },                  () => dbNotes.getReceivedNotes(userId)); },
  getSentNotes(userId)          { return call('note.getSent',    { userId },                  () => dbNotes.getSentNotes(userId)); },
  unlockNotes(userId)           { return call('note.unlock',     { userId },                  () => dbNotes.unlockNotes(userId)); },
  markNotesRead(p)              { return call('note.markRead',   p,                           () => dbNotes.markNotesRead(p)); },
  deleteNotesForUser(userId)    { return call('note.deleteForUser',{ userId },                () => dbNotes.deleteNotesForUser(userId)); },

  // Sessions
  getLastSessionForUser(userId) { return call('session.getLast',   { userId },               () => dbSessions.getLastSessionForUser(userId)); },
  getRecentSessions(limit)      { return call('session.getRecent', { limit },                () => dbSessions.getRecentSessions(limit)); },
  getSessionsForUser(userId)    { return call('session.getForUser',{ userId },               () => dbSessions.getSessionsForUser(userId)); },
  deleteSessionsForUser(userId) { return call('session.deleteForUser',{ userId },            () => dbSessions.deleteSessionsForUser(userId)); },
};

module.exports = api;
