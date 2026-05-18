const { get, remove } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { token } = JSON.parse(event.body || '{}');
  if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'token required' }) };

  const doc = await get({ collection: 'adminTokens', id: token });
  if (!doc) return { statusCode: 404, body: JSON.stringify({ error: 'Invalid token' }) };
  if (doc.expiresAt < Date.now()) {
    await remove({ collection: 'adminTokens', id: token });
    return { statusCode: 401, body: JSON.stringify({ error: 'Token expired' }) };
  }

  await remove({ collection: 'adminTokens', id: token });
  return { statusCode: 200, body: JSON.stringify({ userId: doc.targetUserId }) };
};
