/**
 * @habitualos/db-core
 *
 * Shared Firestore infrastructure for all HabitualOS apps.
 * Provides:
 *   - Firebase Admin initialization (db, admin, FieldValue, Timestamp)
 *   - Generic CRUD operations (create, patch, get, query, remove, increment)
 *   - ID generation (uniqueId)
 */

const dbCore = require('./db-core.cjs');
const { db, admin, FieldValue, Timestamp } = require('./firestore.cjs');
const { uniqueId } = require('./data-utils.cjs');

module.exports = {
  // CRUD operations
  create: dbCore.create,
  patch: dbCore.patch,
  get: dbCore.get,
  query: dbCore.query,
  remove: dbCore.remove,
  increment: dbCore.increment,

  // Firestore access
  db,
  admin,
  FieldValue,
  Timestamp,

  // Utilities
  uniqueId
};
