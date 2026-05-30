import { log } from './utils/log.js';

// ─── Pure utility module — no side effects on import.
// Consumers (Begin buttons, audio overlay) import what they need.

const PREF_KEY = 'dp-audio-pref';

export function getAudioPref() {
  return localStorage.getItem(PREF_KEY); // 'on' | 'off' | null
}

export function setAudioPref(val) {
  localStorage.setItem(PREF_KEY, val);
}

// Must be called inside a user gesture (click/tap) handler.
// Creates and immediately closes an AudioContext to satisfy browser autoplay policy.
// Sets dp-audio-pref = 'on' on success. Safe to call if already unlocked.
export async function ensureAudioUnlocked() {
  if (getAudioPref() === 'on') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    log('debug', '[audio-unlock] unlocked via gesture, state=', ctx.state);
    await ctx.close();
    setAudioPref('on');
  } catch (err) {
    log('warn', '[audio-unlock] ensureAudioUnlocked failed:', err);
  }
}

export function disableAudio() {
  setAudioPref('off');
}

// Used by home.js return-visit pulse detection (App-Audio-Unlock-Route ticket).
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
