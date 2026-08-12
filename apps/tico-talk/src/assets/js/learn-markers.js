// The Menu drill's TICO:/GUEST:/STATUS: line-marker format — parses the
// model's raw marked-up text (or a live token stream) into transcript
// bubbles. Specific to this drill's own prompt contract (see
// learn-chat-init.cjs's FORMAT instructions), not a generic chat
// renderer — see utils/chat-transcript.js for the plain speaker-tagged
// bubble/scroll helpers this builds on.
import { scrollToBottom } from './utils/chat-transcript.js';
import { imageForItem } from './menu-card-images.js';

const transcript = document.getElementById('learn-transcript');

// Matched on a word boundary, not "start of line" — the model doesn't
// reliably put a newline before every marker (seen gluing GUEST: straight
// onto the end of the prior sentence with no break at all), and a
// leading \b still can't false-match inside real dialogue: these are
// exact all-caps tokens immediately followed by a colon, not a pattern
// that turns up in ordinary lowercase menu chatter.
const SEGMENT_MARKER_RE = /\b(TICO|GUEST|STATUS|IMAGE):[ \t]?/;
const SEGMENT_MARKER_HOLDBACK = 7; // length of "STATUS:" — longest marker

function createSegmentElement(speaker) {
  const el = document.createElement('p');
  el.className = speaker === 'tico' ? 'transcript-line transcript-line--tico' : 'transcript-line transcript-line--guest';
  transcript.appendChild(el);
  return el;
}

// Shown once, at the very start of a fresh section — no title, just one
// line in Tico's own voice (reuses .transcript-line--tico's styling
// directly via createSegmentElement, same as any TICO: narration line).
// Not itself persisted as its own chatHistory entry (unlike the status
// marker) — it's derived purely from position (index 0) + exact content
// match against KICKOFF_MESSAGE during rehydration in learn-practice.js,
// so it doesn't need its own marker type in the parsing pipeline here.
export function createGettingStartedElement() {
  const el = createSegmentElement('tico');
  el.textContent = 'Answer each guest’s question as best you can. Check the Review tab anytime you get stuck, or just try to answer and I’ll help you learn it.';
  return el;
}

// Same idea, for re-entering an already-Covered section (see
// isReviewSession in learn-practice.js) — different opening line since
// there's nothing new to learn here, just to keep sharp.
export function createReviewStartedElement() {
  const el = createSegmentElement('tico');
  el.textContent = 'Now that you’ve covered this fully, answer a few more questions to help it stick.';
  return el;
}

// A lightweight title block ("You are: / Training"), not a chat bubble —
// visually distinct from TICO/GUEST dialogue since it's not part of the
// conversation, it's a status marker sitting in the same timeline.
function createStatusElement(label) {
  const el = document.createElement('div');
  el.className = 'learn-status-marker';
  const prefix = document.createElement('span');
  prefix.className = 'learn-status-marker__prefix';
  prefix.textContent = 'You are:';
  const value = document.createElement('span');
  value.className = 'learn-status-marker__label';
  value.textContent = label;
  el.appendChild(prefix);
  el.appendChild(value);
  transcript.appendChild(el);
  return el;
}

// A missed-fact visual scaffold — an opt-in "Show visual aid" link right
// after a wrong/partial answer during the gated Coverage drill (see
// handleFactResult in learn-practice.js), never during a Review/Mastery
// pass, where offering the answer would undermine the point of testing
// retention. Opt-in rather than auto-shown (Erik's call): it preserves a
// genuine "do I actually need this" moment rather than reflexively
// answering every miss, closer to a flashcard app's deliberate "show
// answer" than an automatic reveal.
//
// itemId is looked up fresh against menu-card-images.js's manifest (not
// embedded as a resolved URL) and against sectionItems for the item's
// real name/price/description, so a rehydrated old chat still resolves
// correctly even if the underlying image file's build hash has since
// changed. Silently renders nothing if the item has no image or isn't
// found in sectionItems — this only ever fires live for items menu-
// restaurant-filter.js has already confirmed have one, but rehydration
// re-resolves it fresh rather than trusting that's still true.
export function appendShowCardLink(itemId, restaurantId, sectionName, sectionItems) {
  const src = imageForItem(restaurantId, sectionName, itemId);
  const item = sectionItems?.find((i) => i.id === itemId);
  if (!src || !item) return null;

  const wrap = document.createElement('div');
  wrap.className = 'learn-show-card';
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'learn-show-card__link';
  link.textContent = 'Show visual aid';
  wrap.appendChild(link);
  transcript.appendChild(wrap);

  link.addEventListener('click', () => {
    wrap.innerHTML = '';
    wrap.className = 'learn-inline-card';

    const img = document.createElement('img');
    img.className = 'study-card__image';
    img.src = src;
    img.alt = item.name;
    wrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'study-card__body';
    const nameRow = document.createElement('div');
    nameRow.className = 'study-card__name-row';
    const name = document.createElement('h3');
    name.className = 'study-card__name';
    name.textContent = item.name;
    nameRow.appendChild(name);
    if (item.price) {
      const price = document.createElement('span');
      price.className = 'study-card__price';
      price.textContent = `$${item.price}`;
      nameRow.appendChild(price);
    }
    body.appendChild(nameRow);
    if (item.description) {
      const desc = document.createElement('p');
      desc.className = 'study-card__desc';
      desc.textContent = item.description;
      body.appendChild(desc);
    }
    wrap.appendChild(body);
    scrollToBottom();
  }, { once: true });

  return wrap;
}

