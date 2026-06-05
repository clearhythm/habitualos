const { get, create } = require('@habitualos/db-core');
const { log } = require('../_utils/log.cjs');

const COL = 'slugs';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'user';
}

async function getSlug(slug) {
  return get({ collection: COL, id: slug });
}

async function assignSlug(userId, name) {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (true) {
    const existing = await getSlug(candidate);
    if (!existing) {
      await create({ collection: COL, id: candidate, data: { userId, name } });
      log('debug', '[slugs] assigned slug', candidate, 'to', userId);
      return candidate;
    }
    if (existing.userId === userId) {
      log('debug', '[slugs] slug already owned by this user:', candidate);
      return candidate;
    }
    candidate = base + n;
    n++;
  }
}

module.exports = { getSlug, assignSlug, slugify };
