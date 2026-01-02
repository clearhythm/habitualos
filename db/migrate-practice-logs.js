/**
 * Migration Script: Rename practices → practice-logs
 *
 * This migrates the old "practices" collection (which contains practice logs)
 * to the new "practice-logs" collection, freeing up "practices" for the
 * canonical practice library.
 *
 * Run with: node db/migrate-practice-logs.js
 */

require('dotenv').config();
const dbCore = require('../netlify/functions/_services/db-core.cjs');

async function migratePracticeLogs() {
  console.log('🔄 Starting migration: practices → practice-logs\n');

  try {
    // 1. Get all documents from old "practices" collection
    console.log('📖 Reading old practices collection...');
    const oldPractices = await dbCore.query({
      collection: 'practices'
    });

    console.log(`   Found ${oldPractices.length} practice log entries\n`);

    if (oldPractices.length === 0) {
      console.log('✅ No data to migrate. Collection is empty.\n');
      return;
    }

    // 2. Copy each document to "practice-logs"
    console.log('📝 Copying to practice-logs collection...');
    let successCount = 0;
    let errorCount = 0;

    for (const practice of oldPractices) {
      try {
        // Build data object, filtering out undefined values
        const data = {
          _userId: practice._userId,
          timestamp: practice.timestamp || new Date().toISOString()
        };

        // Only add defined fields
        if (practice.practice_name !== undefined) data.practice_name = practice.practice_name;
        if (practice.duration !== undefined) data.duration = practice.duration;
        if (practice.reflection !== undefined) data.reflection = practice.reflection;
        if (practice.obi_wan_message !== undefined) data.obi_wan_message = practice.obi_wan_message;
        if (practice.obi_wan_expanded !== undefined) data.obi_wan_expanded = practice.obi_wan_expanded;
        if (practice.obi_wan_feedback !== undefined) data.obi_wan_feedback = practice.obi_wan_feedback;
        if (practice._createdAt !== undefined) data._createdAt = practice._createdAt;

        // Create the same document in practice-logs
        await dbCore.create({
          collection: 'practice-logs',
          id: practice.id,
          data
        });
        successCount++;
        process.stdout.write(`   Migrated ${successCount}/${oldPractices.length}\r`);
      } catch (error) {
        console.error(`\n   ❌ Error migrating ${practice.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n   ✅ Successfully migrated ${successCount} entries`);
    if (errorCount > 0) {
      console.log(`   ⚠️  ${errorCount} errors occurred`);
    }

    // 3. Delete old documents from "practices" collection
    console.log('\n🗑️  Deleting old practices collection...');
    let deleteCount = 0;

    for (const practice of oldPractices) {
      try {
        await dbCore.remove({
          collection: 'practices',
          id: practice.id
        });
        deleteCount++;
        process.stdout.write(`   Deleted ${deleteCount}/${oldPractices.length}\r`);
      } catch (error) {
        console.error(`\n   ❌ Error deleting ${practice.id}:`, error.message);
      }
    }

    console.log(`\n   ✅ Deleted ${deleteCount} old entries\n`);

    console.log('✅ Migration complete!\n');
    console.log('Collections now:');
    console.log('  • practices → Practice library (canonical definitions)');
    console.log('  • practice-logs → Practice log entries (migrated)');
    console.log('  • practice-chats → Chat conversations\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migratePracticeLogs()
  .then(() => {
    console.log('Done! 🎉');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
