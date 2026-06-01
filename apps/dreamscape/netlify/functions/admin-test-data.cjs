const { upsertUser, deleteUser, updateLastPracticed } = require('./collections/users.cjs');
const { ensureConnection, deleteConnectionsForUser } = require('./collections/connections.cjs');
const { deletePracticeLogsForUser } = require('./collections/practice-logs.cjs');
const { create } = require('@habitualos/db-core');
const { log } = require('./_utils/log.cjs');

function checkAdminKey(event) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return;
  const header = event.headers?.['x-admin-key'];
  if (header !== secret) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function makePracticeLogId() {
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let params;
  try { params = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, name, userId, targetUserId } = params;

  try {
    checkAdminKey(event);
  } catch (err) {
    return { statusCode: err.statusCode || 500, body: JSON.stringify({ error: err.message }) };
  }

  log('debug', '[admin-test-data] action:', action, 'userId:', userId);

  try {
    if (action === 'create-user') {
      if (!name) return { statusCode: 400, body: JSON.stringify({ error: 'name required' }) };
      const newUserId = `tu-${name.toLowerCase().replace(/\s+/g, '-')}`;
      await upsertUser({ userId: newUserId, name, joinedAt: Date.now(), inviteToken: 'test' });
      return { statusCode: 200, body: JSON.stringify({ ok: true, userId: newUserId }) };
    }

    if (action === 'create-practice') {
      if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };
      const practiceLogId = makePracticeLogId();
      const now = Date.now();
      await create({
        collection: 'practice-logs',
        id: practiceLogId,
        data: {
          _practiceId: practiceLogId,
          _userId: userId,
          _startedAt: new Date(now - 600000),
          _stoppedAt: new Date(now),
          practiceName: null,
          note: null,
          durationSeconds: 600,
        },
      });
      await updateLastPracticed(userId);
      return { statusCode: 200, body: JSON.stringify({ ok: true, practiceLogId }) };
    }

    if (action === 'connect') {
      if (!userId || !targetUserId) return { statusCode: 400, body: JSON.stringify({ error: 'userId and targetUserId required' }) };
      await ensureConnection({ userAId: userId, userBId: targetUserId, initiatedBy: 'admin' });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'delete-practices') {
      if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };
      await deletePracticeLogsForUser(userId);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'delete-user') {
      if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };
      if (!userId.startsWith('tu-')) return { statusCode: 400, body: JSON.stringify({ error: 'can only delete tu-* test users' }) };
      await Promise.all([
        deleteConnectionsForUser(userId),
        deletePracticeLogsForUser(userId),
        deleteUser(userId),
      ]);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `unknown action: ${action}` }) };
  } catch (err) {
    log('warn', '[admin-test-data] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
