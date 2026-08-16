// Page script for /menu/ (also reused, restaurant-filtering only, by
// /menu-review/). /menu/ has two phases: browse (the reference list) and
// detail (one category, reached by clicking it or via Train). Detail has
// two modes, Review and Practice, toggled in place without changing
// phase — Review shows the category's items, Practice is the text chat.
// Switching Review <-> Practice never resets the chat: the transcript DOM
// and in-memory history just stay alive underneath, exactly like they
// would if Practice were its own permanent tab, so leaving and coming
// back mid-conversation (within the same category) picks up where it
// left off. There used to be a separate /learn/ page with its own picker
// phase, then a teach/drill split with "I'm Ready"/"Back to X" verbs;
// both are gone in favor of this Review/Practice framing.
//
// Menu *content* (categories + items) is fetched on demand and cached in
// localStorage (see collections/restaurant-menus.js) rather than baked
// into the page at build time for every restaurant — only the current
// restaurant's data is ever in memory or the DOM. The restaurant
// switcher itself (just names) stays build-time-baked; it's tiny.
//
// This file owns layout/rendering/filtering only — browse/detail phase
// management, the restaurant switcher, and the browse list's tier pills.
// The Practice chat itself (streaming, fact coverage, transitions, chat
// persistence) is a separate concern, owned by learn-practice.js — this
// file calls into it (startPractice/exitPractice/hasActiveSession) rather
// than containing that logic inline.
//
// URL scheme: /menu/food/, /menu/drinks/ (browse) and
// /menu/food/{category}, /menu/drinks/{category} (detail) are real
// routes — silently rewritten to this same file by netlify.toml (status
// 200, wildcarded on the category segment). The Review/Practice toggle
// rides along as a #review/#practice hash on the same category URL
// (set/read in setMode/modeFromHash) rather than a distinct route — a
// client-side-only fragment, no server round-trip, but enough to survive
// a reload or browser back/forward without silently re-deriving mode
// from coverage every time. The study cards' Overview/Preparation tabs
// (menu-study-cards.js) are a second, independent state living in the
// same fragment as a query-style param — #review?card-content=preparation
// — not nested inside mode (see writeHash/modeFromHash/cardContentFromHash).
import { getOrCreateUserId } from './utils/user-id.js';
import { resolveInitialRestaurantId, applyRestaurantFilter } from './restaurant.js';
import {
  loadFactCoverageCache,
  hydrateRestaurantProgress,
  computeTierBySection,
  tierForSectionInProgress,
  passForSection
} from './learn-coverage.js';
import { hasActiveSession, exitPractice, startPractice } from './learn-practice.js';
import { getRestaurantMenu } from './collections/restaurant-menus.js';
import { sectionCardImages, prepImageForItem } from './menu-card-images.js';
import { renderStudyCards, resetToFirstCard } from './menu-study-cards.js';
import { log } from './utils/log.js';

const CONTENT_TYPE_KEY = 'tico-current-content-type';

// Single source of truth for the content-type <-> URL mapping — every
// other place that needs one direction or the other reads from this
// instead of re-deriving it.
const CONTENT_TYPE_PATHS = { food: '/menu/food/', drink: '/menu/drinks/' };

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function pathForContentType(type) {
  return CONTENT_TYPE_PATHS[type] || CONTENT_TYPE_PATHS.food;
}

function pathForTeach(type, sectionName) {
  return `${pathForContentType(type)}${slugify(sectionName)}`;
}

// Splits a pathname into { contentType, categorySlug }. categorySlug is
// null for a bare /menu/food/ visit (browse); both are null for
// anything outside the /menu/food|drinks/ namespace (e.g. bare /menu/).
function parsePath(pathname) {
  for (const [type, base] of Object.entries(CONTENT_TYPE_PATHS)) {
    // base carries its own trailing slash (e.g. '/menu/drinks/'), but a
    // bare visit to '/menu/drinks' (no trailing slash — what a typed URL
    // or an external link is likely to produce) is exactly as valid and
    // must resolve the same way, so the trailing slash can't be required
    // on both sides of the comparison.
    const baseNoSlash = base.replace(/\/$/, '');
    if (pathname === baseNoSlash || pathname.startsWith(base)) {
      const rest = pathname.slice(baseNoSlash.length).replace(/^\/+|\/+$/g, '');
      return { contentType: type, categorySlug: rest || null };
    }
  }
  return { contentType: null, categorySlug: null };
}

// A direct visit (or browser back/forward — see the popstate listener
// below) to /menu/food/... or /menu/drinks/... shows that type
// regardless of what's in localStorage from a previous session; bare
// /menu/ falls back to localStorage (defaulting to food) since the URL
// alone doesn't say which type it should be.
function getCurrentContentType() {
  const { contentType } = parsePath(location.pathname);
  if (contentType) return contentType;
  try {
    return localStorage.getItem(CONTENT_TYPE_KEY) || 'food';
  } catch {
    return 'food';
  }
}

