require('dotenv').config();
const { db } = require('@habitualos/db-core');

const FROM = 'erik-burns';
const TO = 'erik';
const COLLECTIONS = ['signal-owners', 'signal-context'];

async function main() {
  for (const col of COLLECTIONS) {
    const oldDoc = await db.collection(col).doc(FROM).get();
    if (!oldDoc.exists) {
      console.log(col + '/' + FROM + ' — not found, skipping');
      continue;
    }
    const data = { ...oldDoc.data(), signalId: TO };
    await db.collection(col).doc(TO).set(data);
    await db.collection(col).doc(FROM).delete();
    console.log(col + ': ' + FROM + ' → ' + TO);
  }
  console.log('Done.');
}

main().catch(console.error).finally(() => process.exit());
