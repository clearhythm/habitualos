const { query, patch } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { userId } = JSON.parse(event.body || '{}');
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };

  const notes = await query({ collection: 'notes', where: [`_toUserId::eq::${userId}`] });
  const locked = (notes || []).filter(n => !n.unlockedAt);

  await Promise.all(
    locked.map(n => patch({ collection: 'notes', id: n._noteId, data: { unlockedAt: Date.now() } }))
  );

  return { statusCode: 200, body: JSON.stringify({ unlocked: locked.length }) };
};
