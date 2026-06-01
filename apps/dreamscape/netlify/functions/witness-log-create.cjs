const { createWitnessLog } = require('./collections/witness-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('witness.log.create', 'POST', async (event, { userId, witnessedUserId, witnessedPracticeId }) => {
  if (!userId) throw new Error('userId required');
  if (!witnessedUserId) throw new Error('witnessedUserId required');
  if (!witnessedPracticeId) throw new Error('witnessedPracticeId required');
  await createWitnessLog({ userId, witnessedUserId, witnessedPracticeId });
  return { ok: true };
});
