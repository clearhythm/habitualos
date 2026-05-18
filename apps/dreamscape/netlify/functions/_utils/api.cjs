const { create, uniqueId } = require('@habitualos/db-core');
const dbUsers       = require('../_services/db-users.cjs');
const dbConnections = require('../_services/db-connections.cjs');
const dbNotes       = require('../_services/db-notes.cjs');
const dbSessions    = require('../_services/db-sessions.cjs');

// Log every API action — fire and forget
function log(action, params = {}) {
  create({
    collection: 'api-logs',
    id: uniqueId('log'),
    data: { action, params, createdAt: Date.now() },
  }).catch(() => {});
}

const api = {
  // Users
  upsertUser(params)      { log('user.upsert', params);       return dbUsers.upsertUser(params); },
  getUser(userId)         { log('user.get', { userId });       return dbUsers.getUser(userId); },
  getAllUsers()            { log('user.getAll');                return dbUsers.getAllUsers(); },
  deleteUser(userId)      { log('user.delete', { userId });    return dbUsers.deleteUser(userId); },

  // Connections
  ensureConnection(params)          { log('connection.ensure', params);          return dbConnections.ensureConnection(params); },
  getConnectionsForUser(userId)     { log('connection.getForUser', { userId });  return dbConnections.getConnectionsForUser(userId); },
  deleteConnectionsForUser(userId)  { log('connection.deleteForUser', { userId }); return dbConnections.deleteConnectionsForUser(userId); },

  // Notes
  createNote(params)                { log('note.create', { fromUserId: params.fromUserId, toUserId: params.toUserId }); return dbNotes.createNote(params); },
  getReceivedNotes(userId)          { log('note.getReceived', { userId });       return dbNotes.getReceivedNotes(userId); },
  getSentNotes(userId)              { log('note.getSent', { userId });           return dbNotes.getSentNotes(userId); },
  unlockNotes(userId)               { log('note.unlock', { userId });            return dbNotes.unlockNotes(userId); },
  markNotesRead(params)             { log('note.markRead', params);              return dbNotes.markNotesRead(params); },
  deleteNotesForUser(userId)        { log('note.deleteForUser', { userId });     return dbNotes.deleteNotesForUser(userId); },

  // Sessions
  getLastSessionForUser(userId)     { log('session.getLast', { userId });        return dbSessions.getLastSessionForUser(userId); },
  getRecentSessions(limit)          { log('session.getRecent', { limit });       return dbSessions.getRecentSessions(limit); },
  getSessionsForUser(userId)        { log('session.getForUser', { userId });     return dbSessions.getSessionsForUser(userId); },
  deleteSessionsForUser(userId)     { log('session.deleteForUser', { userId });  return dbSessions.deleteSessionsForUser(userId); },
};

module.exports = api;
