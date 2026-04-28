let audioCtx = null;
let musicSource = null;
let voiceSource = null;
let musicGain = null;
let voiceGain = null;
let wakeLock = null;
let startTime = null;
let timerInterval = null;
let resumeCount = 0;
let musicBuffer = null;
let voiceBuffer = null;

const STATUS = {
  ok: 'status-ok',
  warn: 'status-warn',
  error: 'status-error',
  idle: 'status-idle',
};

function setStatus(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `status-badge ${STATUS[type]}`;
}

function log(msg) {
  const el = document.getElementById('event-log');
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `${time} — ${msg}`;
  el.prepend(line);
}

async function decodeFile(file) {
  const tempCtx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();
  return buffer;
}

async function loadTrack(inputId, labelId, statusId, bufferSetter, name) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const label = document.getElementById(labelId);
  label.textContent = `Loading…`;
  setStatus(statusId, 'Decoding…', 'warn');
  try {
    const buffer = await decodeFile(file);
    bufferSetter(buffer);
    label.textContent = file.name;
    setStatus(statusId, `Ready — ${Math.round(buffer.duration)}s`, 'ok');
    log(`${name} loaded: "${file.name}" (${Math.round(buffer.duration)}s)`);
    updateStartButton();
  } catch (err) {
    label.textContent = 'Failed';
    setStatus(statusId, 'Decode error', 'error');
    log(`${name} decode failed: ${err.message}`);
  }
}

function updateStartButton() {
  document.getElementById('start-btn').disabled = !musicBuffer && !voiceBuffer;
}

document.getElementById('music-input').addEventListener('change', () =>
  loadTrack('music-input', 'music-label', 'music-track-status', (b) => { musicBuffer = b; }, 'Music'));

document.getElementById('voice-input').addEventListener('change', () =>
  loadTrack('voice-input', 'voice-label', 'voice-track-status', (b) => { voiceBuffer = b; }, 'Voice'));

document.getElementById('music-vol').addEventListener('input', (e) => {
  if (musicGain) musicGain.gain.value = parseFloat(e.target.value);
  document.getElementById('music-vol-label').textContent = Math.round(e.target.value * 100) + '%';
});

document.getElementById('voice-vol').addEventListener('input', (e) => {
  if (voiceGain) voiceGain.gain.value = parseFloat(e.target.value);
  document.getElementById('voice-vol-label').textContent = Math.round(e.target.value * 100) + '%';
});

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    setStatus('wakelock-status', 'Not supported', 'warn');
    log('Wake Lock API not available on this browser/device');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    setStatus('wakelock-status', 'Active', 'ok');
    log('Wake Lock acquired');
    wakeLock.addEventListener('release', () => {
      setStatus('wakelock-status', 'Released', 'warn');
      log('Wake Lock released by system');
    });
  } catch (err) {
    setStatus('wakelock-status', 'Failed', 'error');
    log(`Wake Lock failed: ${err.message}`);
  }
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume();
      resumeCount++;
      setStatus('ctx-status', 'Running (resumed)', 'ok');
      setStatus('resume-count', String(resumeCount), 'warn');
      log(`AudioContext resumed (#${resumeCount})`);
    }
    if (audioCtx && (!wakeLock || wakeLock.released)) {
      await requestWakeLock();
    }
  } else {
    if (audioCtx) setStatus('ctx-status', audioCtx.state, 'warn');
    log('Page hidden');
  }
}

function updateTimer() {
  if (!startTime) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `${mins}:${secs}`;
  if (audioCtx) {
    const s = audioCtx.state;
    setStatus('ctx-status', s === 'running' ? 'Running' : `⚠ ${s}`, s === 'running' ? 'ok' : 'warn');
  }
}

async function startTest() {
  resumeCount = 0;
  document.getElementById('start-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  if (musicBuffer) {
    musicGain = audioCtx.createGain();
    musicGain.gain.value = parseFloat(document.getElementById('music-vol').value);
    musicGain.connect(audioCtx.destination);
    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start();
    log('Music track started (looping)');
  }

  if (voiceBuffer) {
    voiceGain = audioCtx.createGain();
    voiceGain.gain.value = parseFloat(document.getElementById('voice-vol').value);
    voiceGain.connect(audioCtx.destination);
    voiceSource = audioCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    voiceSource.loop = false;
    voiceSource.connect(voiceGain);
    voiceSource.start();
    log('Voice track started');
  }

  setStatus('ctx-status', 'Running', 'ok');
  setStatus('resume-count', '0', 'ok');

  await requestWakeLock();

  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopTest() {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearInterval(timerInterval);
  timerInterval = null;
  startTime = null;

  [musicSource, voiceSource].forEach(s => { if (s) { try { s.stop(); } catch (_) {} } });
  musicSource = voiceSource = null;
  [musicGain, voiceGain].forEach(g => { if (g) g.disconnect(); });
  musicGain = voiceGain = null;
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  if (wakeLock && !wakeLock.released) { wakeLock.release(); wakeLock = null; }

  setStatus('ctx-status', 'Closed', 'idle');
  setStatus('wakelock-status', 'Released', 'idle');
  setStatus('resume-count', '—', 'idle');
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('start-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  log('Test stopped');
}

document.getElementById('start-btn').addEventListener('click', startTest);
document.getElementById('stop-btn').addEventListener('click', stopTest);

updateStartButton();
