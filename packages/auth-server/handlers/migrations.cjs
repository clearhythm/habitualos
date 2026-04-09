/**
 * @habitualos/auth-server - handlers/migrations.cjs
 *
 * Handler factory for the user data migration endpoint.
 * Called when a returning user signs in on a new device — their guest data
 * needs to be merged into their existing account.
 *
 * Usage:
 *   exports.handler = createMigrationsHandler({ migrateData });
 *
 * POST body: { oldUserId, newUserId }
 */

/**
 * @param {Object} options
 * @param {(oldUserId: string, newUserId: string) => Promise<void>} options.migrateData
 *   App-provided function that re-keys data from oldUserId → newUserId.
 * @returns {Function} Netlify handler
 */
function createMigrationsHandler({ migrateData }) {
  return async function handler(event) {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let oldUserId, newUserId;
    try {
      ({ oldUserId, newUserId } = JSON.parse(event.body || '{}'));
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    if (!oldUserId || !newUserId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'oldUserId and newUserId required' }) };
    }

    if (oldUserId === newUserId) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, migrated: 0 })
      };
    }

    try {
      await migrateData(oldUserId, newUserId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    } catch (err) {
      console.error('migrations error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Migration failed' }) };
    }
  };
}

module.exports = { createMigrationsHandler };
