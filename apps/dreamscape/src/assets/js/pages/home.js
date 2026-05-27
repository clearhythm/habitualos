import { setSkyGradient, lerpHex } from '../sky-gradient.js';
import { getAudioPref, setAudioPref } from '../audio-unlock.js';
import { setMuted as setAmbientMuted, setVolume as setAmbientVolume } from '../audio-engine.js';
import { log } from '../utils/log.js';

// ─── Audio init — fetch + decode buffers immediately; resume on gesture
let _audioCtx    = null;
let _masterGain  = null;
let _chimeBuffer = null;
let _birdBuffer  = null;
let _pendingChime = null;   // chime to play once audio is ready
let _muted  = getAudioPref() === 'off';
let _volume = parseFloat(localStorage.getItem('dp-volume') ?? '1');

(async () => {
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = _muted ? 0 : _volume;
    _masterGain.connect(_audioCtx.destination);
    const [chimeAb, birdAb] = await Promise.all([
      fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer()),
      fetch('/assets/music/effects/bird-chirp.mp3').then(r => r.arrayBuffer()),
    ]);
    _chimeBuffer = await _audioCtx.decodeAudioData(chimeAb);
    _birdBuffer  = await _audioCtx.decodeAudioData(birdAb);
    // Play any chime that was queued before the buffer loaded
    if (_pendingChime && !_muted && _audioCtx.state === 'running') {
      playSignature(_pendingChime);
      _pendingChime = null;
    }
    log('debug', '[audio] buffers ready');
  } catch (err) { log('warn', '[audio] init failed:', err); }
})();

// ─── Chime signatures
const SELF_CHIME      = { notes: [0, 7, 12],  timing: [0, 0.25, 0.55] };
const CAUGHT_UP_CHIME = { notes: [9, 16, 12], timing: [0, 0.2,  0.3]  };

// ─── Queue — each entry is a friend's most recent un-acted-upon practice
// id field used to track celebrate actions in localStorage
// TODO: replace QUEUE_SESSIONS with Firestore fetch (most recent practice per friend, unseen only)
const QUEUE_SESSIONS = [
  { id: 'roi-001',   name: "Ro'i",  lastPracticed: '2 hours ago',  chime: { notes: [-7,  0,  4], timing: [0, 0.35, 0.70] } },
  { id: 'yuki-001',  name: 'Yuki',  lastPracticed: 'this morning', chime: { notes: [0,   5, 12], timing: [0, 0.18, 0.62] } },
  { id: 'frank-001', name: 'Frank', lastPracticed: 'yesterday',    chime: { notes: [-12, 2,  9], timing: [0, 0.08, 0.24] } },
  { id: 'sarah-001', name: 'Sarah', lastPracticed: '3 days ago',   chime: { notes: [-5,  4,  7], timing: [0, 0.52, 0.74] } },
];

function getActedOn()   { try { return new Set(JSON.parse(localStorage.getItem('dp-acted-on') ?? '[]')); } catch { return new Set(); } }
function markActedOn(id){ const s = getActedOn(); s.add(id); localStorage.setItem('dp-acted-on', JSON.stringify([...s])); }
function getUnseenQueue(){ const acted = getActedOn(); return QUEUE_SESSIONS.filter(s => !acted.has(s.id)); }

// ─── Tour slides
const TOUR_SLIDES = [
  { name: 'Practice', sub: 'your friends see it',  action: { text: 'practice', href: '/practice/' } },
  { name: 'Witness',    sub: 'and share voice chimes',   action: { text: 'invite',   href: '/invite/'   } },
  { name: 'Reflect',  sub: 'and get personal support',   action: { text: 'reflect',  href: '/reflect/'  } },
];
const QUEUE_MS   = 8000;  // auto-advance queue after 8s of inaction
const TOUR_MS    = 8000;

// ─── Page state
// 'idle' | 'queue' | 'caught-up' | 'touring'
let _pageState      = 'idle';
let _currentSession = null;
let _queueList      = [];   // snapshot of unseen sessions, set at init
let _queueCursor    = 0;
let _queueTimer     = null;
let _tourIndex      = 0;
let _tourTimer      = null;

