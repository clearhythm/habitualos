// Card-based Review study view: one dish at a time (Back/Next), same
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

let cardEls = [];
let bridgeEl = null;
let cardImages = []; // parallel to cardEls, {img, src}
let index = 0;

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

function buildCard(item, image, cardIndex, total) {
  const card = document.createElement('div');
  card.className = 'study-card';

  // No loading="lazy" — that defers the fetch until the image is both
  // visible AND near the viewport, which a display:none card never
  // satisfies until it's already active. loadImage()'s manual current+
  // next preload (see setActive) already does this on purpose and on a
  // deliberate schedule; the browser's own heuristic on top of that just
  // re-blocks the fetch behind visibility and defeats the preload.
  const img = document.createElement('img');
  img.className = 'study-card__image';
  img.alt = item.name;
  card.appendChild(img);
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

  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'study-card__desc';
    desc.textContent = item.description;
    body.appendChild(desc);
  }

  card.appendChild(body);

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
// description, price, ...}. images: {itemId: path}, from sectionCardImages.
export function renderStudyCards(targetEl, items, images, callbacks = {}) {
  targetEl.innerHTML = '';
  targetEl.classList.add('menu-study-cards');

  cardImages = [];
  cardEls = items.map((item, i) => buildCard(item, images[item.id], i, items.length));
  bridgeEl = buildBridge(items.length, callbacks.onPracticeRequested);

  cardEls.forEach((el) => targetEl.appendChild(el));
  targetEl.appendChild(bridgeEl);

  setActive(0);
}

// Called whenever Review is (re)selected on an already-rendered section
// (see menu-restaurant-filter.js's setMode) — safe to call even when this
// section never had study cards rendered (plain-list sections).
export function resetToFirstCard() {
  if (cardEls.length) setActive(0);
}
