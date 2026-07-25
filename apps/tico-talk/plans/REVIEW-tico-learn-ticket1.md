# Ticket 1: /learn/ drill — chat layout & input UX (port from dreamscape)

## App Context

Tico-talk is a restaurant staff training app (`apps/tico-talk`). Frontend:
11ty + Nunjucks, vanilla JS ES modules, SCSS. Backend: Netlify Functions
(Node.js, CommonJS — note `"type": "module"` in `package.json` means
top-level function files must use the `.cjs` extension, not `.js`, to use
`require`/`exports.handler`). No auth system exists yet. **Never
`console.log`** — no `log()` utility exists client-side yet in this app
(server-side there's `netlify/functions/_utils/log.cjs`); this ticket is
frontend-only so it doesn't need one.

This ticket is a pure UI/layout port — **no backend changes**, and
doesn't require Ticket 2's streaming backend to exist to build or verify
visually. It ports dreamscape's `reflect` page chat interaction pattern
(`apps/dreamscape/src/reflect.njk`, `src/assets/js/pages/reflect.js`,
`src/styles/_components.scss:1832-1954`) onto `/learn/`'s existing drill
phase, which currently uses a plain, non-fixed `<input>+button` form.

## Phase 0: Explore First

Read these before starting:
- `apps/tico-talk/src/learn.njk` — current drill markup (the
  `#learn-drill` section specifically)
- `apps/tico-talk/src/assets/js/learn.js` — current `appendLine`,
  `appendThinking`, `sendTurn`, `startDrill`, and the submit handler
- `apps/tico-talk/src/styles/_learn.scss` — current (minimal) styling
- `apps/tico-talk/src/styles/_layout.scss:6-12` — the existing, currently
  unused `page-canvas` mixin
- `apps/tico-talk/src/assets/js/navigation.js:14-17` — where
  `--nav-height` gets set (already wired, nothing to change here)
- `apps/tico-talk/src/styles/_components.scss` — find `.transcript`,
  `.transcript-line`, `.transcript-line--guest`, `.transcript-line--user`
  (used by Welcome & Seating and Date Night too — you're extending these,
  not replacing them)
- Reference: `apps/dreamscape/src/styles/_components.scss:1832-1954` and
  `apps/dreamscape/src/assets/js/pages/reflect.js:341-355`

## Overview

1. Wrap the drill phase in a flex-column `page-canvas` layout instead of
   normal document flow.
2. Swap the `<input>` for an auto-resizing `<textarea>`.
3. Desktop Enter submits; mobile Enter inserts a newline.
4. Extend the shared `.transcript-line--user`/`--guest` classes with
   asymmetric bubble corners (affects Welcome & Seating and Date Night
   too — intentional, small visual upgrade, not a regression).
5. Animated "thinking" indicator instead of a static line.

## File 1: `src/learn.njk` (MODIFY)

Find the `<div class="learn-drill" id="learn-drill" hidden>` block. Its
current transcript/form markup:

```html
<div class="transcript" id="learn-transcript"></div>
<form class="learn-answer-form" id="learn-answer-form">
  <input type="text" id="learn-answer-input" placeholder="Type what you'd actually say…" autocomplete="off">
  <button type="submit" class="btn">Send</button>
</form>
```

Replace with (note the extra `learn-transcript` class alongside the
existing `transcript` class — this scopes the new flex/scroll container
behavior to just this page without touching the shared class other pages
use):

```html
<div class="transcript learn-transcript" id="learn-transcript"></div>
<div class="learn-input-shell">
  <form class="learn-input-row" id="learn-answer-form" autocomplete="off">
    <div class="learn-input-wrap">
      <textarea
        id="learn-answer-input"
        class="learn-textarea"
        rows="2"
        placeholder="Reply…"
        aria-label="Your answer"
      ></textarea>
    </div>
    <button type="submit" class="btn">Send</button>
  </form>
</div>
```

Also wrap the whole drill section's *content* (the back link + transcript
+ input shell) so the back link stays outside the new flex-scroll area —
check the existing structure; the back link (`.learn-back`) should stay
where it is, above `.learn-transcript`, not inside it.

## File 2: `src/styles/_learn.scss` (MODIFY)

Replace the current `.learn-answer-form` rule block with:

