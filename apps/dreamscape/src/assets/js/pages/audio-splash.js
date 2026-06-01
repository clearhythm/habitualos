import { setUserAudioPreference, setAudioMuted } from '../audio-unlock.js';
import { log } from '../utils/log.js';

const params = new URLSearchParams(window.location.search);
const next   = params.get('next') || '/';

log('debug', '[audio-splash] next=', next);

document.getElementById('enable-btn').addEventListener('click', () => {
  setUserAudioPreference('enabled');
  setAudioMuted(false);
  window.location.replace(next);
});

document.getElementById('skip-btn').addEventListener('click', () => {
  setUserAudioPreference('off');
  setAudioMuted(true);
  window.location.replace(next);
});
