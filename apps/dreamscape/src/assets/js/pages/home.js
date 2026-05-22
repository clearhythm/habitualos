import { setSkyGradient, lerpHex } from '../sky-gradient.js';

// ─── Wind chime audio — pitch-shifted signatures via Web Audio API
// Fetch starts immediately; AudioContext + decode happen on first gesture.
// Create context + decode buffer immediately — no gesture needed for this part.
// Gesture is only needed to call resume() on the suspended context.
import { getAudioPref, setAudioPref } from '../audio-unlock.js';
import { setMuted as setAmbientMuted, setVolume as setAmbientVolume } from '../audio-engine.js';
import { log } from '../utils/log.js';

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
  } catch (err) { log('warn', 'Chime audio init failed:', err); }
})();

let _loopStarted = false;
let _isWelcome   = false;
function startChimeLoop() {
  log('debug', '[chime] startChimeLoop called, _loopStarted=', _loopStarted);
  if (_loopStarted || _isWelcome) return;
  _loopStarted = true;
  runChimeLoop();
}

document.addEventListener('audioReady', async (e) => {
  log('debug', '[chime] audioReady fired, enabled=', e.detail.enabled, 'ctx state=', _audioCtx?.state);
  _muted = !e.detail.enabled;
  setAmbientMuted(_muted);
  setAmbientVolume(_volume);
  // Feed + swing don't need audio — start the loop regardless
  startChimeLoop();
  // Try to resume audio within this gesture context
  if (!_muted && _audioCtx && _audioCtx.state === 'suspended') {
    try { await _audioCtx.resume(); } catch (_) {}
    log('debug', '[chime] after resume attempt, ctx state=', _audioCtx?.state);
    if (_audioCtx.state === 'suspended') wireGestureResume();
  }
  syncMuteBtn();
});

function wireGestureResume() {
  async function handler() {
    const wasSuspended = _audioCtx && _audioCtx.state === 'suspended';
    if (wasSuspended) {
      try { await _audioCtx.resume(); } catch (_) {}
    }
    if (wasSuspended && _currentSession && !_muted && !document.body.classList.contains('sidemenu-open')) playSignature(_currentSession.chime);
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
// TODO: load from user profile
const SELF_CHIME = { notes: [0, 7, 12], timing: [0, 0.25, 0.55] };

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
let _advanceResolve = null;
let _navOpen        = false;

function advanceChime() {
  if (_advanceResolve) { _advanceResolve(); _advanceResolve = null; }
}

function pauseLoop() { _navOpen = true; }

function resumeLoop() {
  _navOpen = false;
  if (_currentSession) {
    showFeedMessage(_currentSession.name, `practiced ${_currentSession.lastPracticed}`);
    swingChime();
    playSignature(_currentSession.chime);
  }
}

function waitOrAdvance(ms) {
  return new Promise(resolve => {
    _advanceResolve = resolve;
    setTimeout(() => {
      if (_advanceResolve === resolve) _advanceResolve = null;
      resolve();
    }, ms);
  });
}

async function runChimeLoop() {
  log('debug', '[chime] runChimeLoop started');
  const sessions = MOCK_SESSIONS; // replace with Firestore fetch later

  if (sessions.length === 0) {
    showFeedMessage('Silence', 'invites more support');
    setTimeout(() => document.getElementById('invite-pill').removeAttribute('hidden'), 800);
    return;
  }

  await waitOrAdvance(3000);

  for (const session of sessions) {
    log('debug', '[chime] showing session:', session.name);
    _currentSession = session;
    if (!_navOpen) {
      showFeedMessage(session.name, `practiced ${session.lastPracticed}`);
      swingChime();
      playSignature(session.chime);
    }
    await waitOrAdvance(10000);
  }
  _currentSession = null;
  if (!_navOpen) {
    showFeedMessage('You', 'are caught up now');
    swingChime();
    playSignature(SELF_CHIME);
  }
}

document.getElementById('wind-chime')?.addEventListener('click', () => {
  swingChime();
  advanceChime();
});

// ─── Wind chime sway
let _swayEndCb = null;
function swingChime() {
  const chime = document.querySelector('#wind-chime .wind-chime');
  if (!chime) return;
  if (_swayEndCb) { chime.removeEventListener('animationend', _swayEndCb); _swayEndCb = null; }
  chime.classList.remove('chime-swaying');
  void window.getComputedStyle(chime).animationName; // force style flush
  chime.classList.add('chime-swaying');
  _swayEndCb = (e) => {
    log('debug', '[chime] animationend:', e.animationName);
    if (e.animationName === 'chime-sway') {
      chime.classList.remove('chime-swaying');
      chime.removeEventListener('animationend', _swayEndCb);
      _swayEndCb = null;
    }
  };
  chime.addEventListener('animationend', _swayEndCb);
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

document.addEventListener('nav:open',  pauseLoop);
document.addEventListener('nav:close', resumeLoop);

// ─── Welcome state (join / first-time signup)
{
  const welcomeFrom = localStorage.getItem('dp-welcome-from');
  const firstVisit  = localStorage.getItem('dp-first-visit');
  localStorage.removeItem('dp-welcome-from');
  localStorage.removeItem('dp-first-visit');

  if (welcomeFrom || firstVisit) {
    _isWelcome = true;
    const feedEl = document.getElementById('feed-message');
    if (feedEl) {
      const nameEl = feedEl.querySelector('.feed-name');
      const timeEl = feedEl.querySelector('.feed-time');
      if (nameEl) nameEl.textContent = 'Welcome';
      if (timeEl) timeEl.textContent = welcomeFrom
        ? `You are now connected to ${welcomeFrom}, for support in your practice.`
        : 'You can start a practice now, or reflect for help getting started.';
    }
  }
}

// ─── Init
setSkyGradient();
setOrbColor();
