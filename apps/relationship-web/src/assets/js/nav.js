// Navigation Component for Pidgerton
// Handles hamburger → X toggle and sidemenu open/close

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('sidemenu-toggle');
  const menuLinks = document.querySelectorAll('.sidemenu-main a');

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

  // Close on clicking the right overlay area
  const overlay = document.querySelector('.sidemenu-right');
  if (overlay) {
    overlay.addEventListener('click', function() {
      if (toggle) {
        toggle.classList.remove('open');
        document.body.classList.remove('sidemenu-open');
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.body.classList.contains('sidemenu-open')) {
      toggle.classList.remove('open');
      document.body.classList.remove('sidemenu-open');
    }
  });

  // Scroll-based navbar background
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }
});
