// Card-based Review study view: one dish/drink at a time (Back/Next), same
// mechanism on every viewport — desktop just constrains the card to a
// narrower centered column instead of full width, keeping the same
// single-card focus rather than showing everything in a grid (Erik's
// call: easier to use and keeps visual focus, even if it doesn't fill
// desktop's screen real estate). Only used for sections where every item
// has an image (see menu-card-images.js) — menu-restaurant-filter.js
// falls back to the plain list otherwise.
//
// Always opens on the first card, both on initial render AND every time
// Review is (re)selected via resetToFirstCard() (see menu-restaurant-
// filter.js's setMode) — no resume position, Erik's call: it's a short
// study pass, not a long document you'd expect to pick back up mid-way.
//
// Cards with a `recipe` (drinks only, today — {ingredientNames, garnish,
// ingredients (with amounts), instructions}) can flip between two named
// faces: "Overview" (front — image + accurate ingredient sentence, what
// you'd tell a guest) and "Preparation" (back — the real recipe, amounts
// included). Tabs, not a single toggle button (Erik's call — a single
// button that relabels itself to show current-vs-destination state was
// genuinely ambiguous; two always-visible tabs, current one highlighted,
// is the same pattern the Review/Practice toggle already uses elsewhere
// in this app). One shared cardContent mode drives every card in the
// deck at once (not independent per-card state) — flip any card and the
// mode carries forward as you Back/Next, per Erik's ask, rather than
// each newly-active card silently reverting to Overview. Plain instant
// content-swap, not a 3D animation (Erik's call: function over flourish,
// given he needed this fast for actual bartending, not polish).
// Persisted in the URL as a second segment on the existing #review/
// #practice hash (see menu-restaurant-filter.js's modeFromHash/setMode)
// — e.g. #review?card-content=preparation — a state alongside Review/
// Practice, not nested inside it.

let cardEls = [];
let bridgeEl = null;
let cardImages = []; // parallel to cardEls, {img, src}
let cardHasRecipe = []; // parallel to cardEls, boolean
let index = 0;
let cardContent = 'overview'; // 'overview' | 'preparation' — shared across every recipe-bearing card in the deck
let onCardContentChanged = null;

function loadImage(i) {
  const entry = cardImages[i];
  if (entry && !entry.img.src) entry.img.src = entry.src;
}

function setActive(newIndex) {
  index = newIndex;
  [...cardEls, bridgeEl].forEach((el, i) => el.classList.toggle('is-active', i === newIndex));
  // Preload the next card's image too (not just the active one) so
  // tapping Next feels instant instead of waiting on a fresh fetch —
  // only ever 2 images in flight at once, not the whole deck.
  loadImage(newIndex);
  loadImage(newIndex + 1);
}

// Applies to every recipe-bearing card at once, not just the active one
// — a newly-active card reached via Next/Back is already in the right
// state by the time you see it, nothing extra needed in setActive.
//
// notify defaults to true (a real user-initiated tab click) but
// renderStudyCards' own initial setup passes false — firing
// onCardContentChanged during that initial call would race menu-
// restaurant-filter.js's enterDetail, which still has to pushState the
// section's own path AFTER renderStudyCards returns; a hash write at
// that point would target the stale pre-navigation path and then get
// silently overwritten. A genuine click always happens well after
// navigation has settled, so it never hits this.
function applyCardContent(mode, notify = true) {
  cardContent = mode;
  const flipped = mode === 'preparation';
  cardEls.forEach((card, i) => {
    if (!cardHasRecipe[i]) return;
    card.classList.toggle('is-flipped', flipped);
    card.querySelectorAll('.study-card__tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.cardContent === mode);
    });
  });
  if (notify) onCardContentChanged?.(mode);
}

// Shared by the front (recipe.ingredientNames, no amounts) and back
// (recipe.ingredients, with amounts) faces — same list markup, different
// source array.
function appendIngredientsList(container, names) {
  const heading = document.createElement('h4');
  heading.className = 'study-card__recipe-heading';
  heading.textContent = 'Ingredients';
  container.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'study-card__ingredients';
  names.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function buildTabs(card) {
  const tabs = document.createElement('div');
  tabs.className = 'study-card__tabs';

  [['overview', 'Overview'], ['preparation', 'Preparation']].forEach(([mode, label]) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'study-card__tab';
    tab.dataset.cardContent = mode;
    tab.textContent = label;
    tab.classList.toggle('is-active', mode === 'overview');
    tab.addEventListener('click', () => applyCardContent(mode));
    tabs.appendChild(tab);
  });

  card.appendChild(tabs);
}

