import { log } from '../utils/log.js';
import { signIn, isSignedIn } from '../auth/auth.js';
import { readIntendedPath, clearIntendedPath } from '../auth/auth-intent.js';

function show(id) {
  document.querySelectorAll('.auth-step').forEach(el => { el.hidden = true; });
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

async function consumeToken(token) {
  show('step-verify');
  log('debug', '[signin] consuming token');
  try {
    const res  = await fetch(`/api/auth-magic-link-consume?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'invalid token');
    signIn({ userId: data.userId, name: data.profile?.displayName || data.profile?.firstName || '' });
    clearIntendedPath();
    const next = readIntendedPath();
    log('debug', '[signin] signed in, redirecting to', next);
    window.location.replace(next);
  } catch (err) {
    log('warn', '[signin] token consume failed:', err.message);
    show('step-form');
  }
}

async function sendLink(email) {
  const guestId = localStorage.getItem('dp-userId');
  const res = await fetch('/api/auth-magic-link-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, guestId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'send failed');

  // In local dev the token is returned — auto-follow for testing
  if (data.verifyUrl) {
    log('debug', '[signin] dev verifyUrl:', data.verifyUrl);
  }

  return data;
}

function init() {
  if (isSignedIn()) {
    window.location.replace(readIntendedPath());
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  if (token) {
    consumeToken(token);
    return;
  }

  show('step-form');

  const emailInput = document.getElementById('signin-email');
  const signinBtn  = document.getElementById('signin-btn');
  const errorEl    = document.getElementById('signin-error');

  signinBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'please enter a valid email';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    signinBtn.disabled = true;
    signinBtn.textContent = 'sending…';
    try {
      await sendLink(email);
      document.getElementById('sent-email').textContent = email;
      show('step-sent');
    } catch (err) {
      log('warn', '[signin] send failed:', err.message);
      errorEl.textContent = 'something went wrong — try again';
      errorEl.hidden = false;
      signinBtn.disabled = false;
      signinBtn.textContent = 'send me a link';
    }
  });

  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') signinBtn.click(); });
}

init();
