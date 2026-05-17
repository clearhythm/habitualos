exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const key = event.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // TODO: query circle/{userId} + sessions for lastPracticedAt + sessionCount
  return {
    statusCode: 200,
    body: JSON.stringify({ members: [] }),
  };
};
