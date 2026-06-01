// Web Audio API + Wake Lock — single shared engine for all pages

const DEFAULT_TRACK = '/assets/music/ambient-paulyudin.mp3';

let audioCtx  = null;
let gainNode  = null;
let source    = null;     // ambient music source node
let buffer    = null;     // ambient track buffer
let _bowlBuf  = null;     // singing bowl buffer (lazy)
let wakeLock  = null;
let _volume   = 0.4;
let _muted    = false;
let _playing  = false;

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

// ─── Ambient music
export async function loadTrack(url = DEFAULT_TRACK) {
  await initAudio();
  const ab = await fetch(url).then(r => r.arrayBuffer());
  buffer   = await audioCtx.decodeAudioData(ab);
}

export async function play() {
  if (_playing) return;
  if (!buffer) await loadTrack();
  await initAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  source        = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop   = true;
  source.connect(gainNode);
  source.start();

  _playing = true;
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

export function stop() {
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  if (source) { try { source.stop(); } catch (_) {} source = null; }
  _playing = false;
}

export function isPlaying() { return _playing; }

// ─── Singing bowl (practice bell) — routes through shared gainNode
export async function playBowl() {
  try {
    await initAudio();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (!_bowlBuf) {
      const ab = await fetch('/assets/music/effects/singing-bowl.mp3').then(r => r.arrayBuffer());
      _bowlBuf = await audioCtx.decodeAudioData(ab);
    }
    const now   = audioCtx.currentTime;
    const scale = audioCtx.createGain();
    scale.gain.setValueAtTime(0.65, now);
    scale.gain.setValueAtTime(0.65, now + 5.0);
    scale.gain.exponentialRampToValueAtTime(0.001, now + 15.0);
    scale.connect(gainNode);
    const src = audioCtx.createBufferSource();
    src.buffer = _bowlBuf;
    src.playbackRate.value = Math.pow(2, 2 / 12); // +2 semitones
    src.connect(scale);
    src.start();
  } catch (_) {}
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

async function _onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    if (audioCtx?.state === 'suspended') await audioCtx.resume();
    if (_playing && !wakeLock) await acquireWakeLock();
  }
}
