// Shared, JS-positioned tooltip for any element with data-tooltip — not a
// CSS ::after, because a CSS ::after positioned inside a scrollable
// container (overflow-x: auto, used by both the tables and the chart on
// /insights/demo/) gets clipped by that container's own overflow no
// matter how the tooltip itself is styled. One tooltip element appended
// to <body> and positioned via getBoundingClientRect() sidesteps that
// entirely, and shows/hides instantly (no native title="" delay).
let tooltipEl = null;

function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  // A dev-server hot reload can re-run this module (resetting the
  // tooltipEl variable) without a full page refresh (DOM persists) — this
  // file is the only thing that ever creates a .js-tooltip, so any that
  // already exists at this point is an orphan left behind by a previous
  // module instance, stuck wherever it was last shown, not a second
  // legitimate tooltip. Clear it before creating the real one.
  document.querySelectorAll('.js-tooltip').forEach((el) => el.remove());
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'js-tooltip';
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  const el = ensureTooltip();
  el.textContent = text;
  el.classList.add('is-visible');

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = el.getBoundingClientRect();

  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

  let top = targetRect.top - tooltipRect.height - 8;
  if (top < 8) top = targetRect.bottom + 8; // flip below if there's no room above

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function hideTooltip() {
  tooltipEl?.classList.remove('is-visible');
}

// selector defaults to every data-tooltip element on the page — call
// again (safe, addEventListener no-ops on duplicate identical listeners
// only if the same function reference is reused, which it is here) if
// more such elements get added to the DOM later.
export function initTooltips(selector = '[data-tooltip]') {
  document.querySelectorAll(selector).forEach((target) => {
    target.addEventListener('mouseenter', () => showTooltip(target));
    target.addEventListener('mouseleave', hideTooltip);
    target.addEventListener('focus', () => showTooltip(target));
    target.addEventListener('blur', hideTooltip);
  });
}
