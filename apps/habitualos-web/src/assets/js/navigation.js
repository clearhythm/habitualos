window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('active');
  } else {
    navbar.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.btn').forEach(btn => {
    function spawnRipple(clientX, clientY, el) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (clientY - rect.top - size / 2) + 'px';
      el.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    }
    btn.addEventListener('mouseenter', function(e) {
      spawnRipple(e.clientX, e.clientY, this);
    });
    btn.addEventListener('touchstart', function(e) {
      const touch = e.touches[0];
      spawnRipple(touch.clientX, touch.clientY, this);
    }, { passive: true });
  });


  document.querySelectorAll('.screenshot-gallery').forEach(gallery => {
    const main = gallery.querySelector('.screenshot-main');
    gallery.querySelectorAll('.screenshot-thumb').forEach(thumb => {
      thumb.addEventListener('click', function() {
        main.src = this.src;
        gallery.querySelectorAll('.screenshot-thumb').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    });
  });

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('.lightbox-img');

  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.screenshot-main').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });

  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  const toggle = document.getElementById('sidemenu-toggle');
  const menuLinks = document.querySelectorAll('.sidemenu-main a');

  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      document.body.classList.toggle('sidemenu-open');
    });
  }

  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (toggle) {
        toggle.classList.remove('open');
        document.body.classList.remove('sidemenu-open');
      }
    });
  });
});
