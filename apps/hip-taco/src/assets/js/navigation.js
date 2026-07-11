// Sidemenu toggle and auto-close
document.addEventListener('DOMContentLoaded', function() {
  // Set --nav-height from actual rendered height so the page-canvas mixin stays accurate.
  const toggle = document.getElementById('sidemenu-toggle');
  if (toggle) {
    document.documentElement.style.setProperty('--nav-height', toggle.offsetHeight + 'px');
  }

  function closeMenu() {
    if (toggle) toggle.classList.remove('open');
    document.body.classList.remove('sidemenu-open');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
    });
  }

  const overlay = document.querySelector('.sidemenu-right');
  if (overlay) overlay.addEventListener('click', closeMenu);

  document.querySelectorAll('.sidemenu-left a').forEach(link => link.addEventListener('click', closeMenu));
});
