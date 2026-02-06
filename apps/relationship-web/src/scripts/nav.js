// Navigation Component for RelationalOS
// Handles hamburger menu toggle

(function() {
  const hamburger = document.getElementById('hamburger');
  const sideMenu = document.getElementById('side-menu');
  const overlay = document.getElementById('side-menu-overlay');

  if (!hamburger || !sideMenu) return;

  function toggleMenu() {
    const isOpen = sideMenu.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    sideMenu.classList.add('open');
    overlay.classList.add('visible');
    hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    sideMenu.classList.remove('open');
    overlay.classList.remove('visible');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', closeMenu);

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu.classList.contains('open')) {
      closeMenu();
    }
  });
})();
