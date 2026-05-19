const circleList       = document.getElementById('circle-list');
const notesWaitingList  = document.getElementById('notes-waiting-list');
const notesSectionLabel = document.getElementById('notes-section-label');

let _userId = null;
let _name   = null;
let _circle = [];
let _receivedNotes = [];
let _sentNotes     = [];
let currentTab = 'celebrate';

function hasLocked()  { return _receivedNotes.some(n => !n.unlockedAt); }
function hasUnread()  { return _receivedNotes.some(n => n.unlockedAt && !n.readAt); }
function allCaughtUp() { return !hasLocked() && !hasUnread(); }

async function loadCircleData() {
  _userId = localStorage.getItem('dp-userId');
  _name   = localStorage.getItem('dp-name') || 'You';
  if (!_userId) { renderCircle(); return; }

  try {
    const res  = await fetch(`/api/circle-data?userId=${encodeURIComponent(_userId)}`);
    const data = await res.json();
    _circle        = data.circle        || [];
    _receivedNotes = data.receivedNotes || [];
    _sentNotes     = data.sentNotes     || [];
  } catch (_) {}

  renderCircle();
  if (_circle.length) renderNotesSection();
}

const NOTE_STATUS = {
  waiting:    'You have new notes from your circle · Practice to unlock them',
  unlocked:   'You have new notes from your circle · Scroll down to read them',
  caughtUp:   'Celebrate and encourage your circle · Notes unlock when they practice',
};

function renderNotesSection() {
  const icon      = document.getElementById('circle-icon');
  const subtitle  = document.getElementById('circle-subtitle');
  const subtitle2 = document.getElementById('circle-subtitle-2');
  if (allCaughtUp()) {
    if (icon) icon.classList.remove('has-notes');
    if (subtitle)  subtitle.textContent  = 'send notes to support friends';
    if (subtitle2) subtitle2.textContent = 'they can read them when they practice';
  } else if (hasLocked()) {
    if (icon) icon.classList.add('has-notes');
    if (subtitle)  subtitle.textContent  = 'you have unread notes';
    if (subtitle2) subtitle2.textContent = 'practice to unlock';
  } else {
    if (icon) icon.classList.add('has-notes');
    if (subtitle)  subtitle.textContent  = 'you have unread notes';
    if (subtitle2) subtitle2.textContent = 'scroll down to read';
  }
}

function threadNotes(userId) {
  return _receivedNotes.filter(n => n._fromUserId === userId);
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderThread(userId, name) {
  const notes = threadNotes(userId);

  const history = notes.map(n => {
    if (!n.unlockedAt) {
      return `
        <div class="thread-msg thread-msg--them thread-msg--locked">
          <div class="thread-locked-text">Practice to unlock this note</div>
          <div class="thread-msg-meta">${relativeTime(n.sentAt)}</div>
        </div>`;
    }
    return `
      <div class="thread-msg thread-msg--them">
        <div class="thread-msg-text">${escapeHtml(n.text)}</div>
        <div class="thread-msg-meta">${relativeTime(n.sentAt)}</div>
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

function sortedCircle() {
  const list = _circle.map(person => {
    const daysSince = person.daysSince ?? Infinity;
    return { ...person, daysSince };
  });
  return currentTab === 'celebrate'
    ? list.sort((a, b) => a.daysSince - b.daysSince)
    : list.sort((a, b) => b.daysSince - a.daysSince);
}

const circleListHeader = document.querySelector('.circle-list-header');
const circleSection    = document.querySelector('.circle-section');

function renderCircle() {
  if (circleSection) circleSection.removeAttribute('hidden');
  const page = document.querySelector('.circle-page');
  if (!_circle.length) {
    const icon      = document.getElementById('circle-icon');
    const subtitle  = document.getElementById('circle-subtitle');
    const subtitle2 = document.getElementById('circle-subtitle-2');
    if (icon)      icon.classList.remove('has-notes');
    if (subtitle)  subtitle.textContent  = 'share voice notes with friends';
    if (subtitle2) subtitle2.textContent = 'get mutual support in your practice';
    if (circleListHeader) circleListHeader.hidden = true;
    if (page) page.classList.add('circle-page--empty');
    circleList.innerHTML = '';
    return;
  }
  if (circleListHeader) circleListHeader.hidden = false;
  if (page) page.classList.remove('circle-page--empty');

  circleList.innerHTML = sortedCircle().map(person => {
    const notes = threadNotes(person.userId);
    const hasUnreadFromThis = notes.some(n => n.unlockedAt && !n.readAt);
    const practicedLabel = person.lastPracticedAt
      ? (person.daysSince === 0 ? 'practiced today' : `practiced ${person.daysSince}d ago`)
      : 'never practiced';
    return `
      <div class="circle-row" id="row-${person.userId}">
        <div class="circle-row-main" data-userid="${person.userId}" data-name="${escapeHtml(person.name || person.userId)}">
          <span class="circle-row-name">${hasUnreadFromThis ? '<span class="unread-dot"></span>' : ''}${escapeHtml(person.name || person.userId)}</span>
          <span class="circle-row-meta">${practicedLabel}</span>
        </div>
        ${renderThread(person.userId, escapeHtml(person.name || person.userId))}
      </div>`;
  }).join('');

  circleList.querySelectorAll('.circle-thread').forEach(t => t.hidden = true);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    const text     = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    thread.hidden  = true;
    showSentConfirmation(userId);
    fetch('/api/note-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: _userId, fromName: _name, toUserId: userId, text }),
    }).catch(() => {});
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
      // mark-read if there are unlocked unread notes from this person
      const hasUnread = _receivedNotes.some(n => n._fromUserId === userId && n.unlockedAt && !n.readAt);
      if (hasUnread) {
        fetch('/api/notes-mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: _userId, fromUserId: userId }),
        }).then(() => {
          _receivedNotes.forEach(n => {
            if (n._fromUserId === userId && n.unlockedAt) n.readAt = Date.now();
          });
          renderCircle();
          renderNotesSection();
        }).catch(() => {});
      }
    }
  }
});

const modeBtn = document.getElementById('circle-mode-btn');
if (modeBtn) {
  modeBtn.addEventListener('click', () => {
    currentTab = currentTab === 'celebrate' ? 'encourage' : 'celebrate';
    modeBtn.textContent = currentTab === 'celebrate' ? 'Celebrate ▾' : 'Encourage ▴';
    renderCircle();
  });
}

loadCircleData();
