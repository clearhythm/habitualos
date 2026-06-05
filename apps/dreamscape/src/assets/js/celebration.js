import { initAudio, getCtx, getGain } from './audio-engine.js';
import { SKY_COLORS, getDayPeriod } from './sky-palette.js';
import { lerpHex } from './sky-gradient.js';
import { log } from './utils/log.js';

const MOCK_WITNESSES = [{ name: 'Frank' }, { name: 'Sarah' }];

function isMockCelebration() {
  return new URLSearchParams(window.location.search).has('mockCelebration');
}

async function fetchWitnessedByStatus(userId) {
  if (isMockCelebration()) return MOCK_WITNESSES;
  try {
    const res   = await fetch(`/api/witness-queue-get?userId=${encodeURIComponent(userId)}`);
    const { queue } = await res.json();
    const entry = (queue || []).find(item => item.type === 'witnessed-by');
    return entry ? entry.witnesses : [];
  } catch { return []; }
}

async function markWitnessedSeen(userId) {
  try {
    await fetch('/api/witnessed-by-mark-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch {}
}

let _witnessedBuffer = null;
let _birdBuffer      = null;

async function loadAudio() {
  await initAudio();
  const ctx = getCtx();
  if (!ctx) return;
  const loads = [];
  if (!_witnessedBuffer) {
    loads.push(
      fetch('/assets/music/ambient/witnessed.mp3').then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { _witnessedBuffer = buf; })
    );
  }
  if (!_birdBuffer) {
    loads.push(
      fetch('/assets/music/effects/bird-chirp.mp3').then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { _birdBuffer = buf; })
    );
  }
  await Promise.all(loads);
}

function applySkyToView(el) {
  const params       = new URLSearchParams(window.location.search);
  const overrideHour = params.has('hour') ? parseFloat(params.get('hour')) : null;
  const { period, next, t } = getDayPeriod(overrideHour);
  const curr = SKY_COLORS[period];
  const nx   = SKY_COLORS[next];
  el.style.background = `linear-gradient(to bottom, ${lerpHex(curr.top, nx.top, t)}, ${lerpHex(curr.bot, nx.bot, t)})`;
}

function playStrings(ctx) {
  if (!_witnessedBuffer || ctx.state !== 'running') return null;
  const gain = ctx.createGain();
  gain.connect(getGain());
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.50, ctx.currentTime + 1.4);

  const maxOffset  = Math.max(0, _witnessedBuffer.duration - 13);
  const startOff   = Math.random() * maxOffset;
  const src = ctx.createBufferSource();
  src.buffer = _witnessedBuffer;
  src.connect(gain);
  src.start(0, startOff);
  log('debug', '[celebration] strings at offset', startOff.toFixed(1));
  return { gain, src };
}

function stopStrings(handle, ctx) {
  if (!handle || !ctx) return;
  const { gain, src } = handle;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 3);
  setTimeout(() => { try { src.stop(); gain.disconnect(); } catch (_) {} }, 3500);
}

function playBirdSounds(ctx) {
  if (!_birdBuffer || ctx.state !== 'running') return;
  // 5–8 chirps staggered over the cutscene — different pitches, different birds
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const delay     = i * (1.0 + Math.random() * 1.8);
    const semitones = (Math.random() - 0.5) * 10;
    const vol       = 0.30 + Math.random() * 0.20;

    const gain = ctx.createGain();
    gain.gain.value = vol;
    gain.connect(getGain());

    const src = ctx.createBufferSource();
    src.buffer = _birdBuffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    src.connect(gain);
    src.start(ctx.currentTime + delay);

    const fadeAt = ctx.currentTime + delay + 1.0;
    gain.gain.setValueAtTime(vol, fadeAt);
    gain.gain.linearRampToValueAtTime(0, fadeAt + 0.7);
    setTimeout(() => { try { gain.disconnect(); } catch (_) {} }, (delay + 2) * 1000);
  }
}

function showCelebrationNames(witnesses) {
  const container = document.getElementById('celebration-names');
  if (!container) return Promise.resolve();
  const cards = [
    { name: 'You', sub: 'were witnessed today' },
    ...witnesses.map(w => ({ name: w.name, sub: 'witnessed your practice' })),
  ];
  return new Promise(resolve => {
    let i = 0;
    function next() {
      if (i >= cards.length) { resolve(); return; }
      const { name, sub } = cards[i++];
      const card = document.createElement('div');
      card.className = 'celebration-card';
      card.innerHTML = `<span class="feed-name">${name}</span><span class="feed-time">${sub}</span>`;
      container.innerHTML = '';
      container.appendChild(card);
      void card.offsetWidth;
      card.classList.add('celebration-card--visible');
      card.addEventListener('animationend', () => setTimeout(next, 400), { once: true });
    }
    next();
  });
}

export async function runCelebration(userId) {
  const witnesses = await fetchWitnessedByStatus(userId);
  if (!witnesses.length) return;

  const view = document.getElementById('celebration-view');
  if (!view) return;

  await loadAudio();
  const ctx = getCtx();
  if (ctx?.state === 'suspended') { try { await ctx.resume(); } catch (_) {} }

  applySkyToView(view);
  view.classList.add('celebration-view--active');

  const glowEl = document.getElementById('celebration-glow');
  if (glowEl) {
    glowEl.classList.remove('celebration-glow--fade');
    void glowEl.offsetWidth;
    glowEl.classList.add('celebration-glow--active');
  }

  view.classList.add('birds-flying');

  let stringsHandle = null;
  if (ctx) {
    stringsHandle = playStrings(ctx);
    playBirdSounds(ctx);
  }

  await showCelebrationNames(witnesses);

  // Fade out overlay slowly — matches the 3s strings fade so birds linger with the music
  view.classList.add('celebration-view--fading');
  view.classList.remove('celebration-view--active');
  if (glowEl) {
    glowEl.classList.remove('celebration-glow--active');
    glowEl.classList.add('celebration-glow--fade');
  }
  if (ctx) stopStrings(stringsHandle, ctx);

  if (!isMockCelebration()) markWitnessedSeen(userId).catch(() => {});

  // Resolve mid-fade so the chime fires while the overlay is still dissolving
  await new Promise(resolve => setTimeout(resolve, 1500));
  log('debug', '[celebration] complete');
}
