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

  // Set --nav-height from the actual rendered bar height so the
  // page-canvas mixin stays accurate.
  if (navBar) {
    document.documentElement.style.setProperty('--nav-height', navBar.offsetHeight + 'px');
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
