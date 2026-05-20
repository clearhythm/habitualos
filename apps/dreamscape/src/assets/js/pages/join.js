import { log } from '../utils/log.js';
import { signIn, isSignedIn, getUserId, initGuestId } from '../auth/auth.js';
import { saveIntendedPath, readIntendedPath, clearIntendedPath } from '../auth/auth-intent.js';

// ─── State
let _sharerUserId = null;
let _sharerName   = null;
let _pendingName  = localStorage.getItem('dp-pending-name') || '';
let _pendingChime = null;
try { _pendingChime = JSON.parse(localStorage.getItem('dp-pending-chime') || 'null'); } catch (_) {}

// ─── Audio for chime preview
let _audioCtx    = null;
let _chimeBuffer = null;

async function initAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer());
    _chimeBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) { log('warn', '[join] audio init failed:', err); }
}

function playChime(sig) {
  if (!_chimeBuffer || !_audioCtx) return;
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  const master = _audioCtx.createGain();
  master.connect(_audioCtx.destination);
  const now     = _audioCtx.currentTime;
  const maxT    = Math.max(...sig.timing);
  const fadeAt  = now + maxT + 3.5;
  master.gain.setValueAtTime(0.7, now);
  master.gain.setValueAtTime(0.7, fadeAt);
  master.gain.exponentialRampToValueAtTime(0.001, fadeAt + 2);
  sig.notes.forEach((semitones, i) => {
    const src = _audioCtx.createBufferSource();
    src.buffer = _chimeBuffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(master);
    src.start(now + sig.timing[i]);
  });
}

// ─── Chime generation
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14];

function generateChime() {
  const pool = [...PENTATONIC];
  const notes = [];
  while (notes.length < 3) {
    const i = Math.floor(Math.random() * pool.length);
    notes.push(pool.splice(i, 1)[0]);
  }
  // Optionally shift root down an octave for variety
  if (Math.random() > 0.5) notes[0] -= 12;
  const t2 = 0.15 + Math.random() * 0.2;
  const t3 = t2 + 0.25 + Math.random() * 0.3;
  return { notes, timing: [0, parseFloat(t2.toFixed(2)), parseFloat(t3.toFixed(2))] };
}

// ─── Step navigation
function show(id) {
  document.querySelectorAll('.auth-step').forEach(el => { el.hidden = true; });
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

// ─── Slug from pathname: /join/erik → "erik"
function getSlug() {
  const parts = window.location.pathname.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || '';
}

// ─── Register + connect on return after magic link
async function registerAndConnect() {
  show('step-connecting');
  const userId      = getUserId();
  const name        = localStorage.getItem('dp-pending-name') || '';
  const connectId   = localStorage.getItem('dp-pending-connect') || '';
  let chime = null;
  try { chime = JSON.parse(localStorage.getItem('dp-pending-chime') || 'null'); } catch (_) {}

  try {
    await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, chime, connectUserId: connectId || undefined }),
    });
  } catch (err) { log('warn', '[join] register failed:', err); }

  localStorage.removeItem('dp-pending-name');
  localStorage.removeItem('dp-pending-chime');
  localStorage.removeItem('dp-pending-connect');
  clearIntendedPath();
  window.location.replace('/');
}

// ─── Main init
async function init() {
  const slug = getSlug();
  if (!slug) { show('step-error'); return; }

  // If already signed in, run register + connect then go home
  if (isSignedIn()) {
    await registerAndConnect();
    return;
  }

  // Look up the sharer
  try {
    const res  = await fetch(`/api/slug-lookup?slug=${encodeURIComponent(slug)}`);
    const data = await res.json();
    if (!res.ok || !data.userId) { show('step-error'); return; }
    _sharerUserId = data.userId;
    _sharerName   = data.name;
    localStorage.setItem('dp-pending-connect', _sharerUserId);
  } catch (_) { show('step-error'); return; }

  // Save intended path so magic link returns here
  saveIntendedPath(window.location.pathname);

  // Ensure guest userId exists
  initGuestId();

  // ─── Step: Name
  const nameLabel = document.getElementById('name-label');
  if (nameLabel && _sharerName) nameLabel.textContent = `${_sharerName} invited you · what's your name?`;

  show('step-name');

  const nameInput = document.getElementById('join-name');
  const nameBtn   = document.getElementById('name-btn');
  if (nameInput && _pendingName) nameInput.value = _pendingName;

  nameBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    _pendingName = name;
    localStorage.setItem('dp-pending-name', name);
    showChimeStep();
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameBtn.click(); });

  // ─── Step: Chime
  function showChimeStep() {
    if (!_pendingChime) _pendingChime = generateChime();
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    show('step-chime');
    initAudio();
  }

  const chimePreview  = document.getElementById('chime-preview');
  const chimeRetryBtn = document.getElementById('chime-retry-btn');
  const chimeBtn      = document.getElementById('chime-btn');

  chimePreview.addEventListener('click', async () => {
    await initAudio();
    if (_pendingChime) playChime(_pendingChime);
  });
  chimePreview.addEventListener('keydown', async e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chimePreview.click(); }
  });

  chimeRetryBtn.addEventListener('click', () => {
    _pendingChime = generateChime();
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    playChime(_pendingChime);
  });

  chimeBtn.addEventListener('click', () => { show('step-email'); });

  // ─── Step: Email
  const emailInput = document.getElementById('join-email');
  const emailBtn   = document.getElementById('email-btn');
  const errorEl    = document.getElementById('join-error');

  emailBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'please enter a valid email';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    emailBtn.disabled = true;
    emailBtn.textContent = 'sending…';
    try {
      const guestId = getUserId();
      const res = await fetch('/api/auth-magic-link-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, guestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'send failed');
      if (data.verifyUrl) log('debug', '[join] dev verifyUrl:', data.verifyUrl);
      document.getElementById('join-sent-email').textContent = email;
      show('step-sent');
    } catch (err) {
      log('warn', '[join] send failed:', err.message);
      errorEl.textContent = 'something went wrong — try again';
      errorEl.hidden = false;
      emailBtn.disabled = false;
      emailBtn.textContent = 'send me a link';
    }
  });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') emailBtn.click(); });
}

init();
