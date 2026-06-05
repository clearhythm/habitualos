const { create } = require('@habitualos/db-core');
const { randomUUID } = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { targetUserId } = JSON.parse(event.body || '{}');
  if (!targetUserId) return { statusCode: 400, body: JSON.stringify({ error: 'targetUserId required' }) };

  const token = randomUUID();
  await create({
    collection: 'adminTokens',
    id: token,
    data: { token, targetUserId, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });

  return { statusCode: 200, body: JSON.stringify({ token }) };
};
