//
// navigation.js - Dreamscape
// ------------------------------------------------------
// Handles:
// - Sidemenu toggle (hamburger → X animation)
// - Scroll-based navbar background
// - Auto-close menu on link click
// ------------------------------------------------------

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

// Nav badge: show dot on Circle link when there are unread notes
(async () => {
  const userId = localStorage.getItem('dp-userId');
  if (!userId) return;
  try {
    const res  = await fetch(`/api/circle-data?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    const notes = data.receivedNotes || [];
    const hasUnread = notes.some(n => n.unlockedAt && !n.readAt);
    if (hasUnread) {
      const badge = document.getElementById('nav-circle-badge');
      if (badge) badge.hidden = false;
    }
  } catch (_) {}
})();

// Scroll handler: Add background to navbar after scrolling
function updateNavbar() {
  const navbar = document.querySelector('.navbar');
  navbar.classList.toggle('active', window.scrollY > 50);
}

window.addEventListener('scroll', updateNavbar);
updateNavbar(); // run once on load to catch restored scroll position

// Menu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('sidemenu-toggle');
  const menuLinks = document.querySelectorAll('.sidemenu-main a');

  // Toggle menu on hamburger click
  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
    });
  }

  // Close button inside sidemenu panel
  const closeBtn = document.getElementById('sidemenu-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (toggle) toggle.classList.remove('open');
      document.body.classList.remove('sidemenu-open');
    });
  }

  // Auto-close menu when any link is clicked
  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (toggle) {
        toggle.classList.remove('open');
        document.body.classList.remove('sidemenu-open');
      }
    });
  });
});
