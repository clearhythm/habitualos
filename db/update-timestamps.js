/**
 * Update Timestamps Script
 *
 * Updates timestamps for chats and practice logs to accurately reflect
 * when they happened (e.g., moving from Jan 2 to Jan 1)
 *
 * Run with: node db/update-timestamps.js
 */

require('dotenv').config();
const dbCore = require('../netlify/functions/_services/db-core.cjs');

async function updateTimestamps() {
  console.log('🕐 Timestamp Update Tool\n');

  try {
    const userId = 'u-mgpqwa49';

    // 1. Fetch all chats
    console.log('📖 Fetching practice chats...');
    const chats = await dbCore.query({
      collection: 'practice-chats',
      where: `_userId::eq::${userId}`
    });
    console.log(`   Found ${chats.length} chats\n`);

    chats.forEach((chat, index) => {
      console.log(`   ${index + 1}. ID: ${chat.id}`);
      console.log(`      Practice: ${chat.suggestedPractice}`);
      console.log(`      Saved at: ${chat.savedAt}`);
      console.log(`      Messages: ${chat.messages?.length || 0}`);
      console.log();
    });

    // 2. Fetch all practice logs
    console.log('📖 Fetching practice logs...');
    const logs = await dbCore.query({
      collection: 'practice-logs',
      where: `_userId::eq::${userId}`
    });
    console.log(`   Found ${logs.length} logs\n`);

    logs.forEach((log, index) => {
      console.log(`   ${index + 1}. ID: ${log.id}`);
      console.log(`      Practice: ${log.practice_name}`);
      console.log(`      Timestamp: ${log.timestamp}`);
      console.log(`      Duration: ${log.duration} min`);
      console.log();
    });

    // 3. Fetch practices
    console.log('📖 Fetching practices...');
    const practices = await dbCore.query({
      collection: 'practices',
      where: `_userId::eq::${userId}`
    });
    console.log(`   Found ${practices.length} practices\n`);

    practices.forEach((practice, index) => {
      console.log(`   ${index + 1}. ID: ${practice.id}`);
      console.log(`      Name: ${practice.name}`);
      console.log(`      Created at: ${practice._createdAt}`);
      console.log(`      Checkins: ${practice.checkins}`);
      console.log();
    });

    console.log('─'.repeat(60));
    console.log('\n💡 To update timestamps, you can:');
    console.log('   1. Manually update in Firestore console');
    console.log('   2. Or add update logic to this script\n');
    console.log('Collections to update:');
    console.log('   • practice-chats → savedAt field');
    console.log('   • practice-logs → timestamp field');
    console.log('   • practices → _createdAt field (should match earliest log)\n');

    console.log('Example: Move everything from Jan 2 → Jan 1, 2026');
    console.log('   LASSO chat: 2026-01-01T17:18:46.260Z (was 17:18 on Jan 2)');
    console.log('   LASSO log: 2026-01-01T17:45:45.850Z (was 17:45 on Jan 2)');
    console.log('   Gratitude log: 2026-01-01T18:00:18.203Z (was 18:00 on Jan 2)\n');

    // Uncomment below to add automated updates:
    /*
    console.log('🔧 Updating timestamps...\n');

    // Update LASSO chat
    await dbCore.update({
      collection: 'practice-chats',
      id: 'pc-mjx51i30',
      data: { savedAt: '2026-01-01T17:18:46.260Z' }
    });
    console.log('✅ Updated LASSO chat');

    // Update LASSO practice log
    await dbCore.update({
      collection: 'practice-logs',
      id: 'p-mjx6070w',
      data: { timestamp: '2026-01-01T17:45:45.850Z' }
    });
    console.log('✅ Updated LASSO practice log');

    // Update Gratitude practice log
    await dbCore.update({
      collection: 'practice-logs',
      id: 'p-mjx6iwxg',
      data: { timestamp: '2026-01-01T18:00:18.203Z' }
    });
    console.log('✅ Updated Gratitude practice log');

    // Update LASSO practice _createdAt (match earliest log)
    await dbCore.update({
      collection: 'practices',
      id: 'practice-21xvvva5jha',
      data: { _createdAt: '2026-01-01T17:45:45.850Z' }
    });
    console.log('✅ Updated LASSO practice _createdAt');

    // Update Gratitude practice _createdAt
    await dbCore.update({
      collection: 'practices',
      id: 'practice-62cg26g8y8q',
      data: { _createdAt: '2026-01-01T18:00:18.203Z' }
    });
    console.log('✅ Updated Gratitude practice _createdAt');

    console.log('\n✅ All timestamps updated!');
    */

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run script
updateTimestamps()
  .then(() => {
    console.log('Done! 🎉\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
