import { consumeToken, initSigninForm } from '../auth/signin.js';
import { isSignedIn } from '../auth/auth.js';
import { readIntendedPath } from '../auth/auth-intent.js';
import { log } from '../utils/log.js';
import { initChimeAudio, playChime, generateChime, swingChime } from '../chime.js';

const chimeWrap = document.getElementById('header-chime-wrap');
chimeWrap?.addEventListener('click', async () => {
  await initChimeAudio();
  playChime(generateChime());
  swingChime(chimeWrap);
});

const params = new URLSearchParams(window.location.search);
const token  = params.get('token');
const isDevSignIn = location.pathname.includes('dev-signin');

if (isSignedIn()) {
  window.location.replace(readIntendedPath());
} else if (isDevSignIn) {
  initDevSigninForm();
} else if (token) {
  document.getElementById('step-verify').hidden = false;
  consumeToken(token).catch(err => {
    log('warn', '[signin] token consume failed:', err.message);
    document.getElementById('step-verify').hidden = true;
    document.getElementById('step-form').hidden   = false;
    const subtext = document.querySelector('#step-form .auth-subtext');
    const isLinkError = err.message === 'Token already used' || err.message === 'Token expired';
    if (isLinkError) {
      subtext.innerHTML = '<span class="auth-error">Sorry, that signin link has already expired.</span><br>Enter your email to receive a new link.';
    } else {
      subtext.innerHTML = '<span class="auth-error">Sorry, something went wrong.</span><br>Enter your email to try again.';
    }
    initSigninForm({
      emailInput:    document.getElementById('signin-email'),
      submitBtn:     document.getElementById('signin-btn'),
      errorEl:       document.getElementById('signin-error'),
      sentEmailEl:   document.getElementById('sent-email'),
      formStep:      document.getElementById('step-form'),
      sentStep:      document.getElementById('step-sent'),
      tryAnotherBtn: document.getElementById('signin-try-another'),
    });
  });
} else {
  document.getElementById('step-form').hidden = false;
  initSigninForm({
    emailInput:    document.getElementById('signin-email'),
    submitBtn:     document.getElementById('signin-btn'),
    errorEl:       document.getElementById('signin-error'),
    sentEmailEl:   document.getElementById('sent-email'),
    formStep:      document.getElementById('step-form'),
    sentStep:      document.getElementById('step-sent'),
    tryAnotherBtn: document.getElementById('signin-try-another'),
  });
}

function initDevSigninForm() {
  document.getElementById('step-form').hidden = false;
  const emailInput  = document.getElementById('signin-email');
  const submitBtn   = document.getElementById('signin-btn');
  const errorEl     = document.getElementById('signin-error');

  submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'please enter a valid email';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'signing in…';
    try {
      const guestId = localStorage.getItem('dp-userId');
      const res  = await fetch('/api/dev-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, guestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'dev sign-in failed');
      log('debug', '[dev-signin] verifyUrl:', data.verifyUrl);
      window.location.href = data.verifyUrl;
    } catch (err) {
      log('warn', '[dev-signin] failed:', err.message);
      errorEl.textContent = 'something went wrong — try again';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'sign in';
    }
  });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
}
