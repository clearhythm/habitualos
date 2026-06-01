import { log } from './utils/log.js';

// ─── Pure utility module — no side effects on import.

// Raw preference value from cookie.
export function userAudioPreference() {
  const match = document.cookie.match(/(?:^|;\s*)dp-audio-pref=([^;]+)/);
  return match ? match[1] : null; // 'enabled' | 'off' | null
}

// True when the user explicitly chose to enable audio.
export function userRequestedAudio() {
  return userAudioPreference() === 'enabled';
}

// Writes the preference cookie (1 year). Only place dp-audio-pref is written.
export function setUserAudioPreference(val) {
  document.cookie = `dp-audio-pref=${val}; path=/; samesite=lax; max-age=31536000`;
}

// Must be called inside a user gesture handler. Creates a temporary AudioContext
// to satisfy browser autoplay policy, and records the preference as 'enabled'.
// Used by ambient-player, practice, and reflect when audio controls are engaged.
export function ensureAudioUnlocked() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume()
      .then(() => { log('debug', '[audio-unlock] unlocked, state=', ctx.state); return ctx.close(); })
      .catch(err => log('warn', '[audio-unlock] resume failed:', err));
  } catch (err) {
    log('warn', '[audio-unlock] AudioContext creation failed:', err);
  }
}

export function getAudioMuted()        { return localStorage.getItem('dp-audio-muted') === 'true'; }
export function setAudioMuted(muted)   { localStorage.setItem('dp-audio-muted', String(muted)); }
export function getAudioVolume()       { return parseFloat(localStorage.getItem('dp-audio-volume') ?? '1'); }
export function setAudioVolume(vol)    { localStorage.setItem('dp-audio-volume', String(vol)); }

// Async check for whether the browser is blocking autoplay.
// Used by the return-visit pulse affordance (UX-Focus-Queue-Ticket1).
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
  log('debug', '[audio-unlock] isAutoplayBlocked:', blocked);
  return blocked;
}
