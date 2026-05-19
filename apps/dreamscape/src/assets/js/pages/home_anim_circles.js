import { initPresence, subscribeToCircle, getCurrentUserId } from '../presence.js';

const outerRings       = document.getElementById('outer-rings');
const centerRing       = document.getElementById('center-ring');
const circleName       = document.getElementById('circle-name');
const circleDescriptor = document.getElementById('circle-descriptor');
const presenceDots     = document.getElementById('presence-dots');

let rotateTimer     = null;
let nameIndex       = 0;
let currentOthers   = [];
const readyAt       = Date.now() + 7000;

function showSelf() {
  circleName.textContent       = 'You';
  circleDescriptor.textContent = 'are here';
  circleName.classList.add('visible');
  circleDescriptor.classList.add('visible');
}

function renderDots() {
  presenceDots.innerHTML = '';
  const N = currentOthers.length;
  if (N === 0) return;

  const R  = 70;
  const cx = 100;
  const minAngle = 20;
  const maxAngle = 160;

  currentOthers.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'presence-dot';

    const angle = N === 1 ? 90 : minAngle + (maxAngle - minAngle) * i / (N - 1);
    const rad   = angle * Math.PI / 180;
    const x     = cx + R * Math.cos(rad) - 18; // center the 36px dot
    const y     = R * Math.sin(rad) - 18;

    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    presenceDots.appendChild(dot);
  });
}

function showName() {
  if (nameIndex >= currentOthers.length) return;

  const idx        = nameIndex;
  const person     = currentOthers[idx];
  const descriptor = person.state === 'practicing' ? 'is practicing' : 'is here';
  nameIndex++;

  // Reveal this dot, dim the previous active one
  const dots = presenceDots.querySelectorAll('.presence-dot');
  dots.forEach((dot, i) => {
    if (i === idx) {
      dot.classList.add('active');
      dot.classList.remove('revealed');
    } else if (i < idx) {
      dot.classList.remove('active');
      dot.classList.add('revealed');
    }
  });

  circleName.classList.remove('visible');
  circleDescriptor.classList.remove('visible');
  setTimeout(() => {
    circleName.textContent       = person._name;
    circleDescriptor.textContent = descriptor;
    circleName.classList.add('visible');
    circleDescriptor.classList.add('visible');
  }, 400);

  // Queue next name, or stop after everyone's been introduced
  if (nameIndex < currentOthers.length) {
    rotateTimer = setTimeout(showName, 10000);
  }
}

function startRotation() {
  clearTimeout(rotateTimer);
  nameIndex = 0;

  const delay = Math.max(0, readyAt - Date.now());
  rotateTimer = setTimeout(showName, delay);
}

const MOCK_OTHERS = [
  { _name: 'Frank', state: 'witnessing' },
  { _name: "Ro'i", state: 'practicing' },
  { _name: 'Erik', state: 'witnessing' },
];

showSelf();
initPresence();

subscribeToCircle((members) => {
  const myId    = getCurrentUserId();
  const myState = members.find(m => m._userId === myId)?.state || 'witnessing';
  const others  = MOCK_OTHERS; // members.filter(m => m._userId !== myId && m.state !== 'idle');

  centerRing.dataset.state = myState;
  currentOthers = others;

  renderDots();

  if (others.length === 0) {
    outerRings.innerHTML = '<div class="outer-ring-static"></div>';
    clearInterval(rotateTimer);
  } else {
    outerRings.innerHTML = '';
    others.forEach(() => {
      const ring = document.createElement('div');
      ring.className = 'outer-ring';
      outerRings.appendChild(ring);
    });
    startRotation();
  }
});
