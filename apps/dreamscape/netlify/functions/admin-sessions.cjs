const { query } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const sessions = await query({
    collection: 'sessions',
    orderBy: 'startedAt::desc',
    limit: 20,
  });

  return { statusCode: 200, body: JSON.stringify({ sessions: sessions || [] }) };
};
