import { initPresence, startSession, endSession, cancelSession, saveReflection, setPresenceState } from '../presence.js';
import { play, stop, setMuted, acquireWakeLock, releaseWakeLock, playChime } from '../audio-engine.js';

const modal          = document.getElementById('timer-modal');
const timerView      = document.getElementById('timer-view');
const noteView       = document.getElementById('note-view');
const timerEl        = document.getElementById('timer');
const labelEl        = document.getElementById('practice-label');
const nameInput      = document.getElementById('practice-name');
const customDuration = document.getElementById('custom-duration');
const noteInput      = document.getElementById('note-input');
const startBtn       = document.getElementById('start-btn');
const pauseBtn       = document.getElementById('pause-btn');
const stopBtn        = document.getElementById('stop-btn');
const discardBtn     = document.getElementById('discard-btn');
const finishControls  = document.getElementById('finish-controls');
const completeLabel   = document.getElementById('complete-label');
const soundToggle     = document.getElementById('sound-toggle');
const saveBtn         = document.getElementById('save-btn');

let timerInterval    = null;
let totalSeconds     = 5 * 60;
let remainingSeconds = totalSeconds;
let isPaused         = false;

initPresence();

document.querySelectorAll('.duration-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    customDuration.value = '';
    totalSeconds = parseInt(btn.dataset.minutes) * 60;
  });
});

customDuration.addEventListener('input', () => {
  const val = parseInt(customDuration.value);
  if (val > 0) {
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    totalSeconds = val * 60;
  }
});

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function openModal() {
  modal.hidden = false;
  timerView.hidden = false;
  noteView.hidden = true;
}

function showNote() {
  timerView.hidden = true;
  noteView.hidden = false;
}

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

function begin() {
  const practiceType = nameInput.value.trim();
  remainingSeconds = totalSeconds;

  labelEl.textContent = practiceType;
  timerEl.textContent = fmt(remainingSeconds);
  pauseBtn.hidden = false;
  pauseBtn.textContent = '⏸';
  finishControls.hidden = true;
  openModal();
  tick();

  // Fire async work without blocking the UI
  startSession(practiceType);
  play();
  acquireWakeLock();
}

async function onComplete() {
  stop();
  playChime();
  releaseWakeLock();

  completeLabel.hidden = false;
  timerEl.textContent = fmt(totalSeconds);
  pauseBtn.hidden = true;
  stopBtn.textContent = 'Continue';
  finishControls.hidden = false;
}

function togglePause() {
  if (isPaused) {
    tick();
    pauseBtn.textContent = '⏸';
    finishControls.hidden = true;
    isPaused = false;
    setPresenceState('practicing');
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
    pauseBtn.textContent = '▶';
    finishControls.hidden = false;
    isPaused = true;
    setPresenceState('witnessing');
  }
}

async function stopSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  const practiced = totalSeconds - remainingSeconds;
  await endSession(null, practiced);
  stop();
  releaseWakeLock();
  isPaused = false;
  completeLabel.hidden = true;
  finishControls.hidden = true;
  stopBtn.textContent = 'Finish';
  pauseBtn.hidden = false;
  pauseBtn.textContent = '⏸';
  showNote();
}

function discardSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  cancelSession();
  stop();
  releaseWakeLock();
  isPaused = false;
  completeLabel.hidden = true;
  finishControls.hidden = true;
  stopBtn.textContent = 'Finish';
  pauseBtn.hidden = false;
  pauseBtn.textContent = '⏸';
  modal.hidden = true;
}

async function save() {
  saveBtn.disabled = true;
  await saveReflection(noteInput.value.trim());
  window.location.href = '/';
}

let _isMuted = false;
soundToggle.addEventListener('click', () => {
  _isMuted = !_isMuted;
  setMuted(_isMuted);
  soundToggle.textContent = _isMuted ? '🔇' : '🔊';
});

startBtn.addEventListener('click', begin);
pauseBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopSession);
discardBtn.addEventListener('click', discardSession);
saveBtn.addEventListener('click', save);
