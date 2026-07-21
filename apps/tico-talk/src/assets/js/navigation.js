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

  // Set --nav-height from the actual rendered bar height so the
  // page-canvas mixin stays accurate.
  if (navBar) {
    document.documentElement.style.setProperty('--nav-height', navBar.offsetHeight + 'px');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      document.body.classList.toggle('sidemenu-open');
    });
  }
});
