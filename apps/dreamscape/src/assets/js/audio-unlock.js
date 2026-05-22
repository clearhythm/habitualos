import { log } from './utils/log.js';

const PREF_KEY = 'dp-audio-pref';

export function getAudioPref() {
  return localStorage.getItem(PREF_KEY); // 'on' | 'off' | null
}

export function setAudioPref(val) {
  localStorage.setItem(PREF_KEY, val);
}

export async function isAutoplayBlocked() {
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

function clearAudioCheckCookie() {
  document.cookie = 'dp-audio-check=; path=/; samesite=lax; max-age=0';
}

function dispatch(enabled) {
  log('debug', '[audio-unlock] dispatching audioReady, enabled=', enabled);
  setTimeout(() => document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled } })), 0);
}

(async () => {
  const splash = document.getElementById('audio-splash');
  if (!splash) return;

  if (!/(?:^|;\s*)dp-auth=1/.test(document.cookie)) return;

  // User explicitly opted out — never show again
  if (getAudioPref() === 'off') {
    clearAudioCheckCookie();
    dispatch(false);
    return;
  }

  // Check if browser blocks autoplay
  const blocked = await isAutoplayBlocked();
  log('debug', '[audio-unlock] blocked=', blocked);

  if (!blocked) {
    clearAudioCheckCookie();
    dispatch(true);
    return;
  }

  // Blocked — show splash to collect user gesture (builds browser MEI over time)
  // Inline script may have already shown it on first sign-in; this is idempotent
  splash.removeAttribute('hidden');

  document.getElementById('audio-splash-enable').addEventListener('click', () => {
    setAudioPref('on');
    clearAudioCheckCookie();
    splash.setAttribute('hidden', '');
    dispatch(true);
  }, { once: true });

  document.getElementById('audio-splash-skip').addEventListener('click', () => {
    setAudioPref('off');
    clearAudioCheckCookie();
    splash.setAttribute('hidden', '');
    dispatch(false);
  }, { once: true });
})();
