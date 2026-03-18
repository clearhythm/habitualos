# habitualos-web — Claude Context

Static marketing site for HabitualOS. 11ty + Nunjucks + SCSS, hosted on Netlify.

## Dev Server

```
npm start    # eleventy --serve --port=8080
npm run build
```

## CSS Compilation (IMPORTANT)

SCSS is compiled **natively by 11ty** via `addExtension("scss")` in `.eleventy.js` — there is NO separate sass CLI process.

- Source entry point: `src/styles/main.scss`
- Compiled output (what the browser gets): `_site/styles/main.css`
- 11ty watches all imported SCSS partials automatically via `self.addDependencies()`
- Hot reload works out of the box — edit any `_*.scss` partial and the browser reloads
- Any `main.css` files outside `_site/` are stale — do not check these for debugging
- Always check `_site/styles/main.css` to verify compiled output

## Key Source Files

- `src/index.njk` — page content
- `src/_includes/base.njk` — HTML shell
- `src/_includes/nav.njk` — navbar
- `src/styles/main.scss` — SCSS entry point
- `src/styles/_variables.scss` — color/spacing/font tokens
- `src/styles/_landing.scss` — section styles
- `src/styles/_navigation.scss` — nav styles
