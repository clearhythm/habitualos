const { create, uniqueId } = require('@habitualos/db-core');
const { log } = require('./log.cjs');

async function logRequest(action, userId, result, error) {
  await create({
    collection: 'api-logs',
    id: uniqueId('log'),
    data: { action, userId: userId || null, result, ...(error ? { error } : {}), createdAt: Date.now() },
  });
}

function handle(action, method, fn) {
  return async (event) => {
    if (event.httpMethod !== method) return { statusCode: 405, body: 'Method Not Allowed' };
    const params = method === 'POST'
      ? JSON.parse(event.body || '{}')
      : (event.queryStringParameters || {});
    const userId = params.userId || null;
    let statusCode = 200, body, error;
    try {
      body = await fn(event, params);
    } catch (err) {
      statusCode = err.statusCode || 500;
      error = err.message || String(err);
      body = { error };
      log('error', `[${action}] error:`, err);
    }
    await logRequest(action, userId, statusCode, error);
    return { statusCode, body: JSON.stringify(body) };
  };
}

module.exports = { handle };
