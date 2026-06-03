import { renderCircleList }   from '../components/circle-list.js';
import { renderReflectInput }  from '../components/reflect-input.js';
import { getConnections }      from '../collections/connections.js';
import { getUserId, getName }  from '../auth/auth.js';
import { swingChime }          from '../chime.js';
import { SKY_COLORS, getDayPeriod } from '../sky-palette.js';
import { log } from '../utils/log.js';

// ─── URL param: ?screen=1|2|3
const params = new URLSearchParams(window.location.search);
if (!params.has('screen')) {
  history.replaceState(null, '', '/tour/?screen=1');
}
let screenNum = Math.max(1, Math.min(3, parseInt(params.get('screen'), 10) || 1));

// ─── Time-of-day placeholder for reflect slide
function reflectPlaceholder() {
  const { period } = getDayPeriod();
  const tail = ['morn', 'mid-morn'].includes(period)        ? 'this morning'
             : ['noon', 'afternoon'].includes(period)        ? 'today'
             : ['dusk', 'late-dusk', 'eve'].includes(period) ? 'this evening'
             : 'tonight';
  return `What's present for you ${tail}?`;
}

function skyBg() {
  const { period } = getDayPeriod();
  const c = SKY_COLORS[period] || SKY_COLORS['noon'];
  return `linear-gradient(to bottom, ${c.top}, ${c.bot})`;
}

const SLIDES = [
  {
    bg:       skyBg,
    iconSrc:  '/assets/images/chime.svg',
    title:    'Practice',
    subtitle: 'awaken a beautiful world',
    sublink:  { text: 'practice', href: '/practice/' },
    widget:   null,
  },
  {
    bg:       'linear-gradient(to bottom, #0d0c1a, #13121f 70%, #0a0917)',
    iconSrc:  '/assets/images/reflect.svg',
    title:    'Reflect',
    subtitle: 'shine a little light on your path',
    sublink:  { text: 'reflect', href: '/reflect/' },
    widget:   'reflect',
  },
  {
    bg:       '#0d0c1a',
    iconSrc:  '/assets/images/circle.svg',
    title:    'Circle',
    subtitle: 'share support with friends',
    sublink:  { text: 'invite', href: '/invite/' },
    widget:   'circle',
  },
];

// ─── DOM
const sceneEl      = document.getElementById('tour-scene');
const blossomEl    = document.getElementById('blossom-content');
const iconEl       = document.getElementById('tour-icon');
const titleEl      = document.getElementById('tour-title');
const subtitleEl   = document.getElementById('tour-subtitle');
const actionsEl    = document.getElementById('tour-actions');
const continueBtn  = document.getElementById('tour-continue');
const sublinkEl    = document.getElementById('tour-sublink');
const widgetEl     = document.getElementById('tour-widget');

let icons = [];
let circleData = { circle: [], receivedNotes: [] };

// ─── Render

function applySlide() {
  const idx   = screenNum - 1;
  const slide = SLIDES[idx];
  const bg    = typeof slide.bg === 'function' ? slide.bg() : slide.bg;

  sceneEl.style.background    = bg;
  iconEl.innerHTML             = icons[idx] || '';
  titleEl.textContent          = slide.title;
  subtitleEl.textContent       = slide.subtitle;
  sublinkEl.textContent        = slide.sublink.text;
  sublinkEl.href               = slide.sublink.href;
  continueBtn.textContent      = screenNum === SLIDES.length ? "i'm ready" : 'continue';

  widgetEl.innerHTML = '';
  if (slide.widget === 'reflect') {
    renderReflectInput(widgetEl, {
      placeholder: reflectPlaceholder(),
      onTap: () => { window.location.href = slide.sublink.href; },
    });
  } else if (slide.widget === 'circle') {
    if (circleData.circle.length) {
      widgetEl.innerHTML = '<div class="tour-circle-list-wrap" id="tour-circle-list"></div>';
      renderCircleList(document.getElementById('tour-circle-list'), {
        circle:        circleData.circle,
        receivedNotes: circleData.receivedNotes,
        userId:        getUserId(),
        userName:      getName() || 'You',
      });
    }
  }

  actionsEl.style.visibility = '';
  log('debug', '[tour] screen', screenNum);
}

function fadeToSlide(nextScreen) {
  blossomEl.classList.add('tour-fading');
  setTimeout(() => {
    screenNum = nextScreen;
    const url = `/tour/?screen=${screenNum}`;
    history.pushState({ screen: screenNum }, '', url);
    applySlide();
    blossomEl.classList.remove('tour-fading');
  }, 150);
}

// ─── Events

iconEl.addEventListener('click', () => {
  if (screenNum !== 1) return;
  const chimeEl = iconEl.querySelector('.wind-chime');
  if (!chimeEl) return;
  chimeEl.classList.remove('chime-at-rest');
  void chimeEl.offsetWidth; // force reflow before re-adding swaying
  swingChime(iconEl);
  chimeEl.addEventListener('animationend', (e) => {
    if (e.animationName === 'chime-sway') chimeEl.classList.add('chime-at-rest');
  }, { once: true });
});

continueBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (screenNum < SLIDES.length) {
    fadeToSlide(screenNum + 1);
  } else {
    window.location.href = '/';
  }
});

sublinkEl.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = sublinkEl.href;
});

window.addEventListener('popstate', (e) => {
  screenNum = e.state?.screen ?? 1;
  applySlide();
});

// ─── Init

async function init() {
  icons = await Promise.all(
    SLIDES.map(s => fetch(s.iconSrc).then(r => r.text()).catch(() => ''))
  );

  getConnections()
    .then(data => {
      circleData = {
        circle:        data.circle        || [],
        receivedNotes: data.receivedNotes || [],
      };
      if (screenNum === 3) applySlide();
    })
    .catch(() => {});

  applySlide();
}

init();
