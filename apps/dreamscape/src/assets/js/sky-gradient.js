const SKY_PALETTE = [
  { h:  0, top: '#050310', bot: '#0a0617' },
  { h:  4, top: '#080514', bot: '#0e0a1f' },
  { h:  5, top: '#0d0c1a', bot: '#1a1040' },
  { h:  6, top: '#1a1040', bot: '#3d1c3a' },
  { h:  7, top: '#2d1b50', bot: '#c8604a' },
  { h:  8, top: '#1a4a7a', bot: '#87aacc' },
  { h: 10, top: '#1a5a8a', bot: '#87cedc' },
  { h: 12, top: '#1255a0', bot: '#72c4eb' },
  { h: 16, top: '#1a5a8a', bot: '#87cedc' },
  { h: 18, top: '#2d3a6a', bot: '#e8904a' },
  { h: 19, top: '#2d1b50', bot: '#8b3040' },
  { h: 20, top: '#1a0b3a', bot: '#3d1b50' },
  { h: 22, top: '#050310', bot: '#0a0617' },
  { h: 24, top: '#050310', bot: '#0a0617' },
];

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

export function lerpHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0]+(rb[0]-ra[0])*t)},${Math.round(ra[1]+(rb[1]-ra[1])*t)},${Math.round(ra[2]+(rb[2]-ra[2])*t)})`;
}

export function setSkyGradient(overrideHour = null) {
  const now  = new Date();
  const hour = overrideHour ?? (now.getHours() + now.getMinutes() / 60);
  let prev = SKY_PALETTE[0], next = SKY_PALETTE[1];
  for (let i = 0; i < SKY_PALETTE.length - 1; i++) {
    if (hour >= SKY_PALETTE[i].h && hour < SKY_PALETTE[i + 1].h) {
      prev = SKY_PALETTE[i]; next = SKY_PALETTE[i + 1]; break;
    }
  }
  const t = (hour - prev.h) / (next.h - prev.h);
  const scene = document.querySelector('.blossom-scene');
  if (scene) scene.style.background =
    `linear-gradient(to bottom, ${lerpHex(prev.top, next.top, t)}, ${lerpHex(prev.bot, next.bot, t)})`;
}

