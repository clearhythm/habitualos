import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';

requireSignIn();

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateFlower(practice, index, canvas) {
  const seed = hashCode(practice.id);
  const x = 60 + (seededRandom(seed) * 480);
  const y = 280 + (seededRandom(seed + 1) * 80);
  const duration = practice.duration || 10;
  const hasReflection = practice.reflection && practice.reflection.length > 20;
  const size = Math.min(Math.max(duration / 40, 0.4), 1.2);

  const hour = new Date(practice.timestamp).getHours();
  let petalColor, centerColor;

  if (hour >= 4 && hour < 6) {
    petalColor = `hsl(${280 + seededRandom(seed + 2) * 40}, 70%, 75%)`;
    centerColor = '#FFD700';
  } else if (hour >= 6 && hour < 12) {
    petalColor = `hsl(${40 + seededRandom(seed + 2) * 40}, 80%, 70%)`;
    centerColor = '#FF8C00';
  } else if (hour >= 12 && hour < 18) {
    petalColor = `hsl(${seededRandom(seed + 2) * 360}, 75%, 70%)`;
    centerColor = '#FFD700';
  } else if (hour >= 18 && hour < 22) {
    petalColor = `hsl(${320 + seededRandom(seed + 2) * 40}, 65%, 65%)`;
    centerColor = '#FF6347';
  } else {
    petalColor = `hsl(${240 + seededRandom(seed + 2) * 60}, 60%, 60%)`;
    centerColor = '#4169E1';
  }

  const petalCount = hasReflection ? 8 : 6;
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('opacity', '0');

  setTimeout(() => {
    group.style.transition = 'opacity 0.6s ease-out';
    group.setAttribute('opacity', '1');
  }, index * 100);

  const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  stem.setAttribute('x1', x);
  stem.setAttribute('y1', y);
  stem.setAttribute('x2', x);
  stem.setAttribute('y2', y + 40);
  stem.setAttribute('stroke', '#2D5016');
  stem.setAttribute('stroke-width', 2 * size);
  stem.setAttribute('stroke-linecap', 'round');
  group.appendChild(stem);

  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalX = x + Math.cos(angle) * (12 * size);
    const petalY = y + Math.sin(angle) * (12 * size);
    const petal = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    petal.setAttribute('cx', petalX);
    petal.setAttribute('cy', petalY);
    petal.setAttribute('rx', 6 * size);
    petal.setAttribute('ry', 10 * size);
    petal.setAttribute('fill', petalColor);
    petal.setAttribute('transform', `rotate(${(angle * 180 / Math.PI)}, ${petalX}, ${petalY})`);
    group.appendChild(petal);
  }

  const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  center.setAttribute('cx', x);
  center.setAttribute('cy', y);
  center.setAttribute('r', 8 * size);
  center.setAttribute('fill', centerColor);
  group.appendChild(center);

  canvas.appendChild(group);
}

function getFlowerStage(count) {
  if (count === 0) return { emoji: '🌑', label: 'Unplanted', sublabel: 'A garden waiting to be born' };
  if (count <= 2) return { emoji: '🌱', label: 'Seedling', sublabel: 'Tender and new, reaching toward light' };
  if (count <= 5) return { emoji: '🌿', label: 'Young Sprout', sublabel: 'Roots deepening, stem strengthening' };
  if (count <= 10) return { emoji: '🌺', label: 'First Buds', sublabel: 'Something beautiful forming beneath the surface' };
  if (count <= 20) return { emoji: '🌸', label: 'Opening Bloom', sublabel: 'Petals unfurling, showing what was hidden' };
  if (count <= 50) return { emoji: '🌻', label: 'Full Bloom', sublabel: 'Radiant, confident, facing the sun' };
  return { emoji: '🌼', label: 'Wild Garden', sublabel: 'An entire ecosystem of growth and life' };
}

function formatPlantedDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  if (days === 0) return 'Planted today';
  if (days === 1) return 'Planted yesterday';
  if (days < 7) return `Planted ${days} days ago`;
  if (days < 30) { const weeks = Math.floor(days / 7); return `Planted ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`; }
  return `Planted ${formattedDate}`;
}

function renderGarden(practices, count, firstPracticeDate) {
  const stage = getFlowerStage(count);
  const canvas = document.getElementById('garden-canvas');
  practices.forEach((practice, index) => generateFlower(practice, index, canvas));
  document.getElementById('flower-label').textContent = stage.label;
  document.getElementById('practice-count').textContent = count === 0
    ? stage.sublabel
    : `${count} ${count === 1 ? 'practice' : 'practices'}\n${stage.sublabel}`;
  if (firstPracticeDate) {
    document.getElementById('planted-date').textContent = formatPlantedDate(firstPracticeDate);
  }
}

async function loadGarden() {
  const userId = initializeUser();

  try {
    const response = await fetch(`/.netlify/functions/practice-list?userId=${userId}&limit=1000&_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
    });
    const data = await response.json();

    const loading = document.getElementById('loading');
    const container = document.getElementById('garden-container');
    loading.style.display = 'none';

    if (data.success) {
      const practiceCount = data.practices.length;
      const firstPracticeDate = practiceCount > 0 ? data.practices[practiceCount - 1].timestamp : null;
      const practicesOldestFirst = [...data.practices].reverse();
      renderGarden(practicesOldestFirst, practiceCount, firstPracticeDate);
      container.style.display = 'block';
    } else {
      loading.innerHTML = '<div style="color: #d32f2f;">Failed to load garden. Please refresh the page.</div>';
    }
  } catch (error) {
    console.error('Error loading garden:', error);
    document.getElementById('loading').innerHTML = '<div style="color: #d32f2f;">Failed to load garden. Please refresh the page.</div>';
  }
}

loadGarden();

window.addEventListener('pageshow', (event) => {
  if (event.persisted) loadGarden();
});
