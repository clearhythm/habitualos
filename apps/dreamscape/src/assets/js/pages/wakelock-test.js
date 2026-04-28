let audioCtx = null;
let sourceNode = null;
let gainNode = null;
let wakeLock = null;
let startTime = null;
let timerInterval = null;
let resumeCount = 0;
let decodedBuffer = null;

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
      log(`AudioContext resumed after visibility change (#${resumeCount})`);
    }
    if (audioCtx && (!wakeLock || wakeLock.released)) {
      await requestWakeLock();
    }
  } else {
    setStatus('ctx-status', audioCtx ? audioCtx.state : 'closed', 'warn');
    log('Page hidden — audio context may be suspended by browser');
  }
}

function updateTimer() {
  if (!startTime) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `${mins}:${secs}`;
  if (audioCtx) {
    const state = audioCtx.state;
    setStatus('ctx-status', state === 'running' ? 'Running' : `⚠ ${state}`, state === 'running' ? 'ok' : 'warn');
  }
}

// Load and decode a local audio file
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const label = document.getElementById('file-label');
  label.textContent = `Loading: ${file.name}…`;
  setStatus('audio-status', 'Decoding…', 'warn');

  // Need a temporary AudioContext just for decoding if none exists
  const tempCtx = audioCtx || new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    label.textContent = file.name;
    setStatus('audio-status', 'Ready', 'ok');
    document.getElementById('start-btn').disabled = false;
    log(`Loaded "${file.name}" — ${Math.round(decodedBuffer.duration)}s, ${decodedBuffer.numberOfChannels}ch`);
    if (!audioCtx) tempCtx.close();
  } catch (err) {
    label.textContent = 'Decode failed — try another file';
    setStatus('audio-status', 'Error', 'error');
    log(`Decode failed: ${err.message}`);
    if (!audioCtx) tempCtx.close();
  }
});

// Volume slider
document.getElementById('volume-slider').addEventListener('input', (e) => {
  if (gainNode) gainNode.gain.value = parseFloat(e.target.value);
  document.getElementById('volume-label').textContent = Math.round(e.target.value * 100) + '%';
});

async function startTest() {
  resumeCount = 0;
  document.getElementById('start-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = parseFloat(document.getElementById('volume-slider').value);
  gainNode.connect(audioCtx.destination);

  if (decodedBuffer) {
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = decodedBuffer;
    sourceNode.loop = true;
    sourceNode.connect(gainNode);
    sourceNode.start();
    setStatus('audio-status', 'Playing file', 'ok');
    log(`Playing audio file via AudioBufferSourceNode (looping)`);
  } else {
    // Fallback: oscillator
    sourceNode = audioCtx.createOscillator();
    sourceNode.type = 'sine';
    sourceNode.frequency.value = 432;
    sourceNode.connect(gainNode);
    sourceNode.start();
    setStatus('audio-status', 'Playing tone', 'ok');
    log('No file loaded — playing 432 Hz oscillator fallback');
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

  if (sourceNode) { try { sourceNode.stop(); } catch (_) {} sourceNode = null; }
  if (gainNode) { gainNode.disconnect(); gainNode = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  if (wakeLock && !wakeLock.released) { wakeLock.release(); wakeLock = null; }

  setStatus('ctx-status', 'Closed', 'idle');
  setStatus('audio-status', decodedBuffer ? 'Ready' : 'Idle', decodedBuffer ? 'ok' : 'idle');
  setStatus('wakelock-status', 'Released', 'idle');
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('start-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  log('Test stopped');
}

document.getElementById('start-btn').addEventListener('click', startTest);
document.getElementById('stop-btn').addEventListener('click', stopTest);

// Start disabled until a file is loaded (or fallback available via direct click)
document.getElementById('start-btn').disabled = false;
