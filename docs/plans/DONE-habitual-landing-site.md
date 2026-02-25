# Task: Build HabitualOS Landing Page (`apps/habitualos-web`)

## What You're Building

A new static 11ty app at `apps/habitualos-web/` in the monorepo at `/Users/erik/Sites/habitualos`. This is a public-facing marketing/portfolio landing page for HabitualOS — the platform-level brand for Erik Burns' agentic AI work. It is NOT a new product; it is a professional portfolio page establishing EEAT (expertise, experience, authoritativeness, trustworthiness) for hiring signal in agentic AI + wellness tech.

The page should be honest and specific, not generic marketing copy. Erik builds and uses these systems daily. That's the differentiation.

**DO NOT** touch or modify any existing apps (habitual-web, relationship-web, zer0gravity).

---

## Monorepo Context

Working directory: `/Users/erik/Sites/habitualos`

Structure:
- `apps/habitual-web/` — auth-gated daily productivity app (also branded "HabitualOS" in its UI)
- `apps/relationship-web/` — relationship support app ("Pidgerton")
- `apps/zer0gravity/` — semantic microformat CLI tool
- `packages/` — shared packages (@habitualos/db-core, auth-server, frontend-utils, etc.)
- Root `pnpm-workspace.yaml` manages workspaces

**The new app has NO backend.** No Netlify functions, no Firestore, no auth. Pure static 11ty.

---

## Tech Stack (copy from habitual-web)

- **11ty v2.0.1** static site generator
- **Nunjucks** templates
- **SCSS** compiled via `sass` CLI (NOT a bundler)
- **pnpm** workspaces
- **Netlify** deploy

---

## Files to Create

Create all of these files. Full content is specified below.

### 1. `apps/habitualos-web/package.json`

```json
{
  "name": "habitualos-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "sass:build": "sass src/styles/main.scss:_site/css/main.css --style=compressed",
    "sass:watch": "sass src/styles/main.scss:_site/css/main.css --watch",
    "eleventy:build": "eleventy",
    "eleventy:serve": "eleventy --serve --port=8081",
    "dev": "concurrently --kill-others \"npm:sass:watch\" \"npm:eleventy:serve\"",
    "build": "sass src/styles/main.scss:_site/css/main.css --style=compressed && eleventy"
  },
  "dependencies": {
    "@11ty/eleventy": "^2.0.1"
  },
  "devDependencies": {
    "concurrently": "^9.2.1",
    "sass": "^1.69.5"
  }
}
```

### 2. `apps/habitualos-web/.eleventy.js`

```javascript
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("_site/css");
  eleventyConfig.addPassthroughCopy("src/scripts");
  eleventyConfig.addWatchTarget("_site/css/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
```

### 3. `apps/habitualos-web/netlify.toml`

```toml
# =============================================================================
# Netlify Configuration for habitualos-web (landing page)
# Set "Base directory" to "apps/habitualos-web" in Netlify UI.
# =============================================================================
[build]
  base = "apps/habitualos-web"
  ignore = "cd $(git rev-parse --show-toplevel) && git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- apps/habitualos-web/"
  command = "cd $(git rev-parse --show-toplevel) && pnpm install && pnpm --filter habitualos-web build"
  publish = "_site"
```

### 4. `apps/habitualos-web/src/_includes/base.njk`

Simplified version — no auth scripts, no service worker cleanup, dark mode toggle retained.

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title or "HabitualOS" }}</title>
  <meta name="description" content="{{ description or 'An agentic AI platform built and used daily to explore how AI agents can handle operational work while preserving human judgment and agency.' }}">
  <link rel="stylesheet" href="/css/main.css">
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
    })();
  </script>
</head>
<body>
  {% include "nav.njk" %}

  <main class="main" style="padding-top: 80px;">
    {{ content | safe }}
  </main>

  <footer class="footer">
    <div class="container">
      <p class="text-muted">Built with curiosity by Erik Burns &copy; 2026 HabitualOS</p>
    </div>
  </footer>

  <script src="/scripts/navigation.js"></script>
  <script>
    (function() {
      const toggle = document.getElementById('theme-toggle');
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      const html = document.documentElement;

      function updateToggle() {
        const currentTheme = html.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          icon.textContent = '☀️';
          text.textContent = 'Light Mode';
        } else {
          icon.textContent = '🌙';
          text.textContent = 'Dark Mode';
        }
      }

      toggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateToggle();
      });

      updateToggle();
    })();
  </script>
