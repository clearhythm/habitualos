// netlify/functions/_services/db-core.cjs
// -----------------------------------------------------------------------------
// Generic Firestore Core (no HTTP)
// -----------------------------------------------------------------------------
// Purpose:
//   A tiny, collection-agnostic CRUD layer used by all API handlers.
//   Centralizes cross-cutting DB behavior:
//     - Input sanitization for collection/doc IDs
//     - Server timestamps (_createdAt, _updatedAt)
//
// API (all functions return simple JSON-ish objects):
//   - create({ collection, id?, data }) -> { id }
//   - patch({ collection, id, data })   -> { id }
//   - get({ collection, id })           -> { id, ...data } | null
//   - query({ collection, where })      -> Array<{ id, ...data }>
//   - remove({ collection, id })        -> { id }
// -----------------------------------------------------------------------------

const { db, admin } = require("../_utils/firestore.cjs");
const { FieldValue } = admin.firestore;

// Basic allowlist: letters, numbers, dash, underscore
const sanitize = (s) => String(s || "").replace(/[^a-zA-Z0-9-_]/g, "");

/**
 * create({ collection, id?, data }) -> { id }
 * - If the doc doesn't exist: creates it and sets _createdAt
 * - If it exists: merges `data` and sets _updatedAt
 * - Returns the document id (generated if not provided)
 */
async function create({ collection, id, data }) {
  const col = sanitize(collection);
  if (!col) throw new Error("db-core.create: 'collection' is required");
  const ref = db.collection(col).doc(sanitize(id || db.collection(col).doc().id));
  const exists = (await ref.get()).exists;

  const now = FieldValue.serverTimestamp();

  if (exists) {
    await ref.set(
      {
        ...(data || {}),
        _updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await ref.set({
      ...(data || {}),
      _createdAt: now,
    });
  }

  return { id: ref.id };
}

/**
 * patch({ collection, id, data }) -> { id }
 * - Merges 'data' into the doc.
 * - Always updates _updatedAt
 * - Returns the id.
 */
async function patch({ collection, id, data }) {
  const col = sanitize(collection);
  const docId = sanitize(id);
  if (!col) throw new Error("db-core.patch: 'collection' is required");
  if (!docId) throw new Error("db-core.patch: 'id' is required");

  const ref = db.collection(col).doc(docId);
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      ...(data || {}),
      _updatedAt: now,
    },
    { merge: true }
  );

  return { id: docId };
}

/**
 * get({ collection, id }) -> { id, ...data } | null
 * Point lookup.
 * - Returns a single document by id (or null if not found).
 */
async function get({ collection, id }) {
  const col = sanitize(collection);
  const docId = sanitize(id);
  if (!col) throw new Error("db-core.get: 'collection' is required");
  if (!docId) throw new Error("db-core.get: 'id' is required");

  const snap = await db.collection(col).doc(docId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * query({ collection, where, orderBy, limit }) -> Array<{ id, ...data }>
 * List/filter helper.
 * - `where` uses a tiny string format: "field::eq::value" or "field::array-contains::value"
 *    e.g., `_userId::eq::abc123` or `tags::array-contains::meditation`
 * - `orderBy` format: "field::direction" e.g., "timestamp::desc"
 * - `limit` is an integer (optional)
 */
async function query({ collection, where, orderBy, limit }) {
  const col = sanitize(collection);
  if (!col) throw new Error("db-core.query: 'collection' is required");

  let q = db.collection(col);

  // Apply where clause
  if (where) {
    const [field, op, value] = String(where).split("::");
    if (field && op === "eq") {
      q = q.where(field, "==", value);
    } else if (field && op === "array-contains") {
      q = q.where(field, "array-contains", value);
    }
  }

  // Apply orderBy
  if (orderBy) {
    const [field, direction] = String(orderBy).split("::");
    q = q.orderBy(field, direction || "asc");
  }

  // Apply limit
  if (limit && Number.isInteger(limit)) {
    q = q.limit(limit);
  }

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * remove({ collection, id }) -> { id }
 * Hard delete.
 */
async function remove({ collection, id }) {
  const col = sanitize(collection);
  const docId = sanitize(id);
  if (!col) throw new Error("db-core.remove: 'collection' is required");
  if (!docId) throw new Error("db-core.remove: 'id' is required");

  await db.collection(col).doc(docId).delete();
  return { id: docId };
}

module.exports = {
  create,
  patch,
  get,
  query,
  remove,
};
