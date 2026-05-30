import { getUserId } from '../auth/auth.js';
import { initPresence, setPresenceState } from '../presence.js';
import { startSession, endSession, cancelSession, saveReflection } from '../sessions.js';
import { setMuted, setVolume, acquireWakeLock, releaseWakeLock, playChime } from '../audio-engine.js';
import { getAudioPref } from '../audio-unlock.js';
import { loadSettings } from '../practice-settings.js';
import { initAmbientPlayer } from '../ambient-player.js';
import { saveAbandonedIfPending } from '../collections/reflect-chats.js';
import { log } from '../utils/log.js';

// ─── Settings + audio state
const _settings     = loadSettings();
const _audioEnabled = getAudioPref() === 'on';

// ─── Params — redirect back to setup if missing
const _params       = new URLSearchParams(window.location.search);
const _practice     = _params.get('practice') ?? '';
const _durationSecs = parseInt(_params.get('duration'), 10);

if (isNaN(_durationSecs) || _durationSecs <= 0) {
  log('debug', '[practice-timer] missing duration, redirecting to setup');
  window.location.replace('/practice/');
}

// ─── DOM
const timerView    = document.getElementById('timer-view');
const noteView     = document.getElementById('note-view');
const timerEl      = document.getElementById('timer');
const labelEl      = document.getElementById('practice-label');
const noteInput    = document.getElementById('note-input');
const pauseBtn     = document.getElementById('pause-btn');
const iconPause    = document.getElementById('icon-pause');
const iconPlay     = document.getElementById('icon-play');
const stopBtn      = document.getElementById('stop-btn');
const discardBtn   = document.getElementById('discard-btn');
const completeLabel = document.getElementById('complete-label');
const saveBtn      = document.getElementById('save-btn');

let timerInterval    = null;
let totalSeconds     = _durationSecs;
let remainingSeconds = totalSeconds;
let isPaused         = false;

initPresence();

// ─── Helpers
function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function showTimer() {
  timerView.hidden = false;
  noteView.hidden  = true;
}

function showNote() {
  timerView.hidden = true;
  noteView.hidden  = false;
}

function setRunningState() {
  iconPause.style.display = '';
  iconPlay.style.display  = 'none';
  pauseBtn.setAttribute('aria-label', 'Pause');
  pauseBtn.setAttribute('data-tooltip', 'pause practice');
  stopBtn.hidden    = false;
  discardBtn.hidden = true;
}

function setPausedState() {
  iconPause.style.display = 'none';
  iconPlay.style.display  = '';
  pauseBtn.setAttribute('aria-label', 'Continue');
  pauseBtn.setAttribute('data-tooltip', 'continue practice');
  stopBtn.hidden    = true;
  discardBtn.hidden = false;
}

// ─── Timer
function tick() {
  timerInterval = setInterval(() => {
    remainingSeconds--;
    timerEl.textContent = fmt(remainingSeconds);
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onComplete();
    }
  }, 1000);
}

async function onComplete() {
  if (_settings.bellEnd && _audioEnabled) playChime();
  releaseWakeLock();
  pauseBtn.hidden      = true;
  stopBtn.hidden       = true;
  discardBtn.hidden    = true;
  completeLabel.hidden = false;
  // Auto-transition to note view after chime settles
  setTimeout(() => stopSession(), 2500);
}

function togglePause() {
  if (isPaused) {
    tick();
    setRunningState();
    isPaused = false;
    setPresenceState('practicing');
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
    setPausedState();
    isPaused = true;
    setPresenceState('witnessing');
  }
}

async function stopSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  const practiced = totalSeconds - remainingSeconds;
  await endSession(practiced);
  saveAbandonedIfPending(getUserId());
  releaseWakeLock();
  isPaused = false;
  completeLabel.hidden = true;
  pauseBtn.hidden = false;
  setRunningState();
  showNote();
}

function discardSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  cancelSession();
  releaseWakeLock();
  window.location.href = '/practice/';
}

async function save() {
  saveBtn.disabled = true;
  await saveReflection(noteInput.value.trim());
  localStorage.setItem('dp-home-state', 'just-practiced');
  window.location.href = '/';
}

// ─── Ambient player
let _isMuted = getAudioPref() === 'off';
let _volume  = parseFloat(localStorage.getItem('dp-volume') ?? '1');

initAmbientPlayer({
  isMuted:        () => _isMuted,
  getVolume:      () => _volume,
  onVolumeChange: (vol) => {
    _volume = vol;
    localStorage.setItem('dp-volume', vol);
    setVolume(vol);
  },
  onMuteChange: (muted) => {
    _isMuted = muted;
    _volume  = muted ? 0 : 1;
    setMuted(muted);
    setVolume(_volume);
  },
});

// ─── Button handlers
pauseBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopSession);
discardBtn.addEventListener('click', discardSession);
saveBtn.addEventListener('click', save);

// Skip — set home state so homepage shows "practiced just now"
document.getElementById('skip-btn')?.addEventListener('click', () => {
  localStorage.setItem('dp-home-state', 'just-practiced');
});

// ─── Begin immediately
labelEl.textContent = _practice;
timerEl.textContent = fmt(totalSeconds);
setRunningState();
showTimer();
tick();

startSession(_practice);
acquireWakeLock();
if (_settings.bellStart && _audioEnabled) playChime();
log('debug', '[practice-timer] started', _practice, _durationSecs, 'secs');
