import { log } from './utils/log.js';

const PREF_KEY = 'dp-audio-pref';

export function getAudioPref() {
  return localStorage.getItem(PREF_KEY); // 'on' | 'off' | null (null = not set)
}

export function setAudioPref(val) {
  localStorage.setItem(PREF_KEY, val);
  // TODO: persist to user account on backend
}

async function isAutoplayBlocked() {
  if (navigator.getAutoplayPolicy) {
    return navigator.getAutoplayPolicy('audiocontext') !== 'allowed';
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 500))]);
  } catch (_) {}
  const blocked = ctx.state !== 'running';
  ctx.close();
  return blocked;
}

(async () => {
  const splash = document.getElementById('audio-splash');
  if (!splash) return;

  const blocked = await isAutoplayBlocked();

  log('debug', '[audio-unlock] blocked=', blocked, 'pref=', getAudioPref());

  function dispatch(enabled) {
    log('debug', '[audio-unlock] dispatching audioReady, enabled=', enabled);
    setTimeout(() => document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled } })), 0);
  }

  if (!blocked) {
    const pref = getAudioPref() ?? 'on';
    dispatch(pref === 'on');
    return;
  }

  const pref = getAudioPref();
  if (pref === 'off') {
    dispatch(false);
    return;
  }

  log('debug', '[audio-unlock] showing splash');
  splash.removeAttribute('hidden');

  document.getElementById('audio-splash-enable').addEventListener('click', () => {
    setAudioPref('on');
    splash.setAttribute('hidden', '');
    document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled: true } }));
  }, { once: true });

  document.getElementById('audio-splash-skip').addEventListener('click', () => {
    setAudioPref('off');
    splash.setAttribute('hidden', '');
    document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled: false } }));
  }, { once: true });
})();
