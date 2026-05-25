import { signOut, isSignedIn } from './auth/auth.js';
import { addRipple, removeRipple } from './nav-ripple.js';

// navigation.js - Dreamscape
// Handles: sidemenu toggle, scroll-based navbar background, auto-close menu on link click

// ?su= sign-in-as: validate one-time admin token and store userId
(async () => {
  const params = new URLSearchParams(window.location.search);
  const su = params.get('su');
  if (!su) return;
  try {
    const res = await fetch('/api/auth-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: su }),
    });
    if (res.ok) {
      const { userId } = await res.json();
      localStorage.setItem('dp-userId', userId);
    }
  } catch (_) {}
  params.delete('su');
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
})();

// Nav badge: show dot on Circle link when there are unread notes.
// Read from LS first — only fetch once if not cached.
(async () => {
  const userId = localStorage.getItem('dp-userId');
  if (!userId) return;

  const cached = localStorage.getItem('dp-has-unread');

  if (cached === null) {
    try {
      const res  = await fetch(`/api/unread-check?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      localStorage.setItem('dp-has-unread', data.hasUnread ? 'true' : 'false');
      if (data.hasUnread) {
        const badge = document.getElementById('nav-circle-badge');
        if (badge) badge.hidden = false;
        addRipple('unread');
      }
    } catch (_) {}
  } else if (cached === 'true') {
    const badge = document.getElementById('nav-circle-badge');
    if (badge) badge.hidden = false;
    addRipple('unread');
  }
})();

// Time-of-day sky top color — matches homepage gradient, used for scrolled masthead bg
const SKY_TOPS = [
  { h:  0, c: '#050310' }, { h:  4, c: '#080514' }, { h:  5, c: '#0d0c1a' },
  { h:  6, c: '#1a1040' }, { h:  7, c: '#2d1b50' }, { h:  8, c: '#1a4a7a' },
  { h: 10, c: '#1a5a8a' }, { h: 12, c: '#1255a0' }, { h: 16, c: '#1a5a8a' },
  { h: 18, c: '#2d3a6a' }, { h: 19, c: '#2d1b50' }, { h: 20, c: '#1a0b3a' },
  { h: 22, c: '#050310' }, { h: 24, c: '#050310' },
];

function lerpChannel(a, b, t) { return Math.round(a + (b - a) * t); }
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function skyTopColor() {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  let prev = SKY_TOPS[0], next = SKY_TOPS[1];
  for (let i = 0; i < SKY_TOPS.length - 1; i++) {
    if (hour >= SKY_TOPS[i].h && hour < SKY_TOPS[i + 1].h) {
      prev = SKY_TOPS[i]; next = SKY_TOPS[i + 1]; break;
    }
  }
  const t = (hour - prev.h) / (next.h - prev.h);
  const [r1,g1,b1] = hexToRgb(prev.c), [r2,g2,b2] = hexToRgb(next.c);
  return `rgb(${lerpChannel(r1,r2,t)},${lerpChannel(g1,g2,t)},${lerpChannel(b1,b2,t)})`;
}

// Scroll handler: fade in masthead background once page content scrolls under it
const masthead = document.getElementById('sidemenu-toggle');
function updateNavbar() {
  if (!masthead) return;
  const scrolled = window.scrollY > 40;
  masthead.classList.toggle('scrolled', scrolled);
  if (scrolled) masthead.style.setProperty('--masthead-bg', skyTopColor());
}
window.addEventListener('scroll', updateNavbar, { passive: true });

// Menu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  // Set --nav-height from actual rendered height so page-canvas mixin stays accurate.
  const navEl = document.getElementById('sidemenu-toggle');
  if (navEl) {
    document.documentElement.style.setProperty('--nav-height', navEl.offsetHeight + 'px');
  }

  const toggle = document.getElementById('sidemenu-toggle');
  const menuLinks = document.querySelectorAll('.sidemenu-main a');

  function closeMenu() {
    if (toggle) toggle.classList.remove('open');
    document.body.classList.remove('sidemenu-open');
  }

  if (toggle) {
    if (!localStorage.getItem('dp-nav-seen')) addRipple('first-time');

    toggle.addEventListener('click', function() {
      if (!localStorage.getItem('dp-nav-seen')) {
        localStorage.setItem('dp-nav-seen', '1');
        removeRipple('first-time');
      }
      const opening = !document.body.classList.contains('sidemenu-open');
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
      document.dispatchEvent(new CustomEvent(opening ? 'nav:open' : 'nav:close'));
    });
  }

  const overlay = document.querySelector('.sidemenu-right');
  if (overlay) overlay.addEventListener('click', closeMenu);

  menuLinks.forEach(link => link.addEventListener('click', closeMenu));

  document.getElementById('signout-btn')?.addEventListener('click', signOut);

  if (isSignedIn()) {
    document.querySelectorAll('[data-auth-only]').forEach(el => el.hidden = false);
  } else {
    document.getElementById('about-nav-link').hidden = false;
    document.getElementById('signin-nav-link').hidden = false;
    if (location.hostname === 'localhost') document.getElementById('dev-signin-nav-link').hidden = false;
  }
});
