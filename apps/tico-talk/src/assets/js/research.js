// "Listen to this article" — browser-native Web Speech API
// (speechSynthesis), not a generated/hosted audio file. Zero cost, zero
// production step, works instantly for this or any future article —
// the tradeoff (flagged to Erik before building) is voice quality
// depends entirely on whatever's already installed on the visitor's own
// device, not something Tico controls. Reads #research-article only —
// the main body of the piece, not the appendix (dense tables and
// citations don't read well aloud, and someone wanting that level of
// detail is already reading, not listening on a drive).
const button = document.getElementById('listen-toggle');
const articleEl = document.getElementById('research-article');

if (button && articleEl && 'speechSynthesis' in window) {
  let utterance = null;

  button.addEventListener('click', () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      button.textContent = '▶ Resume';
      return;
    }
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      button.textContent = '⏸ Pause';
      return;
    }
    utterance = new SpeechSynthesisUtterance(articleEl.textContent);
    utterance.onend = () => {
      button.textContent = '▶ Listen to this article';
    };
    speechSynthesis.speak(utterance);
    button.textContent = '⏸ Pause';
  });
} else if (button) {
  // No Web Speech API support in this browser — hide rather than leave
  // a button that does nothing when clicked.
  button.hidden = true;
}
