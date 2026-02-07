/**
 * One-time seed script to create the initial users collection.
 * Run from repo root: node migrations/seed-users.cjs
 */
require('dotenv').config({ path: 'apps/habitual-web/.env' });
const { db, admin } = require('@habitualos/db-core');

const users = [
  {
    _userId: 'u-mgpqwa49',
    _email: 'user@changeit.com',
    profile: { firstName: 'Erik' }
  }
  // Add more users here as needed:
  // { _userId: 'u-xxxxxxxx', _email: 'someone@example.com', profile: { firstName: 'Name' } }
];

async function seed() {
  for (const user of users) {
    const ref = db.collection('users').doc(user._userId);
    const snap = await ref.get();

    if (snap.exists) {
      console.log(`SKIP: ${user._userId} already exists`);
      continue;
    }

    await ref.set({
      ...user,
      _createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`CREATED: ${user._userId} (${user._email})`);
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
