window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('active');
  } else {
    navbar.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', function() {
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