function buildCard(item, image, cardIndex, total, prepImage) {
  const card = document.createElement('div');
  card.className = 'study-card';

  if (item.recipe) buildTabs(card);

  const front = document.createElement('div');
  front.className = 'study-card__face';

  // No loading="lazy" — that defers the fetch until the image is both
  // visible AND near the viewport, which a display:none card never
  // satisfies until it's already active. loadImage()'s manual current+
  // next preload (see setActive) already does this on purpose and on a
  // deliberate schedule; the browser's own heuristic on top of that just
  // re-blocks the fetch behind visibility and defeats the preload.
  const img = document.createElement('img');
  img.className = 'study-card__image';
  img.alt = item.name;
  front.appendChild(img);
  cardImages[cardIndex] = { img, src: image };

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

  // recipe.ingredientNames (verified, bare names, no amounts — see
  // restructure-ingredient-names.cjs) wins over item.description when
  // both exist: description is guest-facing printed-menu copy,
  // occasionally stale/wrong (confirmed case: Pomegranate Cosmo's
  // printed description says "luxardo syrup," the real recipe uses
  // simple syrup). Rendered as one comma-joined sentence — no garnish
  // clause here on purpose: garnish is a preparation/execution detail,
  // not a composition fact, and the real printed menu doesn't mention
  // it either (Erik's call) — it's still on the Preparation face,
  // folded into the instructions text. Dishes have no recipe field yet,
  // so they keep using description unchanged.
  if (item.recipe?.ingredientNames?.length) {
    const desc = document.createElement('p');
    desc.className = 'study-card__desc';
    const sentence = `${item.recipe.ingredientNames.join(', ')}.`;
    desc.textContent = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    body.appendChild(desc);
  } else if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'study-card__desc';
    desc.textContent = item.description;
    body.appendChild(desc);
  }

  front.appendChild(body);
  card.appendChild(front);

  if (item.recipe) {
    const back = document.createElement('div');
    back.className = 'study-card__face study-card__face--back';

    // Mirrors the front face's structure exactly: edge-to-edge image (if
    // there is one — most drinks don't have a prep diagram yet, so this
    // just falls through to the body starting at the top) then a padded
    // body starting with a name+price row, same as the front.
    if (prepImage) {
      const prepImg = document.createElement('img');
      prepImg.className = 'study-card__image';
      prepImg.src = prepImage;
      prepImg.alt = `${item.name} ratio diagram`;
      back.appendChild(prepImg);
    }

    const backBody = document.createElement('div');
    backBody.className = 'study-card__body';

    const backNameRow = document.createElement('div');
    backNameRow.className = 'study-card__name-row';
    const backName = document.createElement('h3');
    backName.className = 'study-card__name';
    backName.textContent = item.name;
    backNameRow.appendChild(backName);
    if (item.price) {
      const backPrice = document.createElement('span');
      backPrice.className = 'study-card__price';
      backPrice.textContent = `$${item.price}`;
      backNameRow.appendChild(backPrice);
    }
    backBody.appendChild(backNameRow);

    if (item.recipe.ingredients?.length) {
      appendIngredientsList(backBody, item.recipe.ingredients);
    }

    if (item.recipe.instructions) {
      const prepHeading = document.createElement('h4');
      prepHeading.className = 'study-card__recipe-heading';
      prepHeading.textContent = 'Preparation';
      backBody.appendChild(prepHeading);

      const prep = document.createElement('p');
      prep.className = 'study-card__recipe-prep';
      prep.textContent = item.recipe.instructions;
      backBody.appendChild(prep);
    }

    back.appendChild(backBody);
    card.appendChild(back);
  }

  const footer = document.createElement('div');
  footer.className = 'study-card__footer';

  // No Back button on the very first card — nothing behind it to return to.
  if (cardIndex > 0) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn--secondary study-card__back-btn';
    back.textContent = 'Back';
    back.addEventListener('click', () => setActive(index - 1));
    footer.appendChild(back);
  }

  const progress = document.createElement('span');
  progress.className = 'study-card__progress';
  progress.textContent = `${cardIndex + 1} of ${total}`;
  footer.appendChild(progress);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn study-card__next-btn';
  next.textContent = 'Next';
  next.addEventListener('click', () => setActive(index + 1));
  footer.appendChild(next);

  card.appendChild(footer);
  return card;
}

function buildBridge(total, onPracticeRequested) {
  const bridge = document.createElement('div');
  bridge.className = 'study-card study-card--bridge';

  const text = document.createElement('p');
  text.className = 'study-card__bridge-text';
  text.textContent = `You've seen all ${total} — ready to practice?`;
  bridge.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'study-card__bridge-actions';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--secondary study-card__back-btn';
  back.textContent = 'Back';
  back.addEventListener('click', () => setActive(total - 1));
  actions.appendChild(back);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn study-card__practice-btn';
  btn.textContent = 'Start Practice';
  btn.addEventListener('click', () => onPracticeRequested?.());
  actions.appendChild(btn);

  bridge.appendChild(actions);
  return bridge;
}

// items: category.items (see renderCategoryList's shape) — {id, name,
// description, price, recipe?: {ingredientNames, garnish, ingredients,
// instructions}, ...}. images: {itemId: path}, from sectionCardImages.
// callbacks.initialCardContent ('overview'|'preparation', from the URL
// hash — see menu-restaurant-filter.js) sets the deck's starting mode;
// callbacks.onCardContentChanged(mode) fires whenever it changes so the
// caller can keep the hash in sync.
export function renderStudyCards(targetEl, items, images, callbacks = {}) {
  targetEl.innerHTML = '';
  targetEl.classList.add('menu-study-cards');

  cardImages = [];
  cardHasRecipe = items.map((item) => Boolean(item.recipe));
  onCardContentChanged = callbacks.onCardContentChanged || null;
  cardEls = items.map((item, i) => buildCard(item, images[item.id], i, items.length, callbacks.prepImages?.[item.id]));
  bridgeEl = buildBridge(items.length, callbacks.onPracticeRequested);

  cardEls.forEach((el) => targetEl.appendChild(el));
  targetEl.appendChild(bridgeEl);

  setActive(0);
  applyCardContent(callbacks.initialCardContent === 'preparation' ? 'preparation' : 'overview', false);
}

// Called whenever Review is (re)selected on an already-rendered section
// (see menu-restaurant-filter.js's setMode) — safe to call even when this
// section never had study cards rendered (plain-list sections). Only
// resets which card is active, not the deck's Overview/Preparation mode
// — that's meant to persist, per Erik.
export function resetToFirstCard() {
  if (cardEls.length) setActive(0);
}
