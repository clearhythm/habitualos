const { getSlug } = require('./_services/db-slugs.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const slug = (event.queryStringParameters?.slug || '').toLowerCase().trim();
  if (!slug) return { statusCode: 400, body: JSON.stringify({ error: 'slug required' }) };

  log('debug', '[slug-lookup] looking up slug:', slug);

  const doc = await getSlug(slug);
  if (!doc) return { statusCode: 404, body: JSON.stringify({ error: 'not found' }) };

  return {
    statusCode: 200,
    body: JSON.stringify({ userId: doc.userId, name: doc.name }),
  };
};
