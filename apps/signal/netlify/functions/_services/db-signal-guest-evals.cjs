'use strict';
const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-guest-evals';

async function createGuestEval(guestId, data) {
  const gevalId = `geval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.collection(COLLECTION).doc(gevalId).set({
    _gevalId: gevalId,
    _guestId: guestId,
    _migratedTo: null,
    _migratedAt: null,
    ...data,
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return gevalId;
}

async function getGuestEvalsByGuestId(guestId) {
  const snap = await db.collection(COLLECTION)
    .where('_guestId', '==', guestId)
    .get();
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b._createdAt?._seconds || 0) - (a._createdAt?._seconds || 0))
    .slice(0, 10); // safety cap
}

async function migrateGuestEval(guestId, userId) {
  const snap = await db.collection(COLLECTION)
    .where('_guestId', '==', guestId)
    .where('_migratedTo', '==', null)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      _migratedTo: userId,
      _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

async function getGuestEvalById(gevalId) {
  const doc = await db.collection(COLLECTION).doc(gevalId).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function updateGuestEval(gevalId, data) {
  await db.collection(COLLECTION).doc(gevalId).set(data, { merge: true });
}

module.exports = { createGuestEval, getGuestEvalsByGuestId, migrateGuestEval, getGuestEvalById, updateGuestEval };
