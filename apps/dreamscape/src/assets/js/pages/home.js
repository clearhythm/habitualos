import { setSkyGradient, setOrbColor } from '../sky-gradient.js';
import { getDayPeriod, DAY_PERIODS } from '../sky-palette.js';
import { getAudioMuted, setAudioMuted, getAudioVolume, setAudioVolume } from '../audio-unlock.js';
import { initAudio, getCtx, getGain, getMuted, getVolume, setMuted, setVolume } from '../audio-engine.js';
import { initAmbientPlayer } from '../ambient-player.js';
import { log } from '../utils/log.js';
import { initScene, getStoredTier } from '../scene.js';
import { getUserId } from '../auth/auth.js';
import { fetchWitnessQueue, markWitnessed } from '../collections/witness-queue.js';
import { getUserProfile } from '../collections/users.js';
import { swingChime } from '../chime.js';

// ─── Audio init — shared context from audio-engine; fetch + decode buffers
let _chimeBuffer  = null;
let _birdBuffer   = null;
let _pendingChime = null;   // chime to play once audio is ready

(async () => {
  try {
    setMuted(getAudioMuted());
    setVolume(getAudioVolume());
    await initAudio();
    const ctx = getCtx();
    const [chimeAb, birdAb] = await Promise.all([
      fetch('/assets/music/effects/windchime.mp3').then(r => r.arrayBuffer()),
      fetch('/assets/music/effects/bird-chirp.mp3').then(r => r.arrayBuffer()),
    ]);
    _chimeBuffer = await ctx.decodeAudioData(chimeAb);
    _birdBuffer  = await ctx.decodeAudioData(birdAb);
    if (_pendingChime && ctx.state === 'running') {
      playChime(_pendingChime);
      _pendingChime = null;
    }
    log('debug', '[audio] buffers ready');
    if (ctx.state === 'suspended') wireGestureResume();
  } catch (err) { log('warn', '[audio] init failed:', err); }
})();

// ─── Chime signatures
const SELF_CHIME   = { notes: [0, 7, 12],  timing: [0, 0.25, 0.55] };
const SYSTEM_CHIME = { notes: [12, 16, 24], timing: [0, 0.2,  0.3]  };
let   _userChime      = null;

// ─── Queue — populated async at init from witness-queue.js (real or mock mode)

// ─── Page state
// 'idle' | 'just-practiced' | 'queue' | 'caught-up'
let _pageState      = 'idle';
let _currentSession = null;
let _queueList      = [];   // snapshot of unseen sessions, set at init
let _queueCursor    = 0;
let _queueTimer     = null;

// ─── DOM
const feedEl           = document.getElementById('feed-message');
const mainActionBtn    = document.getElementById('main-action-btn');
const celebrateBtn     = document.getElementById('celebrate-btn');
const reflectPill      = document.getElementById('reflect-pill');
const continueBtn      = document.getElementById('continue-btn');
const voiceChimeBtn    = document.getElementById('voice-chime-btn');
const practiceActionsEl = document.querySelector('.practice-actions');

function revealActions() { practiceActionsEl.style.visibility = ''; }

// ─── Action helpers — each hides everything then shows only what's needed

function showIdleActions() {
  mainActionBtn.className   = 'practice-pill';
  mainActionBtn.hidden      = false;
  mainActionBtn.href        = '/practice/';
  mainActionBtn.textContent = 'practice';
  continueBtn.className     = 'btn-quiet';
  continueBtn.hidden        = true;
  celebrateBtn.hidden       = true;
  reflectPill.hidden        = false;
  voiceChimeBtn.hidden      = true;
}

function showPracticedActions() {
  mainActionBtn.className   = 'practice-pill';
  mainActionBtn.hidden      = false;
  mainActionBtn.href        = '/history/';
  mainActionBtn.textContent = 'your story';
  celebrateBtn.hidden       = true;
  reflectPill.hidden        = false;
  continueBtn.hidden        = true;
  voiceChimeBtn.hidden      = true;
}

function showQueueActions() {
  mainActionBtn.hidden      = true;
  celebrateBtn.hidden       = false;
  celebrateBtn.classList.remove('btn-confirmed');
  celebrateBtn.textContent  = 'witness';
  reflectPill.hidden        = true;
  continueBtn.hidden        = true;
  voiceChimeBtn.hidden      = false;
}

function showCaughtUpActions() {
  mainActionBtn.className   = 'practice-pill';
  mainActionBtn.hidden      = false;
  mainActionBtn.href        = '/practice/';
  mainActionBtn.textContent = 'practice';
  celebrateBtn.hidden       = true;
  reflectPill.hidden        = false;
  continueBtn.hidden        = true;
  voiceChimeBtn.hidden      = true;
}

