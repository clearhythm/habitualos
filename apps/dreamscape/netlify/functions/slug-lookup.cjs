const { getSlug } = require('./collections/slugs.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('slug.lookup', 'GET', async (event, params) => {
  const slug = (params.slug || '').toLowerCase().trim();
  if (!slug) throw new Error('slug required');

  log('debug', '[slug-lookup] looking up slug:', slug);

  const doc = await getSlug(slug);
  if (!doc) {
    const err = new Error('not found');
    err.statusCode = 404;
    throw err;
  }

  return { userId: doc.userId, name: doc.name };
});
