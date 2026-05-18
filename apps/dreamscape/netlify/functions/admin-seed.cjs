const api = require('./_utils/api.cjs');
const { TEST_USERS } = require('./_utils/test-users.cjs');

const ERIK  = 'u-test-erik';
const SARAH = 'u-test-sarah';
const FRANK = 'u-test-frank';
const ROI   = 'u-test-roi';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { scenario } = JSON.parse(event.body || '{}');
  const validScenarios = ['no-notes', 'notes-waiting', 'notes-unlocked', 'all-caught-up'];
  if (!validScenarios.includes(scenario)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid scenario' }) };
  }

  // Ensure user docs exist for all test users
  await Promise.all(TEST_USERS.map(u =>
    api.upsertUser({ userId: u.userId, name: u.name, joinedAt: Date.now(), inviteToken: 'test' })
  ));

  // Ensure connections between erik and each circle member
  await Promise.all([SARAH, FRANK, ROI].map(memberId =>
    api.ensureConnection({ userAId: ERIK, userBId: memberId, initiatedBy: ERIK })
  ));

  // Clear existing notes for erik
  await api.deleteNotesForUser(ERIK);

  if (scenario === 'notes-waiting') {
    await api.createNote({ fromUserId: SARAH, fromName: 'Sarah', toUserId: ERIK, text: 'Test note from Sarah (waiting)' });
    await api.createNote({ fromUserId: ROI,   fromName: "Ro'i",  toUserId: ERIK, text: "Test note from Ro'i (waiting)" });
  } else if (scenario === 'notes-unlocked') {
    const noteIdSarah = await api.createNote({ fromUserId: SARAH, fromName: 'Sarah', toUserId: ERIK, text: 'Test note from Sarah (unlocked)' });
    const noteIdRoi   = await api.createNote({ fromUserId: ROI,   fromName: "Ro'i",  toUserId: ERIK, text: "Test note from Ro'i (unlocked)" });
    await api.unlockNotes(ERIK);
  }
  // no-notes and all-caught-up: connections exist, no notes

  return { statusCode: 200, body: JSON.stringify({ ok: true, scenario }) };
};
