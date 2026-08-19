// Rotating word in the hero headline — "Master your menu. [Food/Drinks/
// Service] ... without the grind." The middle word is its own standalone
// label between two halves of one sentence, not the grammatical object
// of "your menu's ___" (that phrasing is why Craft/Preparation/Upsells
// each read slightly off at points — none of them are actually "a part
// of the menu"). As a standalone label, Service fits fine again. Kept
// short/similar-length on purpose (Erik dropped "Recommendations" for
// exactly this reason) so the headline doesn't jump around as it cycles.
const WORDS = ['Food', 'Drinks', 'Service'];
const el = document.getElementById('hero-rotator');

if (el) {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % WORDS.length;
    el.classList.add('is-fading');
    setTimeout(() => {
      el.textContent = WORDS[i];
      el.classList.remove('is-fading');
    }, 200);
  }, 3400);
}
