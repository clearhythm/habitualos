//
// navigation.js - HabitualOS
// ------------------------------------------------------
// Handles:
// - Sidemenu toggle (hamburger → X animation)
// - Scroll-based navbar background
// - Auto-close menu on link click
// ------------------------------------------------------

// Scroll handler: Add background to navbar after scrolling
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('active');
  } else {
    navbar.classList.remove('active');
  }
});

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
