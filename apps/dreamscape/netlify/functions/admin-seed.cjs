const { upsertUser } = require('./collections/users.cjs');
const { ensureConnection } = require('./collections/connections.cjs');
const { createNote, unlockNotes, deleteNotesForUser } = require('./collections/notes.cjs');
const { handle } = require('./_utils/api.cjs');
const { TEST_USERS } = require('./_utils/test-users.cjs');

const ERIK  = 'u-test-erik';
const SARAH = 'u-test-sarah';
const FRANK = 'u-test-frank';
const ROI   = 'u-test-roi';

exports.handler = handle('admin.seed', 'POST', async (event, { scenario }) => {
  const validScenarios = ['no-notes', 'notes-waiting', 'notes-unlocked', 'all-caught-up'];
  if (!validScenarios.includes(scenario)) throw new Error('Invalid scenario');

  await Promise.all(TEST_USERS.map(u =>
    upsertUser({ userId: u.userId, name: u.name, joinedAt: new Date(), inviteToken: 'test' })
  ));

  await Promise.all([SARAH, FRANK, ROI].map(memberId =>
    ensureConnection({ initiatedBy: ERIK, receivedBy: memberId })
  ));

  await deleteNotesForUser(ERIK);

  if (scenario === 'notes-waiting') {
    await createNote({ fromUserId: SARAH, fromName: 'Sarah', toUserId: ERIK, text: 'Test note from Sarah (waiting)' });
    await createNote({ fromUserId: ROI,   fromName: "Ro'i",  toUserId: ERIK, text: "Test note from Ro'i (waiting)" });
  } else if (scenario === 'notes-unlocked') {
    await createNote({ fromUserId: SARAH, fromName: 'Sarah', toUserId: ERIK, text: 'Test note from Sarah (unlocked)' });
    await createNote({ fromUserId: ROI,   fromName: "Ro'i",  toUserId: ERIK, text: "Test note from Ro'i (unlocked)" });
    await unlockNotes(ERIK);
  }

  return { ok: true, scenario };
});
