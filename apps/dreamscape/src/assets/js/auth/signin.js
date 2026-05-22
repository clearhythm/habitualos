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
  if (data.verifyUrl) log('debug', '[signin] dev verifyUrl:', data.verifyUrl);
  return data;
}

export async function consumeToken(token) {
  log('debug', '[signin] consuming token');
  const res  = await fetch(`/api/auth-magic-link-consume?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'invalid token');
  signIn({ userId: data.userId, name: data.profile?.displayName || data.profile?.firstName || '' });
  if (localStorage.getItem('dp-audio-pref') === null) {
    document.cookie = 'dp-audio-check=1; path=/; samesite=lax; max-age=300';
  }
  const dest = readIntendedPath();
  clearIntendedPath();
  window.location.replace(dest);
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