// ─── DOM
const feedEl        = document.getElementById('feed-message');
const mainActionBtn = document.getElementById('main-action-btn');
const celebrateBtn  = document.getElementById('celebrate-btn');
const reflectPill   = document.getElementById('reflect-pill');
const continueBtn   = document.getElementById('continue-btn');
const voiceChimeBtn = document.getElementById('voice-chime-btn');

// ─── Action helpers — each hides everything then shows only what's needed

function showIdleActions() {
  mainActionBtn.hidden  = false;
  mainActionBtn.href    = '/practice/';
  mainActionBtn.textContent = 'practice';
  celebrateBtn.hidden   = true;
  reflectPill.hidden    = false;
  continueBtn.hidden    = true;
  voiceChimeBtn.hidden  = true;
}

function showPracticedActions() {
  mainActionBtn.hidden  = false;
  mainActionBtn.href    = '/history/';
  mainActionBtn.textContent = 'more ago';
  celebrateBtn.hidden   = true;
  reflectPill.hidden    = false;
  continueBtn.hidden    = true;
  voiceChimeBtn.hidden  = true;
}

function showQueueActions() {
  mainActionBtn.hidden  = true;
  celebrateBtn.hidden   = false;
  celebrateBtn.classList.remove('btn-received');
  reflectPill.hidden    = true;
  continueBtn.hidden    = true;
  voiceChimeBtn.hidden  = false;
}

function showCaughtUpActions() {
  mainActionBtn.hidden  = false;
  mainActionBtn.href    = '/practice/';
  mainActionBtn.textContent = 'practice';
  celebrateBtn.hidden   = true;
  reflectPill.hidden    = false;
  continueBtn.hidden    = true;
  voiceChimeBtn.hidden  = true;
}

function showTourActions(slide) {
  mainActionBtn.hidden  = false;
  mainActionBtn.href    = slide.action.href;
  mainActionBtn.textContent = slide.action.text;
  celebrateBtn.hidden   = true;
  reflectPill.hidden    = true;
  continueBtn.hidden    = false;
  voiceChimeBtn.hidden  = true;
}

// ─── State transitions

function showSession(session) {
  _currentSession = session;
  _pageState      = 'queue';
  // Stop pulse ring once user is actively in the queue — invitation fulfilled
  document.getElementById('wind-chime')?.classList.remove('chime-hint-pulse');
  if (_pulseSwayInterval) { clearInterval(_pulseSwayInterval); _pulseSwayInterval = null; }
  showFeedMessage(session.name, `practiced ${session.lastPracticed}`);
  swingChime();
  playSignature(session.chime);
  showQueueActions();
  clearTimeout(_queueTimer);
  _queueTimer = setTimeout(advanceQueue, QUEUE_MS);
}

function advanceQueue() {
  clearTimeout(_queueTimer);
  _queueCursor++;
  if (_queueCursor >= _queueList.length) { showCaughtUp(); return; }
  showSession(_queueList[_queueCursor]);
}

function showCaughtUp() {
  _pageState      = 'caught-up';
  _currentSession = null;
  clearTimeout(_queueTimer);
  swingChime();
  showFeedMessage('You', 'are all caught up');
  playSignature(CAUGHT_UP_CHIME);
  showCaughtUpActions();
}

function showIdleState() {
  _pageState      = 'idle';
  _currentSession = null;
  clearTimeout(_tourTimer);
  clearTimeout(_queueTimer);
  applyIntroTagline();
  showIdleActions();
}

function startTour() {
  _pageState  = 'touring';
  _tourIndex  = 0;
  showTourSlide();
}

function showTourSlide() {
  clearTimeout(_tourTimer);
  const slide = TOUR_SLIDES[_tourIndex];
  showFeedMessage(slide.name, slide.sub);
  swingChime();
  playSignature(CAUGHT_UP_CHIME); // stub — Tour-Scene-Sounds-Ticket1 replaces with playSceneSound()
  showTourActions(slide);
  _tourTimer = setTimeout(advanceTour, TOUR_MS);
}

function advanceTour() {
  clearTimeout(_tourTimer);
  _tourIndex++;
  if (_tourIndex >= TOUR_SLIDES.length) {
    swingChime();
    playSignature(CAUGHT_UP_CHIME);
    showIdleState();
    return;
  }
  showTourSlide();
}

