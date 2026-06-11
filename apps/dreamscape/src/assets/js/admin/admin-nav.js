export function initNav() {
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      document.querySelectorAll('.admin-view').forEach(el => el.hidden = true);
      document.querySelectorAll('.admin-nav-link').forEach(el => el.classList.remove('active'));
      document.getElementById(`view-${view}`).hidden = false;
      link.classList.add('active');
    });
  });
}
