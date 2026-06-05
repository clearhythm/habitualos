const { getActiveWitnessQueue, getUnseenWitnesses } = require('./collections/witness-logs.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('witness.queue.get', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');

  const [queue, witnesses] = await Promise.all([
    getActiveWitnessQueue(userId),
    getUnseenWitnesses(userId),
  ]);

  if (witnesses.length) {
    queue.unshift({ type: 'witnessed-by', witnesses });
  }

  return { queue };
});
