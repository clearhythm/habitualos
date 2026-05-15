# Brand Redesign — Daily Practice

Replace the generic tech-green aesthetic with a calm, organic, forest-rooted brand. Add a proper signed-out landing page to replace the current `/` → `/practice/` redirect. This ticket lays the visual foundation for the future Ambient Journey feature.

## Brand Direction (from mockup)

- **Background**: Deep forest green `#1c3022` on landing; warm off-white `#faf8f2` in the app interior
- **Primary color**: `#2d5a3d` — deeper, more forest (replaces bright lime `#3a7a10`)
- **Typography**: Lora serif for h1/h2; system-ui body remains
- **Tone**: unhurried, non-performative, nature-adjacent
- **Landing layout**: full-bleed dark, minimal nav, large serif headline, stacked CTAs

---

## SCSS Changes

### `src/styles/_variables.scss`
```scss
$color-primary: #2d5a3d;          // was #3a7a10
$color-primary-dark: #1f3d29;     // was #2d600c
$color-bg: #faf8f2;               // was #ffffff — warm off-white
$color-bg-muted: #f0ede4;         // was #f3f4f6 — warm light gray
$font-family-heading: 'Lora', Georgia, serif;  // new

// Landing page palette
$color-landing-bg: #1c3022;
$color-landing-text: #f0ebe0;
$color-landing-muted: #8aab8e;
$color-landing-eyebrow: #6a8a6e;
$color-landing-btn-outline: rgba(240, 235, 224, 0.25);
```

### `src/styles/_base.scss`
- Update `html` background gradient: `linear-gradient(to bottom, #f0ede4 0%, #faf8f2 60%, #e8ede8 100%)` — warm earth tones replacing the lavender-to-mint
- Apply `$font-family-heading` to `h1, h2`
- Set `h1` font-weight to `400` (Lora reads better at regular weight)

### `src/_includes/base.njk`
Add Google Fonts preconnect + stylesheet for Lora (weights 400, 600):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap" rel="stylesheet">
```

### `src/styles/_landing.scss` (new)
Scoped under `body.landing-page`. Styles: `.landing-nav`, `.landing-main`, `.landing-eyebrow`, `.landing-headline`, `.landing-subtext`, `.landing-divider`, `.landing-ctas`, `.landing-btn`, `.landing-btn-primary`, `.landing-btn-secondary`, `.landing-or`, `.landing-reassurance`.

### `src/styles/main.scss`
Add `@use 'landing'` to imports.

---

## New Files

### `src/_includes/landing.njk`
Minimal layout — no app nav, no footer. Body gets `class="landing-page"`. Loads `main.css` and page script only.

### `src/index.njk`
```yaml
layout: landing.njk
permalink: /
pageScript: /assets/js/pages/index.js
```
Content:
- Minimal top nav: "Daily Practice" wordmark + "Learn more" anchor link
- Eyebrow: "Some days are full. Some days aren't."
- Headline: "A place for daily practice."
- Subtext: "Show up in small ways. See others do the same. Together, we keep the practice alive."
- Thin CSS ornamental divider
- CTAs: "Create an account →" → `/signin/` and "Sign in" (person icon) → `/signin/`
- Reassurance: "No streaks. No pressure. Just practice. Life will happen. You're still welcome here."
- Short anchor section: 2–3 sentences about what the app is

### `src/assets/js/pages/index.js`
```js
import { isSignedIn } from '../utils/auth.js';
if (isSignedIn()) { window.location.replace('/practice/'); }
```

---

## Modified Files

### `netlify.toml`
Remove the `[[redirects]] from = "/" to = "/practice/" status = 302` block.

---

## Verification

1. `npm run dev` — clean build, no errors
2. Signed out → `localhost:8888/` shows dark green landing page
3. Signed in → `localhost:8888/` redirects to `/practice/`
4. "Create an account" + "Sign in" → both land on `/signin/`
5. Interior pages (chat, log, history) → serif h1/h2, warm off-white bg, no lavender
6. Dark mode still works on interior pages
7. Nav brand renders correctly against new primary color
