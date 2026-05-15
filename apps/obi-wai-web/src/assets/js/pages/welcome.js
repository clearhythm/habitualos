import { isSignedIn, getUserId, getLocalUser } from '../auth/auth.js';

const SEEN_KEY = 'obi_welcome_seen';
const CARD_COUNT = 3;
let currentCard = 0;

function getNextUrl() {
  return new URLSearchParams(window.location.search).get('next') || '/practice/';
}

function isLearnMoreMode() {
  return new URLSearchParams(window.location.search).get('mode') === 'learn-more';
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

function showCard(index) {
  currentCard = index;
  document.querySelectorAll('.welcome-card').forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.welcome-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
  document.getElementById('btn-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('btn-next');
  if (index === CARD_COUNT - 1) {
    nextBtn.textContent = isLearnMoreMode() ? 'Create an account →' : 'Get started →';
  } else {
    nextBtn.textContent = 'Next →';
  }
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

function finish() {
  localStorage.setItem(SEEN_KEY, 'true');
  window.location.href = isLearnMoreMode() ? '/signin/' : getNextUrl();
}

function next() {
  if (currentCard < CARD_COUNT - 1) {
    showCard(currentCard + 1);
  } else {
    finish();
  }
}

function prev() {
  if (currentCard > 0) showCard(currentCard - 1);
}

function showCarousel() {
  document.getElementById('step-name').style.display = 'none';
  document.getElementById('step-carousel').style.display = 'block';
  renderDots();
  showCard(0);
}

function showNameStep() {
  document.getElementById('step-name').style.display = 'block';
  document.getElementById('step-carousel').style.display = 'none';
  setTimeout(() => document.getElementById('name-input').focus(), 50);
}

async function submitName(e) {
  e.preventDefault();
  const name = document.getElementById('name-input').value.trim();
  if (!name) return;

  const btn = document.getElementById('name-submit');
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await fetch('/api/user-profile-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), displayName: name })
    });
    if (!res.ok) throw new Error();
    saveLocalDisplayName(name);
    showCarousel();
  } catch {
    btn.disabled = false;
    btn.textContent = 'Continue →';
  }
}

function init() {
  if (isLearnMoreMode()) {
    document.getElementById('btn-skip').style.display = 'none';
    showCarousel();
    return;
  }

  if (!isSignedIn()) {
    window.location.replace(`/signin/?next=${encodeURIComponent(window.location.href)}`);
    return;
  }

  if (getLocalDisplayName()) {
    showCarousel();
  } else {
    showNameStep();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('name-form').addEventListener('submit', submitName);
  document.getElementById('btn-next').addEventListener('click', next);
  document.getElementById('btn-prev').addEventListener('click', prev);
  document.getElementById('btn-skip').addEventListener('click', finish);

  let touchStartX = 0;
  const carousel = document.getElementById('step-carousel');
  carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });
});
