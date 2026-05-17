const TEST_USERS = {
  erik:  { userId: 'u-test-erik',  name: 'Erik'  },
  sarah: { userId: 'u-test-sarah', name: 'Sarah' },
  frank: { userId: 'u-test-frank', name: 'Frank' },
  roi:   { userId: 'u-test-roi',   name: "Ro'i"  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { scenario } = JSON.parse(event.body || '{}');
  const validScenarios = ['no-notes', 'notes-waiting', 'notes-unlocked', 'all-caught-up'];
  if (!validScenarios.includes(scenario)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid scenario' }) };
  }

  // TODO: implement seeding logic once notes data model is built
  // Scenarios:
  //   no-notes      — ensure alice/bob/carol are in circle, delete any notes for alice
  //   notes-waiting — seed a note from bob to alice with unlockedAt=null
  //   notes-unlocked — seed a note from bob to alice with unlockedAt=Date.now()
  //   all-caught-up — seed a note from bob to alice, marked readAt=Date.now()

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, scenario }),
  };
};
