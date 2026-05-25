# Architecture Ticket 1: Vite Migration

## Goal
Replace the current unbundled browser JS setup with Vite via `@11ty/eleventy-plugin-vite`. This makes `packages/frontend-utils` (and any future frontend package) importable in browser JS exactly as `@habitualos/db-core` already works in server-side functions — one tested source of truth, no copies, no drift.

**Fixes as a side effect:** hot reload, which is currently broken due to BrowserSync WebSocket not surviving the netlify dev proxy.

---

## Context

Currently:
- 11ty handles templates, SCSS compilation, and passes through `src/assets/` statically
- Browser JS has no bundler — package specifiers like `@habitualos/frontend-utils` can't resolve
- `packages/frontend-utils/` files have been manually copied into app `src/assets/js/` directories and have drifted
- Hot reload is broken (BrowserSync on port 8080 doesn't survive the netlify dev proxy on port 8888)

After:
- Vite runs as a post-processor on top of 11ty's output
- Workspace packages resolve natively in browser JS (same as server-side already works)
- HMR works correctly through netlify dev
- `packages/frontend-utils/` is the single source of truth — no app-level copies needed

---

## Phase 0: Explore First

Read these before implementing:
- Root `CLAUDE.md` — monorepo conventions (commit style, log utility, code principles)
- `apps/dreamscape/CLAUDE.md` — app-specific context and tech stack
- `apps/dreamscape/.eleventy.js` — current config (CommonJS, manual SCSS step to replace)
- `apps/dreamscape/package.json` — current scripts and deps
- `apps/dreamscape/netlify.toml` — dev server setup (`targetPort = 8080`)
- `apps/dreamscape/src/assets/js/` — understand what JS entry points exist
- `apps/dreamscape/src/assets/js/utils/` — `log.js`, `env-config.js` (keep these, they're app-local)
- `apps/dreamscape/src/assets/js/auth/auth.js` — custom dreamscape auth (keep as-is, NOT replaced by shared package)
- `packages/frontend-utils/` — what's in the shared package

Reference article: https://benswift.me/blog/2025/11/24/11ty-and-vite-for-modern-static-websites/

---

## Implementation

### 1. Install dependencies

```bash
pnpm add -D vite @11ty/eleventy-plugin-vite --filter dreamscape
```

### 2. Update `.eleventy.js`

Convert to async (required for ESM plugin import) and add the plugin. Remove the manual SCSS compilation block — Vite handles it.

```js
const path = require("path");

module.exports = async function(eleventyConfig) {
  const { EleventyVitePlugin } = await import("@11ty/eleventy-plugin-vite");

  eleventyConfig.addPlugin(EleventyVitePlugin, {
    viteOptions: {
      resolve: {
        alias: {
          // Resolve workspace packages for browser JS
          "@habitualos/frontend-utils": path.resolve(__dirname, "../../packages/frontend-utils"),
        },
      },
      css: {
        preprocessorOptions: {
          scss: {
            // Keep load paths so _variables and _components resolve
            loadPaths: [path.resolve(__dirname, "src/styles")],
          },
        },
      },
    },
  });

  // IMPORTANT: The old config used addPassthroughCopy("src/assets") to copy everything.
  // That must be removed. Vite now owns src/assets/js/ and all SCSS — do NOT pass those through,
  // or you will get unbundled files overwriting Vite's output.
  // Only pass through non-JS/CSS static assets explicitly:
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/music");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
    },
    templateFormats: ["njk", "md", "html", "scss"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
```

### 3. Handle the passthrough wipe gotcha

Vite empties `_site` before it builds, which deletes 11ty's passthrough copies. Add a small plugin inside `viteOptions.plugins` to restore them:

```js
plugins: [
  {
    name: "restore-passthrough",
    closeBundle: async () => {
      // Re-copy any files Vite wiped that 11ty had placed
      // (Images, audio are passed through above — Vite doesn't bundle them
      //  but does wipe them. This hook re-copies after Vite finishes.)
      const { execSync } = require("child_process");
      execSync("cp -r src/assets/images _site/assets/images 2>/dev/null || true");
      execSync("cp -r src/assets/music _site/assets/music 2>/dev/null || true");
    },
  },
],
```

> Note: investigate whether `assetsInclude` or `publicDir` in Vite config is a cleaner solve before reaching for the `closeBundle` hook.

### 4. Update `package.json` scripts

```json
"scripts": {
  "prestart": "mkdir -p netlify/edge-functions/_lib && cp ../../packages/edge-functions/chat-stream-core.ts netlify/edge-functions/_lib/",
  "start": "netlify dev",
  "eleventy:build": "eleventy",
  "eleventy:serve": "eleventy --serve --port=8080",
  "build": "eleventy"
}
```

No changes needed — the plugin handles the Vite integration inside the eleventy process.

### 5. Verify imports work

After migration, browser JS should be able to do:

```js
import { getTimeOfDayGreeting, getTimezone } from "@habitualos/frontend-utils/utils.js";
```

Test this by temporarily adding such an import to an existing page JS file and confirming it builds without error.

---

## What Does NOT Change

- `src/assets/js/auth/auth.js` — dreamscape's custom auth (different localStorage keys from shared package). Keep as-is.
- `src/assets/js/utils/log.js` — app-local, keep
- `src/assets/js/utils/env-config.js` — app-local, keep
- Netlify functions — unaffected, they already resolve workspace packages via Node.js
- `netlify.toml` — no changes needed

---

## Verification

1. `npm run start` — dev server starts, no errors
2. Edit a `.njk` template — browser reloads (hot reload working)
3. Edit a `.scss` file — browser reloads with updated styles (hot reload working)
4. Edit a `.js` file — HMR updates without full reload
5. Add a test import of `@habitualos/frontend-utils/utils.js` in any page JS — builds and runs without error
6. Production build (`npm run build`) — `_site/` contains all expected assets including images and audio

---

## After This Ticket

Ticket 3b (Daily-Reflections-Ticket3b.md) can be implemented — dynamic greeting using `getTimeOfDayGreeting()` from the shared package.
