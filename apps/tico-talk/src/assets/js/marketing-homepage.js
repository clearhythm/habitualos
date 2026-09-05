import { initTicoTalkPlayer } from './utils/tico-talk-player.js';

initTicoTalkPlayer();

// Rotating word in the homepage hero — "Make every [guest/visit/
// ticket]" above the fixed "Count." Each word gestures at a different
// facet of the same mission (guest = experience, visit = the occasion
// as a whole, ticket = the revenue Insights tracks) without needing
// more headline text to say all three. Starts on "guest" (matching the
// static markup so there's no flash-of-wrong-word before JS runs),
// plays through visit, then settles permanently on "ticket" — a single
// pass, not an infinite loop, so it reads as a deliberate reveal rather
// than something that keeps distracting a visitor who lingers on the
// page. "ticket" is the deliberate resting word, directly under "Count."
//
// Only the word itself (#hero-pre-rotator-word) gets new text each
// cycle, but the fade/pop classes toggle on the outer wrapper
// (#hero-pre-rotator, "Make every " + the word together). That's
// deliberate: changing just the word still changes the whole line's
// width (shorter/longer words re-center the line), so the wrapper still
// needs to fade out and back in around the swap — hiding that re-flow
// in the invisible gap, not just fading the word in isolation, which
// would still show the jump around it. Same fade-swap mechanism as the
// app homepage's own rotator (see homepage.js) — kept as a separate
// file since the word list and elements are specific to this page.
const WORDS = ['guest', 'visit', 'ticket'];
const wrapper = document.getElementById('hero-pre-rotator');
const wordEl = document.getElementById('hero-pre-rotator-word');

function popIn() {
  wrapper.classList.remove('is-popping');
  void wrapper.offsetWidth; // force reflow so the animation can restart
  wrapper.classList.add('is-popping');
}

if (wrapper && wordEl) {
  // Pop the initial "guest" into place on load — it's already the
  // correct text (no fade/swap needed, nothing to hide), just the same
  // entrance flourish every later word gets.
  popIn();

  let i = 0;
  const interval = setInterval(() => {
    i += 1;
    if (i >= WORDS.length) {
      clearInterval(interval);
      return;
    }
    wrapper.classList.add('is-fading');
    setTimeout(() => {
      wordEl.textContent = WORDS[i];
      wrapper.classList.remove('is-fading');
      popIn();
    }, 200);
  }, 3400);
}