// Renders one complete (non-streaming) assistant turn — used to rehydrate
// a persisted chat, where the full raw text is already available. Also
// used directly for live STATUS marker insertion (see appendStatusMarker
// in learn-practice.js) so both paths share one rendering implementation.
// IMAGE markers reach their rendering (appendShowCardLink) via a direct
// call from learn-practice.js's tool_complete handling for the live case
// (position matters there — see that file's comment), and via this
// function's own dispatch below for rehydration. restaurantId/sectionName/
// sectionItems are only needed to resolve an IMAGE marker's itemId — omit
// for callers that never rehydrate one.
//
// TICO:/GUEST: are Tico's own voice / the guest's dialogue — rendered as
// bubbles. STATUS:/IMAGE: are different — never in the model's own stream
// (it has no instruction to emit either); they're synthetic markers
// learn-practice.js inserts itself so they get persisted and replayed
// through this same parsing/rendering pipeline, in-line in the
// transcript, exactly like a real turn would be. Markers are parsed out
// here and never shown as raw text.
export function renderAssistantTurn(rawText, restaurantId, sectionName, sectionItems) {
  const re = new RegExp(SEGMENT_MARKER_RE, 'g');
  const positions = [];
  let m;
  while ((m = re.exec(rawText))) {
    positions.push({ start: m.index, contentStart: m.index + m[0].length, marker: m[1] });
  }
  if (positions.length === 0) {
    // No markers (older stored data, or the model skipped the format) — fall back to one guest bubble.
    if (rawText.trim()) createSegmentElement('guest').textContent = rawText.trim();
    return;
  }
  positions.forEach((pos, i) => {
    if (pos.marker !== 'TICO' && pos.marker !== 'GUEST' && pos.marker !== 'STATUS' && pos.marker !== 'IMAGE') return; // hidden tracking markers, never rendered
    const end = i + 1 < positions.length ? positions[i + 1].start : rawText.length;
    const text = rawText.slice(pos.contentStart, end).trim();
    if (!text) return;
    if (pos.marker === 'STATUS') {
      createStatusElement(text);
    } else if (pos.marker === 'IMAGE') {
      appendShowCardLink(text, restaurantId, sectionName, sectionItems);
    } else {
      createSegmentElement(pos.marker === 'TICO' ? 'tico' : 'guest').textContent = text;
    }
  });
}

// Streaming variant of the same parsing — call createStreamRenderer() once
// per turn, then feed it the full accumulated text after every token.
// Fact-result tracking doesn't flow through here at all (see the
// tool_complete handling in learn-practice.js's sendTurn) — every marker
// this sees gets a bubble directly, nothing to buffer/accumulate silently.
export function createStreamRenderer() {
  let consumedLen = 0;
  let marker = null;
  let bubble = null;

  function openSegment(nextMarker) {
    marker = nextMarker;
    bubble = (marker === 'TICO' || marker === 'GUEST')
      ? createSegmentElement(marker === 'TICO' ? 'tico' : 'guest')
      : null;
  }

  function absorb(chunk) {
    if (!chunk) return;
    if (!bubble && marker === null) {
      // Safe fallback if the model ever forgets the opening marker entirely.
      marker = 'GUEST';
      bubble = createSegmentElement('guest');
    }
    if (bubble) {
      bubble.appendChild(document.createTextNode(chunk));
      scrollToBottom();
    }
  }

  return {
    update(fullTextSoFar) {
      for (;;) {
        const unconsumed = fullTextSoFar.slice(consumedLen);
        const m = SEGMENT_MARKER_RE.exec(unconsumed);
        if (m && m.index === 0) {
          openSegment(m[1]);
          consumedLen += m[0].length;
          continue;
        }
        if (m && m.index > 0) {
          absorb(unconsumed.slice(0, m.index));
          consumedLen += m.index;
          continue;
        }
        // No marker in the unconsumed tail — hold back a few characters in
        // case they're the start of one still arriving token by token.
        if (unconsumed.length > SEGMENT_MARKER_HOLDBACK) {
          const safeLen = unconsumed.length - SEGMENT_MARKER_HOLDBACK;
          absorb(unconsumed.slice(0, safeLen));
          consumedLen += safeLen;
        }
        break;
      }
    },
    finalize(fullText) {
      absorb(fullText.slice(consumedLen));
      consumedLen = fullText.length;
    }
  };
}
