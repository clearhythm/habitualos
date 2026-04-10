/**
 * One-time seed: add photoUrl + tagline to a signal-owners doc.
 *
 * Usage:
 *   node tests/seed-owner-card.cjs [--dry-run]
 *
 * Defaults to signalId=erik-burns. Override with SIGNAL_ID env var.
 */

require('dotenv').config();
const { db } = require('@habitualos/db-core');

const DRY_RUN  = process.argv.includes('--dry-run');
const SIGNAL_ID = process.env.SIGNAL_ID || 'erik-burns';

const PATCH = {
  photoUrl: '/assets/images/erik-burns.jpg',
  tagline:  'Full-stack engineer & product thinker',
};

async function run() {
  const snap = await db.collection('signal-owners').where('_signalId', '==', SIGNAL_ID).limit(1).get();
  if (snap.empty) {
    console.error(`No owner found for signalId: ${SIGNAL_ID}`);
    process.exit(1);
  }

  const doc = snap.docs[0];
  console.log(`Found owner doc: ${doc.id}`);
  console.log('Patch:', PATCH);

  if (DRY_RUN) {
    console.log('DRY RUN — no writes.');
    process.exit(0);
  }

  await db.collection('signal-owners').doc(doc.id).update(PATCH);
  console.log('Done.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
