const ERIK  = 'u-test-erik';
const SARAH = 'u-test-sarah';

const runBtn     = document.getElementById('run-tests-btn');
const resultsEl  = document.getElementById('test-results');

const TESTS = [
  {
    name: 'note-send: POST note from sarah → erik',
    async run() {
      const data = await AdminAPI.noteSend({ fromUserId: SARAH, fromName: 'Sarah', toUserId: ERIK, text: 'Unit test note' });
      assert(data._noteId, `expected _noteId, got: ${JSON.stringify(data)}`);
      return data._noteId;
    },
  },
  {
    name: 'circle-data: GET for erik — returns connections + notes',
    async run() {
      const data = await AdminAPI.circleData(ERIK);
      assert(Array.isArray(data.circle),        `circle not array`);
      assert(Array.isArray(data.receivedNotes), `receivedNotes not array`);
      assert(Array.isArray(data.sentNotes),     `sentNotes not array`);
    },
  },
  {
    name: 'notes-unlock: POST for erik — returns unlocked count',
    async run() {
      const data = await AdminAPI.notesUnlock(ERIK);
      assert(typeof data.unlocked === 'number', `expected unlocked number, got: ${JSON.stringify(data)}`);
    },
  },
  {
    name: 'notes-mark-read: POST for erik/sarah — returns marked count',
    async run() {
      const data = await AdminAPI.notesMarkRead(ERIK, SARAH);
      assert(typeof data.marked === 'number', `expected marked number, got: ${JSON.stringify(data)}`);
    },
  },
  {
    name: 'admin-users: GET — returns members array',
    async run() {
      const data = await AdminAPI.getUsers();
      assert(Array.isArray(data.members), `expected members array, got: ${JSON.stringify(data)}`);
    },
  },
  {
    name: 'admin-sessions: GET — returns sessions array',
    async run() {
      const data = await AdminAPI.getSessions();
      assert(Array.isArray(data.sessions), `expected sessions array, got: ${JSON.stringify(data)}`);
    },
  },
];

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

runBtn.addEventListener('click', async () => {
  runBtn.disabled = true;
  runBtn.textContent = 'Running…';
  resultsEl.innerHTML = '';
  resultsEl.hidden = false;

  for (const test of TESTS) {
    const row = document.createElement('div');
    row.className = 'test-result test-result--running';
    row.textContent = `⏳ ${test.name}`;
    resultsEl.appendChild(row);

    try {
      await test.run();
      row.className = 'test-result test-result--pass';
      row.textContent = `✓ ${test.name}`;
    } catch (err) {
      row.className = 'test-result test-result--fail';
      row.textContent = `✗ ${test.name} — ${err.message}`;
    }
  }

  runBtn.disabled = false;
  runBtn.textContent = 'Run all tests';
});
