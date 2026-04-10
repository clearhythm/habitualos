require('dotenv').config();
const { db } = require('@habitualos/db-core');

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const snap = await db.collection('signal-early-access').get();
  console.log(`Found ${snap.docs.length} entries.`);

  if (DRY_RUN) {
    snap.docs.forEach(d => {
      const data = d.data();
      console.log(`  [${d.id}] ${data.name || '(anon)'} — ${data.email || '(no email)'} — ${data.message?.slice(0, 50) || ''}`);
    });
    console.log('\nDry run — pass --apply to delete all.');
    return;
  }

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log('Deleted all entries.');
}

main().catch(console.error).finally(() => process.exit());
