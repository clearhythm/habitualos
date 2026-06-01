import { getUserId } from '../auth/auth.js';
import { initPresence, setPresenceState } from '../presence.js';
import { startSession, endSession, cancelSession, saveReflection } from '../sessions.js';
import { setMuted, setVolume, acquireWakeLock, releaseWakeLock, playChime } from '../audio-engine.js';
import { getAudioMuted, setAudioMuted, getAudioVolume, setAudioVolume } from '../audio-unlock.js';
import { loadSettings } from '../practice-settings.js';
import { initAmbientPlayer } from '../ambient-player.js';
import { saveAbandonedIfPending } from '../collections/reflect-chats.js';
import { log } from '../utils/log.js';

export function startTimer(practiceName, durationSecs, { onDiscard, source } = {}) {
  const settings     = loadSettings();
  const audioEnabled = userRequestedAudio();

  // ─── DOM
  const timerModal   = document.getElementById('timer-modal');
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
  let totalSeconds     = durationSecs;
  let remainingSeconds = totalSeconds;
  let isPaused         = false;

  // ─── Helpers
  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function showTimerView() {
    timerView.hidden = false;
    noteView.hidden  = true;
  }

  function showNoteView() {
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

  function onComplete() {
    if (settings.bellEnd && audioEnabled) playChime();
    releaseWakeLock();
    pauseBtn.hidden      = true;
    stopBtn.hidden       = true;
    discardBtn.hidden    = true;
    completeLabel.hidden = false;
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
    showNoteView();
  }

  function discardSession() {
    clearInterval(timerInterval);
    timerInterval = null;
    cancelSession();
    releaseWakeLock();
    timerModal.hidden = true;
    onDiscard?.();
  }

  async function save() {
    saveBtn.disabled = true;
    await saveReflection(noteInput.value.trim());
    localStorage.setItem('dp-home-state', 'just-practiced');
    window.location.href = '/';
  }

  // ─── Ambient player
  let _isMuted = getAudioMuted();
  let _volume  = getAudioVolume();

  initAmbientPlayer({
    isMuted:        () => _isMuted,
    getVolume:      () => _volume,
    onVolumeChange: (vol) => {
      _volume = vol;
      setAudioVolume(vol);
      setVolume(vol);
    },
    onMuteChange: (muted) => {
      _isMuted = muted;
      setAudioMuted(muted);
      if (!muted) _volume = getAudioVolume();
      setMuted(muted);
      setVolume(muted ? 0 : _volume);
    },
  });

  // ─── Button handlers
  pauseBtn.addEventListener('click', togglePause);
  stopBtn.addEventListener('click', stopSession);
  discardBtn.addEventListener('click', discardSession);
  saveBtn.addEventListener('click', save);

  document.getElementById('skip-btn')?.addEventListener('click', () => {
    localStorage.setItem('dp-home-state', 'just-practiced');
  });

  // ─── Begin
  timerModal.hidden   = false;
  labelEl.textContent = practiceName;
  timerEl.textContent = fmt(totalSeconds);
  setRunningState();
  showTimerView();
  tick();

  initPresence();
  startSession(practiceName);
  acquireWakeLock();
  if (settings.bellStart && audioEnabled) playChime();
  log('debug', '[practice-timer] started', practiceName, durationSecs, 'secs', 'source=', source);
}