function setCurrentContentType(type) {
  try { localStorage.setItem(CONTENT_TYPE_KEY, type); } catch {}
}

function categoriesFor(contentType) {
  return currentMenuData?.[contentType === 'drink' ? 'drinks' : 'food'] || [];
}

// Finds the exact category name a URL's category segment refers to,
// scoped to the current restaurant + content type. Reads currentMenuData
// (in-memory, already scoped to the current restaurant) rather than
// querying the DOM — categories aren't baked per-restaurant into the
// page anymore, so there's nothing to query until the menu has loaded.
function findSectionBySlug(contentType, slug) {
  const match = categoriesFor(contentType).find((c) => slugify(c.name) === slug);
  return match?.name || null;
}

function applyContentTypeFilter(contentType) {
  const toggled = document.querySelectorAll('.menu-content-panel[data-content-type]');
  toggled.forEach((el) => {
    el.hidden = el.dataset.contentType !== contentType;
  });
  log('debug', '[menu] applyContentTypeFilter', { contentType, elementsToggled: toggled.length });
  document.querySelectorAll('.page-title-switcher').forEach((wrapper) => {
    const label = contentType === 'drink' ? 'Drinks' : 'Food';
    const trigger = wrapper.querySelector('.page-title-switcher__label');
    if (trigger) trigger.textContent = label;
    wrapper.querySelectorAll('.content-type-switcher__option').forEach((opt) => {
      opt.classList.toggle('is-current', opt.dataset.contentType === contentType);
    });
  });
}

// Train's icon shape depends on both restaurant and content type (food
// tray vs. each restaurant's own drink glass) — one <svg> per Train link,
// JS sets its actual contents directly rather than baking every
// restaurant's every shape and hidden-toggling between them. That old
// approach (two <svg>s per link, four total per restaurant) was real
// duplication of the same kind the whole-menu-content fetch/cache change
// eliminated elsewhere on this page, just at a smaller scale — and it's
// what made a genuinely simple "which icon shows" question hard to
// answer with confidence even when the toggle logic itself was correct.
const TRAIN_ICON_SHAPES = {
  food: {
    className: 'icon-tray',
    viewBox: '2 1 20 17', width: 30, height: 26,
    inner: '<path d="M5 14a7 7 0 0 1 14 0"/><line x1="12" y1="6.5" x2="12" y2="4.5"/><circle cx="12" cy="3.6" r="0.9" fill="currentColor" stroke="none"/><path d="M8 11.5a5 5 0 0 1 2.5-3.5" opacity="0.5"/><ellipse cx="12" cy="14.5" rx="8.5" ry="1.7"/>'
  },
  'drink-margaritaville': {
    // Flat rim, rounded (not straight-diagonal) sides bulging out then
    // narrowing to a flat bottom, plain ring as the lime-wheel garnish
    // overlapping the rim — verified by rendering locally (qlmanage -t
    // on a scratch SVG) before landing here; earlier attempts (a
    // scalloped curve, then a straight-sided wedge) either looked like a
    // bird/arrow or read as too angular once actually rendered.
    className: 'icon-margarita',
    viewBox: '2 2 22 19', width: 33, height: 29,
    inner: '<path d="M4 4L20 4Q21 7 16 10L8 10Q3 7 4 4Z"/><line x1="12" y1="10" x2="12" y2="18"/><line x1="8" y1="18" x2="16" y2="18"/><circle cx="19.5" cy="4.5" r="2"/>'
  },
  'drink-default': {
    className: 'icon-martini',
    viewBox: '3 1 18 20', width: 27, height: 30,
    inner: '<path d="M4 4h16l-8 9z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="9.5" y1="2" x2="13.5" y2="6.5"/><circle cx="11.5" cy="5" r="1.3" fill="currentColor" stroke="none"/>'
  }
};

function trainIconShapeFor(restaurantId, contentType) {
  if (contentType !== 'drink') return TRAIN_ICON_SHAPES.food;
  return TRAIN_ICON_SHAPES[`drink-${restaurantId}`] || TRAIN_ICON_SHAPES['drink-default'];
}

// Each shape gets its own class (icon-tray/icon-margarita/icon-martini)
// so any one of them can be nudged independently in CSS, layered on top
// of the shared .page-header__action svg { bottom: 2px } baseline in
// _menu-review.scss — that rule centers icons against the text in
// general, but different shapes' visual weight sits differently within
// their own bounding box.
function updateTrainIcon(trainLink, restaurantId, contentType) {
  const icon = trainLink.querySelector('.train-icon');
  if (!icon) return;
  const shape = trainIconShapeFor(restaurantId, contentType);
  icon.setAttribute('viewBox', shape.viewBox);
  icon.setAttribute('width', shape.width);
  icon.setAttribute('height', shape.height);
  icon.innerHTML = shape.inner;
  // Not icon.className = ... — on SVG elements className is an
  // SVGAnimatedString, not a plain string, so assigning to it directly
  // silently doesn't update the actual class attribute. setAttribute
  // works regardless of element type/namespace.
  icon.setAttribute('class', `train-icon ${shape.className}`);
}

