const { query, remove, get } = require('@habitualos/db-core');
const { TEST_USER_IDS } = require('./_utils/test-users.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const deletions = [];

  for (const userId of TEST_USER_IDS) {
    // connections where user is either side
    const [connAsA, connAsB] = await Promise.all([
      query({ collection: 'connections', where: [`_userAId::eq::${userId}`] }),
      query({ collection: 'connections', where: [`_userBId::eq::${userId}`] }),
    ]);
    for (const c of [...(connAsA || []), ...(connAsB || [])]) {
      deletions.push(remove({ collection: 'connections', id: c._connId }));
    }

    // notes sent or received
    const [sent, received] = await Promise.all([
      query({ collection: 'notes', where: [`_fromUserId::eq::${userId}`] }),
      query({ collection: 'notes', where: [`_toUserId::eq::${userId}`] }),
    ]);
    for (const n of [...(sent || []), ...(received || [])]) {
      deletions.push(remove({ collection: 'notes', id: n._noteId }));
    }

    // sessions
    const sessions = await query({ collection: 'sessions', where: [`_userId::eq::${userId}`] });
    for (const s of (sessions || [])) {
      deletions.push(remove({ collection: 'sessions', id: s._sessionId }));
    }

    // user doc
    deletions.push(remove({ collection: 'users', id: userId }));
  }

  await Promise.all(deletions);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, deletedFor: TEST_USER_IDS }),
  };
};
