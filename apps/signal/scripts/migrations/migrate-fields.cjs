/**
 * One-time Firestore field migration script.
 *
 * Renames un-prefixed metadata fields to _ convention across all Signal collections.
 * Safe to run multiple times — skips docs that already have the new field names.
 *
 * Usage:
 *   node tests/migrate-fields.cjs [--dry-run]
 *
 * --dry-run: prints what would change without writing anything.
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('DRY RUN — no writes will occur\n');

let totalMigrated = 0;
let totalSkipped = 0;

async function migrateCollection(collectionName, fieldMap) {
  console.log(`\n── ${collectionName} ──`);
  const snap = await db.collection(collectionName).get();
  if (snap.empty) { console.log('  (empty)'); return; }

  let migrated = 0, skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const update = {};
    const remove = {};

    for (const [oldField, newField] of Object.entries(fieldMap)) {
      const hasOld = oldField in data;
      const hasNew = newField in data;

      if (hasOld && !hasNew) {
        update[newField] = data[oldField];
        remove[oldField] = admin.firestore.FieldValue.delete();
      }
    }

    const changes = Object.keys(update);
    if (changes.length === 0) {
      skipped++;
      continue;
    }

    console.log(`  ${doc.id}: ${changes.map(f => `${Object.entries(fieldMap).find(([,v]) => v === f)[0]} → ${f}`).join(', ')}`);

    if (!DRY_RUN) {
      await db.collection(collectionName).doc(doc.id).update({ ...update, ...remove });
    }
    migrated++;
  }

  console.log(`  ${migrated} migrated, ${skipped} already up to date`);
  totalMigrated += migrated;
  totalSkipped += skipped;
}

async function run() {
  try {
    await migrateCollection('signal-owners', {
      signalId: '_signalId',
    });

    await migrateCollection('signal-evaluations', {
      evalId:   '_evalId',
      signalId: '_signalId',
      userId:   '_userId',
    });

    await migrateCollection('signal-session-chunks', {
      signalId:       '_signalId',
      conversationId: '_conversationId',
    });

    await migrateCollection('signal-leads', {
      signalId:  '_signalId',
      visitorId: '_visitorId',
    });

    await migrateCollection('signal-resumes', {
      resumeId:     '_resumeId',
      evaluationId: '_evaluationId',
      signalId:     '_signalId',
      userId:       '_userId',
    });

    await migrateCollection('signal-covers', {
      coverId:      '_coverId',
      evaluationId: '_evaluationId',
      resumeId:     '_resumeId',
      signalId:     '_signalId',
      userId:       '_userId',
    });

    await migrateCollection('signal-auth-codes', {
      userId:   '_userId',
      signalId: '_signalId',
    });

    await migrateCollection('signal-waitlist', {
      email: '_email',
    });

    console.log(`\n✓ Done — ${totalMigrated} docs migrated, ${totalSkipped} skipped`);
    if (DRY_RUN) console.log('(dry run — nothing was written)');
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exit(1);
  }
}

run();
