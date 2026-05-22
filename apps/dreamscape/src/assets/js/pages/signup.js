import { log } from '../utils/log.js';
import { isSignedIn, getUserId, initGuestId } from '../auth/auth.js';
import { initChimeAudio, playChime, generateChime, swingChime } from '../chime.js';

// ─── Step navigation
const STEP_TITLES = { 'step-chime': 'Your Chime', 'step-email': 'Your Contact', 'step-sent': 'Check Email' };

export function show(id) {
  document.querySelectorAll('.auth-step').forEach(el => { el.hidden = true; });
  const el = document.getElementById(id);
  if (el) el.hidden = false;
  const title = document.getElementById('header-title');
  if (title) title.textContent = STEP_TITLES[id] ?? 'Welcome,';
}

// ─── Register + connect after magic link return (same-device fallback only)
async function registerAndConnect() {
  show('step-connecting');
  const userId    = getUserId();
  const name      = localStorage.getItem('dp-pending-name') || '';
  let chime = null;
  try { chime = JSON.parse(localStorage.getItem('dp-pending-chime') || 'null'); } catch (_) {}

  try {
    await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, chime }),
    });
  } catch (err) { log('warn', '[signup] register failed:', err); }

  localStorage.removeItem('dp-pending-name');
  localStorage.removeItem('dp-pending-chime');
  localStorage.removeItem('dp-pending-email');
  window.location.replace('/');
}

// ─── Entry point — called by signup.njk directly, or by join.js with sharer context
export async function startSignupFlow({ sharerName = null, connectUserId = null, connectName = null } = {}) {
  if (isSignedIn()) {
    await registerAndConnect();
    return;
  }

  initGuestId();

  // Personalise name step copy if an inviter is known
  const nameSubtext = document.getElementById('name-subtext');
  if (nameSubtext && sharerName) {
    nameSubtext.innerHTML = `${sharerName} invited you to join.<br>Provide your first name to begin.`;
  }

  const pendingEmail = localStorage.getItem('dp-pending-email');

  if (!pendingEmail) {
    // Clear any stale pending data from a previous session
    localStorage.removeItem('dp-pending-chime');
    localStorage.removeItem('dp-pending-name');
  }

  let _pendingChime  = null;
  let _chimeAssigned = false;

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

  function showChimeStep() {
    if (!_pendingChime) _pendingChime = generateChime();
    _chimeAssigned = true;
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    show('step-chime');
    initChimeAudio().then(() => { playChime(_pendingChime); swingChime(headerChimeWrap); });
  }

  if (headerChimeWrap) {
    headerChimeWrap.addEventListener('click', async () => {
      await initChimeAudio();
      const sig = _chimeAssigned ? _pendingChime : generateChime();
      playChime(sig);
      swingChime(headerChimeWrap);
    });
  }

  const chimeRetryBtn = document.getElementById('chime-retry-btn');
  const chimeBtn      = document.getElementById('chime-btn');

  chimeRetryBtn.addEventListener('click', () => {
    _pendingChime = generateChime();
    localStorage.setItem('dp-pending-chime', JSON.stringify(_pendingChime));
    playChime(_pendingChime);
    swingChime(headerChimeWrap);
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
      const name  = localStorage.getItem('dp-pending-name') || '';
      let chime = null;
      try { chime = JSON.parse(localStorage.getItem('dp-pending-chime') || 'null'); } catch (_) {}

      const pendingRegistration = { name, chime, connectUserId: connectUserId || null, connectName: connectName || null };

      const res = await fetch('/api/auth-magic-link-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, guestId, pendingRegistration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'send failed');
      if (data.verifyUrl) log('debug', '[signup] dev verifyUrl:', data.verifyUrl);

      // Data is now in Firestore — clean up localStorage
      localStorage.removeItem('dp-pending-name');
      localStorage.removeItem('dp-pending-chime');
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

  if (pendingEmail) {
    document.getElementById('join-sent-email').textContent = pendingEmail;
    show('step-sent');
  } else {
    show('step-name');
  }
}
