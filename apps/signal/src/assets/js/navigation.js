(function () {
  var body = document.body;
  var toggle = document.getElementById('sidemenu-toggle');
  var overlay = document.getElementById('sidemenu-overlay');
  var navbar = document.querySelector('.navbar');
  var modal = document.getElementById('signal-modal');
  var modalClose = document.getElementById('signal-modal-close');
  var sidemenuDemoOpen = document.getElementById('sidemenu-demo-open');

  // ─── Sidemenu ───────────────────────────────────────────────────────────────

  function closeMenu() { body.classList.remove('sidemenu-open'); }

  if (toggle) {
    toggle.addEventListener('click', function () {
      body.classList.toggle('sidemenu-open');
    });
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        body.classList.toggle('sidemenu-open');
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Close sidemenu when an anchor link is clicked
  var sidemenuLinks = document.querySelectorAll('.sidemenu-left a[href]');
  sidemenuLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      closeMenu();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMenu();
      closeModal();
    }
  });

  // ─── Navbar scroll ──────────────────────────────────────────────────────────

  if (navbar) {
    function updateNavbar() {
      navbar.classList.toggle('active', window.scrollY > 40);
    }
    updateNavbar();
    window.addEventListener('scroll', updateNavbar, { passive: true });
  }

  // ─── Overscroll background ──────────────────────────────────────────────────
  // Sets html bg so iOS rubber-band overscroll matches header (top) or footer (bottom)

  var htmlEl = document.documentElement;
  var isHeroLight = document.body.classList.contains('hero-light');
  var OVERSCROLL_TOP = isHeroLight ? '#c7e3ff' : '#130e28';
  var OVERSCROLL_BOTTOM = '#080d17'; // matches $color-sidemenu-bg (footer)

  function updateHtmlBg() {
    htmlEl.style.background = window.scrollY < 10 ? OVERSCROLL_TOP : OVERSCROLL_BOTTOM;
  }
  updateHtmlBg();
  window.addEventListener('scroll', updateHtmlBg, { passive: true });

  // ─── Modal ──────────────────────────────────────────────────────────────────

  function openModal() {
    closeMenu();
    if (modal) {
      modal.removeAttribute('hidden');
      body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    if (modal) {
      modal.setAttribute('hidden', '');
      body.style.overflow = '';
    }
  }

  // Expose openModal for signal-modal.js to call
  window.signalModalOpen = openModal;

  // Sidemenu "Score your Signal" — owner mode if signed in, otherwise onboard
  if (sidemenuDemoOpen && modal) {
    sidemenuDemoOpen.addEventListener('click', function (e) {
      e.preventDefault();
      var ownerSignalId = localStorage.getItem('signal-owner-id');
      if (window.signalOpen) {
        window.signalOpen(ownerSignalId ? { mode: 'owner', signalId: ownerSignalId } : {});
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  // Click outside modal inner to close
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }
})();
