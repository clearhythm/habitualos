const modal = document.getElementById('skill-tree-modal');
const openTrigger = document.querySelector('.confidence-badge');
const closeTrigger = document.querySelector('.skill-tree-modal__close');
const backdrop = document.querySelector('.skill-tree-modal__backdrop');

function openModal() { modal.classList.add('is-open'); }
function closeModal() { modal.classList.remove('is-open'); }

openTrigger?.addEventListener('click', openModal);
closeTrigger?.addEventListener('click', closeModal);
backdrop?.addEventListener('click', closeModal);