// Target section: the restaurant's last-trained section if it isn't
// Covered yet (resume where they left off), else the first non-Covered
// section in list order, else just the first section (nothing left to
// train — reopen it to review). Shared by updateTrainLink (the browse
// list's Train button) and the Covered banner's Continue button (see
// handlePracticeSessionStarted/setMode below) — both are the same "what's
// next" question, scoped to one content type (food or drinks).
function isCategoryCovered(sectionName) {
  const progress = currentRestaurantProgress.sections?.[sectionName]?._progress;
  return progress === 'Covered' || progress === 'Mastered';
}

function nextTrainTarget(contentType) {
  const categoryNames = categoriesFor(contentType).map((c) => c.name);
  if (!categoryNames.length) return null;

  const lastTrained = currentRestaurantProgress.lastTrained;
  return (lastTrained && categoryNames.includes(lastTrained) && !isCategoryCovered(lastTrained))
    ? lastTrained
    : categoryNames.find((name) => !isCategoryCovered(name)) || categoryNames[0];
}

// Covered sections default straight into Practice (re-drill what you
// already know) rather than Review. An in-progress session always wins
// regardless of coverage, though — a reload mid-practice should stay in
// practice, not bounce to Review because the underlying section happens
// to already be covered.
function initialModeFor(contentType, sectionName) {
  if (hasActiveSession(currentRestaurantId, sectionName)) return 'practice';
  return isCategoryCovered(sectionName) ? 'practice' : 'review';
}

// Reads the URL's #review/#practice fragment (see setMode) — only
// meaningful for a reload/direct-visit/back-forward landing on a URL that
// already names a section, so callers resolving a FRESH section (a
// category click, the Train link) don't consult this: a stale hash left
// over from whatever section you were on before shouldn't leak into a
// section you're entering for the first time this visit.
function modeFromHash() {
  const mode = location.hash.slice(1).split('?')[0];
  return mode === 'practice' || mode === 'review' ? mode : null;
}

// The study cards' Server/Bartender toggle (see menu-study-cards.js) rides
// as a query-style param on the same hash: #review?card-content=preparation.
// A state alongside Review/Practice, not nested inside it — same "only
// meaningful for reload/popstate, not a fresh section entry" rule as
// modeFromHash above, and the same reasoning: don't leak the last
// section's choice into a section you're opening for the first time.
function cardContentFromHash() {
  const query = location.hash.split('?')[1] || '';
  return new URLSearchParams(query).get('card-content') === 'preparation' ? 'preparation' : null;
}

// Rebuilds the full #mode?card-content=... hash from scratch rather than
// patching it in place — the two segments are independent state (see
// above) but only ever live together in one URL fragment, so whichever
// one changes, the other has to be explicitly carried forward or it's
// silently dropped. replaceState, not pushState — matches setMode's own
// reasoning: neither of these is real navigation, so neither should add
// its own browser-history entry.
function writeHash(mode, cardContent) {
  let hash = `#${mode}`;
  if (cardContent === 'preparation') hash += '?card-content=preparation';
  const hashedPath = `${location.pathname}${hash}`;
  if (location.pathname + location.hash !== hashedPath) {
    history.replaceState(null, '', hashedPath);
  }
}

function updateTrainLink(restaurantId, contentType) {
  const venue = document.querySelector(`.menu-review__venue[data-restaurant="${restaurantId}"]`);
  const trainLink = venue?.querySelector('[data-train-link]');
  if (!trainLink) {
    log('debug', '[menu] updateTrainLink: no Train link found for restaurant', { restaurantId, contentType });
    return;
  }

  updateTrainIcon(trainLink, restaurantId, contentType);

  const target = nextTrainTarget(contentType);
  if (!target) {
    log('debug', '[menu] updateTrainLink: icon set, no categories loaded yet for target/href', { restaurantId, contentType });
    return;
  }

  trainLink.href = pathForTeach(contentType, target);
  trainLink.dataset.targetSection = target;
  log('debug', '[menu] updateTrainLink', { restaurantId, contentType, target, href: trainLink.href });
}

// ─── Menu content: fetched + cached, rendered client-side ────────────
// currentMenuData is always scoped to currentRestaurantId — reassigned
// whenever the restaurant changes, never merged/accumulated across
// restaurants (see /api/restaurant-menu-get, collections/restaurant-menus.js).
let currentMenuData = null;

// This restaurant's full learn-progress ({sections, lastTrained}) —
// fetched once per restaurant load, kept in sync locally afterward (see
// refreshPillFor) rather than re-fetched on every small change. Each
// section's own object in `sections` carries its _progress tier directly
// (Training/Covered/Mastered), read straight through, never re-derived.
let currentRestaurantProgress = { sections: {}, lastTrained: null };

