const { query, patch } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { userId, fromUserId } = JSON.parse(event.body || '{}');
  if (!userId || !fromUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId and fromUserId required' }) };
  }

  const notes = await query({ collection: 'notes', where: [`_toUserId::eq::${userId}`] });
  const unread = (notes || []).filter(
    n => n._fromUserId === fromUserId && n.unlockedAt && !n.readAt
  );

  await Promise.all(
    unread.map(n => patch({ collection: 'notes', id: n._noteId, data: { readAt: Date.now() } }))
  );

  return { statusCode: 200, body: JSON.stringify({ marked: unread.length }) };
};