</body>
</html>
```

### 5. `apps/habitualos-web/src/_includes/nav.njk`

Static nav — no auth dependency.

```html
<nav class="navbar">
  <div class="w-100 sidemenu">
    <div id="sidemenu-toggle" class="toggle">
      <span></span>
      <span></span>
      <span></span>
    </div>

    <div class="sidemenu-main">
      <div class="sidemenu-left">
        <ul>
          <li><h3><a href="#about">About</a></h3></li>
          <li><h3><a href="#systems">Systems</a></h3></li>
          <li><h3><a href="#stack">Stack</a></h3></li>
          <li><h3><a href="#writing">Writing</a></h3></li>
        </ul>
        <footer>
          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
            <span id="theme-text">Dark Mode</span>
            <span class="theme-icon" id="theme-icon">🌙</span>
          </button>
          <p style="color: #fff; font-size: 0.9rem; padding: 1rem; opacity: 0.7; margin-top: 1rem;">
            <a href="https://linkedin.com/in/erikburns" style="color: #fff; text-decoration: underline;" target="_blank" rel="noopener">LinkedIn</a>
          </p>
        </footer>
      </div>
      <div class="sidemenu-right">
        <div class="sidemenu-overlay"></div>
      </div>
    </div>
  </div>

  <div class="mx-auto">
    <a class="navbar-brand" href="/">HabitualOS</a>
  </div>
</nav>
```

### 6. `apps/habitualos-web/src/scripts/navigation.js`

Exact copy of habitual-web's navigation.js — hamburger toggle and scroll effect.

```javascript
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('active');
  } else {
    navbar.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('sidemenu-toggle');
  const menuLinks = document.querySelectorAll('.sidemenu-main a');

  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
    });
  }

  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (toggle) {
        toggle.classList.remove('open');
        document.body.classList.remove('sidemenu-open');
      }
    });
  });
});
```

### 7. `apps/habitualos-web/src/styles/main.scss`

```scss
@import 'variables';
@import 'base';
@import 'layout';
@import 'components';
@import 'navigation';
@import 'landing';
```

### 8. `apps/habitualos-web/src/styles/_variables.scss`

Exact copy from habitual-web (no changes needed):

```scss
// Colors
$color-primary: #2563eb;
$color-primary-dark: #1e40af;
$color-success: #10b981;
$color-warning: #f59e0b;
$color-danger: #ef4444;
$color-text: #1f2937;
$color-text-muted: #6b7280;
$color-bg: #ffffff;
$color-bg-muted: #f3f4f6;
$color-border: #e5e7eb;

// Dark mode colors
$dark-color-text: #e5e7eb;
$dark-color-text-muted: #9ca3af;
$dark-color-bg: #1f2937;
$dark-color-bg-muted: #111827;
$dark-color-border: #374151;
$dark-color-border-hover: #4b5563;

// Spacing (8px base unit)
$space-xs: 0.25rem;
$space-sm: 0.5rem;
$space-md: 1rem;
$space-lg: 1.5rem;
$space-xl: 2rem;
$space-2xl: 3rem;