// JS port of menu-categories.njk's macro — same classes throughout, so
// the existing CSS needs no changes. Built with createElement/textContent
// (not innerHTML) matching this file's existing DOM-building style —
// Firestore data is trusted, but there's no reason to treat it
// differently from the rest of this file's rendering.
function renderCategoryList(categories, { clickable = false, tierBySection = null } = {}) {
  const container = document.createElement('div');
  container.className = 'menu-review__categories';

  categories.forEach((category) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'menu-category';

    // The whole row (name + pill) is one clickable target, not just the
    // name text — a small pill sitting just outside the tap target read
    // as a dead zone. header itself becomes the <button> when clickable;
    // heading is just a plain span inside it.
    const header = document.createElement(clickable ? 'button' : 'div');
    header.className = clickable ? 'menu-category__header menu-category__header--link' : 'menu-category__header';
    if (clickable) {
      header.type = 'button';
      header.dataset.section = category.name;
    }

    const heading = document.createElement(clickable ? 'span' : 'h3');
    heading.className = 'menu-category__name';
    heading.textContent = category.name;
    header.appendChild(heading);

    // Pill: blank/no pill by default, kept deliberately quiet — only
    // "training" (the single most-recently-entered-Practice section) or
    // "covered" (every fact covered) ever show. See learn-coverage.js.
    const tier = tierBySection?.[category.name];
    if (tier && tier !== 'blank') {
      const pill = document.createElement('span');
      pill.className = `menu-category__pill menu-category__pill--${tier}`;
      pill.textContent = tier === 'covered' ? 'Covered' : 'Training';
      header.appendChild(pill);
    }

    catDiv.appendChild(header);

    const ul = document.createElement('ul');
    ul.className = 'menu-category__items';
    category.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'menu-item';

      const row = document.createElement('div');
      row.className = 'menu-item__row';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'menu-item__name';
      nameSpan.textContent = item.name;
      row.appendChild(nameSpan);
      if (item.price) {
        const priceSpan = document.createElement('span');
        priceSpan.className = 'menu-item__price';
        priceSpan.textContent = `$${item.price}`;
        row.appendChild(priceSpan);
      }
      li.appendChild(row);

      if (item.description) {
        const desc = document.createElement('p');
        desc.className = 'menu-item__desc';
        desc.textContent = item.description;
        li.appendChild(desc);
      }

      if (item.tags && item.tags.length) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'menu-item__tags';
        item.tags.forEach((tag) => {
          const tagSpan = document.createElement('span');
          tagSpan.className = 'menu-item__tag';
          tagSpan.textContent = tag;
          tagsDiv.appendChild(tagSpan);
        });
        li.appendChild(tagsDiv);
      }

      if (item.notes) {
        const notes = document.createElement('p');
        notes.className = 'menu-item__notes';
        notes.textContent = item.notes;
        li.appendChild(notes);
      }

      ul.appendChild(li);
    });
    catDiv.appendChild(ul);
    container.appendChild(catDiv);
  });

  return container;
}

// Replaces the current restaurant's two content panels' contents —
// clearing whatever was there (the skeleton placeholder, on first load)
// and rendering the real category lists in one shot.
function renderMenuPanels(restaurantId, menuData, tierBySection) {
  const venue = document.querySelector(`.menu-review__venue[data-restaurant="${restaurantId}"]`);
  if (!venue) return;
  const foodPanel = venue.querySelector('.menu-content-panel[data-content-type="food"]');
  const drinkPanel = venue.querySelector('.menu-content-panel[data-content-type="drink"]');
  if (foodPanel) {
    foodPanel.innerHTML = '';
    foodPanel.appendChild(renderCategoryList(menuData.food, { clickable: true, tierBySection }));
  }
  if (drinkPanel) {
    drinkPanel.innerHTML = '';
    drinkPanel.appendChild(renderCategoryList(menuData.drinks, { clickable: true, tierBySection }));
  }
}

async function loadMenuForRestaurant(restaurantId) {
  log('debug', '[menu] loadMenuForRestaurant: start', { restaurantId });
  // Menu content renders as soon as its own cache/fetch resolves (Ticket
  // 4's original fast path) — restaurant-wide progress is a separate,
  // slower round trip (no client cache of its own) that shouldn't gate
  // the menu itself. It fills in the pills/Train-link a moment later
  // instead, same "progressively enhance, don't block" tolerance already
  // accepted for the browse skeleton.
  const menuData = await getRestaurantMenu(restaurantId);
  currentMenuData = menuData;
  renderMenuPanels(restaurantId, menuData, computeTierBySection(menuData, currentRestaurantProgress));
  log('debug', '[menu] loadMenuForRestaurant: rendered', {
    restaurantId,
    foodCategories: menuData.food?.length || 0,
    drinkCategories: menuData.drinks?.length || 0,
  });

  hydrateRestaurantProgress(getOrCreateUserId(), restaurantId).then((progress) => {
    if (currentRestaurantId !== restaurantId) return; // restaurant changed again before this resolved
    currentRestaurantProgress = progress;
    renderMenuPanels(restaurantId, currentMenuData, computeTierBySection(currentMenuData, progress));
    if (currentPhase === 'browse') updateTrainLink(restaurantId, currentContentType);
  });

  return menuData;
}

