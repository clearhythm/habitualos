// Ordered day periods — name + start hour only.
// Each period ends when the next begins. Night starts at 22 and ends at 6 (wraps midnight).
export const DAY_PERIODS = [
  { period: 'night',     start: 22 },
  { period: 'pre-dawn',  start:  6 },
  { period: 'dawn',      start:  7 },
  { period: 'morn',      start:  8 },
  { period: 'mid-morn',  start: 10 },
  { period: 'noon',      start: 12 },
  { period: 'afternoon', start: 16 },
  { period: 'dusk',      start: 18 },
  { period: 'late-dusk', start: 19 },
  { period: 'eve',       start: 20 },
];

export const SKY_COLORS = {
  'night':      { top: '#0d0c1a', bot: '#1a1040' },
  'pre-dawn':   { top: '#1a1040', bot: '#3d1c3a' },
  'dawn':       { top: '#2d1b50', bot: '#c8604a' },
  'morn':       { top: '#1a4a7a', bot: '#87aacc' },
  'mid-morn':   { top: '#1a5a8a', bot: '#87cedc' },
  'noon':       { top: '#1255a0', bot: '#72c4eb' },
  'afternoon':  { top: '#1a5a8a', bot: '#87cedc' },
  'dusk':       { top: '#2d3a6a', bot: '#e8904a' },
  'late-dusk':  { top: '#2d1b50', bot: '#8b3040' },
  'eve':        { top: '#1a0b3a', bot: '#3d1b50' },
};

export const ORB_COLORS = {
  'night':      { color: '#c8d0e8', glow: 'rgba(180,190,230,0.20)' },
  'pre-dawn':   { color: '#e07040', glow: 'rgba(224,112,64,0.32)'  },
  'dawn':       { color: '#f09030', glow: 'rgba(240,144,48,0.38)'  },
  'morn':       { color: '#f5b828', glow: 'rgba(245,184,40,0.34)'  },
  'mid-morn':   { color: '#f8d050', glow: 'rgba(248,208,80,0.30)'  },
  'noon':       { color: '#fae468', glow: 'rgba(250,228,104,0.32)' },
  'afternoon':  { color: '#f5c030', glow: 'rgba(245,192,48,0.32)'  },
  'dusk':       { color: '#f08028', glow: 'rgba(240,128,40,0.38)'  },
  'late-dusk':  { color: '#d84820', glow: 'rgba(216,72,32,0.32)'   },
  'eve':        { color: '#903058', glow: 'rgba(144,48,88,0.24)'   },
};

// Resolves a clock hour to the current period, the next period, and how far through it (t 0→1).
// Pass the result directly to setSkyGradient / setOrbColor.
// DAY_PERIODS must cover all 24 hours with no gaps — this always returns before the loop ends.
export function getDayPeriod(overrideHour = null) {
  const now = new Date();
  const h = overrideHour ?? (now.getHours() + now.getMinutes() / 60);
  const n = DAY_PERIODS.length;

  let curr, next, t;

  for (let i = 0; i < n; i++) {
    curr = DAY_PERIODS[i];
    next = DAY_PERIODS[(i + 1) % n];
    const from  = curr.start;
    const to    = next.start;
    const wraps = from > to;

    if (wraps ? (h >= from || h < to) : (h >= from && h < to)) {
      const span = wraps ? to + 24 - from : to - from;
      const offset = wraps && h < from ? h + 24 - from : h - from;
      t = offset / span;
      break;
    }
  }

  return { period: curr.period, next: next.period, t };
}
