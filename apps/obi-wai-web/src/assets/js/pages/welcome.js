import { isSignedIn, getUserId, getLocalUser } from '../auth/auth.js';
import { saveIntendedPath } from '../auth/auth-intent.js';

const SEEN_KEY = 'obi_welcome_seen';
const PENDING_NAME_KEY = 'obi_pending_name';
const CARD_COUNT = 3;
let currentCard = 0;

function getNextUrl() {
  return new URLSearchParams(window.location.search).get('next') || '/practice/';
}

function getLocalDisplayName() {
  return getLocalUser()?.profile?.displayName || null;
}

function saveLocalDisplayName(name) {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const user = JSON.parse(raw);
    user.profile = user.profile || {};
    user.profile.displayName = name;
    localStorage.setItem('user', JSON.stringify(user));
  } catch {}
}

// ---- Carousel ----

function showCard(index) {
  currentCard = index;
  document.querySelectorAll('.welcome-card').forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.welcome-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
  document.getElementById('btn-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
  document.getElementById('btn-next').textContent = index === CARD_COUNT - 1 ? 'Get started →' : 'Next →';
}

function renderDots() {
  const container = document.getElementById('welcome-dots');
  for (let i = 0; i < CARD_COUNT; i++) {
    const dot = document.createElement('button');
    dot.className = 'welcome-dot';
    dot.setAttribute('aria-label', `Go to card ${i + 1}`);
    dot.addEventListener('click', () => showCard(i));
    container.appendChild(dot);
  }
}

function nextCard() {
  if (currentCard < CARD_COUNT - 1) {
    showCard(currentCard + 1);
  } else {
    onCarouselFinish();
  }
}

function prevCard() {
  if (currentCard > 0) showCard(currentCard - 1);
}

// ---- Step transitions ----

function show(id) {
  ['step-carousel', 'step-name', 'step-email', 'step-confirm'].forEach(stepId => {
    document.getElementById(stepId).style.display = stepId === id ? '' : 'none';
  });
}

function onCarouselFinish() {
  localStorage.setItem(SEEN_KEY, 'true');
  if (isSignedIn()) {
    if (!getLocalDisplayName()) {
      show('step-name');
      setTimeout(() => document.getElementById('name-input').focus(), 50);
    } else {
      window.location.href = getNextUrl();
    }
  } else {
    show('step-name');
    setTimeout(() => document.getElementById('name-input').focus(), 50);
  }
}

// ---- Name step ----

async function submitName(e) {
  e.preventDefault();
  const name = document.getElementById('name-input').value.trim();
  if (!name) return;

  const btn = document.getElementById('name-submit');
  btn.disabled = true;
  btn.textContent = '…';

  if (isSignedIn()) {
    try {
      const res = await fetch('/api/user-profile-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId(), displayName: name })
      });
      if (!res.ok) throw new Error();
      saveLocalDisplayName(name);
      window.location.href = getNextUrl();
    } catch {
      btn.disabled = false;
      btn.textContent = 'Continue →';
    }
  } else {
    localStorage.setItem(PENDING_NAME_KEY, name);
    show('step-email');
    setTimeout(() => document.getElementById('email-input').focus(), 50);
    btn.disabled = false;
    btn.textContent = 'Continue →';
  }
}

// ---- Email step ----

async function submitEmail(e) {
  e.preventDefault();
  const email = document.getElementById('email-input').value.trim();
  const errorEl = document.getElementById('email-error');
  errorEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    errorEl.textContent = 'Please enter a valid email address.';
    errorEl.style.display = '';
    return;
  }

  const btn = document.getElementById('email-submit');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const nextUrl = getNextUrl();
  const returnTo = nextUrl !== '/practice/' ? `/welcome/?next=${encodeURIComponent(nextUrl)}` : '/welcome/';
  saveIntendedPath(returnTo);

  try {
    const guestId = getLocalUser()?._userId || null;
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, guestId })
    });
    if (!res.ok) throw new Error();
    document.getElementById('confirm-email').textContent = email;
    show('step-confirm');
    document.getElementById('btn-skip').style.display = 'none';
  } catch {
    errorEl.textContent = 'Something went wrong. Please try again.';
    errorEl.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Send me a link →';
  }
}

// ---- Post-auth: came back after clicking magic link ----

async function savePendingNameAndRedirect() {
  const name = localStorage.getItem(PENDING_NAME_KEY);
  if (!name) {
    window.location.replace(getNextUrl());
    return;
  }
  try {
    const res = await fetch('/api/user-profile-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), displayName: name })
    });
    if (res.ok) {
      saveLocalDisplayName(name);
      localStorage.removeItem(PENDING_NAME_KEY);
    }
  } catch {}
  window.location.replace(getNextUrl());
}

// ---- Init ----

function init() {
  if (isSignedIn() && localStorage.getItem(PENDING_NAME_KEY)) {
    savePendingNameAndRedirect();
    return;
  }

  show('step-carousel');
  renderDots();
  showCard(0);

  let touchStartX = 0;
  const carousel = document.getElementById('step-carousel');
  carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? nextCard() : prevCard();
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (document.getElementById('step-carousel').style.display === 'none') return;
    if (e.key === 'ArrowRight') nextCard();
    if (e.key === 'ArrowLeft') prevCard();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('btn-next').addEventListener('click', nextCard);
  document.getElementById('btn-prev').addEventListener('click', prevCard);
  document.getElementById('btn-skip').addEventListener('click', () => {
    localStorage.setItem(SEEN_KEY, 'true');
    window.location.href = isSignedIn() ? getNextUrl() : '/signin/';
  });

  document.getElementById('name-form').addEventListener('submit', submitName);
  document.getElementById('email-form').addEventListener('submit', submitEmail);
  document.getElementById('btn-change-email').addEventListener('click', () => {
    document.getElementById('email-input').value = '';
    show('step-email');
    setTimeout(() => document.getElementById('email-input').focus(), 50);
  });
});
