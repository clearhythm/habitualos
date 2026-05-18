const { create, uniqueId } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { fromUserId, fromName, toUserId, text } = JSON.parse(event.body || '{}');
  if (!fromUserId || !toUserId || !text?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fromUserId, toUserId, and text required' }) };
  }

  const _noteId = uniqueId('note');
  await create({
    collection: 'notes',
    id: _noteId,
    data: {
      _noteId,
      _fromUserId: fromUserId,
      _fromName: fromName || '',
      _toUserId: toUserId,
      text: text.trim(),
      sentAt: Date.now(),
      unlockedAt: null,
      readAt: null,
    },
  });

  return { statusCode: 200, body: JSON.stringify({ _noteId }) };
};