```scss
@use 'layout' as l;

.learn-drill {
  @include l.page-canvas;
  display: flex;
  flex-direction: column;
}

.learn-transcript {
  flex: 1;
  min-height: 0; // required for flex overflow to work correctly
  overflow-y: scroll;
  padding: $space-lg;
}

.learn-input-shell {
  flex-shrink: 0;
  background: $color-bg;
  padding: 0 $space-lg $space-lg;
}

.learn-input-row {
  display: flex;
  gap: $space-sm;
  align-items: flex-end;
}

.learn-input-wrap {
  flex: 1;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: 0.75rem;
  transition: border-color 0.15s;

  &:focus-within { border-color: $color-border-hover; }
}

.learn-textarea {
  display: block;
  width: 100%;
  resize: none;
  background: transparent;
  border: none;
  padding: $space-sm $space-md;
  font-family: $font-family;
  font-size: $font-size-base;
  color: $color-text;
  line-height: 1.55;
  max-height: 200px;
  overflow-y: auto;

  &::placeholder { color: $color-text-muted; }
  &:focus { outline: none; }
  &:disabled { opacity: 0.6; }
}

@keyframes learn-thinking-pulse {
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 0.8; }
}

.learn-thinking {
  font-style: italic;
  animation: learn-thinking-pulse 1.6s ease-in-out infinite;
}
```

Remove the old `.learn-answer-form input`/`.learn-answer-form .btn`/
`.learn-thinking { opacity: 0.6; font-style: italic; }` rules (superseded
by the above). Keep `.learn-screen`, `.learn-picker`, `.learn-teach__intro`,
`.learn-back`, `.learn-start-drill` as-is — this ticket only touches the
drill phase.

## File 3: `src/styles/_components.scss` (MODIFY)

Find `.transcript-line--guest` and `.transcript-line--user`. Add
asymmetric corner-radius (sharp corner on the "speaking" side, matching
dreamscape's `chat-bubble--assistant`/`--user`):

```scss
&--guest {
  align-self: flex-start;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: 0.75rem 0.75rem 0.75rem 0.15rem; // sharp bottom-left
}

&--user {
  align-self: flex-end;
  background: $color-green;
  color: #ffffff;
  border-radius: 0.75rem 0.75rem 0.15rem 0.75rem; // sharp bottom-right
}
```

This changes the existing flat `border-radius: 0.75rem` (currently on the
shared `.transcript-line` base rule — check whether it's on the base rule
or needs adding fresh here) to the asymmetric version, on the two
directional variants only. `.transcript-line--tico` (centered, italic
narration) is unaffected — leave it as-is, it isn't a directional bubble.

This affects Welcome & Seating (`/practice/`) and Date Night
(`/practice/date-night/`) too, since they share these classes — that's
intentional (a small, app-wide visual upgrade), not a regression. Confirm
both still look correct after this change.

## File 4: `src/assets/js/learn.js` (MODIFY)

Add auto-resize and mobile/desktop Enter handling. Find the existing
`answerInput`/`answerForm` references and the submit handler at the
bottom of the file.

Add after the existing element queries:

```javascript
// Auto-resize textarea as the user types — reset to auto first so
// scrollHeight re-measures from a collapsed state, otherwise it only
// ever grows.
answerInput?.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
});

// Desktop: Enter submits. Mobile (coarse pointer): Enter inserts a
// newline, matching native textarea behavior. Shift+Enter always inserts
// a newline on both.
answerInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      answerForm.requestSubmit();
    }
  }
});
```

In the existing submit handler, after clearing the input, reset its
height too (otherwise a multi-line answer leaves the textarea tall for
the next turn):

```javascript
answerInput.value = '';
answerInput.style.height = 'auto';
```

Update `appendThinking()` to use the new class name (`.learn-thinking`
already exists as a class in the current code — just confirm the CSS
animation from File 2 actually applies; no JS change needed if the class
name is already `learn-thinking` on that element).

This ticket does **not** change `sendTurn()`'s network logic — it still
calls the existing non-streaming `/api/learn-drill` endpoint for now.
Ticket 2 replaces that with SSE streaming; this ticket is layout/input UX
only, verified against whatever backend currently exists.

## Verification

1. `node --check src/assets/js/learn.js`
2. `node -e "require('sass').compile('src/styles/main.scss')"` — confirm
   it compiles.
3. Serve via `pnpm run eleventy:serve:ai`, open `/learn/`, pick a section,
   click "Start practicing":
   - The drill phase fills the viewport below the nav bar; the input area
     stays pinned at the bottom while the transcript above it scrolls.
   - Type a multi-line answer (Shift+Enter) — the textarea grows, caps at
     ~200px, then scrolls internally.
   - On a simulated mobile viewport (browser devtools device toolbar),
     Enter inserts a newline instead of submitting; Send button still
     works.
   - On desktop, Enter submits.
   - After submitting, the textarea collapses back to its 2-row height.
4. Visit `/practice/` (Welcome & Seating) and `/practice/date-night/` —
   confirm the transcript bubbles still render correctly with the new
   asymmetric corners (not a regression, just a slightly different corner
   shape).
