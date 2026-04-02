const { db, admin } = require('@habitualos/db-core');
const crypto = require('crypto');

const COLLECTION = 'signal-early-access';

async function checkSlugAvailable(slug) {
  const [claimedSnap, ownerSnap] = await Promise.all([
    db.collection(COLLECTION).where('claimedSlug', '==', slug).limit(1).get(),
    db.collection('signal-owners').doc(slug).get()
  ]);
  return claimedSnap.empty && !ownerSnap.exists;
}

async function submitInterest({ slug, name, message, email, link }) {
  const ref = db.collection(COLLECTION).doc();
  const confirmToken = crypto.randomBytes(24).toString('hex');
  await ref.set({
    _id: ref.id,
    claimedSlug: slug || '',
    name: name || '',
    message: message || '',
    email: email || '',       // private — never returned to client
    link: link || '',
    reply: '',
    confirmed: false,
    confirmToken,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, confirmToken };
}

async function confirmByToken(token, collection) {
  const col = collection || COLLECTION;
  const snap = await db.collection(col).where('confirmToken', '==', token).limit(1).get();
  if (snap.empty) return false;
  const data = snap.docs[0].data();
  await snap.docs[0].ref.update({ confirmed: true });
  // Return email — waitlist uses _email, early-access uses email
  return { email: data._email || data.email || null };
}

async function listInterest() {
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return snap.docs.map(d => {
    const { email: _omit, ...pub } = d.data();
    return pub;
  });
}

async function editInterest({ id, name, message, link, email }) {
  const patch = {
    name: name || '',
    message: message || '',
    link: link || '',
  };
  if (email) patch.email = email;
  await db.collection(COLLECTION).doc(id).update(patch);
}

async function deleteInterest({ id }) {
  await db.collection(COLLECTION).doc(id).delete();
}

async function getInterestById(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? doc.data() : null;
}

module.exports = { submitInterest, listInterest, editInterest, deleteInterest, checkSlugAvailable, confirmByToken, getInterestById };
