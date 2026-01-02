/**
 * Backfill Script: Create practice library entries from existing practice logs
 *
 * This script finds practice logs that don't have corresponding entries in the
 * practices collection and creates them with correct timestamps and checkin counts.
 *
 * Run with: node db/backfill-practices.js
 */

require('dotenv').config();
const dbCore = require('../netlify/functions/_services/db-core.cjs');

async function backfillPractices() {
  console.log('🔄 Starting backfill: practice-logs → practices\n');

  try {
    // 1. Get all practice logs
    console.log('📖 Reading practice logs...');
    const practiceLogs = await dbCore.query({
      collection: 'practice-logs'
    });

    console.log(`   Found ${practiceLogs.length} practice log entries\n`);

    if (practiceLogs.length === 0) {
      console.log('✅ No practice logs to process.\n');
      return;
    }

    // 2. Get all existing practices
    console.log('📖 Reading existing practices...');
    const existingPractices = await dbCore.query({
      collection: 'practices'
    });

    console.log(`   Found ${existingPractices.length} existing practices\n`);

    // 3. Group practice logs by practice name (case-insensitive)
    console.log('🔍 Analyzing practice logs...');
    const practiceGroups = new Map();

    for (const log of practiceLogs) {
      if (!log.practice_name) continue;

      const normalizedName = log.practice_name.toLowerCase();

      if (!practiceGroups.has(normalizedName)) {
        practiceGroups.set(normalizedName, {
          name: log.practice_name,  // Preserve casing from first occurrence
          userId: log._userId,
          logs: []
        });
      }

      practiceGroups.get(normalizedName).logs.push(log);
    }

    console.log(`   Found ${practiceGroups.size} unique practice names\n`);

    // 4. For each practice, check if it exists in the library
    console.log('📝 Checking for missing practices...');
    let createdCount = 0;
    let skippedCount = 0;

    for (const [normalizedName, group] of practiceGroups) {
      // Check if practice already exists (case-insensitive)
      const exists = existingPractices.some(p =>
        p.name && p.name.toLowerCase() === normalizedName
      );

      if (exists) {
        console.log(`   ⏭️  Skipping "${group.name}" (already exists)`);
        skippedCount++;
        continue;
      }

      // Practice doesn't exist - create it
      // Sort logs by timestamp to find the earliest
      group.logs.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });

      const firstLog = group.logs[0];
      const checkinCount = group.logs.length;

      const practiceId = 'practice-' + Math.random().toString(36).substring(2, 15);
      const practiceData = {
        _userId: group.userId,
        name: group.name,  // Preserve original casing
        instructions: `${group.name} practice`,  // Default instructions
        checkins: checkinCount,
        _createdAt: firstLog.timestamp  // Use timestamp from first log
      };

      await dbCore.create({
        collection: 'practices',
        id: practiceId,
        data: practiceData
      });

      console.log(`   ✅ Created "${group.name}" (${checkinCount} checkins, first: ${firstLog.timestamp})`);
      createdCount++;
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Created: ${createdCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}\n`);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run backfill
backfillPractices()
  .then(() => {
    console.log('Done! 🎉');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