// ─── State transitions

function showSession(session) {
  _currentSession = session;
  _pageState      = 'queue';
  document.getElementById('wind-chime')?.classList.remove('chime-hint-pulse');
  if (_pulseSwayInterval) { clearInterval(_pulseSwayInterval); _pulseSwayInterval = null; }

  showFeedMessage(session.name, `practiced ${session.lastPracticedLabel ?? 'recently'}`);
  swingChime(windChimeEl);
  playChime(session.chime);
  showQueueActions();
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
  swingChime(windChimeEl);
  showFeedMessage('You', 'are all caught up');
  const sig = _userChime ?? SELF_CHIME;
  if (!playChime(sig)) _pendingChime = sig;
  showCaughtUpActions();
}

function showIdleState() {
  _pageState      = 'idle';
  _currentSession = null;
  clearTimeout(_queueTimer);
  applyIntroTagline();
  showIdleActions();
  updateChimePulse();
}

// ─── Chime pulse — dynamic, reflects unseen queue state
// Sway interval kept in sync with the 10s CSS ring animation

let _pulseSwayInterval = null;

function updateChimePulse() {
  const hasUnseen = _queueList.length > 0;
  // Pulse ring is only an idle-state invitation — never reactivates mid-queue
  const showPulse = hasUnseen && _pageState === 'idle';
  document.getElementById('wind-chime')?.classList.toggle('chime-hint-pulse', showPulse);

  if (showPulse && !_pulseSwayInterval) {
    swingChime(windChimeEl);
    _pulseSwayInterval = setInterval(() => swingChime(windChimeEl), 10000);
  } else if (!showPulse && _pulseSwayInterval) {
    clearInterval(_pulseSwayInterval);
    _pulseSwayInterval = null;
  }
}

// ─── Main click dispatch

function onChimeClick() {
  if (_pageState === 'caught-up')      { return; }
  if (_pageState === 'queue')          { advanceQueue(); return; }
  if (_pageState === 'just-practiced') { return; }

  // idle — start queue from beginning
  if (_queueList.length > 0) {
    _queueCursor = 0;
    showSession(_queueList[0]);
  } else {
    showCaughtUp();
  }
}

// ─── Wind chime click
document.getElementById('wind-chime')?.addEventListener('click', async () => {
  swingChime(windChimeEl);
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch (_) {} }
  onChimeClick();
});

// ─── Witness
celebrateBtn.addEventListener('click', () => {
  if (!_currentSession) return;

  celebrateBtn.classList.add('btn-confirmed');
  markWitnessed({ witnessId: getUserId(), practicerId: _currentSession.userId, practiceLogId: _currentSession.practiceLogId }).catch(() => {});
  playChimeEcho(_currentSession.chime);
  swingChime(windChimeEl);
  updateChimePulse();
  _queueTimer = setTimeout(advanceQueue, 2500);
});

// ─── Skip (queue advance)
voiceChimeBtn.addEventListener('click', advanceQueue);

// ─── Witness echo — plays the friend's own chime signature, lower register + longer decay
// Their notes, their voice — just heard more deeply
function playChimeEcho(sig) {
  const ctx = getCtx();
  if (!_chimeBuffer || !ctx || ctx.state !== 'running') return;
  log('debug', '[witness] playWitnessEcho');
  const gain = ctx.createGain();
  gain.connect(getGain());

  const now      = ctx.currentTime;
  const maxDelay = Math.max(...sig.timing);
  const peak     = 0.35;  // softer than a full signature; master gain handles user volume
  const sustainEnd = now + maxDelay + 5.5;
  const fadeTime   = 4.0;           // long tail — lingers behind the next session's chime

  gain.gain.setValueAtTime(peak, now);
  gain.gain.setValueAtTime(peak, sustainEnd);
  gain.gain.exponentialRampToValueAtTime(0.001, sustainEnd + fadeTime);

  sig.notes.forEach((semitones, i) => {
    const src = ctx.createBufferSource();
    src.buffer = _chimeBuffer;
    // Octave up — same notes, lighter overtone shimmer
    src.playbackRate.value = Math.pow(2, (semitones + 12) / 12);
    src.connect(gain);
    src.start(now + sig.timing[i]);
  });

  const totalMs = (maxDelay + 5.5 + fadeTime + 0.2) * 1000;
  setTimeout(() => gain.disconnect(), totalMs);
}

