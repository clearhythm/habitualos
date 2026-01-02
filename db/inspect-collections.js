/**
 * Diagnostic Script: Inspect Firestore collections
 *
 * Shows what's in each collection to help diagnose missing data
 *
 * Run with: node db/inspect-collections.js
 */

require('dotenv').config();
const dbCore = require('../netlify/functions/_services/db-core.cjs');

async function inspectCollections() {
  console.log('🔍 Inspecting Firestore collections\n');

  const collections = ['practices', 'practice-logs', 'practice-chats'];

  for (const collection of collections) {
    try {
      console.log(`\n📂 Collection: ${collection}`);
      console.log('─'.repeat(60));

      const docs = await dbCore.query({ collection });

      console.log(`   Total documents: ${docs.length}\n`);

      if (docs.length === 0) {
        console.log('   (empty)\n');
        continue;
      }

      docs.forEach((doc, index) => {
        console.log(`   ${index + 1}. ID: ${doc.id}`);

        // Show key fields based on collection type
        if (collection === 'practices') {
          console.log(`      - name: ${doc.name}`);
          console.log(`      - userId: ${doc._userId}`);
          console.log(`      - checkins: ${doc.checkins}`);
          console.log(`      - created: ${doc._createdAt}`);
        } else if (collection === 'practice-logs') {
          console.log(`      - practice_name: ${doc.practice_name}`);
          console.log(`      - userId: ${doc._userId}`);
          console.log(`      - timestamp: ${doc.timestamp}`);
          console.log(`      - duration: ${doc.duration} min`);
        } else if (collection === 'practice-chats') {
          console.log(`      - userId: ${doc._userId}`);
          console.log(`      - suggestedPractice: ${doc.suggestedPractice}`);
          console.log(`      - completed: ${doc.completed}`);
          console.log(`      - savedAt: ${doc.savedAt}`);
          console.log(`      - messages: ${doc.messages?.length || 0} messages`);
        }
        console.log();
      });

    } catch (error) {
      console.log(`   ❌ Error reading collection: ${error.message}\n`);
    }
  }

  console.log('─'.repeat(60));
  console.log('\n✅ Inspection complete\n');
}

// Run inspection
inspectCollections()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Inspection failed:', error);
    process.exit(1);
  });
