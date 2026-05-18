const api = require('./_utils/api.cjs');
const { TEST_USER_IDS } = require('./_utils/test-users.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  await Promise.all(TEST_USER_IDS.map(async (userId) => {
    await Promise.all([
      api.deleteConnectionsForUser(userId),
      api.deleteNotesForUser(userId),
      api.deleteSessionsForUser(userId),
      api.deleteUser(userId),
    ]);
  }));

  return { statusCode: 200, body: JSON.stringify({ ok: true, deletedFor: TEST_USER_IDS }) };
};
