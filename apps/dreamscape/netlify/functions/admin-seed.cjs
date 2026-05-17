const { TEST_USERS } = require('./_utils/test-users.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { scenario } = JSON.parse(event.body || '{}');
  const validScenarios = ['no-notes', 'notes-waiting', 'notes-unlocked', 'all-caught-up'];
  if (!validScenarios.includes(scenario)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid scenario' }) };
  }

  // TODO: implement seeding logic once notes data model is built
  // Scenarios:
  //   no-notes      — all users in circle, no notes for erik
  //   notes-waiting — note from sarah/roi to erik, unlockedAt=null
  //   notes-unlocked — note from sarah/roi to erik, unlockedAt=Date.now()
  //   all-caught-up — note from sarah/roi to erik, readAt=Date.now()

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, scenario }),
  };
};
