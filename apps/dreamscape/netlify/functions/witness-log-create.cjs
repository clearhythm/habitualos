const { createWitnessLog } = require('./collections/witness-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('witness.log.create', 'POST', async (event, { witnessId, practicerId, practiceLogId }) => {
  if (!witnessId) throw new Error('witnessId required');
  if (!practicerId) throw new Error('practicerId required');
  if (!practiceLogId) throw new Error('practiceLogId required');
  await createWitnessLog({ witnessId, practicerId, practiceLogId });
  return { ok: true };
});
