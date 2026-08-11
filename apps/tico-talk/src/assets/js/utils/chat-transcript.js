// Generic "append a line to a chat-style transcript" helpers — a plain
// speaker-tagged bubble, a "thinking" placeholder, and the page-level
// scroll-to-bottom both use. Not tied to any particular chat protocol or
// marker format — see learn-markers.js for the Menu drill's own
// TICO:/GUEST:/STATUS: parsing, built on top of this.

// Whole-page scroll, not element.scrollIntoView() — the latter's per-
// element/per-render geometry guessing is what caused streaming to jump
// around and rehydrated history to stop short of the true bottom. This
// always lands exactly at the bottom, unconditionally, regardless of
// what changed.
export function scrollToBottom() {
  window.scrollTo(0, document.documentElement.scrollHeight);
}

export function appendLine(container, speaker, text) {
  const line = document.createElement('p');
  line.className = `transcript-line transcript-line--${speaker}`;
  line.textContent = text;
  container.appendChild(line);
  scrollToBottom();
  return line;
}

export function appendThinking(container, label) {
  const line = document.createElement('p');
  line.className = 'transcript-line transcript-line--tico learn-thinking';
  line.textContent = label;
  container.appendChild(line);
  scrollToBottom();
  return line;
}
