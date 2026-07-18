// Web Audio API + Wake Lock — single shared engine for all pages.
// Ported from dreamscape's audio-engine.js, trimmed to the reusable core
// (ambient-track + one-shot-effect playback dropped — no audio assets here yet).
// The push-to-talk recording layer (getUserMedia/MediaRecorder) is not built
// yet; this is the shared AudioContext/gain/wake-lock base it will sit on.

let audioCtx  = null;
let gainNode  = null;
let wakeLock  = null;
let _volume   = 0.4;
let _muted    = false;

// ─── Core init — creates AudioContext + masterGain; idempotent
export async function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode  = audioCtx.createGain();
  gainNode.gain.value = _muted ? 0 : _volume;
  gainNode.connect(audioCtx.destination);
}

export function getCtx()    { return audioCtx; }
export function getGain()   { return gainNode; }
export function getMuted()  { return _muted; }
export function getVolume() { return _volume; }

// ─── Volume / mute
export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (gainNode && !_muted) gainNode.gain.value = _volume;
}

export function setMuted(muted) {
  _muted = muted;
  if (gainNode) gainNode.gain.value = _muted ? 0 : _volume;
}

// ─── Wake lock
export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) {}
}

export function releaseWakeLock() {
  if (wakeLock && !wakeLock.released) wakeLock.release();
  wakeLock = null;
}

window.addEventListener('beforeunload', () => {
  if (audioCtx) { try { audioCtx.close(); } catch (_) {} }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && audioCtx?.state === 'suspended') {
    await audioCtx.resume();
  }
});
