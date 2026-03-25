/**
 * Firestore service for signal-owners collection.
 *
 * signal-owners/{signalId}:
 *   _userId        — links to users/{id}
 *   signalId       — short slug (e.g. 'erik-burns')
 *   displayName    — shown in widget header
 *   personas       — array of { key, label, opener } (up to 4)
 *   contextText    — owner's background/bio text
 *   anthropicApiKey — AES-256-GCM encrypted Anthropic API key
 *   status         — 'pending' | 'active'
 *   _createdAt / _updatedAt
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-owners';

async function getOwnerBySignalId(signalId) {
  const snap = await db.collection(COLLECTION).doc(signalId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getOwnerByUserId(userId) {
  const snap = await db.collection(COLLECTION)
    .where('_userId', '==', userId)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function createOwner(signalId, data) {
  const ref = db.collection(COLLECTION).doc(signalId);
  const exists = (await ref.get()).exists;
  if (exists) throw new Error(`Signal ID '${signalId}' is already taken`);
  await ref.set({
    ...data,
    _signalId: signalId,
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
    _updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { signalId };
}

async function updateOwner(signalId, patch) {
  const ref = db.collection(COLLECTION).doc(signalId);
  await ref.update(
    { ...patch, _updatedAt: admin.firestore.FieldValue.serverTimestamp() }
  );
  return { signalId };
}

async function signalIdAvailable(signalId) {
  const snap = await db.collection(COLLECTION).doc(signalId).get();
  return !snap.exists;
}

module.exports = {
  getOwnerBySignalId,
  getOwnerByUserId,
  createOwner,
  updateOwner,
  signalIdAvailable
};
