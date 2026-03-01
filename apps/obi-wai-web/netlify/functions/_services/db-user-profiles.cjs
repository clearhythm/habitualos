// netlify/functions/_services/db-user-profiles.cjs
// Phone number operations on the users collection
require('dotenv').config();
const dbCore = require('@habitualos/db-core');
const { db, admin } = require('@habitualos/db-core/firestore.cjs');

// Look up a user by phone number
async function getUserByPhone(phoneNumber) {
  const results = await dbCore.query({
    collection: 'users',
    where: `profile.phoneNumber::eq::${phoneNumber}`
  });
  return results.length > 0 ? results[0] : null;
}

// Save phone number into profile sub-object.
// Uses mergeFields to upsert only profile.phoneNumber without touching other profile fields.
async function setUserPhone(userId, phoneNumber) {
  const ref = db.collection('users').doc(userId);
  await ref.set(
    { profile: { phoneNumber }, _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { mergeFields: ['profile.phoneNumber', '_updatedAt'] }
  );
  return true;
}

// Get all users who have a phone number registered (filter in JS — no exists operator)
async function getAllUsersWithPhone() {
  const results = await dbCore.query({ collection: 'users' });
  return results.filter(u => u.profile && u.profile.phoneNumber);
}

module.exports = { getUserByPhone, setUserPhone, getAllUsersWithPhone };
