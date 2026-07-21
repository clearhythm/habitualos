// Wires open/close for a modal given its trigger + the modal element.
// Close button and backdrop are scoped to that modal so multiple modals
// on the same page don't collide.
function wireModal(trigger, modal) {
  if (!trigger || !modal) return;
  const closeBtn = modal.querySelector('.modal__close');
  const backdrop = modal.querySelector('.modal__backdrop');
  const open = () => modal.classList.add('is-open');
  const close = () => modal.classList.remove('is-open');
  trigger.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
}

wireModal(document.querySelector('.confidence-badge'), document.getElementById('skill-tree-modal'));
wireModal(document.getElementById('how-it-works-trigger'), document.getElementById('how-it-works-modal'));

// Guided tour — spotlights one real element at a time with a short
// callout, rather than dumping all the explanation into a modal at once.
// No backdrop/dimming (keeps this simple and avoids fighting the existing
// fixed-position z-index layers) — just an outline on the target element
// plus a small tooltip near it. Runs on every page load — this is a demo
// Erik replays live, not a real first-run flow yet, so it should never go
// quiet on its own (no localStorage gating).
const tourSteps = [
  { selector: '.session-header', text: "This shows what you're practicing and your current confidence level." },
  { selector: '.transcript', text: 'Tico sets the scene, then plays each line as the scenario unfolds.' },
  { selector: '.talk-btn', text: 'Tap this now to respond as you normally would.' },
];

// Set by startTour() while the tour is active; the talk button's click
// handler calls this so tapping the mic always dismisses whatever tour
// step is showing, rather than leaving it lingering once real interaction
// starts.
let dismissTour = () => {};

function startTour() {
  document.body.classList.add('tour-open');
  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';
  document.body.appendChild(tooltip);

  let highlighted = null;

  function showStep(i) {
    highlighted?.classList.remove('tour-highlight');
    const step = tourSteps[i];
    const target = document.querySelector(step.selector);
    if (!target) { endTour(); return; }
    highlighted = target;
    target.classList.add('tour-highlight');

    const isLast = i === tourSteps.length - 1;
    tooltip.innerHTML = `
      <p class="tour-tooltip__text"></p>
      <div class="tour-tooltip__actions">
        <button class="tour-tooltip__skip" type="button">Skip</button>
        <button class="tour-tooltip__next" type="button"></button>
      </div>
    `;
    tooltip.querySelector('.tour-tooltip__text').textContent = step.text;
    tooltip.querySelector('.tour-tooltip__next').textContent = isLast ? 'Got it' : 'Next';
    tooltip.querySelector('.tour-tooltip__skip').addEventListener('click', endTour);
    tooltip.querySelector('.tour-tooltip__next').addEventListener('click', () => {
      if (isLast) endTour(); else showStep(i + 1);
    });

    const rect = target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 160) {
      tooltip.style.top = `${rect.bottom + 12}px`;
      tooltip.style.bottom = 'auto';
    } else {
      tooltip.style.top = 'auto';
      tooltip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
    }
    tooltip.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 296))}px`;
  }

  function endTour() {
    highlighted?.classList.remove('tour-highlight');
    tooltip.remove();
    document.body.classList.remove('tour-open');
    dismissTour = () => {};
  }

  dismissTour = endTour;
  showStep(0);
}

setTimeout(startTour, 500);

// Scripted demo — matches the real interaction model: only the user's own
// turns need an explicit tap. Guest and Tico lines auto-advance on their
// own after a short pause (simulating audio playback / an API round-trip),
// exactly as they would in the real product. The talk button only enables
// when it's actually the user's turn, and the label text says which state
// it's in so it's clear what's happening at any given moment.
const transcript = document.querySelector('.transcript');
const talkBtn = document.querySelector('.talk-btn');
const talkLabel = document.querySelector('.talk-bar__label');

const AUTO_DELAY_MS = 900;
const PROCESSING_DELAY_MS = 1800; // longer, deliberate pause — reads as real STT/AI processing, not instant

// Most Greet interactions are host-initiated (the host asks a guiding
// question) rather than the guest speaking first — so the demo opens with
// the user's turn already active, not a guest line playing first.
//
// It's either a coaching break OR an in-character response, never both —
// a good attempt is acknowledged simply by the guest responding naturally
// and the scene continuing; there's no separate "nice job" aside stacked
// on top when nothing needs correcting.
const turns = [
  { speaker: 'user', text: 'Hi there! Welcome in — how many in your group today?', auto: false },
  { speaker: 'guest', text: 'Table for two please. Do you have anything outside?', auto: true },
  { speaker: 'user', text: "We've got a nice patio — right this way.", auto: false },
];
let turnIndex = 0;

function appendLine(turn) {
  const line = document.createElement('p');
  line.className = `transcript-line transcript-line--${turn.speaker}`;
  line.textContent = turn.text;
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

const STATE_LABELS = {
  waiting: 'Tap to talk',
  recording: 'Tap when done',
  processing: 'One moment…',
  // No label during guest/Tico playback — "Listening…" read as the app
  // listening to the user, which is backwards; the button is simply
  // inert here (disabled), the transcript itself carries what's happening.
  listening: '',
  done: 'Scenario complete',
};

// The button is only ever clickable in 'waiting' (start) and 'recording'
// (stop) — that's the actual answer to "how does the app know you're
// done": you tell it, with a second tap, not automatic silence detection.
let currentState = null;

function setState(state) {
  currentState = state;
  if (!talkBtn) return;
  talkBtn.disabled = state !== 'waiting' && state !== 'recording';
  talkBtn.classList.toggle('is-processing', state === 'processing');
  talkBtn.classList.toggle('is-recording', state === 'recording');
  if (talkLabel) talkLabel.textContent = STATE_LABELS[state];
}

// Reveals turns[turnIndex] onward: auto turns play themselves with a pause
// between each; stops and enables the button as soon as a non-auto
// (user) turn is next.
function playAutoTurns() {
  if (turnIndex >= turns.length) { setState('done'); return; }
  const next = turns[turnIndex];
  if (!next.auto) { setState('waiting'); return; }
  setState('listening');
  setTimeout(() => {
    appendLine(next);
    turnIndex++;
    playAutoTurns();
  }, AUTO_DELAY_MS);
}

talkBtn?.addEventListener('click', () => {
  dismissTour();
  if (talkBtn.disabled) return;

  if (currentState === 'waiting') {
    setState('recording');
    return;
  }

  // currentState === 'recording' — the user just tapped to signal they're done.
  setState('processing');
  setTimeout(() => {
    appendLine(turns[turnIndex]);
    turnIndex++;
    playAutoTurns();
  }, PROCESSING_DELAY_MS);
});

playAutoTurns();
