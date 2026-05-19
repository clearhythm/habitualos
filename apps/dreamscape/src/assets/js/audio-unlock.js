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
  try { await ctx.resume(); } catch (_) {}
  const blocked = ctx.state !== 'running';
  ctx.close();
  return blocked;
}

(async () => {
  const splash = document.getElementById('audio-splash');
  if (!splash) return;

  const blocked = await isAutoplayBlocked();

  if (!blocked) {
    // Browser allows autoplay — honor pref (default on), no splash ever
    const pref = getAudioPref() ?? 'on';
    document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled: pref === 'on' } }));
    return;
  }

  // Autoplay is blocked — only skip splash if user explicitly said no
  const pref = getAudioPref();
  if (pref === 'off') {
    document.dispatchEvent(new CustomEvent('audioReady', { detail: { enabled: false } }));
    return;
  }

  // No pref, or pref='on' but still blocked — show splash to capture gesture
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
