import { log } from '../utils/log.js';
import { isSignedIn, getUserId, initGuestId } from '../auth/auth.js';
import { saveIntendedPath, clearIntendedPath } from '../auth/auth-intent.js';

// ─── Audio
let _audioCtx    = null;
let _chimeBuffer = null;

async function initAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer());
    _chimeBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) { log('warn', '[signup] audio init failed:', err); }
}

function playChime(sig) {
  if (!_chimeBuffer || !_audioCtx) return;
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  const master = _audioCtx.createGain();
  master.connect(_audioCtx.destination);
  const now    = _audioCtx.currentTime;
  const maxT   = Math.max(...sig.timing);
  const fadeAt = now + maxT + 3.5;
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
  if (Math.random() > 0.5) notes[0] -= 12;
  const t2 = 0.15 + Math.random() * 0.2;
  const t3 = t2 + 0.25 + Math.random() * 0.3;
  return { notes, timing: [0, parseFloat(t2.toFixed(2)), parseFloat(t3.toFixed(2))] };
}

// ─── Step navigation
const STEP_TITLES = { 'step-chime': 'Your Chime', 'step-email': 'Your Contact', 'step-sent': 'Check Email' };

export function show(id) {
  document.querySelectorAll('.auth-step').forEach(el => { el.hidden = true; });
  const el = document.getElementById(id);
  if (el) el.hidden = false;
  const title = document.getElementById('header-title');
  if (title) title.textContent = STEP_TITLES[id] ?? 'Welcome,';
}

// ─── Register + connect after magic link return
async function registerAndConnect() {
  show('step-connecting');
  const userId    = getUserId();
  const name      = localStorage.getItem('dp-pending-name') || '';
  const connectId = localStorage.getItem('dp-pending-connect') || '';
  let chime = null;
  try { chime = JSON.parse(localStorage.getItem('dp-pending-chime') || 'null'); } catch (_) {}

  try {
    await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, chime, connectUserId: connectId || undefined }),
    });
  } catch (err) { log('warn', '[signup] register failed:', err); }

  localStorage.removeItem('dp-pending-name');
  localStorage.removeItem('dp-pending-chime');
  localStorage.removeItem('dp-pending-connect');
  localStorage.removeItem('dp-pending-email');
  clearIntendedPath();
  window.location.replace('/');
}

// ─── Entry point — called by signup.njk directly, or by join.js with sharer context
export async function startSignupFlow({ sharerName = null } = {}) {
  if (isSignedIn()) {
    await registerAndConnect();
    return;
  }

  saveIntendedPath(window.location.pathname);
  initGuestId();

  // Personalise name step copy if an inviter is known
  const nameSubtext = document.getElementById('name-subtext');
  if (nameSubtext && sharerName) {
    nameSubtext.innerHTML = `${sharerName} invited you to join.<br>Provide your first name to begin.`;
  }

  // If email already sent, user is mid-flow — don't wipe their data
  const pendingEmail = localStorage.getItem('dp-pending-email');
  if (pendingEmail) {
    document.getElementById('join-sent-email').textContent = pendingEmail;
    show('step-sent');
    return;
  }

  // Clear any stale pending data from a previous session
  // (dp-pending-connect is managed by join.js — don't touch it here)
  localStorage.removeItem('dp-pending-chime');
  localStorage.removeItem('dp-pending-name');

  let _pendingChime  = null;
  let _chimeAssigned = false;

  show('step-name');

  // ─── Name step
  const nameInput = document.getElementById('join-name');
  const nameBtn   = document.getElementById('name-btn');

  nameBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    localStorage.setItem('dp-pending-name', name);
    showChimeStep();
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameBtn.click(); });

  // ─── Chime step
  const headerChimeWrap = document.getElementById('header-chime-wrap');

  function swingHeaderChime() {
    const svg = headerChimeWrap?.querySelector('.wind-chime');
    if (!svg) return;
    svg.classList.remove('chime-swaying');
    void window.getComputedStyle(svg).animationName;
    svg.classList.add('chime-swaying');
    svg.addEventListener('animationend', (e) => {
      if (e.animationName === 'chime-sway') svg.classList.remove('chime-swaying');
    }, { once: true });
  }

  function showChimeStep() {
    if (!_pendingChime) _pendingChime = generateChime();
    _chimeAssigned = true;
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    show('step-chime');
    initAudio().then(() => { playChime(_pendingChime); swingHeaderChime(); });
  }

  if (headerChimeWrap) {
    headerChimeWrap.addEventListener('click', async () => {
      await initAudio();
      const sig = _chimeAssigned ? _pendingChime : generateChime();
      playChime(sig);
      swingHeaderChime();
    });
  }

  const chimeRetryBtn = document.getElementById('chime-retry-btn');
  const chimeBtn      = document.getElementById('chime-btn');

  chimeRetryBtn.addEventListener('click', () => {
    _pendingChime = generateChime();
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    playChime(_pendingChime);
    swingHeaderChime();
  });

  chimeBtn.addEventListener('click', () => { show('step-email'); });

  // ─── Email step
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
      if (data.verifyUrl) log('debug', '[signup] dev verifyUrl:', data.verifyUrl);
      localStorage.setItem('dp-pending-email', email);
      document.getElementById('join-sent-email').textContent = email;
      show('step-sent');
    } catch (err) {
      log('warn', '[signup] send failed:', err.message);
      errorEl.textContent = 'something went wrong — try again';
      errorEl.hidden = false;
      emailBtn.disabled = false;
      emailBtn.textContent = "i'm ready";
    }
  });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') emailBtn.click(); });

  document.getElementById('edit-email-btn')?.addEventListener('click', () => {
    localStorage.removeItem('dp-pending-email');
    emailBtn.disabled = false;
    emailBtn.textContent = "i'm ready";
    show('step-email');
    emailInput.focus();
  });
}
