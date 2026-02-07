/**
 * User Data Access Layer
 *
 * Firestore operations for the users collection.
 * Uses @habitualos/db-core for database access.
 */

const { db, admin } = require('@habitualos/db-core');

async function getUserById(id) {
  const snap = await db.collection('users').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getUserByEmail(email) {
  const q = await db.collection('users')
    .where('_email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();
  return q.empty ? null : { id: q.docs[0].id, ...q.docs[0].data() };
}

async function updateUser(id, patch) {
  await db.collection('users').doc(id).set(
    { ...patch, _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  return true;
}

/**
 * Ensure user document exists with email.
 * Creates user if doesn't exist, updates email if it does.
 */
async function ensureUserEmail(userId, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    await userRef.set({
      _userId: userId,
      _email: normalizedEmail,
      _createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await userRef.set(
      {
        _email: normalizedEmail,
        _updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  return true;
}

module.exports = {
  getUserById,
  getUserByEmail,
  updateUser,
  ensureUserEmail
};
