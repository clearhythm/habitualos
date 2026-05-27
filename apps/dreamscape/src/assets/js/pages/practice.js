import { log } from '../utils/log.js';

// ─── DOM
const nameInput      = document.getElementById('practice-name');
const startBtn       = document.getElementById('start-btn');
const durationValue  = document.getElementById('duration-value');
const bellStartValue = document.getElementById('bell-start-value');
const bellEndValue   = document.getElementById('bell-end-value');
const friendChimesVal = document.getElementById('friend-chimes-value');

// ─── Duration — cycles through presets (minutes)
const DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60, 120];
let durationIndex = DURATIONS.indexOf(5);

function fmtDuration(mins) {
  if (mins >= 60) return `${mins / 60}h`;
  return `${mins}m`;
}

durationValue.textContent = fmtDuration(DURATIONS[durationIndex]);

document.getElementById('settings-duration').addEventListener('click', () => {
  durationIndex = (durationIndex + 1) % DURATIONS.length;
  durationValue.textContent = fmtDuration(DURATIONS[durationIndex]);
});

function toggleValue(el) {
  el.textContent = el.textContent === 'on' ? 'off' : 'on';
}

document.getElementById('settings-bell-start').addEventListener('click', () => toggleValue(bellStartValue));
document.getElementById('settings-bell-end').addEventListener('click', () => toggleValue(bellEndValue));
document.getElementById('settings-friend-chimes').addEventListener('click', () => toggleValue(friendChimesVal));

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

// ─── Begin — navigate to timer with params
startBtn.addEventListener('click', () => {
  const practice    = nameInput.value.trim();
  const durationSecs = DURATIONS[durationIndex] * 60;
  const url = `/practice/timer/?practice=${encodeURIComponent(practice)}&duration=${durationSecs}`;
  log('debug', '[practice] navigating to timer', url);
  window.location.href = url;
});
