const TEST_USER_IDS = ['u-test-erik', 'u-test-sarah', 'u-test-frank', 'u-test-roi'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  // TODO: delete circle/{userId}, sessions where userId in TEST_USER_IDS,
  //       notes where fromUserId or toUserId in TEST_USER_IDS

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, deletedFor: TEST_USER_IDS }),
  };
};