// Updates one category's browse-list pill in place, from
// currentRestaurantProgress (kept in sync locally after writes) — avoids a
// full re-fetch/re-render just to reflect a tier that changed this session.
function refreshCategoryPill(sectionName, tier) {
  const header = document.querySelector(`.menu-category__header--link[data-section="${sectionName}"]`);
  if (!header) return;
  let pill = header.querySelector('.menu-category__pill');
  if (!tier || tier === 'blank') {
    pill?.remove();
    return;
  }
  if (!pill) {
    pill = document.createElement('span');
    header.appendChild(pill);
  }
  pill.className = `menu-category__pill menu-category__pill--${tier}`;
  pill.textContent = tier === 'covered' ? 'Covered' : 'Training';
}

function refreshPillFor(sectionName) {
  if (!sectionName) return;
  refreshCategoryPill(sectionName, tierForSectionInProgress(currentMenuData, currentRestaurantProgress, sectionName));
}

// ─── Practice module callbacks ────────────────────────────────────────
// learn-practice.js owns the drill itself; these are the only two points
// where it needs to reach back into this file's rendering — a new session
// starting (lastTrained bookkeeping) and coverage changing (review
// highlight + pill + Train link).
function handlePracticeSessionStarted() {
  const previousLastTrained = currentRestaurantProgress.lastTrained;
  currentRestaurantProgress = { ...currentRestaurantProgress, lastTrained: currentSection };
  if (previousLastTrained && previousLastTrained !== currentSection) refreshPillFor(previousLastTrained);
  refreshPillFor(currentSection);
}

function handleCoverageChanged(pass, sectionCoverage) {
  const review = detailEl.querySelector('.menu-detail__review');
  if (review) review.dataset.pass = pass;
  // sectionCoverage already carries this section's _progress field
  // (Training/Covered/Mastered) directly — nothing extra to track.
  currentRestaurantProgress = {
    ...currentRestaurantProgress,
    sections: { ...currentRestaurantProgress.sections, [currentSection]: sectionCoverage }
  };
  refreshPillFor(currentSection);
  updateTrainLink(currentRestaurantId, currentContentType);
}

// ─── Phase/mode state ─────────────────────────────────────────────────
const browseEl = document.getElementById('menu-browse');
const detailEl = document.getElementById('menu-detail');
const practiceEl = document.getElementById('menu-practice');

let currentRestaurantId = null;
let currentContentType = 'food';
let currentSection = null; // category name — only meaningful in detail
let currentSectionItemIds = []; // item ids for currentSection — only meaningful in detail
let currentSectionItems = []; // full item objects for currentSection ({id, name, description, price, ...}) — passed into startPractice so the Practice drill's "Show visual aid" scaffold (see learn-markers.js) can render an item's real menu text, not just its image
let currentPhase = 'browse'; // 'browse' | 'detail'
let currentMode = 'review'; // 'review' | 'practice' — only meaningful in detail

function showPhase(phase) {
  currentPhase = phase;
  if (browseEl) browseEl.hidden = phase !== 'browse';
  if (detailEl) detailEl.hidden = phase !== 'detail';
  log('debug', '[menu] showPhase', { phase });
}

// Applies review/practice mode to the (single, dynamically-rendered)
// detail shell.
function applyMode(mode) {
  currentMode = mode;
  detailEl?.querySelectorAll('.menu-detail__review').forEach((el) => { el.hidden = mode !== 'review'; });
  detailEl?.querySelectorAll('.menu-detail__mode-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
  });
  if (practiceEl) practiceEl.hidden = mode !== 'practice';
  log('debug', '[menu] applyMode', { mode, currentSection });
}

// startPractice is idempotent — calling it again for a session that's
// already open for this exact restaurant+section just re-syncs the UI,
// so toggling back to Practice after a Review detour resumes the same
// conversation rather than restarting it (see module comment).
function setMode(mode) {
  applyMode(mode);
  // Keeps the URL's #review/#practice fragment in sync with whatever
  // mode is actually active, so a reload or direct revisit resumes here
  // (see modeFromHash) instead of always re-deriving from coverage.
  // Carries the current card-content forward rather than dropping it —
  // switching to Practice and back to Review should keep whatever
  // Server/Bartender state was already set, not reset it.
  writeHash(mode, cardContentFromHash());
  // Review's DOM isn't rebuilt on every toggle (see module comment above
  // applyMode) — resetToFirstCard is a no-op for plain-list sections, and
  // for study-card sections puts you back at card 1 every time Review is
  // (re)selected, not just on the section's first render.
  if (mode === 'review') {
    resetToFirstCard();
  } else if (mode === 'practice') {
    startPractice(currentRestaurantId, currentSection, currentSectionItemIds, currentSectionItems, {
      onSessionStarted: handlePracticeSessionStarted,
      onCoverageChanged: handleCoverageChanged,
      onTransitionToReview: () => setMode('review'),
      onCoveredContinue: () => {
        const next = nextTrainTarget(currentContentType);
        if (next) enterDetail(currentContentType, next, initialModeFor(currentContentType, next), null);
      }
    });
  }
}

