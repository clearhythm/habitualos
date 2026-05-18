const { query } = require('@habitualos/db-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const logs = await query({
    collection: 'api-logs',
    orderBy: 'createdAt::desc',
    limit: 100,
  });

  return { statusCode: 200, body: JSON.stringify({ logs: logs || [] }) };
};