// ─── Scene sounds — bird chirp with pitch variation to simulate different birds
// Uses same _audioCtx + _masterGain as chime engine
// TODO Tour-Scene-Sounds-Ticket1: swap _birdBuffer for time-of-day file selection
function playSceneSound(type) {
  const ctx = getCtx();
  if (!_birdBuffer || !ctx || ctx.state !== 'running') return;
  log('debug', '[scene] playSceneSound:', type);

  // 1–3 chirps, randomised timing + slight pitch shift per hit = different bird feel
  const count = Math.floor(Math.random() * 3) + 1;
  const gain  = ctx.createGain();
  gain.gain.value = 0.55;
  gain.connect(getGain());

  let offset = 0;
  for (let i = 0; i < count; i++) {
    const src = ctx.createBufferSource();
    src.buffer = _birdBuffer;
    // ±6 semitones of pitch variation — distinct birds, not mechanical repeats
    const semitones = (Math.random() - 0.5) * 12;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(gain);
    src.start(ctx.currentTime + offset);
    offset += 0.15 + Math.random() * 0.25; // 150–400ms between chirps
  }

  // Fade gain out after chirps finish
  const fadeAt = ctx.currentTime + offset + 1.5;
  gain.gain.setValueAtTime(0.55, fadeAt);
  gain.gain.linearRampToValueAtTime(0, fadeAt + 0.8);
  setTimeout(() => gain.disconnect(), (offset + 2.5) * 1000);
}

// ─── Play a chime signature
function playChime(sig) {
  const ctx = getCtx();
  if (!_chimeBuffer || !ctx || ctx.state !== 'running') return 0;
  const sigGain = ctx.createGain();
  sigGain.connect(getGain());

  const now      = ctx.currentTime;
  const maxDelay = Math.max(...sig.timing);
  const fadeAt   = now + maxDelay + 3.5;
  const fadeTime = 2.0;
  const peak     = 0.65;
  sigGain.gain.setValueAtTime(peak, now);
  sigGain.gain.setValueAtTime(peak, fadeAt);
  sigGain.gain.exponentialRampToValueAtTime(0.001, fadeAt + fadeTime);

  sig.notes.forEach((semitones, i) => {
    const src = ctx.createBufferSource();
    src.buffer = _chimeBuffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(sigGain);
    src.start(now + sig.timing[i]);
  });

  const totalMs = (maxDelay + 3.5 + fadeTime + 0.1) * 1000;
  setTimeout(() => sigGain.disconnect(), totalMs);
  return maxDelay + 3.5 + fadeTime;
}

const windChimeEl = document.getElementById('wind-chime');

// ─── Feed message
function showFeedMessage(name, subtitle, { immediate = false } = {}) {
  const html = subtitle
    ? `<span class="feed-name">${name}</span><span class="feed-time">${subtitle}</span>`
    : `<span class="feed-name feed-name--quiet">${name}</span>`;
  if (immediate) {
    feedEl.innerHTML = html;
    feedEl.classList.add('feed-visible');
    return;
  }
  feedEl.classList.remove('feed-visible');
  setTimeout(() => {
    feedEl.innerHTML = html;
    // RAF ensures new content is committed before the fade-in transition starts;
    // without it Safari composites the old painted layer with new innerHTML mid-transition.
    requestAnimationFrame(() => feedEl.classList.add('feed-visible'));
  }, 420);
}

// ─── Intro tagline — alternates visit-to-visit (idle state)
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

// ─── Practice return messages — celebration state, rotates each return
const PRACTICE_RETURN_MESSAGES = [
  { name: 'You',  sub: 'completed your practice' },
  { name: 'You',   sub: 'completed your practice' },
];

function applyPracticeReturnMessage() {
  const raw  = localStorage.getItem('dp-practice-msg-index');
  const idx  = parseInt(raw ?? '0', 10);
  const next = (idx + 1) % PRACTICE_RETURN_MESSAGES.length;
  localStorage.setItem('dp-practice-msg-index', String(next));
  return PRACTICE_RETURN_MESSAGES[idx];
}

// ─── Nav pause / resume (nav open shouldn't change page state — just suppress display updates)
let _navOpen = false;
document.addEventListener('nav:open',  () => { _navOpen = true; });
document.addEventListener('nav:close', () => { _navOpen = false; });

// ─── Ambient player controls
initAmbientPlayer({
  isMuted:        getMuted,
  getVolume:      getVolume,
  onVolumeChange: (vol) => {
    setVolume(vol);
    setAudioVolume(vol);
  },
  onMuteChange: (muted) => {
    setMuted(muted);
    setAudioMuted(muted);
    if (!muted) setVolume(getAudioVolume());
  },
});


