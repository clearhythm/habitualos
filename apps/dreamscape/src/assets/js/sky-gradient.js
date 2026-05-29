import { SKY_COLORS, ORB_COLORS } from './sky-palette.js';

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

export function lerpHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0]+(rb[0]-ra[0])*t)},${Math.round(ra[1]+(rb[1]-ra[1])*t)},${Math.round(ra[2]+(rb[2]-ra[2])*t)})`;
}

export function setSkyGradient({ period, next, t }) {
  const curr  = SKY_COLORS[period];
  const nx    = SKY_COLORS[next];
  const scene = document.querySelector('.blossom-scene');
  if (scene) scene.style.background =
    `linear-gradient(to bottom, ${lerpHex(curr.top, nx.top, t)}, ${lerpHex(curr.bot, nx.bot, t)})`;
}

export function setOrbColor({ period, next, t }) {
  const curr = ORB_COLORS[period];
  const nx   = ORB_COLORS[next];
  const orb  = document.querySelector('.practice-orb');
  if (orb) {
    orb.style.setProperty('--orb-color', lerpHex(curr.color, nx.color, t));
    orb.style.setProperty('--orb-glow',  curr.glow);
  }
}
