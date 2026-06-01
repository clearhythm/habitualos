import { log } from '../utils/log.js';
import { signIn } from './auth.js';
import { readIntendedPath, clearIntendedPath } from './auth-intent.js';

export async function sendLink(email) {
  const guestId = localStorage.getItem('dp-userId');
  const res = await fetch('/api/auth-magic-link-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, guestId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'send failed');
  return data;
}

export async function consumeToken(token) {
  log('debug', '[signin] consuming token');
  const res  = await fetch(`/api/auth-magic-link-consume?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'invalid token');
  const profile = data.profile || {};
  signIn({ userId: data.userId, name: profile._name || profile.displayName || profile.firstName || '' });

  localStorage.removeItem('dp-pending-userId');

  if (data.connId) {
    const result = await completeInviteRegistration(data.userId, data.connId);
    if (result?.connectName) {
      localStorage.setItem('dp-welcome-from', result.connectName);
    } else {
      localStorage.setItem('dp-first-visit', '1');
    }
  }

  const dest = readIntendedPath();
  clearIntendedPath();
  window.location.replace(dest);
}

async function completeInviteRegistration(userId, connId) {
  try {
    const res = await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, connId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log('warn', '[signin] user-register (invite) failed:', res.status, body);
      return null;
    }
    const result = await res.json();
    log('debug', '[signin] invite registration complete');
    return result;
  } catch (err) {
    log('warn', '[signin] invite registration failed:', err);
    return null;
  }
}

export function initSigninForm({ emailInput, submitBtn, errorEl, sentEmailEl, formStep, sentStep, tryAnotherBtn }) {
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
      await sendLink(email);
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
