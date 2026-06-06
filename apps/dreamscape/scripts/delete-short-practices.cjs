// Deletes practice-logs for a given userId where durationSeconds < MIN_DURATION.
// Usage: node scripts/delete-short-practices.cjs
require('dotenv').config({ path: '.env' });

const { query, remove } = require('@habitualos/db-core');

const USER_ID     = 'u-xqhk0feg';
const MIN_DURATION = 30;
const COL          = 'practice-logs';

async function run() {
  const logs = await query({ collection: COL, where: [`_userId::eq::${USER_ID}`] }) || [];
  const short = logs.filter(l => (l.durationSeconds ?? 0) < MIN_DURATION);

  if (!short.length) {
    console.log('No short practices found.');
    return;
  }

  console.log(`Found ${short.length} practice(s) under ${MIN_DURATION}s — deleting...`);
  await Promise.all(short.map(l => remove({ collection: COL, id: l._practiceId })));
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
