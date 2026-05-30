import { log } from '../utils/log.js';
import { loadSettings, saveSettings } from '../practice-settings.js';
import { ensureAudioUnlocked } from '../audio-unlock.js';

// ─── DOM
const nameInput      = document.getElementById('practice-name');
const startBtn       = document.getElementById('start-btn');
const durationValue  = document.getElementById('duration-value');
const bellStartValue = document.getElementById('bell-start-value');
const bellEndValue   = document.getElementById('bell-end-value');
const friendChimesVal = document.getElementById('friend-chimes-value');
const settingsRows   = document.querySelector('.settings-rows');

// ─── Duration — cycles through presets (minutes)
const DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60, 120];

function fmtDuration(mins) {
  if (mins >= 60) return `${mins / 60}h`;
  return `${mins}m`;
}

// ─── Load persisted settings, populate DOM, then reveal rows (no flicker)
const settings = loadSettings();
let durationIndex = DURATIONS.indexOf(settings.durationMins);
if (durationIndex === -1) durationIndex = 1; // fallback to 5m

durationValue.textContent  = fmtDuration(DURATIONS[durationIndex]);
bellStartValue.textContent = settings.bellStart ? 'on' : 'off';
bellEndValue.textContent   = settings.bellEnd   ? 'on' : 'off';
friendChimesVal.textContent = settings.friendChimes ? 'on' : 'off';
settingsRows.style.visibility = '';

// ─── Duration toggle
document.getElementById('settings-duration').addEventListener('click', () => {
  durationIndex = (durationIndex + 1) % DURATIONS.length;
  durationValue.textContent = fmtDuration(DURATIONS[durationIndex]);
  saveSettings({ durationMins: DURATIONS[durationIndex] });
});

// ─── Bell / chime toggles
function toggleValue(el) {
  el.textContent = el.textContent === 'on' ? 'off' : 'on';
}

document.getElementById('settings-bell-start').addEventListener('click', () => {
  toggleValue(bellStartValue);
  saveSettings({ bellStart: bellStartValue.textContent === 'on' });
});
document.getElementById('settings-bell-end').addEventListener('click', () => {
  toggleValue(bellEndValue);
  saveSettings({ bellEnd: bellEndValue.textContent === 'on' });
});
document.getElementById('settings-friend-chimes').addEventListener('click', () => {
  toggleValue(friendChimesVal);
  saveSettings({ friendChimes: friendChimesVal.textContent === 'on' });
});

document.querySelectorAll('.example-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    nameInput.value = tag.textContent;
    nameInput.focus();
  });
});

// ─── Pre-fill practice name from URL (e.g. from nav shortcut)
const _params   = new URLSearchParams(window.location.search);
const _practice = _params.get('practice');
if (_practice) nameInput.value = _practice;

// ─── Begin — unlock audio if needed, then navigate to timer
startBtn.addEventListener('click', async () => {
  const practice    = nameInput.value.trim();
  const durationSecs = DURATIONS[durationIndex] * 60;
  const current = loadSettings();
  if (current.bellStart || current.bellEnd || current.friendChimes) {
    await ensureAudioUnlocked();
  }
  const url = `/practice/timer/?practice=${encodeURIComponent(practice)}&duration=${durationSecs}`;
  log('debug', '[practice] navigating to timer', url);
  window.location.href = url;
});
