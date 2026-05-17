// Web Audio API + Wake Lock — defer AudioContext creation until play() (browser autoplay policy)

const DEFAULT_TRACK = '/assets/music/ambient-paulyudin.mp3';

let audioCtx = null;
let source = null;
let gainNode = null;
let wakeLock = null;
let buffer = null;
let _volume = 0.4;
let _muted = false;
let _playing = false;

export async function loadTrack(url = DEFAULT_TRACK) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const tempCtx = new AudioContext();
  buffer = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();
}

export async function play() {
  if (_playing) return;
  if (!buffer) await loadTrack();

  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = _muted ? 0 : _volume;
  gainNode.connect(audioCtx.destination);

  source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gainNode);
  source.start();

  _playing = true;
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

export function stop() {
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  if (source) { try { source.stop(); } catch (_) {} source = null; }
  if (gainNode) { gainNode.disconnect(); gainNode = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  releaseWakeLock();
  _playing = false;
}

export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (gainNode && !_muted) gainNode.gain.value = _volume;
}

export function setMuted(muted) {
  _muted = muted;
  if (gainNode) gainNode.gain.value = _muted ? 0 : _volume;
}

export function isPlaying() { return _playing; }

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

async function _onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    if (audioCtx?.state === 'suspended') await audioCtx.resume();
    if (_playing && !wakeLock) await acquireWakeLock();
  }
}