// Reads the restaurant's display name from the sidemenu switcher's own
// DOM (nav.njk already renders it there) — no separate restaurant-name
// data needed client-side just for this.
function getRestaurantName(restaurantId) {
  return document.querySelector(`.restaurant-switcher__option[data-restaurant-id="${restaurantId}"]`)?.textContent || '';
}

// Builds the detail shell's entire contents (breadcrumb, restaurant
// name, "Food › Category" title, Review/Practice toggle, review content)
// fresh into #menu-detail — replaces the old per-category baked-and-
// hidden blocks now that categories aren't known until the menu fetch
// resolves. The review panel's data-pass starts from whatever's cached
// locally (instant, no network) — learn-practice.js corrects it once
// hydration reconciles against Firestore, via the onCoverageChanged
// callback above.
function renderDetailBlock(contentType, sectionName, cardContent) {
  const category = categoriesFor(contentType).find((c) => c.name === sectionName);
  if (!category) {
    log('debug', '[menu] renderDetailBlock: category not found', { contentType, sectionName });
    return false;
  }

  currentSectionItemIds = category.items.map((item) => item.id);
  currentSectionItems = category.items;

  detailEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'menu-detail__header';

  const venueName = document.createElement('p');
  venueName.className = 'menu-review__venue-name';
  venueName.textContent = getRestaurantName(currentRestaurantId);
  header.appendChild(venueName);

  const title = document.createElement('p');
  title.className = 'page-title menu-detail__title';
  const crumb = document.createElement('a');
  crumb.className = 'menu-detail__crumb';
  crumb.href = pathForContentType(contentType);
  crumb.textContent = contentType === 'drink' ? 'Drinks' : 'Food';
  title.appendChild(crumb);
  const sep = document.createElement('span');
  sep.className = 'menu-detail__crumb-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '›';
  title.appendChild(sep);
  title.appendChild(document.createTextNode(` ${category.name}`));
  header.appendChild(title);

  const toggle = document.createElement('div');
  toggle.className = 'menu-detail__toggle';
  [['review', 'Review'], ['practice', 'Practice']].forEach(([mode, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-detail__mode-btn';
    btn.dataset.mode = mode;
    btn.textContent = label;
    toggle.appendChild(btn);
  });
  header.appendChild(toggle);

  detailEl.appendChild(header);

  const review = document.createElement('div');
  review.className = 'menu-detail__review';
  review.dataset.pass = passForSection(currentSectionItemIds, loadFactCoverageCache(currentRestaurantId, sectionName));

  // Card view only for sections where every item has a reference image
  // (see menu-card-images.js) — everything else keeps the plain list as
  // the only view. Sections WITH images still get the plain list too,
  // reachable via a toggle — cards are for studying, the list is for a
  // fast lookup ("does it have capers?") without paging through images.
  const cardImages = sectionCardImages(currentRestaurantId, sectionName, category.items);
  if (cardImages) {
    const cardsView = document.createElement('div');
    const listView = document.createElement('div');
    listView.hidden = true;
    listView.appendChild(renderCategoryList([category], { clickable: false }));

    const viewToggle = document.createElement('button');
    viewToggle.type = 'button';
    viewToggle.className = 'menu-review__view-toggle';
    viewToggle.textContent = 'Show text only';
    viewToggle.addEventListener('click', () => {
      listView.hidden = !listView.hidden;
      cardsView.hidden = !cardsView.hidden;
      viewToggle.textContent = listView.hidden ? 'Show text only' : 'Show visual aids';
    });

    const prepImages = {};
    category.items.forEach((item) => {
      const prepImage = prepImageForItem(currentRestaurantId, item.id);
      if (prepImage) prepImages[item.id] = prepImage;
    });

    renderStudyCards(cardsView, category.items, cardImages, {
      onPracticeRequested: () => setMode('practice'),
      initialCardContent: cardContent,
      onCardContentChanged: (mode) => writeHash('review', mode),
      prepImages
    });

    review.appendChild(cardsView);
    review.appendChild(listView);
    review.appendChild(viewToggle);
  } else {
    review.appendChild(renderCategoryList([category], { clickable: false }));
  }
  detailEl.appendChild(review);

  return true;
}

function enterBrowse(contentType, { pushUrl = true } = {}) {
  log('debug', '[menu] enterBrowse', { contentType, pushUrl, previousContentType: currentContentType, previousPhase: currentPhase });
  currentContentType = contentType;
  currentSection = null;
  setCurrentContentType(contentType);
  applyContentTypeFilter(contentType);
  // Skipped (not called with stale/empty data) when the menu hasn't
  // loaded yet — true only on the very first call during init, before
  // loadMenuForRestaurant resolves. That caller is responsible for its
  // own follow-up updateTrainLink() once data's in, so this never fires
  // twice for the same load — every other call site (toggle clicks,
  // breadcrumb, restaurant switch already past its own fetch) already
  // has real data by the time enterBrowse runs.
  if (currentRestaurantId && currentMenuData) updateTrainLink(currentRestaurantId, contentType);
  // applyMode (called from enterDetail) is what normally shows/hides
  // #menu-practice — leaving detail phase entirely bypasses that, so its
  // visibility (and the composer inside it) has to be reset explicitly
  // here or it just carries over from whatever mode was last active.
  if (practiceEl) practiceEl.hidden = true;
  showPhase('browse');
  if (pushUrl) {
    const path = pathForContentType(contentType);
    if (location.pathname !== path) history.pushState(null, '', path);
  }
}

// cardContent: same "only meaningful for reload/popstate, not a fresh
// section entry" rule as mode — callers pass cardContentFromHash() for a
// restore, or null for a fresh click/Train-link entry (see cardContentFromHash).
function enterDetail(contentType, sectionName, mode, cardContent, { pushUrl = true } = {}) {
  const isNewSection = currentPhase !== 'detail' || currentSection !== sectionName;
  log('debug', '[menu] enterDetail', { contentType, sectionName, mode, cardContent, pushUrl, isNewSection });
  if (isNewSection) exitPractice();
  currentContentType = contentType;
  currentSection = sectionName;
  setCurrentContentType(contentType);
  if (!renderDetailBlock(contentType, sectionName, cardContent)) return;
  showPhase('detail');
  // Path first, then mode — setMode writes its #review/#practice
  // fragment against whatever location.pathname already is, so the path
  // has to land first or its own pushState (no hash) would wipe it out.
  if (pushUrl) history.pushState(null, '', pathForTeach(contentType, sectionName));
  setMode(mode);
}

// Shared by the breadcrumb link and the restaurant switcher — both leave
// detail for browse of a (possibly different) content type. If that
// means abandoning an in-progress practice session, exitPractice flushes
// it first so the chat isn't silently dropped.
function switchToBrowse(contentType) {
  if (currentPhase === 'detail') exitPractice();
  enterBrowse(contentType);
}

// ─── Initial load ────────────────────────────────────────────────────
(async function () {
  const fallbackId = document.body.dataset.firstRestaurantId;
  currentRestaurantId = await resolveInitialRestaurantId(getOrCreateUserId(), fallbackId);
  applyRestaurantFilter('.menu-review__venue', currentRestaurantId);

  const { contentType, categorySlug } = parsePath(location.pathname);
  const type = contentType || getCurrentContentType();
  log('debug', '[menu] init', { pathname: location.pathname, currentRestaurantId, contentType, categorySlug, resolvedType: type });

  // Show browse — and the correct content-type panel, with its skeleton
  // — now, before the menu fetch resolves. Called exactly once here;
  // it's what normally gets deferred until after the fetch, but that
  // left the skeleton with no window to ever be visible. Only
  // updateTrainLink (icon + href/target) needs to run again once real
  // data is in — everything else enterBrowse sets up doesn't change.
  enterBrowse(type, { pushUrl: false });

  // ?debugSkeleton — skips the fetch entirely so the skeleton placeholder
  // stays up indefinitely, for iterating on its CSS without racing
  // Firestore/the 24h cache. Remove this block once that's done.
  if (new URLSearchParams(location.search).has('debugSkeleton')) {
    log('debug', '[menu] debugSkeleton: skipping fetch, skeleton will stay up');
    return;
  }

  await loadMenuForRestaurant(currentRestaurantId);

  if (categorySlug) {
    const sectionName = findSectionBySlug(type, categorySlug);
    if (sectionName) {
      // A reload mid-practice should stay in practice, not bounce back
      // to Review — resume it whenever a session already exists for this
      // section rather than always defaulting to Review on landing. The
      // URL's #review/#practice fragment (see modeFromHash/setMode) wins
      // when present; initialModeFor's coverage-based guess is only the
      // fallback for a URL that doesn't name a mode at all.
      enterDetail(type, sectionName, modeFromHash() || initialModeFor(type, sectionName), cardContentFromHash(), { pushUrl: false });
      return;
    }
  }
  updateTrainLink(currentRestaurantId, type);
})();

// The nav switcher changes restaurant without reloading — re-filter,
// fetch/cache-hit the new restaurant's menu, and recompute the Train
// target in place. If we're mid-detail for the old restaurant, that
// content no longer applies — exitPractice flushes any in-progress
// session (against whichever restaurant it actually belongs to, tracked
// internally by learn-practice.js) and we drop back to browse rather than
// continuing on the wrong restaurant's section.
window.addEventListener('tico:restaurant-changed', async (e) => {
  const previousRestaurantId = currentRestaurantId;
  currentRestaurantId = e.detail.restaurantId;
  log('debug', '[menu] tico:restaurant-changed', { previousRestaurantId, currentRestaurantId, currentPhase, currentContentType });
  applyRestaurantFilter('.menu-review__venue', currentRestaurantId);
  await loadMenuForRestaurant(currentRestaurantId);

  if (currentPhase === 'browse') {
    updateTrainLink(currentRestaurantId, currentContentType);
    return;
  }

  exitPractice();
  enterBrowse(currentContentType);
});

// Browser back/forward — no reload, so state has to be re-derived from
// the URL and re-applied manually. Mode toggles use replaceState (see
// setMode), not pushState, so they don't create their own history
// entries — back/forward here is purely about section/browse navigation,
// landing on whichever mode that history entry's #review/#practice
// fragment (or, absent one, coverage) names for that section.
window.addEventListener('popstate', () => {
  const { contentType, categorySlug } = parsePath(location.pathname);
  const type = contentType || getCurrentContentType();
  log('debug', '[menu] popstate', { pathname: location.pathname, contentType, categorySlug, resolvedType: type });

  if (categorySlug) {
    const sectionName = findSectionBySlug(type, categorySlug);
    if (sectionName) {
      enterDetail(type, sectionName, modeFromHash() || initialModeFor(type, sectionName), cardContentFromHash(), { pushUrl: false });
      return;
    }
  }
  enterBrowse(type, { pushUrl: false });
});

// ─── Delegated click handling ────────────────────────────────────────
// One handler for: the browse Food/Drinks switcher, clicking a category
// name (browse → detail), the Train link (browse → detail), the
// Review/Practice toggle, and the detail page's breadcrumb (detail →
// browse) — event delegation throughout since these elements exist once
// per restaurant/category, only one combination visible at a time.
// Delegation also means clicks on JS-rendered category buttons (see
// renderCategoryList) need no extra wiring — they carry the same
// classes/data attributes the old baked markup did.
function closeSwitcher(wrapper) {
  wrapper.classList.remove('is-open');
  wrapper.querySelector('.content-type-switcher').hidden = true;
  wrapper.querySelector('.page-title-switcher__trigger')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  const option = e.target.closest('.content-type-switcher__option');
  const trigger = e.target.closest('.page-title-switcher__trigger');

  if (option) {
    log('debug', '[menu] click: content-type-switcher__option', { contentType: option.dataset.contentType });
    switchToBrowse(option.dataset.contentType);
    if (openSwitcher) closeSwitcher(openSwitcher);
    return;
  }

  if (trigger) {
    const wrapper = trigger.closest('.page-title-switcher');
    const willOpen = wrapper.querySelector('.content-type-switcher').hidden;
    if (openSwitcher) closeSwitcher(openSwitcher);
    if (willOpen) {
      wrapper.classList.add('is-open');
      wrapper.querySelector('.content-type-switcher').hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  if (openSwitcher && !openSwitcher.contains(e.target)) closeSwitcher(openSwitcher);

  const categoryLink = e.target.closest('.menu-category__header--link');
  if (categoryLink) {
    const panel = categoryLink.closest('.menu-content-panel');
    log('debug', '[menu] click: category link', { contentType: panel?.dataset.contentType, section: categoryLink.dataset.section });
    if (panel) enterDetail(panel.dataset.contentType, categoryLink.dataset.section, initialModeFor(panel.dataset.contentType, categoryLink.dataset.section), null);
    return;
  }

  const trainLink = e.target.closest('[data-train-link]');
  if (trainLink) {
    e.preventDefault();
    log('debug', '[menu] click: train link', { currentContentType, targetSection: trainLink.dataset.targetSection });
    if (trainLink.dataset.targetSection) enterDetail(currentContentType, trainLink.dataset.targetSection, initialModeFor(currentContentType, trainLink.dataset.targetSection), null);
    return;
  }

  const modeBtn = e.target.closest('.menu-detail__mode-btn');
  if (modeBtn) {
    log('debug', '[menu] click: mode toggle', { mode: modeBtn.dataset.mode });
    setMode(modeBtn.dataset.mode);
    return;
  }

  const crumb = e.target.closest('.menu-detail__crumb');
  if (crumb) {
    e.preventDefault();
    log('debug', '[menu] click: breadcrumb', { currentContentType });
    switchToBrowse(currentContentType);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openSwitcher = document.querySelector('.page-title-switcher.is-open');
  if (openSwitcher) closeSwitcher(openSwitcher);
});
