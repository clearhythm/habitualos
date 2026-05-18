const { create, patch, query, remove, uniqueId } = require('@habitualos/db-core');
const { TEST_USERS, TEST_USER_IDS } = require('./_utils/test-users.cjs');

const ERIK   = 'u-test-erik';
const SARAH  = 'u-test-sarah';
const FRANK  = 'u-test-frank';
const ROI    = 'u-test-roi';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { scenario } = JSON.parse(event.body || '{}');
  const validScenarios = ['no-notes', 'notes-waiting', 'notes-unlocked', 'all-caught-up'];
  if (!validScenarios.includes(scenario)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid scenario' }) };
  }

  // Ensure user docs and connections exist for all test users
  await ensureUsers();
  await ensureConnections();

  // Clear existing notes for erik
  const existingNotes = await query({ collection: 'notes', where: [`_toUserId::eq::${ERIK}`] });
  await Promise.all((existingNotes || []).map(n => remove({ collection: 'notes', id: n._noteId })));

  if (scenario === 'no-notes' || scenario === 'all-caught-up') {
    // no notes needed
  } else if (scenario === 'notes-waiting') {
    await createNote(SARAH, ERIK, 'sarah-note', null, null);
    await createNote(ROI,   ERIK, 'roi-note',   null, null);
  } else if (scenario === 'notes-unlocked') {
    const now = Date.now();
    await createNote(SARAH, ERIK, 'sarah-note', now, null);
    await createNote(ROI,   ERIK, 'roi-note',   now, null);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, scenario }) };
};

async function ensureUsers() {
  await Promise.all(TEST_USERS.map(async (u) => {
    const existing = await require('@habitualos/db-core').get({ collection: 'users', id: u.userId });
    if (!existing) {
      await create({
        collection: 'users',
        id: u.userId,
        data: { _userId: u.userId, _name: u.name, joinedAt: Date.now(), inviteToken: 'test' },
      });
    }
  }));
}

async function ensureConnections() {
  const members = [SARAH, FRANK, ROI];
  await Promise.all(members.map(async (memberId) => {
    const [userAId, userBId] = [ERIK, memberId].sort();
    const existing = await query({ collection: 'connections', where: [`_userAId::eq::${userAId}`] });
    const alreadyExists = (existing || []).some(c => c._userBId === userBId);
    if (!alreadyExists) {
      const _connId = uniqueId('conn');
      await create({
        collection: 'connections',
        id: _connId,
        data: { _connId, _userAId: userAId, _userBId: userBId, _initiatedBy: ERIK },
      });
    }
  }));
}

async function createNote(fromUserId, toUserId, textSuffix, unlockedAt, readAt) {
  const senderName = TEST_USERS.find(u => u.userId === fromUserId)?.name || fromUserId;
  const _noteId = uniqueId('note');
  await create({
    collection: 'notes',
    id: _noteId,
    data: {
      _noteId,
      _fromUserId: fromUserId,
      _fromName: senderName,
      _toUserId: toUserId,
      text: `Test note from ${senderName} (${textSuffix})`,
      sentAt: Date.now() - 3600000,
      unlockedAt: unlockedAt || null,
      readAt: readAt || null,
    },
  });
}
