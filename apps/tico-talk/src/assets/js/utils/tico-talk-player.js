// Shared play/pause logic for the Tico Talk player card (see
// _includes/tico-talk-player.njk) — used identically on the homepage
// and on /research/ itself. Browser-native Web Speech API, not a
// generated/hosted audio file: zero cost, zero production step, but
// voice quality depends on whatever's installed on the visitor's own
// device, not something Tico controls.
//
// The article text lives in exactly one place, #research-article on
// /research/ — when the player is on that page, it reads the element
// directly; anywhere else (the homepage), it fetches /research/ and
// pulls the same element out of the returned HTML, so the article only
// ever needs editing in one file, not kept in sync across two.
export function initTicoTalkPlayer() {
  const button = document.getElementById('tico-talk-play');
  const icon = document.getElementById('tico-talk-play-icon');

  if (!button || !icon || !('speechSynthesis' in window)) {
    if (button) button.hidden = true;
    return;
  }

  async function getArticleText() {
    const localArticle = document.getElementById('research-article');
    if (localArticle) return localArticle.textContent;

    const response = await fetch('/research/');
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.getElementById('research-article')?.textContent || '';
  }

  button.addEventListener('click', async () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      icon.textContent = '▶';
      return;
    }
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      icon.textContent = '⏸';
      return;
    }

    icon.textContent = '…';
    const text = await getArticleText();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      icon.textContent = '▶';
    };
    speechSynthesis.speak(utterance);
    icon.textContent = '⏸';
  });
}
