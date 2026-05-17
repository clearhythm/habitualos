const circleList       = document.getElementById('circle-list');
const notesWaitingList  = document.getElementById('notes-waiting-list');
const notesSectionLabel = document.getElementById('notes-section-label');
const protoStateBtn    = document.getElementById('proto-state');

const PROTO_STATES = ['notes waiting', 'notes unlocked', 'all caught up'];
let protoStateIdx  = 0;

const MOCK_CIRCLE = [
  { _userId: 'u-test-sarah', _name: 'Sarah',  lastPracticed: 'today',       daysSince: 0, hasNote: true  },
  { _userId: 'u-test-frank', _name: 'Frank',  lastPracticed: '2 hours ago', daysSince: 0, hasNote: false },
  { _userId: 'u-test-roi',   _name: "Ro'i",   lastPracticed: '3 days ago',  daysSince: 3, hasNote: true  },
  { _userId: 'u-test-erik',  _name: 'Erik',   lastPracticed: '8 days ago',  daysSince: 8, hasNote: false },
];

const MOCK_THREADS = {
  'u-test-sarah': [
    { from: 'them', text: 'Your consistency is inspiring me to get back on track!', sentAt: '2 days ago' },
    { from: 'me',   text: 'Sarah! You crushed it this week. Keep going.',            sentAt: '5 days ago' },
  ],
  'u-test-roi': [
    { from: 'them', text: "Been thinking of you. Hope you're finding your rhythm.",  sentAt: '1 day ago'  },
  ],
};

let currentTab = 'celebrate';

const NOTE_STATUS = {
  'notes waiting':  'You have new notes from your circle · Practice to unlock them',
  'notes unlocked': 'You have new notes from your circle · Scroll down to read them',
  'all caught up':  'Celebrate and encourage friends · Notes unlock when they practice',
};

function notesLocked() {
  return PROTO_STATES[protoStateIdx] === 'notes waiting';
}

function renderNotesWaiting() {
  const state = PROTO_STATES[protoStateIdx];
  notesSectionLabel.textContent = state === 'all caught up' ? 'How this works' : 'Waiting for you';

  notesWaitingList.innerHTML = `
    <div class="note-waiting-row">
      <span class="note-waiting-meta">${NOTE_STATUS[state]}</span>
    </div>
  `;
}

function sortedCircle() {
  const list = [...MOCK_CIRCLE];
  return currentTab === 'celebrate'
    ? list.sort((a, b) => a.daysSince - b.daysSince)
    : list.sort((a, b) => b.daysSince - a.daysSince);
}

function renderThread(userId, name) {
  const thread = MOCK_THREADS[userId] || [];
  const locked = notesLocked();

  const history = thread.map(msg => {
    const isMe = msg.from === 'me';
    if (!isMe && locked) {
      return `
        <div class="thread-msg thread-msg--them thread-msg--locked">
          <div class="thread-locked-text">Practice to unlock this note</div>
          <div class="thread-msg-meta">${msg.sentAt}</div>
        </div>`;
    }
    return `
      <div class="thread-msg thread-msg--${isMe ? 'me' : 'them'}">
        <div class="thread-msg-text">${msg.text}</div>
        <div class="thread-msg-meta">${msg.sentAt}</div>
      </div>`;
  }).join('');

  return `
    <div class="circle-thread" id="thread-${userId}">
      <textarea class="compose-input" placeholder="Write ${name} a note…" rows="3"></textarea>
      <div class="compose-actions">
        <button class="btn-quiet btn-cancel" data-userid="${userId}">cancel</button>
        <button class="btn-send" data-userid="${userId}">send note</button>
      </div>
      ${history ? `<div class="thread-history">${history}</div>` : ''}
    </div>`;
}

function renderCircle() {
  circleList.innerHTML = sortedCircle().map(person => `
    <div class="circle-row" id="row-${person._userId}">
      <div class="circle-row-main" data-userid="${person._userId}" data-name="${person._name}">
        <span class="circle-row-name">${person.hasNote && PROTO_STATES[protoStateIdx] === 'notes unlocked' ? '<span class="unread-dot"></span>' : ''}${person._name}</span>
        <span class="circle-row-meta">practiced ${person.lastPracticed}</span>
      </div>
      ${renderThread(person._userId, person._name)}
    </div>
  `).join('');

  // hide all threads initially
  circleList.querySelectorAll('.circle-thread').forEach(t => t.hidden = true);
}

function showSentConfirmation(userId) {
  const row = document.getElementById(`row-${userId}`);
  const el  = document.createElement('div');
  el.className = 'sent-confirmation';
  el.textContent = "Note sent — they'll get it when they practice.";
  row.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

circleList.addEventListener('click', (e) => {
  const rowMain   = e.target.closest('.circle-row-main');
  const cancelBtn = e.target.closest('.btn-cancel');
  const sendBtn   = e.target.closest('.btn-send');

  if (sendBtn) {
    const userId   = sendBtn.dataset.userid;
    const thread   = document.getElementById(`thread-${userId}`);
    const textarea = thread.querySelector('.compose-input');
    if (!textarea.value.trim()) return;
    textarea.value = '';
    thread.hidden = true;
    showSentConfirmation(userId);
    return;
  }

  if (cancelBtn) {
    const userId = cancelBtn.dataset.userid;
    const thread = document.getElementById(`thread-${userId}`);
    thread.querySelector('.compose-input').value = '';
    thread.hidden = true;
    return;
  }

  if (rowMain) {
    const userId = rowMain.dataset.userid;
    const thread = document.getElementById(`thread-${userId}`);
    const isOpen = !thread.hidden;
    circleList.querySelectorAll('.circle-thread').forEach(t => {
      t.hidden = true;
      t.querySelector('.compose-input').value = '';
    });
    if (!isOpen) {
      thread.hidden = false;
      thread.querySelector('.compose-input').focus();
    }
  }
});

protoStateBtn.addEventListener('click', () => {
  protoStateIdx = (protoStateIdx + 1) % PROTO_STATES.length;
  protoStateBtn.innerHTML = `state: <strong>${PROTO_STATES[protoStateIdx]}</strong>`;
  renderNotesWaiting();
  renderCircle();
});

document.querySelectorAll('.circle-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.circle-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderCircle();
  });
});

renderNotesWaiting();
renderCircle();
