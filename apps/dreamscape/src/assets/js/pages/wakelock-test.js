let audioCtx = null;
let oscillator = null;
let gainNode = null;
let wakeLock = null;
let startTime = null;
let timerInterval = null;
let resumeCount = 0;

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
    setStatus('wakelock-status', `Failed`, 'error');
    log(`Wake Lock failed: ${err.message}`);
  }
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Resume AudioContext if browser suspended it
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume();
      resumeCount++;
      setStatus('ctx-status', 'Running (resumed)', 'ok');
      setStatus('resume-count', String(resumeCount), resumeCount > 0 ? 'warn' : 'ok');
      log(`AudioContext resumed after visibility change (#${resumeCount})`);
    }
    // Re-acquire Wake Lock — it's released when tab goes hidden
    if (audioCtx && (!wakeLock || wakeLock.released)) {
      await requestWakeLock();
    }
  } else {
    setStatus('ctx-status', audioCtx ? `${audioCtx.state}` : 'closed', 'warn');
    log('Page hidden — audio context may be suspended by browser');
  }
}

function updateTimer() {
  if (!startTime) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `${mins}:${secs}`;

  // Also poll AudioContext state live
  if (audioCtx) {
    const state = audioCtx.state;
    setStatus('ctx-status', state === 'running' ? 'Running' : `⚠ ${state}`, state === 'running' ? 'ok' : 'warn');
  }
}

async function startTest() {
  resumeCount = 0;
  document.getElementById('start-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  // Create AudioContext
  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  // Oscillator at 432Hz — gentle sine tone
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 432;
  gainNode.gain.value = 0.25;
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();

  setStatus('ctx-status', 'Running', 'ok');
  setStatus('audio-status', 'Playing', 'ok');
  setStatus('resume-count', '0', 'ok');
  log('AudioContext started — oscillator at 432 Hz');

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

  if (oscillator) { try { oscillator.stop(); } catch (_) {} oscillator = null; }
  if (gainNode) { gainNode.disconnect(); gainNode = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  if (wakeLock && !wakeLock.released) { wakeLock.release(); wakeLock = null; }

  setStatus('ctx-status', 'Closed', 'idle');
  setStatus('audio-status', 'Stopped', 'idle');
  setStatus('wakelock-status', 'Released', 'idle');
  document.getElementById('timer').textContent = '00:00';
  log('Test stopped');

  document.getElementById('start-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
}

document.getElementById('start-btn').addEventListener('click', startTest);
document.getElementById('stop-btn').addEventListener('click', stopTest);
