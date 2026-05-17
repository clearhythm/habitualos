const TEST_USER_IDS = ['u-test-alice', 'u-test-bob', 'u-test-carol'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const key = event.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // TODO: delete circle/{userId}, sessions where userId in TEST_USER_IDS,
  //       notes where fromUserId or toUserId in TEST_USER_IDS

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, deletedFor: TEST_USER_IDS }),
  };
};
