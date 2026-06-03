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
  const connectionId = new URLSearchParams(window.location.search).get('connectionId');
  const connParam = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : '';
  const res  = await fetch(`/api/auth-magic-link-consume?token=${encodeURIComponent(token)}${connParam}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'invalid token');
  const profile = data.profile || {};
  signIn({ userId: data.userId, name: profile._name || profile.displayName || profile.firstName || '' });

  localStorage.removeItem('dp-pending-userId');

  if (data.connectionId) {
    await completeInviteRegistration(data.userId, data.connectionId);
    clearIntendedPath();
    window.location.replace('/tour/');
    return;
  }

  const dest = readIntendedPath();
  clearIntendedPath();
  window.location.replace(dest);
}

async function completeInviteRegistration(userId, connectionId) {
  try {
    const res = await fetch('/api/user-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, connectionId }),
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
