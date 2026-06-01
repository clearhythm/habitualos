const { getActiveWitnessQueue } = require('./collections/witness-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('witness.queue.get', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');
  const queue = await getActiveWitnessQueue(userId);
  return { queue };
});
