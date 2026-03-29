const { db, admin } = require('@habitualos/db-core');

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
  await ref.set({
    _id: ref.id,
    claimedSlug: slug || '',
    name: name || '',
    message: message || '',
    email: email || '',       // private — never returned to client
    link: link || '',
    reply: '',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
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

async function editInterest({ id, name, message, link }) {
  await db.collection(COLLECTION).doc(id).update({
    name: name || '',
    message: message || '',
    link: link || '',
  });
}

async function deleteInterest({ id }) {
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = { submitInterest, listInterest, editInterest, deleteInterest, checkSlugAvailable };
