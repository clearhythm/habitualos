import { log } from '../utils/log.js';
import { signIn } from './auth.js';
import { readIntendedPath, clearIntendedPath } from './auth-intent.js';

export async function sendLink(email, { noEmail = false } = {}) {
  const guestId = localStorage.getItem('dp-userId');
  const res = await fetch('/api/auth-magic-link-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, guestId, ...(noEmail && { noEmail: true }) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'send failed');
  if (data.verifyUrl) log('debug', '[signin] dev verifyUrl:', data.verifyUrl);
  return data;
}

export async function consumeToken(token) {
  log('debug', '[signin] consuming token');
  const res  = await fetch(`/api/auth-magic-link-consume?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'invalid token');
  const profile = data.profile || {};
  signIn({ userId: data.userId, name: profile._name || profile.displayName || profile.firstName || '' });

  const pending = data.profile?.pendingRegistration;
  if (pending) {
    await completePendingRegistration(data.userId, pending);
    // Set welcome flag before redirecting
    if (pending.connectName) {
      localStorage.setItem('dp-welcome-from', pending.connectName);
    } else {
      localStorage.setItem('dp-first-visit', '1');
    }
  }

  const dest = readIntendedPath();
  clearIntendedPath();
  window.location.replace(dest);
}

async function completePendingRegistration(userId, pending) {
  const { name, chime, connectUserId, connectName } = pending;
  try {
    await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name: name || '', chime: chime || null, connectUserId: connectUserId || undefined }),
    });
    log('debug', '[signin] registration complete, connectName:', connectName);
  } catch (err) { log('warn', '[signin] register failed:', err); }
  localStorage.removeItem('dp-pending-email');
}

export function initSigninForm({ emailInput, submitBtn, errorEl, sentEmailEl, formStep, sentStep, tryAnotherBtn, noEmail = false }) {
  submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'please enter a valid email';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'sending…';
    try {
      const data = await sendLink(email, { noEmail });
      if (data.verifyUrl) { window.location.href = data.verifyUrl; return; }
      sentEmailEl.textContent = email;
      formStep.hidden = true;
      sentStep.hidden = false;
    } catch (err) {
      log('warn', '[signin] send failed:', err.message);
      errorEl.textContent = 'something went wrong — try again';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'send me a link';
    }
  });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  tryAnotherBtn?.addEventListener('click', () => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'send link';
    sentStep.hidden = true;
    formStep.hidden = false;
    emailInput.focus();
  });
}