// ─── Chime pulse — dynamic, reflects unseen queue state
// Sway interval kept in sync with the 10s CSS ring animation

let _pulseSwayInterval = null;

function updateChimePulse() {
  const hasUnseen = getUnseenQueue().length > 0;
  // Pulse ring is only an idle-state invitation — never reactivates mid-queue
  const showPulse = hasUnseen && _pageState === 'idle';
  document.getElementById('wind-chime')?.classList.toggle('chime-hint-pulse', showPulse);

  if (showPulse && !_pulseSwayInterval) {
    swingChime();
    _pulseSwayInterval = setInterval(swingChime, 10000);
  } else if (!showPulse && _pulseSwayInterval) {
    clearInterval(_pulseSwayInterval);
    _pulseSwayInterval = null;
  }
}

// ─── Main click dispatch

function onChimeClick() {
  if (_pageState === 'touring')   { advanceTour();  return; }
  if (_pageState === 'caught-up') { startTour();    return; }
  if (_pageState === 'queue')     { advanceQueue(); return; }

  // idle or just-practiced — start queue from beginning
  if (_queueList.length > 0) {
    _queueCursor = 0;
    showSession(_queueList[0]);
  } else {
    // No unseen queue — play self chime then caught-up
    // Skip if _pendingChime is set (just-practiced landing already queued it)
    if (!_pendingChime) playSignature(SELF_CHIME);
    showCaughtUp();
  }
}

// ─── Wind chime click
document.getElementById('wind-chime')?.addEventListener('click', () => {
  swingChime();
  onChimeClick();
});

// ─── Witness
celebrateBtn.addEventListener('click', () => {
  if (!_currentSession) return;
  celebrateBtn.classList.add('btn-received');
  markActedOn(_currentSession.id);
  playSceneSound('bird-call');
  updateChimePulse();
  clearTimeout(_queueTimer);
  setTimeout(() => { advanceQueue(); }, 1400);
});

// ─── Continue (tour advance)
continueBtn.addEventListener('click', advanceTour);

// ─── Scene sounds — bird chirp with pitch variation to simulate different birds
// Uses same _audioCtx + _masterGain as chime engine
// TODO Tour-Scene-Sounds-Ticket1: swap _birdBuffer for time-of-day file selection
function playSceneSound(type) {
  if (_muted || !_birdBuffer || !_audioCtx || _audioCtx.state !== 'running') return;
  log('debug', '[scene] playSceneSound:', type);

  // 1–3 chirps, randomised timing + slight pitch shift per hit = different bird feel
  const count = Math.floor(Math.random() * 3) + 1;
  const gain  = _audioCtx.createGain();
  gain.gain.value = 0.55 * _volume;
  gain.connect(_masterGain);

  let offset = 0;
  for (let i = 0; i < count; i++) {
    const src = _audioCtx.createBufferSource();
    src.buffer = _birdBuffer;
    // ±6 semitones of pitch variation — distinct birds, not mechanical repeats
    const semitones = (Math.random() - 0.5) * 12;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(gain);
    src.start(_audioCtx.currentTime + offset);
    offset += 0.15 + Math.random() * 0.25; // 150–400ms between chirps
  }

  // Fade gain out after chirps finish
  const fadeAt = _audioCtx.currentTime + offset + 1.5;
  gain.gain.setValueAtTime(0.55 * _volume, fadeAt);
  gain.gain.linearRampToValueAtTime(0, fadeAt + 0.8);
  setTimeout(() => gain.disconnect(), (offset + 2.5) * 1000);
}

// ─── Play a chime signature
function playSignature(sig) {
  if (_muted || !_chimeBuffer || !_audioCtx || _audioCtx.state !== 'running') return 0;
  const masterGain = _audioCtx.createGain();
  masterGain.connect(_masterGain ?? _audioCtx.destination);

  const now      = _audioCtx.currentTime;
  const maxDelay = Math.max(...sig.timing);
  const fadeAt   = now + maxDelay + 3.5;
  const fadeTime = 2.0;
  const peak     = 0.65 * _volume;
  masterGain.gain.setValueAtTime(peak, now);
  masterGain.gain.setValueAtTime(peak, fadeAt);
  masterGain.gain.exponentialRampToValueAtTime(0.001, fadeAt + fadeTime);

  sig.notes.forEach((semitones, i) => {
    const src = _audioCtx.createBufferSource();
    src.buffer = _chimeBuffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(masterGain);
    src.start(now + sig.timing[i]);
  });

  const totalMs = (maxDelay + 3.5 + fadeTime + 0.1) * 1000;
  setTimeout(() => masterGain.disconnect(), totalMs);
  return maxDelay + 3.5 + fadeTime;
}