function wireGestureResume() {
  async function handler() {
    const ctx = getCtx();
    const wasSuspended = ctx && ctx.state === 'suspended';
    if (wasSuspended) { try { await ctx.resume(); } catch (_) {} }
    if (wasSuspended && _pendingChime) { playChime(_pendingChime); _pendingChime = null; }
    ['click', 'touchstart', 'keydown'].forEach(ev => document.removeEventListener(ev, handler));
  }
  ['click', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, handler, { passive: true })
  );
}

function refreshSky() {
  const period = getDayPeriod(_overrideHour);
  setSkyGradient(period);
  setOrbColor(period);
}

// ─── Tab refocus — update sky gradient always; reset post-practice state after 10 min
let _hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    _hiddenAt = Date.now();
  } else {
    refreshSky();
    if (_hiddenAt && _pageState === 'just-practiced' && Date.now() - _hiddenAt > 10 * 60 * 1000) {
      showIdleState();
    }
    _hiddenAt = null;
  }
});

// ─── Dev API — exposed only on localhost for the dev toolbar
if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.__dpDev = { setSkyGradient, setOrbColor, getDayPeriod, initScene, getStoredTier, dayPeriods: DAY_PERIODS };
}

// ─── Init — runs synchronously on module load (DOM is ready, JS deferred)

// Dev override params — ?hour=14.5 for time-of-day, ?tier=3 to preview a scene tier,
// ?tier=3&new=1 to also trigger the animate-in for that tier
const _devParams    = new URLSearchParams(window.location.search);

// Intro tagline first (empty spans in HTML avoid FOUC)
applyIntroTagline();
showIdleActions();

// Home state — set by practice timer on navigate home
{
  const homeState       = localStorage.getItem('dp-home-state');
  const mockCelebration = _devParams.has('mockCelebration');
  if (homeState === 'just-practiced' || mockCelebration) {
    if (homeState) localStorage.removeItem('dp-home-state');
    _pageState = 'just-practiced';
    // Set final message now (under the overlay during cutscene, revealed after)
    const msg    = applyPracticeReturnMessage();
    const nameEl = feedEl.querySelector('.feed-name');
    const timeEl = feedEl.querySelector('.feed-time');
    if (nameEl) nameEl.textContent = msg.name;
    if (timeEl) timeEl.textContent = msg.sub;
    showPracticedActions();
    // Hide feed so it can fade in properly after the cutscene dissolves
    feedEl.style.opacity = '0';
    // Lazy-load celebration module — plays cutscene (if witnessed), then resolves
    import('../celebration.js').then(({ runCelebration }) => runCelebration(getUserId()))
      .then(() => {
        const sig = _userChime ?? SELF_CHIME;
        swingChime(windChimeEl);
        if (!playChime(sig)) _pendingChime = sig;
        // Fade feed in quickly as the overlay finishes dissolving
        feedEl.style.transition = 'opacity 0.2s ease';
        requestAnimationFrame(() => {
          feedEl.style.opacity = '';
          setTimeout(() => { feedEl.style.transition = ''; }, 300);
        });
      })
      .catch(() => {
        const sig = _userChime ?? SELF_CHIME;
        swingChime(windChimeEl);
        if (!playChime(sig)) _pendingChime = sig;
        feedEl.style.transition = '';
        feedEl.style.opacity = '';
      });
  }
}

revealActions();
const _overrideHour = _devParams.has('hour')   ? parseFloat(_devParams.get('hour'))   : null;
const _tierParam    = _devParams.has('tier')    ? parseInt(_devParams.get('tier'),  10) : null;
const _stonesParam  = _devParams.has('stones')  ? parseInt(_devParams.get('stones'), 10) : null;
const _animateIn    = _devParams.has('new');

refreshSky();

{
  let _sceneTier   = _tierParam  ?? getStoredTier();
  let _stoneLevel  = _stonesParam ?? 0;
  const _preview   = _tierParam !== null && !_animateIn;
  if (_tierParam !== null && _animateIn) {
    localStorage.setItem('dp-scene-tier', String(Math.max(0, _sceneTier - 1)));
  }
  initScene({ tier: _sceneTier, stoneLevel: _stoneLevel, overrideHour: _overrideHour, preview: _preview });
}

fetchWitnessQueue(getUserId()).then(queue => {
  _queueList = queue.filter(item => item.type !== 'witnessed-by');
  updateChimePulse();
}).catch(() => {});

getUserProfile().then(p => {
  _userChime = p.chime || null;
  updateChimePulse();
  if (_pageState === 'caught-up') {
    const sig = _userChime ?? SELF_CHIME;
    if (!playChime(sig)) _pendingChime = sig;
  }
}).catch(() => {});

