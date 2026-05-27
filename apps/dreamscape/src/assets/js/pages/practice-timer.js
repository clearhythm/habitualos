import { getUserId } from '../auth/auth.js';
import { initPresence, setPresenceState } from '../presence.js';
import { startSession, endSession, cancelSession, saveReflection } from '../sessions.js';
import { play, stop, setMuted, setVolume, acquireWakeLock, releaseWakeLock, playChime } from '../audio-engine.js';
import { getAudioPref, setAudioPref } from '../audio-unlock.js';
import { saveAbandonedIfPending } from '../collections/reflect-chats.js';
import { log } from '../utils/log.js';

// ─── Params — redirect back to setup if missing
const _params       = new URLSearchParams(window.location.search);
const _practice     = _params.get('practice') ?? '';
const _durationMins = parseInt(_params.get('duration'), 10);

if (!_practice || isNaN(_durationMins) || _durationMins <= 0) {
  log('debug', '[practice-timer] missing params, redirecting to setup');
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
let totalSeconds     = _durationMins * 60;
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
  stopBtn.hidden    = false;
  discardBtn.hidden = true;
}

function setPausedState() {
  iconPause.style.display = 'none';
  iconPlay.style.display  = '';
  pauseBtn.setAttribute('aria-label', 'Continue');
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
  stop();
  playChime();
  releaseWakeLock();
  completeLabel.hidden = false;
  timerEl.textContent  = fmt(totalSeconds);
  pauseBtn.hidden      = true;
  stopBtn.hidden       = true;
  discardBtn.hidden    = true;
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
  stop();
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
  stop();
  releaseWakeLock();
  window.location.href = '/practice/';
}

async function save() {
  saveBtn.disabled = true;
  await saveReflection(noteInput.value.trim());
  window.location.href = '/history/';
}

// ─── Ambient player (shared with homepage)
const muteBtn      = document.getElementById('ambient-mute-btn');
const volumeSlider = document.getElementById('ambient-volume');
const iconOn       = document.getElementById('icon-sound-on');
const iconOff      = document.getElementById('icon-sound-off');

let _isMuted = getAudioPref() === 'off';
let _volume  = parseFloat(localStorage.getItem('dp-volume') ?? '1');

function syncMuteBtn() {
  if (iconOn)  iconOn.style.display  = _isMuted ? 'none' : '';
  if (iconOff) iconOff.style.display = _isMuted ? '' : 'none';
  if (volumeSlider) volumeSlider.value = _isMuted ? 0 : _volume;
}

if (volumeSlider) {
  volumeSlider.value = _isMuted ? 0 : _volume;
  volumeSlider.addEventListener('input', () => {
    _volume = parseFloat(volumeSlider.value);
    localStorage.setItem('dp-volume', _volume);
    setVolume(_volume);
    if (_volume > 0 && _isMuted) {
      _isMuted = false;
      setAudioPref('on');
      setMuted(false);
      syncMuteBtn();
    }
  });
}

if (muteBtn) {
  syncMuteBtn();
  muteBtn.addEventListener('click', () => {
    _isMuted = !_isMuted;
    _volume = _isMuted ? 0 : 1;
    setAudioPref(_isMuted ? 'off' : 'on');
    setMuted(_isMuted);
    setVolume(_volume);
    if (volumeSlider) volumeSlider.value = _volume;
    syncMuteBtn();
  });
}

// ─── Button handlers
pauseBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopSession);
discardBtn.addEventListener('click', discardSession);
saveBtn.addEventListener('click', save);

// ─── Begin immediately
labelEl.textContent = _practice;
timerEl.textContent = fmt(totalSeconds);
setRunningState();
showTimer();
tick();

startSession(_practice);
play();
acquireWakeLock();
log('debug', '[practice-timer] started', _practice, _durationMins, 'mins');
