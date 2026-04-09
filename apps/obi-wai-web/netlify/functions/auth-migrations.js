require('dotenv').config();
const { createMigrationsHandler } = require('@habitualos/auth-server');
const dbCore = require('@habitualos/db-core');

async function migrateData(oldUserId, newUserId) {
  const logs = await dbCore.query({
    collection: 'practice-logs',
    where: `_userId::eq::${oldUserId}`
  });
  for (const log of logs) {
    await dbCore.patch({ collection: 'practice-logs', id: log.id, data: { _userId: newUserId } });
  }
}

exports.handler = createMigrationsHandler({ migrateData });
