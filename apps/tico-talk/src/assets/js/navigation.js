// Fade in masthead background once page content scrolls under it
function updateMasthead() {
  const masthead = document.getElementById('sidemenu-toggle');
  if (masthead) masthead.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateMasthead, { passive: true });

// Sidemenu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  // Set --nav-height from actual rendered height so the page-canvas mixin stays accurate.
  const toggle = document.getElementById('sidemenu-toggle');
  if (toggle) {
    document.documentElement.style.setProperty('--nav-height', toggle.offsetHeight + 'px');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
    });
  }
});
