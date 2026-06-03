import { renderCircleList }   from '../components/circle-list.js';
import { renderReflectInput }  from '../components/reflect-input.js';
import { getConnections }      from '../collections/connections.js';
import { getUserProfile }      from '../collections/users.js';
import { getUserId, getName }  from '../auth/auth.js';
import { swingChime, initChimeAudio, playChime } from '../chime.js';
import { SKY_COLORS, getDayPeriod } from '../sky-palette.js';
import { initAmbientPlayer }   from '../ambient-player.js';
import { getAudioMuted, setAudioMuted, getAudioVolume, setAudioVolume } from '../audio-unlock.js';
import { log } from '../utils/log.js';

// ─── URL scheme: /tour/ = welcome (screen 0), /tour/?screen=1|2|3 = slides
const params = new URLSearchParams(window.location.search);
let screenNum = params.has('screen')
  ? Math.max(1, Math.min(3, parseInt(params.get('screen'), 10) || 1))
  : 0;

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

// Screen 0 = Welcome, screens 1–3 = Practice / Reflect / Circle
const SLIDES = [
  {
    bg:       skyBg,
    iconSrc:  '/assets/images/chime.svg',
    title:    'Welcome',
    subtitle: 'a beautiful journey awaits you',
    sublink:  { text: 'skip', href: '/' },
    widget:   null,
  },
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
let userChimeSig = null;

// ─── Render

function applySlide() {
  const slide = SLIDES[screenNum];
  const bg    = typeof slide.bg === 'function' ? slide.bg() : slide.bg;

  sceneEl.style.background = bg;
  iconEl.innerHTML         = icons[screenNum] || '';
  titleEl.textContent      = slide.title;
  subtitleEl.textContent   = slide.subtitle;
  sublinkEl.textContent    = slide.sublink.text;
  sublinkEl.href           = slide.sublink.href;
  continueBtn.textContent  = screenNum === 0              ? 'let\'s begin'
                           : screenNum === SLIDES.length - 1 ? 'begin'
                           : 'continue';

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

  if (screenNum === 0) playWelcomeChime();

  log('debug', '[tour] screen', screenNum);
}

function slideUrl(n) {
  return n === 0 ? '/tour/' : `/tour/?screen=${n}`;
}

function fadeToSlide(nextScreen) {
  blossomEl.classList.add('tour-fading');
  setTimeout(() => {
    screenNum = nextScreen;
    history.pushState({ screen: screenNum }, '', slideUrl(screenNum));
    applySlide();
    blossomEl.classList.remove('tour-fading');
  }, 150);
}

// ─── Events

iconEl.addEventListener('click', () => {
  if (screenNum !== 0 && screenNum !== 1) return;
  const chimeEl = iconEl.querySelector('.wind-chime');
  if (!chimeEl) return;
  chimeEl.classList.remove('chime-at-rest');
  void chimeEl.offsetWidth;
  swingChime(iconEl);
  chimeEl.addEventListener('animationend', (e) => {
    if (e.animationName === 'chime-sway') chimeEl.classList.add('chime-at-rest');
  }, { once: true });
});

continueBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (screenNum === 0) playWelcomeChime();
  if (screenNum < SLIDES.length - 1) {
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
  screenNum = e.state?.screen ?? 0;
  applySlide();
});

// ─── Init

async function playWelcomeChime() {
  await initChimeAudio();
  if (userChimeSig) playChime(userChimeSig).catch(() => {});
}

async function init() {
  const [fetchedIcons] = await Promise.all([
    Promise.all(SLIDES.map(s => fetch(s.iconSrc).then(r => r.text()).catch(() => ''))),
    getUserProfile(getUserId()).then(p => { userChimeSig = p.chime || null; }).catch(() => {}),
    initChimeAudio(),
  ]);
  icons = fetchedIcons;

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

initAmbientPlayer({
  isMuted:        () => getAudioMuted(),
  getVolume:      () => getAudioVolume(),
  onVolumeChange: (vol) => setAudioVolume(vol),
  onMuteChange:   (muted) => setAudioMuted(muted),
});

init();