// Typography
$font-family: system-ui, -apple-system, sans-serif;
$font-size-sm: 0.875rem;
$font-size-base: 1rem;
$font-size-lg: 1.125rem;
$font-size-xl: 1.25rem;
$font-size-2xl: 1.5rem;
$font-size-3xl: 2rem;

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
```

### 9. `apps/habitualos-web/src/styles/_base.scss`

Exact copy from habitual-web:

```scss
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  min-height: 100vh;
  background: linear-gradient(to bottom, #EBEDFD, #FDFCF3 70%, #B5DAFF);
  transition: background 0.3s ease;

  &[data-theme="dark"] {
    background: linear-gradient(to bottom, #1a1b26, #1f2937 70%, #111827);
  }
}

body {
  font-family: $font-family;
  font-size: $font-size-base;
  line-height: 1.6;
  color: $color-text;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  html[data-theme="dark"] & {
    color: $dark-color-text;
  }
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: $space-md;
}

h1 { font-size: $font-size-3xl; }
h2 { font-size: $font-size-2xl; }
h3 { font-size: $font-size-xl; }

p {
  margin-bottom: $space-md;
}

a {
  color: $color-primary;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

ul, ol {
  margin-left: $space-lg;
  margin-bottom: $space-md;
}
```

### 10. `apps/habitualos-web/src/styles/_layout.scss`

Copy from habitual-web — only the parts needed (container, main, footer, grid, flex, spacing utilities):

```scss
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 $space-md;

  @media (min-width: $breakpoint-md) {
    padding: 0 $space-xl;
  }
}

.container-narrow {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 $space-md;
}

.main {
  flex: 1;
  padding-bottom: $space-2xl;
}

.footer {
  background: $color-bg-muted;
  border-top: 1px solid $color-border;
  padding: $space-lg 0;
  margin-top: $space-2xl;
  text-align: center;

  html[data-theme="dark"] & {
    background: $dark-color-bg-muted;
    border-top-color: $dark-color-border;
  }
}

.footer p {
  margin-bottom: 0;
}

.grid {
  display: grid;
  gap: $space-lg;
}

.grid-2 {
  @media (min-width: $breakpoint-md) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-between { justify-content: space-between; }
.flex-center { justify-content: center; align-items: center; }
.gap-sm { gap: $space-sm; }
.gap-md { gap: $space-md; }
.gap-lg { gap: $space-lg; }

.mt-sm { margin-top: $space-sm; }
.mt-md { margin-top: $space-md; }
.mt-lg { margin-top: $space-lg; }
.mt-xl { margin-top: $space-xl; }
.mt-2xl { margin-top: $space-2xl; }
.mb-sm { margin-bottom: $space-sm; }
.mb-md { margin-bottom: $space-md; }
.mb-lg { margin-bottom: $space-lg; }
.mb-xl { margin-bottom: $space-xl; }
.mb-2xl { margin-bottom: $space-2xl; }

.text-muted {
  color: $color-text-muted;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

.w-100 { width: 100%; }
.mx-auto { margin-left: auto; margin-right: auto; }
```

### 11. `apps/habitualos-web/src/styles/_components.scss`

Minimal — only what the landing page uses:

```scss
.btn {
  display: inline-block;
  padding: $space-sm $space-lg;
  font-size: $font-size-base;
  font-weight: 500;
  text-align: center;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;

  &:hover {
    text-decoration: none;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
}

.btn-primary {
  background-color: $color-primary;
  color: white;

  &:hover {
    background-color: $color-primary-dark;
  }
}

.btn-ghost {
  background: transparent;
  border: 1px solid $color-border;
  color: $color-text;

  &:hover {
    background: $color-bg-muted;
    border-color: $color-primary;
  }

  html[data-theme="dark"] & {
    border-color: $dark-color-border;
    color: $dark-color-text;

    &:hover {
      background: lighten($dark-color-bg, 5%);
      border-color: $color-primary;
    }
  }
}

.card {
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: 12px;
  padding: $space-lg;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

  html[data-theme="dark"] & {
    background: $dark-color-bg;
    border-color: $dark-color-border;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

.badge {
  display: inline-block;
  padding: $space-xs $space-sm;
  font-size: $font-size-sm;
  font-weight: 500;
  border-radius: 4px;
  background-color: $color-bg-muted;
  color: $color-text-muted;

  html[data-theme="dark"] & {
    background-color: $dark-color-bg-muted;
    color: $dark-color-text-muted;
  }
}

.badge-blue {
  background-color: lighten($color-primary, 40%);
  color: $color-primary-dark;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: $space-md;
  padding: $space-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  color: white;
  font-size: 1rem;
  width: 100%;
  justify-content: space-between;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .theme-icon {
    font-size: $font-size-2xl;
  }
}
```

### 12. `apps/habitualos-web/src/styles/_navigation.scss`

Exact copy from habitual-web (no changes):

```scss
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 1rem 1.5rem;
  background-color: transparent;
  box-shadow: none;
  transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar.active {
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  html[data-theme="dark"] & {
    background-color: $dark-color-bg;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
}

.navbar-brand {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  text-decoration: none;
  margin: 0 auto;

  html[data-theme="dark"] & {
    color: $dark-color-text;
  }
}

.navbar-brand:hover {
  text-decoration: none;
}

.navbar.active .navbar-brand {
  color: #333;
}

.sidemenu .toggle {
  width: 24px;
  height: 18px;
  position: relative;
  padding: 10px;
  transform: rotate(0deg);
  transition: 0.5s ease-in-out;
  cursor: pointer;
  z-index: 2000;
}

.sidemenu .toggle span {
  display: block;
  position: absolute;
  height: 3px;
  width: 24px;
  background: #333;
  border-radius: 1px;
  opacity: 1;
  left: 0;
  transform: rotate(0deg);
  transition: 0.25s ease-in-out;

  html[data-theme="dark"] & {
    background: $dark-color-text;
  }
}

.sidemenu .toggle span:nth-child(1) { top: 0px; width: 85%; }
.sidemenu .toggle span:nth-child(2) { top: 8px; }
.sidemenu .toggle span:nth-child(3) { top: 16px; width: 65%; }

.sidemenu .toggle.open span:nth-child(1) {
  top: 8px; width: 28px; height: 4px; transform: rotate(135deg);
}
.sidemenu .toggle.open span:nth-child(2) { opacity: 0; left: -60px; }
.sidemenu .toggle.open span:nth-child(3) {
  top: 8px; width: 28px; height: 4px; transform: rotate(-135deg);
}

.sidemenu-main {
  position: fixed;
  z-index: 1000;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100%;
  opacity: 0;
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
}

.sidemenu-open {
  overflow-y: hidden;
}

.sidemenu-open .sidemenu-main {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
}

.sidemenu-left {
  z-index: 1001;
  position: relative;
  height: 100vh;
  width: 100%;
  max-width: 600px;
  padding: 0 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidemenu-left ul {
  list-style: none;
  padding-top: 8vh;
  margin-top: 1rem;
  padding-bottom: 3vh;
  flex-grow: 1;
}

.sidemenu-left ul li {
  padding: 0.5rem 0;
  margin: 0;
}

.sidemenu-left ul li h3 {
  padding: 0;
  margin: 0;
  font-size: 2rem;
}

.sidemenu-left ul li h3 a {
  text-decoration: none;
  color: #fff;
  transition: opacity 0.2s;
}

.sidemenu-left ul li h3 a:hover {
  opacity: 0.8;
}

.sidemenu-left footer {
  padding: 2rem 0;
}

.sidemenu-right {
  position: fixed;
  width: 100%;
  height: 100vh;
  right: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 900;
}

@media (max-width: 768px) {
  .sidemenu-left { max-width: 100%; }
  .sidemenu-right { display: none; }
}

@media (min-width: 769px) {
  .sidemenu-left { max-width: 40%; }
}
```

### 13. `apps/habitualos-web/src/styles/_landing.scss`

Landing-page-specific styles:

```scss
// Hero section
.hero {
  padding: $space-2xl 0;
  text-align: center;

  @media (min-width: $breakpoint-md) {
    padding: 4rem 0 3rem;
  }
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: $space-md;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: $breakpoint-sm) {
    font-size: 2.5rem;
  }
}

.hero-tagline {
  font-size: $font-size-xl;
  color: $color-text-muted;
  max-width: 600px;
  margin: 0 auto $space-xl;
  line-height: 1.5;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

.hero-cta {
  display: flex;
  gap: $space-md;
  justify-content: center;
  flex-wrap: wrap;
}

// Section structure
.section {
  padding: $space-2xl 0;
  border-top: 1px solid $color-border;

  html[data-theme="dark"] & {
    border-top-color: $dark-color-border;
  }
}

.section-label {
  font-size: $font-size-sm;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: $color-primary;
  margin-bottom: $space-md;
}

.section-title {
  font-size: $font-size-2xl;
  font-weight: 700;
  margin-bottom: $space-md;
}

.section-intro {
  font-size: $font-size-lg;
  color: $color-text-muted;
  max-width: 640px;
  margin-bottom: $space-xl;
  line-height: 1.7;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

// System cards (HabitualOS + Pidgerton)
.system-card {
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: $space-xl;
  margin-bottom: $space-xl;

  html[data-theme="dark"] & {
    background: $dark-color-bg;
    border-color: $dark-color-border;
  }
}

.system-card-header {
  margin-bottom: $space-lg;
}

.system-name {
  font-size: $font-size-2xl;
  font-weight: 700;
  margin-bottom: $space-sm;
}

.system-subtitle {
  color: $color-text-muted;
  font-size: $font-size-lg;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

.system-body {
  display: grid;
  gap: $space-xl;

  @media (min-width: $breakpoint-lg) {
    grid-template-columns: 1fr 1fr;
  }
}

.system-description {
  p {
    margin-bottom: $space-md;
    line-height: 1.7;
  }
}

.system-details {
  h4 {
    font-size: $font-size-base;
    font-weight: 600;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: $space-sm;

    html[data-theme="dark"] & {
      color: $dark-color-text-muted;
    }
  }

  ul {
    list-style: none;
    margin-left: 0;
    margin-bottom: $space-md;
    padding: 0;
  }

  li {
    padding: $space-xs 0;
    padding-left: $space-md;
    position: relative;
    font-size: $font-size-sm;
    color: $color-text-muted;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
    }

    &::before {
      content: "→";
      position: absolute;
      left: 0;
      color: $color-primary;
    }

    html[data-theme="dark"] & {
      color: $dark-color-text-muted;
      border-bottom-color: $dark-color-border;
    }
  }
}

// Tech stack grid
.stack-grid {
  display: grid;
  gap: $space-md;
  grid-template-columns: 1fr;

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: $breakpoint-lg) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stack-item {
  background: $color-bg-muted;
  border-radius: 8px;
  padding: $space-md;

  html[data-theme="dark"] & {
    background: $dark-color-bg-muted;
  }
}

.stack-item-label {
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-primary;
  margin-bottom: $space-xs;
}

.stack-item-desc {
  font-size: $font-size-sm;
  color: $color-text-muted;
  margin: 0;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

// Approach principles
.principles {
  display: grid;
  gap: $space-lg;

  @media (min-width: $breakpoint-md) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.principle {
  padding: $space-lg;
  border-left: 3px solid $color-primary;

  html[data-theme="dark"] & {
    border-left-color: lighten($color-primary, 10%);
  }
}

.principle-title {
  font-weight: 600;
  margin-bottom: $space-sm;
}

.principle-body {
  font-size: $font-size-sm;
  color: $color-text-muted;
  margin: 0;
  line-height: 1.6;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}

// Writing/articles section
.writing-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.writing-item {
  padding: $space-md 0;
  border-bottom: 1px solid $color-border;

  &:last-child {
    border-bottom: none;
  }

  html[data-theme="dark"] & {
    border-bottom-color: $dark-color-border;
  }
}

.writing-item a {
  font-size: $font-size-lg;
  font-weight: 500;
}

.writing-meta {
  font-size: $font-size-sm;
  color: $color-text-muted;
  margin-top: $space-xs;
  margin-bottom: 0;

  html[data-theme="dark"] & {
    color: $dark-color-text-muted;
  }
}
```

### 14. `apps/habitualos-web/src/index.njk`

The landing page content. Write this with real, specific content. No vague marketing language.

```njk
---
layout: base.njk
title: HabitualOS — Agentic AI for Real Life
description: An agentic AI platform built and used daily to explore how AI agents can handle operational work while preserving human judgment and agency.
---

<!-- Hero -->
<section class="hero">
  <div class="container-narrow">
    <h1 class="hero-title">HabitualOS</h1>
    <p class="hero-tagline">
      Agentic AI for real life — daily productivity tools and relationship support,
      built and used in production to understand how AI agents actually behave when
      stakes are real.
    </p>
    <div class="hero-cta">
      <a href="https://www.linkedin.com/in/erikburns" class="btn btn-primary" target="_blank" rel="noopener">
        Follow on LinkedIn
      </a>
      <a href="#systems" class="btn btn-ghost">See the Work</a>
    </div>
  </div>
</section>

<!-- About -->
<section class="section" id="about">
  <div class="container-narrow">
    <p class="section-label">About</p>
    <h2 class="section-title">Built to be used, not demoed</h2>
    <p class="section-intro">
      Most agentic AI exists as demos or developer previews. HabitualOS is different:
      I'm the primary user, and these tools handle real daily work.
    </p>
    <p>
      The premise is simple: the best way to understand agentic AI is to live with it.
      When an agent manages your actual task load, the gaps in design quality become
      immediately visible. When AI supports your real relationship dynamics, the failure
      modes that don't show up in benchmarks surface quickly.
    </p>
    <p>
      HabitualOS is a personal R&D platform with two deployed systems. It's also
      becoming a shared infrastructure for building agentic apps focused on human
      empowerment and internal growth — which is why it's a monorepo.
    </p>
    <p>
      The work spans multi-agent orchestration, conversational UX patterns, structured
      agent signal protocols, and the problem of building AI systems that treat humans
      as collaborators rather than endpoints.
    </p>
  </div>
</section>

<!-- Systems -->
<section class="section" id="systems">
  <div class="container">
    <p class="section-label">Systems</p>
    <h2 class="section-title">Two deployed apps, one platform</h2>

    <!-- HabitualOS app card -->
    <div class="system-card">
      <div class="system-card-header">
        <h3 class="system-name">HabitualOS</h3>
        <p class="system-subtitle">Agentic daily productivity — executive function support and habit tracking</p>
      </div>
      <div class="system-body">
        <div class="system-description">
          <p>
            A multi-agent system that handles the operational overhead of daily work.
            Multiple specialized agents manage different concerns: task creation and
            scheduling, practice tracking, progress monitoring, and daily check-ins.
          </p>
          <p>
            The system uses a structured signal protocol for agent output — agents don't
            just respond with text, they emit typed signals like <code>GENERATE_ACTIONS</code>
            (create a scheduled task), <code>GENERATE_ASSET</code> (produce a deliverable now),
            or <code>STORE_MEASUREMENT</code> (record a check-in data point). This keeps agent
            behavior constrained and auditable.
          </p>
          <p>
            The practice component tracks habit consistency and generates insights from
            patterns over time. The Do component handles task management through
            conversational interfaces — you describe what needs to happen, agents
            structure it into scheduled actions.
          </p>
        </div>
        <div class="system-details">
          <h4>Technical patterns</h4>
          <ul>
            <li>Multi-agent orchestration with typed signal protocol</li>
            <li>Agent tool use: get_action_details, update_action for autonomous task management</li>
            <li>Conversational UX for creating and scheduling work</li>
            <li>Prompt caching for high-frequency agent interactions</li>
            <li>Long-context memory for session continuity</li>
            <li>Practice tracking with AI-generated pattern insights</li>
          </ul>
          <h4>Stack</h4>
          <ul>
            <li>Claude API (tool use, structured outputs, streaming)</li>
            <li>Node.js + Netlify Functions</li>
            <li>Google Firestore (user-partitioned)</li>
            <li>11ty + Nunjucks frontend</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Pidgerton card -->
    <div class="system-card">
      <div class="system-card-header">
        <h3 class="system-name">Pidgerton</h3>
        <p class="system-subtitle">Relationship support — journaling, pattern recognition, and AI-assisted reflection for navigating relational dynamics</p>
      </div>
      <div class="system-body">
        <div class="system-description">
          <p>
            A conversational journaling tool built for two people navigating complex
            relational dynamics together. Captures relationship moments through chat
            (no forms), identifies patterns across history, and offers AI-assisted
            reflection prompts.
          </p>
          <p>
            Named with intention. The whimsy is a deliberate design choice: AI in
            intimate contexts needs a different sensibility than enterprise software.
            Warmth and playfulness aren't decoration — they're part of what makes
            the tool approachable for emotionally charged material.
          </p>
          <p>
            This is active territory in wellness tech. Relationship support apps are
            an underexplored application of agentic AI, and building one in a real
            relationship produces signal that a mock dataset can't.
          </p>
        </div>
        <div class="system-details">
          <h4>Technical patterns</h4>
          <ul>
            <li>Conversation-driven moment capture (no structured forms)</li>
            <li>Temporal pattern recognition across relationship history</li>
            <li>Survey engine for structured check-ins between partners</li>
            <li>Privacy-first data architecture (fully user-partitioned)</li>
            <li>Export and reflection history</li>
          </ul>
          <h4>Domain relevance</h4>
          <ul>
            <li>Wellness tech and relationship support apps</li>
            <li>High-stakes conversational AI (emotional context)</li>
            <li>Human-centered agent design patterns</li>
            <li>Longitudinal context and memory across sessions</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Stack -->
<section class="section" id="stack">
  <div class="container">
    <p class="section-label">Stack</p>
    <h2 class="section-title">Technologies</h2>
    <p class="section-intro">
      Production systems, not toy demos. Everything below is running in deployed apps
      handling real workloads.
    </p>

    <div class="stack-grid">
      <div class="stack-item">
        <p class="stack-item-label">Claude API</p>
        <p class="stack-item-desc">Tool use, structured outputs, prompt caching, extended thinking, streaming responses</p>
      </div>
      <div class="stack-item">
        <p class="stack-item-label">Multi-agent orchestration</p>
        <p class="stack-item-desc">Typed signal protocols, agent-to-agent handoffs, long-context memory, autonomous scheduling</p>
      </div>
      <div class="stack-item">
        <p class="stack-item-label">Node.js + Netlify Functions</p>
        <p class="stack-item-desc">Serverless backend, edge functions for streaming, scheduled cron agents</p>
      </div>
      <div class="stack-item">
        <p class="stack-item-label">Google Firestore</p>
        <p class="stack-item-desc">Real-time database, user-partitioned data architecture, service layer pattern</p>
      </div>
      <div class="stack-item">
        <p class="stack-item-label">11ty + Nunjucks</p>
        <p class="stack-item-desc">Static site generation, local-first where possible, modular template architecture</p>
      </div>
      <div class="stack-item">
        <p class="stack-item-label">Zero Gravity</p>
        <p class="stack-item-desc">Semantic microformat for agent-parseable content — structured metadata that preserves document readability</p>
      </div>
    </div>
  </div>
</section>

<!-- Approach -->
<section class="section" id="approach">
  <div class="container-narrow">
    <p class="section-label">Approach</p>
    <h2 class="section-title">How I think about this work</h2>

    <div class="principles">
      <div class="principle">
        <p class="principle-title">AI as collaborator, not oracle</p>
        <p class="principle-body">
          Agents surface options and handle operational overhead.
          Humans decide. The goal is to amplify judgment, not replace it.
          Systems that obscure this boundary fail in high-stakes contexts.
        </p>
      </div>
      <div class="principle">
        <p class="principle-title">Build in contexts that matter</p>
        <p class="principle-body">
          Demo apps optimize for impressiveness. Production tools optimize
          for reliability. Using these systems daily means the failure modes
          that don't show up in benchmarks become immediately visible.
        </p>
      </div>
      <div class="principle">
        <p class="principle-title">Structured outputs constrain behavior</p>
        <p class="principle-body">
          Typed agent signals and tool use schemas make agent behavior
          predictable and auditable. Freeform text generation is a last resort,
          not a default.
        </p>
      </div>
      <div class="principle">
        <p class="principle-title">Context and memory change the product</p>
        <p class="principle-body">
          Agents that know your history, patterns, and preferences are categorically
          different from stateless chatbots. Long-context memory and session
          continuity aren't features — they're the foundation.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- Writing -->
<section class="section" id="writing">
  <div class="container-narrow">
    <p class="section-label">Writing</p>
    <h2 class="section-title">Articles and notes</h2>
    <p class="section-intro">
      I write about what I learn building these systems.
      Most of it lives on LinkedIn for now.
    </p>
    <ul class="writing-list">
      <li class="writing-item">
        <a href="https://www.linkedin.com/in/erikburns" target="_blank" rel="noopener">
          Follow on LinkedIn for updates
        </a>
        <p class="writing-meta">Articles on agentic AI, conversational UX, and building with Claude</p>
      </li>
    </ul>
  </div>
</section>
```

---

## Build Instructions

After creating all files, run these commands from the repo root:

```bash
# Install dependencies for the new app
cd /Users/erik/Sites/habitualos && pnpm install

# Verify the new app builds
pnpm --filter habitualos-web build
```

If the build succeeds, `apps/habitualos-web/_site/index.html` will exist.

To run locally:
```bash
pnpm --filter habitualos-web dev
```
This starts the dev server at http://localhost:8081.

---

## Deploy

The `netlify.toml` is included in the app. To deploy:
1. Push this code to the repo
2. In Netlify dashboard: **Add new site** → connect to the same GitHub repo
3. Set **Base directory** to `apps/habitualos-web`
4. Netlify will pick up the `netlify.toml` automatically
5. No environment variables needed (pure static)

---

## Notes

- The LinkedIn URL `https://www.linkedin.com/in/erikburns` is a placeholder — update it with Erik's actual LinkedIn URL if different
- The writing section is intentionally sparse — add real article links as they exist
- Do NOT add auth, backend functions, or any dynamic features
- Do NOT modify any existing apps
- Keep the `<code>` tags in the system description — they add technical specificity
- The `_site/css/` passthrough in `.eleventy.js` is correct: sass compiles directly to `_site/css/main.css`, and 11ty passes it through unchanged
