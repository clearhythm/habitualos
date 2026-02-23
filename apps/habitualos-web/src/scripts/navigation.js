window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('active');
  } else {
    navbar.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', function() {
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
