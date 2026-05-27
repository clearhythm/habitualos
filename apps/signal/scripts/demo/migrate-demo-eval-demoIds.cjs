/**
 * One-time migration: backfill demoId on existing demo evaluations + avatarUrl/nickname on demo owners.
 *
 * Run BEFORE deploying the updated signal-demo-evals-get.js endpoint.
 * The updated endpoint filters by demoId — without this migration, spock-vs-data returns zero results.
 *
 * Usage:
 *   node scripts/demo/migrate-demo-eval-demoIds.cjs [--dry-run]
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { getOwnerBySignalId } = require('../../netlify/functions/_services/db-signal-owners.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log('\nMigrate: backfill demoId on signal-evaluations + avatarUrl/nickname on demo owners\n');
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  // ── 1. Backfill demoId on evaluations ────────────────────────────────────────
  console.log('Fetching demo evaluations missing demoId...');
  const snap = await db.collection('signal-evaluations')
    .where('demo', '==', true)
    .get();

  const toUpdate = snap.docs.filter(doc => !doc.data().demoId);
  console.log(`  Found ${snap.docs.length} demo evals — ${toUpdate.length} missing demoId\n`);

  if (toUpdate.length) {
    const BATCH_SIZE = 400;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = db.batch();
      toUpdate.slice(i, i + BATCH_SIZE).forEach(doc => {
        if (!DRY_RUN) {
          batch.update(doc.ref, { demoId: 'spock-vs-data' });
        }
        console.log(`  ${DRY_RUN ? '[dry]' : '✓'} ${doc.id} → demoId: spock-vs-data`);
      });
      if (!DRY_RUN) await batch.commit();
    }
  }

  // ── 2. Patch Spock + Data owner docs with nickname + avatarUrl ───────────────
  console.log('\nPatching Spock and Data owner docs...');

  const OWNER_PATCHES = [
    {
      signalId: 'spock',
      patch: {
        nickname: 'Spock',
        avatarUrl: '/assets/images/spock.jpg'
      }
    },
    {
      signalId: 'data',
      patch: {
        nickname: 'Data',
        avatarUrl: '/assets/images/data.jpg'
      }
    }
  ];

  for (const { signalId, patch } of OWNER_PATCHES) {
    const owner = await getOwnerBySignalId(signalId);
    if (!owner) {
      console.log(`  ~ Owner not found: ${signalId} (skipping)`);
      continue;
    }
    if (owner.nickname && owner.avatarUrl) {
      console.log(`  ~ Already patched: ${signalId} (skipping)`);
      continue;
    }
    if (!DRY_RUN) {
      await db.collection('signal-owners').doc(owner._id || signalId).update(patch);
      console.log(`  ✓ Patched: ${signalId} →`, patch);
    } else {
      console.log(`  [dry] Would patch: ${signalId} →`, patch);
    }
  }

  console.log('\nMigration complete.\n');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