// ─── Wind chime sway
let _swayEndCb = null;
function swingChime() {
  const chime = document.querySelector('#wind-chime .wind-chime');
  if (!chime) return;
  if (_swayEndCb) { chime.removeEventListener('animationend', _swayEndCb); _swayEndCb = null; }
  chime.classList.remove('chime-swaying');
  void window.getComputedStyle(chime).animationName;
  chime.classList.add('chime-swaying');
  _swayEndCb = (e) => {
    if (e.animationName === 'chime-sway') {
      chime.classList.remove('chime-swaying');
      chime.removeEventListener('animationend', _swayEndCb);
      _swayEndCb = null;
    }
  };
  chime.addEventListener('animationend', _swayEndCb);
}

// ─── Feed message
function showFeedMessage(name, subtitle) {
  feedEl.classList.remove('feed-visible');
  setTimeout(() => {
    feedEl.innerHTML = subtitle
      ? `<span class="feed-name">${name}</span><span class="feed-time">${subtitle}</span>`
      : `<span class="feed-name feed-name--quiet">${name}</span>`;
    feedEl.classList.add('feed-visible');
  }, 400);
}

// ─── Intro tagline — alternates visit-to-visit
const TAGLINES = [
  { name: 'Practice', sub: 'is only the beginning' },
  { name: 'Presence', sub: 'is the gift of you being here' },
];

function applyIntroTagline() {
  const raw  = localStorage.getItem('dp-tagline-index');
  const idx  = parseInt(raw ?? '0', 10);
  const next = (idx + 1) % TAGLINES.length;
  localStorage.setItem('dp-tagline-index', String(next));
  const t      = TAGLINES[idx];
  const nameEl = feedEl.querySelector('.feed-name');
  const timeEl = feedEl.querySelector('.feed-time');
  if (nameEl) nameEl.textContent = t.name;
  if (timeEl) timeEl.textContent = t.sub;
}

// ─── Nav pause / resume (nav open shouldn't change page state — just suppress display updates)
let _navOpen = false;
document.addEventListener('nav:open',  () => { _navOpen = true; });
document.addEventListener('nav:close', () => { _navOpen = false; });

// ─── Master volume + mute controls
const muteBtn      = document.getElementById('ambient-mute-btn');
const volumeSlider = document.getElementById('ambient-volume');

function syncMuteBtn() {
  const iconOn  = document.getElementById('icon-sound-on');
  const iconOff = document.getElementById('icon-sound-off');
  if (iconOn)  iconOn.style.display  = _muted ? 'none' : '';
  if (iconOff) iconOff.style.display = _muted ? '' : 'none';
  if (volumeSlider) volumeSlider.value = _muted ? 0 : _volume;
}

if (volumeSlider) {
  volumeSlider.value = _volume;
  volumeSlider.addEventListener('input', () => {
    _volume = parseFloat(volumeSlider.value);
    localStorage.setItem('dp-volume', _volume);
    setAmbientVolume(_volume);
    if (_masterGain && !_muted) _masterGain.gain.value = _volume;
  });
}

if (muteBtn) {
  syncMuteBtn();
  muteBtn.addEventListener('click', () => {
    _muted  = !_muted;
    _volume = _muted ? 0 : 1;
    setAudioPref(_muted ? 'off' : 'on');
    setAmbientMuted(_muted);
    setAmbientVolume(_volume);
    if (_masterGain) _masterGain.gain.value = _muted ? 0 : _volume;
    if (volumeSlider) volumeSlider.value = _volume;
    syncMuteBtn();
  });
}

