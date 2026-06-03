import { getConnections } from '../collections/connections.js';
import { getUserId, getName } from '../auth/auth.js';
import { renderCircleList } from '../components/circle-list.js';

const circleList    = document.getElementById('circle-list');
const circleSection = document.querySelector('.circle-section');

let circle        = [];
let receivedNotes = [];

function hasLocked()   { return receivedNotes.some(n => !n.unlockedAt); }
function hasUnread()   { return receivedNotes.some(n => n.unlockedAt && !n.readAt); }
function allCaughtUp() { return !hasLocked() && !hasUnread(); }

function renderNotesSection() {
  const icon      = document.getElementById('circle-icon');
  const subtitle  = document.getElementById('circle-subtitle');
  const subtitle2 = document.getElementById('circle-subtitle-2');
  if (allCaughtUp()) {
    if (icon) icon.classList.remove('has-notes');
    if (subtitle)  subtitle.textContent  = 'practice with friends';
    if (subtitle2) subtitle2.textContent = 'witness, celebrate, send chimes';
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

function renderCircle() {
  if (circleSection) circleSection.removeAttribute('hidden');
  const page = document.querySelector('.circle-page');
  if (!circle.length) {
    const icon      = document.getElementById('circle-icon');
    const subtitle  = document.getElementById('circle-subtitle');
    const subtitle2 = document.getElementById('circle-subtitle-2');
    if (icon)      icon.classList.remove('has-notes');
    if (subtitle)  subtitle.textContent  = 'invite your friends';
    if (subtitle2) subtitle2.textContent = 'support your daily practices';
    if (page) page.classList.add('circle-page--empty');
    circleList.innerHTML = '';
    return;
  }
  if (page) page.classList.remove('circle-page--empty');

  renderCircleList(circleList, {
    circle,
    receivedNotes,
    userId:   getUserId(),
    userName: getName() || 'You',
    onNotesChanged: () => {
      // re-read unread state from the shared receivedNotes array (widget mutates readAt in place)
      renderNotesSection();
    },
  });
}

async function loadCircleData() {
  if (!getUserId()) { renderCircle(); return; }

  try {
    const data = await getConnections();
    circle        = data.circle        || [];
    receivedNotes = data.receivedNotes || [];
  } catch (_) {}

  const unread = receivedNotes.some(n => n.unlockedAt && !n.readAt);
  localStorage.setItem('dp-has-unread', unread ? 'true' : 'false');

  renderCircle();
  if (circle.length) renderNotesSection();
}

loadCircleData();
