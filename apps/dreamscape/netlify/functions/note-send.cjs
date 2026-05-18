const api = require('./_utils/api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { fromUserId, fromName, toUserId, text } = JSON.parse(event.body || '{}');
  if (!fromUserId || !toUserId || !text?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fromUserId, toUserId, and text required' }) };
  }

  const _noteId = await api.createNote({ fromUserId, fromName, toUserId, text });
  return { statusCode: 200, body: JSON.stringify({ _noteId }) };
};
