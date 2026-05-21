import { log } from './utils/log.js';

let _audioCtx    = null;
let _chimeBuffer = null;

export async function initChimeAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer());
    _chimeBuffer = await _audioCtx.decodeAudioData(buf);
  } catch (err) { log('warn', '[chime] audio init failed:', err); }
}

export function playChime(sig) {
  if (!_chimeBuffer || !_audioCtx) return;
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  const master = _audioCtx.createGain();
  master.connect(_audioCtx.destination);
  const now   = _audioCtx.currentTime;
  const maxT  = Math.max(...sig.timing);
  const fadeAt = now + maxT + 3.5;
  master.gain.setValueAtTime(0.7, now);
  master.gain.setValueAtTime(0.7, fadeAt);
  master.gain.exponentialRampToValueAtTime(0.001, fadeAt + 2);
  sig.notes.forEach((semitones, i) => {
    const src = _audioCtx.createBufferSource();
    src.buffer = _chimeBuffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(master);
    src.start(now + sig.timing[i]);
  });
}

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14];

export function generateChime() {
  const pool = [...PENTATONIC];
  const notes = [];
  while (notes.length < 3) {
    const i = Math.floor(Math.random() * pool.length);
    notes.push(pool.splice(i, 1)[0]);
  }
  if (Math.random() > 0.5) notes[0] -= 12;
  const t2 = 0.15 + Math.random() * 0.2;
  const t3 = t2 + 0.25 + Math.random() * 0.3;
  return { notes, timing: [0, parseFloat(t2.toFixed(2)), parseFloat(t3.toFixed(2))] };
}

export function swingChime(wrapEl) {
  const svg = wrapEl?.querySelector('.wind-chime');
  if (!svg) return;
  svg.classList.remove('chime-swaying');
  void window.getComputedStyle(svg).animationName;
  svg.classList.add('chime-swaying');
  svg.addEventListener('animationend', (e) => {
    if (e.animationName === 'chime-sway') svg.classList.remove('chime-swaying');
  }, { once: true });
}
