import { sendNote as apiSendNote, markRead as apiMarkRead } from '../collections/notes.js';

export function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function practicedLabel(person) {
  if (!person.lastPracticedAt) return 'never practiced';
  return person.daysSince === 0 ? 'practiced today' : `practiced ${person.daysSince}d ago`;
}

/**
 * Render the full circle list widget (header + sortable rows + thread interaction).
 *
 * @param {HTMLElement} container
 * @param {{
 *   circle: object[],
 *   receivedNotes?: object[],
 *   userId?: string,
 *   userName?: string,
 *   onNotesChanged?: () => void,
 * }} opts
 * @returns {() => void} teardown
 */
export function renderCircleList(container, {
  circle = [],
  receivedNotes: initialNotes = [],
  userId = null,
  userName = 'You',
  onNotesChanged = null,
} = {}) {
  let sortMode = 'celebrate';
  let receivedNotes = [...initialNotes];

  function sorted() {
    return circle
      .map(p => ({ ...p, daysSince: p.daysSince ?? Infinity }))
      .sort((a, b) => sortMode === 'celebrate'
        ? a.daysSince - b.daysSince
        : b.daysSince - a.daysSince);
  }

  function threadNotes(fromUserId) {
    return receivedNotes.filter(n => n._fromUserId === fromUserId);
  }

  function renderThread(fromUserId, name) {
    const notes = threadNotes(fromUserId);
    const history = notes.map(n => {
      if (!n.unlockedAt) return `
        <div class="thread-msg thread-msg--them thread-msg--locked">
          <div class="thread-locked-text">Practice to unlock this note</div>
          <div class="thread-msg-meta">${relativeTime(n.sentAt)}</div>
        </div>`;
      return `
        <div class="thread-msg thread-msg--them">
          <div class="thread-msg-text">${escapeHtml(n.text)}</div>
          <div class="thread-msg-meta">${relativeTime(n.sentAt)}</div>
        </div>`;
    }).join('');

    return `
      <div class="circle-thread" id="thread-${fromUserId}" hidden>
        <textarea class="compose-input" name="note" placeholder="Write ${name} a note…" rows="3"></textarea>
        <div class="compose-actions">
          <button class="btn-quiet btn-cancel" data-userid="${fromUserId}">cancel</button>
          <button class="btn-send" data-userid="${fromUserId}">send note</button>
        </div>
        ${history ? `<div class="thread-history">${history}</div>` : ''}
      </div>`;
  }

  function render() {
    const sortLabel = sortMode === 'celebrate' ? 'Celebrate ▾' : 'Encourage ▴';
    const rows = sorted().map(person => {
      const name = escapeHtml(person.name || person.userId);
      const hasUnread = threadNotes(person.userId).some(n => n.unlockedAt && !n.readAt);
      return `
        <div class="circle-row" id="row-${person.userId}">
          <div class="circle-row-main" data-userid="${person.userId}" data-name="${name}">
            <span class="circle-row-name">${hasUnread ? '<span class="unread-dot"></span>' : ''}${name}</span>
            <span class="circle-row-meta">${practicedLabel(person)}</span>
          </div>
          ${renderThread(person.userId, name)}
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="circle-list-header">
        <span class="circle-list-header-label">Name</span>
        <button class="circle-list-header-sort">${sortLabel}</button>
      </div>
      ${rows}`;

    // Sort toggle
    container.querySelector('.circle-list-header-sort')
      .addEventListener('click', () => {
        sortMode = sortMode === 'celebrate' ? 'encourage' : 'celebrate';
        render();
      });

    // Row interactions
    container.addEventListener('click', onClick);
  }

  function showSentConfirmation(fromUserId) {
    const row = container.querySelector(`#row-${fromUserId}`);
    if (!row) return;
    const el = document.createElement('div');
    el.className = 'sent-confirmation';
    el.textContent = "Note sent — they'll get it when they practice.";
    row.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function onClick(e) {
    const sendBtn   = e.target.closest('.btn-send');
    const cancelBtn = e.target.closest('.btn-cancel');
    const rowMain   = e.target.closest('.circle-row-main');

    if (sendBtn) {
      const toUserId = sendBtn.dataset.userid;
      const thread   = container.querySelector(`#thread-${toUserId}`);
      const textarea = thread.querySelector('.compose-input');
      const text     = textarea.value.trim();
      if (!text) return;
      textarea.value = '';
      thread.hidden  = true;
      showSentConfirmation(toUserId);
      if (userId) apiSendNote({ fromUserId: userId, fromName: userName, toUserId, text }).catch(() => {});
      return;
    }

    if (cancelBtn) {
      const thread = container.querySelector(`#thread-${cancelBtn.dataset.userid}`);
      thread.querySelector('.compose-input').value = '';
      thread.hidden = true;
      return;
    }

    if (rowMain) {
      const fromUserId = rowMain.dataset.userid;
      const thread     = container.querySelector(`#thread-${fromUserId}`);
      const isOpen     = !thread.hidden;
      container.querySelectorAll('.circle-thread').forEach(t => {
        t.hidden = true;
        t.querySelector('.compose-input').value = '';
      });
      if (!isOpen) {
        thread.hidden = false;
        thread.querySelector('.compose-input').focus();
        const hasUnread = receivedNotes.some(n => n._fromUserId === fromUserId && n.unlockedAt && !n.readAt);
        if (hasUnread && userId) {
          apiMarkRead({ userId, fromUserId })
            .then(() => {
              receivedNotes.forEach(n => {
                if (n._fromUserId === fromUserId && n.unlockedAt) n.readAt = Date.now();
              });
              const stillUnread = receivedNotes.some(n => n.unlockedAt && !n.readAt);
              localStorage.setItem('dp-has-unread', stillUnread ? 'true' : 'false');
              const badge = document.getElementById('nav-circle-badge');
              if (badge && !stillUnread) badge.hidden = true;
              onNotesChanged?.();
              render();
            })
            .catch(() => {});
        }
      }
    }
  }

  render();
  return () => { container.innerHTML = ''; };
}
