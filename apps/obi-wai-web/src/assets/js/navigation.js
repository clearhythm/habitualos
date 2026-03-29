//
// navigation.js - HabitualOS
// ------------------------------------------------------
// Handles:
// - Sidemenu toggle (hamburger → X animation)
// - Scroll-based navbar background
// - Auto-close menu on link click
// ------------------------------------------------------

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