// ─── audioReady — fired by audio-unlock.js after pref is determined
document.addEventListener('audioReady', async (e) => {
  log('debug', '[chime] audioReady, enabled=', e.detail.enabled, 'ctx state=', _audioCtx?.state);
  _muted = !e.detail.enabled;
  setAmbientMuted(_muted);
  setAmbientVolume(_volume);

  if (!_muted && _audioCtx && _audioCtx.state === 'suspended') {
    try { await _audioCtx.resume(); } catch (_) {}
    log('debug', '[chime] after resume, ctx state=', _audioCtx?.state);
    if (_audioCtx.state === 'suspended') wireGestureResume();
  }

  // Play pending chime (e.g. SELF_CHIME from just-practiced) — only if buffer is ready
  if (_pendingChime && !_muted && _audioCtx?.state === 'running' && _chimeBuffer) {
    playSignature(_pendingChime);
    _pendingChime = null;
  }

  updateChimePulse();
  syncMuteBtn();
});

function wireGestureResume() {
  async function handler() {
    const wasSuspended = _audioCtx && _audioCtx.state === 'suspended';
    if (wasSuspended) { try { await _audioCtx.resume(); } catch (_) {} }
    if (wasSuspended && !_muted) {
      const chime = _pendingChime ?? null;
      if (chime) { playSignature(chime); _pendingChime = null; }
    }
    ['click', 'touchstart', 'keydown'].forEach(ev => document.removeEventListener(ev, handler));
  }
  ['click', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, handler, { passive: true })
  );
}

// ─── Sky + orb
const ORB_PALETTE = [
  { h:  0, color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },
  { h:  4, color: '#b0b8d0', glow: 'rgba(160,170,210,0.14)' },
  { h:  5, color: '#c8907a', glow: 'rgba(200,140,100,0.20)' },
  { h:  6, color: '#e07040', glow: 'rgba(224,112,64,0.32)'  },
  { h:  7, color: '#f09030', glow: 'rgba(240,144,48,0.38)'  },
  { h:  8, color: '#f5b828', glow: 'rgba(245,184,40,0.34)'  },
  { h: 10, color: '#f8d050', glow: 'rgba(248,208,80,0.30)'  },
  { h: 12, color: '#fae468', glow: 'rgba(250,228,104,0.32)' },
  { h: 16, color: '#f5c030', glow: 'rgba(245,192,48,0.32)'  },
  { h: 18, color: '#f08028', glow: 'rgba(240,128,40,0.38)'  },
  { h: 19, color: '#d84820', glow: 'rgba(216,72,32,0.32)'   },
  { h: 20, color: '#903058', glow: 'rgba(144,48,88,0.24)'   },
  { h: 21, color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },
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
    orb.style.setProperty('--orb-glow',  prev.glow);
  }
}

// ─── Cleanup
window.addEventListener('beforeunload', () => _audioCtx?.close());

// ─── Init — runs synchronously on module load (DOM is ready, JS deferred)

// Intro tagline first (empty spans in HTML avoid FOUC)
applyIntroTagline();
showIdleActions();

// Home state — set by practice timer on navigate home
{
  const homeState = localStorage.getItem('dp-home-state');
  if (homeState) {
    localStorage.removeItem('dp-home-state');
    if (homeState === 'just-practiced') {
      const nameEl = feedEl.querySelector('.feed-name');
      const timeEl = feedEl.querySelector('.feed-time');
      if (nameEl) nameEl.textContent = 'You';
      if (timeEl) timeEl.textContent = 'practiced just now';
      showPracticedActions();
      _pendingChime = SELF_CHIME;
      swingChime();
    }
  }
}

// Welcome state — first-time / invite join
{
  const welcomeFrom = localStorage.getItem('dp-welcome-from');
  const firstVisit  = localStorage.getItem('dp-first-visit');
  localStorage.removeItem('dp-welcome-from');
  localStorage.removeItem('dp-first-visit');
  if (welcomeFrom || firstVisit) {
    const nameEl = feedEl.querySelector('.feed-name');
    const timeEl = feedEl.querySelector('.feed-time');
    if (nameEl) nameEl.textContent = 'Welcome';
    if (timeEl) timeEl.textContent = welcomeFrom
      ? `You are now connected to ${welcomeFrom}, for support in your practice.`
      : 'You can start a practice now, or reflect for help getting started.';
  }
}

setSkyGradient();
setOrbColor();
_queueList = getUnseenQueue(); // snapshot for this page visit
updateChimePulse(); // pulse on load if unseen queue items exist
