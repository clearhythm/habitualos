# TICKET: Add esbuild build pipeline to Signal

## Why this exists

The Signal widget (`embed.js`) needs to:
1. Work as a drop-in `<script>` on external sites (requires IIFE, no bundler assumed on host)
2. Be maintainable as modular ESM source (requires a bundler on our side)

Currently there is no JS build step — 11ty serves JS files as-is. This ticket adds `esbuild` as the build layer between source modules and the served artifact, without disrupting anything else in the pipeline.

This ticket is **infrastructure only** — it does not restructure any widget code. It just gets esbuild wired in and proven working. The widget source restructuring is a follow-on ticket.

## What to build

### 1. Install esbuild

```bash
npm install --save-dev esbuild
```

No other dependencies needed. esbuild handles JS bundling, SCSS (via plugin), and CSS inlining.

### 2. Build script

Add `scripts/build-widget.js` (Node script, not a config file):

```js
const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin'); // see note below

esbuild.build({
  entryPoints: ['src/widget/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'Signal',        // window.Signal in the output
  outfile: 'src/assets/js/embed.js',
  minify: process.env.NODE_ENV === 'production',
  plugins: [sassPlugin({ type: 'style' })],  // inlines compiled SCSS as <style> injection
});
```

> **Note on SCSS plugin**: `esbuild-sass-plugin` with `type: 'style'` generates a JS snippet that injects a `<style>` tag at runtime. This is exactly the right behavior — the CSS travels with the IIFE and self-injects on load. Install: `npm install --save-dev esbuild-sass-plugin sass`.

If SCSS plugin adds complexity, start with plain CSS (`src/widget/widget.css`) and add the sass plugin once CSS extraction (Ticket 2) is done.

### 3. Wire into npm scripts

Update `package.json`:

```json
"scripts": {
  "build:widget": "node scripts/build-widget.js",
  "build:widget:watch": "node scripts/build-widget.js --watch",
  "start": "npm run build:widget && netlify dev",
  "build": "npm run build:widget && eleventy"
}
```

For watch mode, the build script should use `esbuild.context()` + `.watch()`:

```js
const isWatch = process.argv.includes('--watch');
if (isWatch) {
  esbuild.context({ ...options }).then(ctx => ctx.watch());
} else {
  esbuild.build(options);
}
```

### 4. Smoke test entry point

Create `src/widget/index.js` as a minimal placeholder that proves the pipeline works:

```js
// src/widget/index.js
// Placeholder — real widget logic comes in TICKET-widget-js-modules
console.log('[Signal widget] bundle loaded');
export const version = '2.0.0';
```

Run `npm run build:widget` and verify:
- `src/assets/js/embed.js` is created
- It is an IIFE (starts with `(function(){`)
- `window.Signal` exists if you load it in a browser
- `npm run start` runs clean (11ty serves the built file)

### 5. Gitignore consideration

`src/assets/js/embed.js` will now be a **build artifact**, not a hand-edited source file. Two options:

**Option A** (recommended): Keep `embed.js` in git. External sites reference it by URL; having it in git means Netlify deploys it without a separate CI step beyond `npm run build`. Add a comment at the top of the built file: `/* Generated — edit src/widget/index.js instead */`.

**Option B**: Gitignore it and ensure Netlify's build command includes `npm run build:widget`. Cleaner in principle but requires CI config discipline.

Recommendation: Option A for now.

## Current state (what exists)

- `src/assets/js/embed.js` — hand-written IIFE, ~800 lines, visitor mode only
- `src/assets/js/signal-modal.js` — ES module, ~730 lines, three-mode widget for signal.habitualos.com
- No bundler exists. JS is served as-is by 11ty.
- `package.json` has `"start": "netlify dev"` and `"build": "eleventy"`

## Out of scope

- Do not restructure any widget logic (that's TICKET-widget-js-modules)
- Do not extract widget CSS yet (that's TICKET-widget-css-extraction)
- Do not change modal.njk, base.njk, or any page templates
- Do not delete or modify signal-modal.js or embed.js source

## Acceptance criteria

- [ ] `npm run build:widget` produces `src/assets/js/embed.js` as an IIFE
- [ ] `npm run start` works end-to-end (netlify dev + widget bundle built)
- [ ] `npm run build` (Netlify CI) works end-to-end
- [ ] The existing `embed.js` behavior is unchanged (external sites still work)
- [ ] A `src/widget/index.js` placeholder exists as the new entry point
