const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-early-access';

async function submitInterest({ name, message, email, link }) {
  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    _id: ref.id,
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

module.exports = { submitInterest, listInterest };
