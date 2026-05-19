// ─── Time-of-day sky gradient
const SKY_PALETTE = [
  { h:  0, top: '#050310', bot: '#0a0617' },
  { h:  4, top: '#080514', bot: '#0e0a1f' },
  { h:  5, top: '#0d0c1a', bot: '#1a1040' },
  { h:  6, top: '#1a1040', bot: '#3d1c3a' },
  { h:  7, top: '#2d1b50', bot: '#c8604a' },
  { h:  8, top: '#1a4a7a', bot: '#87aacc' },
  { h: 10, top: '#1a5a8a', bot: '#87cedc' },
  { h: 12, top: '#1255a0', bot: '#72c4eb' },
  { h: 16, top: '#1a5a8a', bot: '#87cedc' },
  { h: 18, top: '#2d3a6a', bot: '#e8904a' },
  { h: 19, top: '#2d1b50', bot: '#8b3040' },
  { h: 20, top: '#1a0b3a', bot: '#3d1b50' },
  { h: 22, top: '#050310', bot: '#0a0617' },
  { h: 24, top: '#050310', bot: '#0a0617' },
];

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function lerpHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0]+(rb[0]-ra[0])*t)},${Math.round(ra[1]+(rb[1]-ra[1])*t)},${Math.round(ra[2]+(rb[2]-ra[2])*t)})`;
}

function setSkyGradient() {
  const now  = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  let prev = SKY_PALETTE[0], next = SKY_PALETTE[1];
  for (let i = 0; i < SKY_PALETTE.length - 1; i++) {
    if (hour >= SKY_PALETTE[i].h && hour < SKY_PALETTE[i + 1].h) {
      prev = SKY_PALETTE[i]; next = SKY_PALETTE[i + 1]; break;
    }
  }
  const t = (hour - prev.h) / (next.h - prev.h);
  const scene = document.querySelector('.blossom-scene');
  if (scene) scene.style.background =
    `linear-gradient(to bottom, ${lerpHex(prev.top, next.top, t)}, ${lerpHex(prev.bot, next.bot, t)})`;
}


// ─── Wind chime audio — pitch-shifted signatures via Web Audio API
// Fetch starts immediately; AudioContext + decode happen on first gesture.
// Create context + decode buffer immediately — no gesture needed for this part.
// Gesture is only needed to call resume() on the suspended context.
import { getAudioPref, setAudioPref } from '../audio-unlock.js';
import { setMuted as setAmbientMuted, setVolume as setAmbientVolume } from '../audio-engine.js';

const PREF_KEY = 'dp-audio-pref';
let _audioCtx = null;
let _chimeBuffer = null;
let _currentSession = null;
let _muted = getAudioPref() === 'off';
let _volume = parseFloat(localStorage.getItem('dp-volume') ?? '1');

(async () => {
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer());
    _chimeBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) { console.warn('Chime audio init failed:', err); }
})();

let _loopStarted = false;
function startChimeLoop() {
  if (_loopStarted) return;
  _loopStarted = true;
  runChimeLoop();
}

document.addEventListener('audioReady', async (e) => {
  _muted = !e.detail.enabled;
  setAmbientMuted(_muted);
  setAmbientVolume(_volume);
  if (!_muted && _audioCtx) {
    if (_audioCtx.state === 'suspended') {
      try { await _audioCtx.resume(); } catch (_) {}
    }
    if (_audioCtx.state === 'running') {
      startChimeLoop();
    } else {
      wireGestureResume();
    }
  }
  syncMuteBtn();
});

function wireGestureResume() {
  async function handler() {
    if (!_audioCtx || !_chimeBuffer || _muted) return;
    if (_audioCtx.state === 'suspended') await _audioCtx.resume();
    startChimeLoop();
    ['click', 'touchstart', 'keydown'].forEach(e => document.removeEventListener(e, handler));
  }
  ['click', 'touchstart', 'keydown'].forEach(e =>
    document.addEventListener(e, handler, { passive: true })
  );
}

function syncMuteBtn() {
  const iconOn  = document.getElementById('icon-sound-on');
  const iconOff = document.getElementById('icon-sound-off');
  if (iconOn)  iconOn.style.display  = _muted ? 'none' : '';
  if (iconOff) iconOff.style.display = _muted ? '' : 'none';
}

// ─── Master volume + mute
const muteBtn    = document.getElementById('ambient-mute-btn');
const volumeSlider = document.getElementById('ambient-volume');

if (volumeSlider) {
  volumeSlider.value = _volume;
  volumeSlider.addEventListener('input', () => {
    _volume = parseFloat(volumeSlider.value);
    localStorage.setItem('dp-volume', _volume);
    setAmbientVolume(_volume);
  });
}

if (muteBtn) {
  syncMuteBtn();
  muteBtn.addEventListener('click', () => {
    _muted = !_muted;
    _volume = _muted ? 0 : 1;
    setAudioPref(_muted ? 'off' : 'on');
    setAmbientMuted(_muted);
    setAmbientVolume(_volume);
    if (volumeSlider) volumeSlider.value = _volume;
    syncMuteBtn();
  });
}

// ─── Mock sessions (replace with Firestore fetch later)
// Each user has a stored chime signature: 3 semitone offsets + a timing pattern.
// Most recent first — in production this comes pre-sorted from the query
const MOCK_SESSIONS = [
  { name: "Ro'i",  lastPracticed: '2 hours ago',    chime: { notes: [-7,  0,  4], timing: [0, 0.35, 0.70] } },
  { name: 'Yuki',  lastPracticed: 'this morning',   chime: { notes: [0,   5, 12], timing: [0, 0.18, 0.62] } },
  { name: 'Frank', lastPracticed: 'yesterday',       chime: { notes: [-12, 2,  9], timing: [0, 0.08, 0.24] } },
  { name: 'Sarah', lastPracticed: '3 days ago',      chime: { notes: [-5,  4,  7], timing: [0, 0.52, 0.74] } },
];

// ─── Play a chime signature — notes ring fully, group fades out at the end
// Returns the total audio duration in seconds so the loop can time itself.
function playSignature(sig) {
  if (_muted || !_chimeBuffer || !_audioCtx || _audioCtx.state !== 'running') return 0;
  const masterGain = _audioCtx.createGain();
  masterGain.connect(_audioCtx.destination);

  const now      = _audioCtx.currentTime;
  const maxDelay = Math.max(...sig.timing);
  const fadeAt   = now + maxDelay + 3.5;
  const fadeTime = 2.0;
  const peak     = 0.65 * _volume;
  masterGain.gain.setValueAtTime(peak, now);
  masterGain.gain.setValueAtTime(peak, fadeAt);
  masterGain.gain.exponentialRampToValueAtTime(0.001, fadeAt + fadeTime);

  sig.notes.forEach((semitones, i) => {
    const source = _audioCtx.createBufferSource();
    source.buffer = _chimeBuffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    source.connect(masterGain);
    source.start(now + sig.timing[i]);
  });

  return maxDelay + 3.5 + fadeTime; // total seconds from now
}

// ─── Main chime loop
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let _advanceResolve = null;
function advanceChime() {
  if (_advanceResolve) { _advanceResolve(); _advanceResolve = null; }
}
function waitOrAdvance(ms) {
  return new Promise(resolve => {
    _advanceResolve = resolve;
    setTimeout(() => { _advanceResolve = null; resolve(); }, ms);
  });
}

async function runChimeLoop() {
  const sessions = MOCK_SESSIONS; // replace with Firestore fetch later

  if (sessions.length === 0) {
    showFeedMessage('Silence', 'invites more support');
    setTimeout(() => document.getElementById('invite-pill').removeAttribute('hidden'), 800);
    return;
  }

  await waitOrAdvance(3000);

  for (const session of sessions) {
    _currentSession = session;
    showFeedMessage(session.name, `practiced ${session.lastPracticed}`);
    swingChime();
    playSignature(session.chime);
    await waitOrAdvance(10000);
  }
  _currentSession = null;

  showFeedMessage('You', 'are caught up now');
}

document.getElementById('wind-chime')?.addEventListener('click', () => {
  swingChime();
  advanceChime();
});

// ─── Wind chime sway
function swingChime() {
  const chime = document.getElementById('wind-chime');
  if (!chime) return;
  chime.classList.remove('chime-swaying');
  void chime.offsetWidth;
  chime.classList.add('chime-swaying');
  function onEnd(e) {
    if (e.animationName === 'chime-sway') {
      chime.classList.remove('chime-swaying');
      chime.removeEventListener('animationend', onEnd);
    }
  }
  chime.addEventListener('animationend', onEnd);
}

// ─── Feed message
const feedEl = document.getElementById('feed-message');

function showFeedMessage(name, subtitle) {
  feedEl.classList.remove('feed-visible');
  setTimeout(() => {
    feedEl.innerHTML = subtitle
      ? `<span class="feed-name">${name}</span><span class="feed-time">${subtitle}</span>`
      : `<span class="feed-name feed-name--quiet">${name}</span>`;
    feedEl.classList.add('feed-visible');
  }, 400);
}

// ─── Sun / moon orb color — celestial body on the horizon
const ORB_PALETTE = [
  { h:  0, color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },  // moon
  { h:  4, color: '#b0b8d0', glow: 'rgba(160,170,210,0.14)' },  // dim moon
  { h:  5, color: '#c8907a', glow: 'rgba(200,140,100,0.20)' },  // pre-dawn
  { h:  6, color: '#e07040', glow: 'rgba(224,112,64,0.32)' },   // dawn
  { h:  7, color: '#f09030', glow: 'rgba(240,144,48,0.38)' },   // sunrise
  { h:  8, color: '#f5b828', glow: 'rgba(245,184,40,0.34)' },   // morning
  { h: 10, color: '#f8d050', glow: 'rgba(248,208,80,0.30)' },   // bright sun
  { h: 12, color: '#fae468', glow: 'rgba(250,228,104,0.32)' },  // midday
  { h: 16, color: '#f5c030', glow: 'rgba(245,192,48,0.32)' },   // afternoon
  { h: 18, color: '#f08028', glow: 'rgba(240,128,40,0.38)' },   // golden hour
  { h: 19, color: '#d84820', glow: 'rgba(216,72,32,0.32)' },    // sunset
  { h: 20, color: '#903058', glow: 'rgba(144,48,88,0.24)' },    // dusk
  { h: 21, color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },  // moon rises
  { h: 24, color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },
];

function setOrbColor() {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  let prev = ORB_PALETTE[0], next = ORB_PALETTE[1];
  for (let i = 0; i < ORB_PALETTE.length - 1; i++) {
    if (hour >= ORB_PALETTE[i].h && hour < ORB_PALETTE[i + 1].h) {
      prev = ORB_PALETTE[i]; next = ORB_PALETTE[i + 1]; break;
    }
  }
  const t     = (hour - prev.h) / (next.h - prev.h);
  const color = lerpHex(prev.color, next.color, t);
  const orb   = document.querySelector('.practice-orb');
  if (orb) {
    orb.style.setProperty('--orb-color', color);
    orb.style.setProperty('--orb-glow', prev.glow);
  }
}

// ─── Init
setSkyGradient();
setOrbColor();
