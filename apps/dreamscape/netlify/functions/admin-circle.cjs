exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  // TODO: query circle/{userId} + sessions for lastPracticedAt + sessionCount
  return {
    statusCode: 200,
    body: JSON.stringify({ members: [] }),
  };
};
