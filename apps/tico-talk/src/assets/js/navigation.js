// Fade in nav-bar background once page content scrolls under it
function updateNavBar() {
  const navBar = document.getElementById('nav-bar');
  if (navBar) navBar.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateNavBar, { passive: true });

// Sidemenu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  const navBar = document.getElementById('nav-bar');
  const toggle = document.getElementById('sidemenu-toggle');
  const overlay = document.getElementById('sidemenu-overlay');

  // Set --nav-height from the nav's actual distance-from-viewport-top
  // (not just its own offsetHeight) so the page-canvas mixin/hero padding
  // stay accurate for both the app nav (flush, top: 0 — bottom equals its
  // own height) and the marketing floating pill (top: 1rem — bottom is
  // taller than its height alone by that offset, which offsetHeight alone
  // would silently drop).
  if (navBar) {
    document.documentElement.style.setProperty('--nav-height', navBar.getBoundingClientRect().bottom + 'px');
  }

  function closeMenu() {
    document.body.classList.remove('sidemenu-open');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      document.body.classList.toggle('sidemenu-open');
    });
  }

  // Desktop-only overlay (the dimmed area beside the partial panel) closes
  // the menu on click; on mobile the panel fills the screen so this never
  // renders.
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  document.querySelectorAll('.sidemenu-left a[href]').forEach(function(link) {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenu();
  });
});
