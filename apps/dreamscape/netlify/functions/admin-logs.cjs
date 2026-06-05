const { query } = require('@habitualos/db-core');

const tsToMs = (ts) => ts?.toMillis() ?? 0;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const logs = await query({
    collection: 'api-logs',
    orderBy: '_createdAt::desc',
    limit: 100,
  });

  return { statusCode: 200, body: JSON.stringify({ logs: (logs || []).map(l => ({ ...l, createdAt: tsToMs(l._createdAt) })) }) };
};
