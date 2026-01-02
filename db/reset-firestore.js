#!/usr/bin/env node

/**
 * Reset Firestore Database
 * Deletes all documents in the practices collection
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(credentials)
});

const db = admin.firestore();

async function resetPractices() {
  console.log('🔄 Resetting Firestore practices collection...');

  try {
    // Get all practices
    const practicesRef = db.collection('practices');
    const snapshot = await practicesRef.get();

    if (snapshot.empty) {
      console.log('✅ No practices found - collection is already empty');
      process.exit(0);
    }

    console.log(`📝 Found ${snapshot.size} practices to delete`);

    // Delete all practices in batches
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count++;

      if (count % batchSize === 0) {
        await batch.commit();
        console.log(`   Deleted ${count} practices...`);
        batch = db.batch();
      }
    }

    // Commit remaining deletions
    if (count % batchSize !== 0) {
      await batch.commit();
    }

    console.log(`✅ Successfully deleted ${count} practices`);
    console.log('🎉 Firestore reset complete!');

  } catch (error) {
    console.error('❌ Error resetting Firestore:', error);
    process.exit(1);
  }

  process.exit(0);
}

resetPractices();
