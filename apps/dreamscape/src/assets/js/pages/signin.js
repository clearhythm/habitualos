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

if (isSignedIn()) {
  window.location.replace(readIntendedPath());
} else if (token) {
  document.getElementById('step-verify').hidden = false;
  document.getElementById('step-form').hidden   = true;
  consumeToken(token).catch(err => {
    log('warn', '[signin] token consume failed:', err.message);
    document.getElementById('step-verify').hidden = true;
    document.getElementById('step-form').hidden   = false;
  });
} else {
  initSigninForm({
    emailInput:  document.getElementById('signin-email'),
    submitBtn:   document.getElementById('signin-btn'),
    errorEl:     document.getElementById('signin-error'),
    sentEmailEl: document.getElementById('sent-email'),
    formStep:    document.getElementById('step-form'),
    sentStep:    document.getElementById('step-sent'),
  });
}
