import { log } from '../utils/log.js';
import { loadSettings, saveSettings } from '../practice-settings.js';

const DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60, 120];

function fmtDuration(mins) {
  if (mins >= 60) return `${mins / 60}h`;
  return `${mins}m`;
}

/**
 * Render the practice setup UI into `container`.
 * Uses the same CSS classes as practice.njk so styling is always in sync.
 * No begin button — that's page-specific behavior.
 *
 * @param {HTMLElement} container
 * @param {{ interactive?: boolean, tourMode?: boolean }} opts
 *   interactive: settings rows save to localStorage (default true)
 *   tourMode: skip input/label; example tags show selected state on tap (default false)
 * @returns {() => void} teardown
 */
export function renderPracticeSetup(container, { interactive = true, tourMode = false } = {}) {
  const settings = loadSettings();
  let durationIndex = DURATIONS.indexOf(settings.durationMins);
  if (durationIndex === -1) durationIndex = 1;

  const fieldHTML = tourMode ? `
    <div class="practice-examples">
      <button class="example-tag">meditation</button>
      <button class="example-tag">exercise</button>
      <button class="example-tag">prayer</button>
    </div>` : `
    <div class="practice-field">
      <input type="text" class="practice-name-input" placeholder="optional" autocomplete="off">
      <p class="feed-time">what are you practicing?</p>
      <div class="practice-examples">
        <button class="example-tag">meditation</button>
        <button class="example-tag">exercise</button>
        <button class="example-tag">prayer</button>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="practice-setup${tourMode ? ' practice-setup--tour' : ''}">
      ${fieldHTML}
      <div class="settings-rows">
        <button class="settings-row" data-setting="duration">
          <span class="settings-row-label">Duration</span>
          <span class="settings-row-value">${fmtDuration(DURATIONS[durationIndex])}</span>
        </button>
        <button class="settings-row" data-setting="bell-start">
          <span class="settings-row-label">Starting bell</span>
          <span class="settings-row-value">${settings.bellStart ? 'on' : 'off'}</span>
        </button>
        <button class="settings-row" data-setting="bell-end">
          <span class="settings-row-label">Ending bell</span>
          <span class="settings-row-value">${settings.bellEnd ? 'on' : 'off'}</span>
        </button>
        <button class="settings-row" data-setting="friend-chimes">
          <span class="settings-row-label">Friend chimes</span>
          <span class="settings-row-value">${settings.friendChimes ? 'on' : 'off'}</span>
        </button>
      </div>
    </div>`;

  const tags = container.querySelectorAll('.example-tag');

  if (tourMode) {
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        const isSelected = tag.classList.contains('selected');
        tags.forEach(t => t.classList.remove('selected'));
        if (!isSelected) tag.classList.add('selected');
      });
    });
  } else {
    const nameInput = container.querySelector('.practice-name-input');
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        nameInput.value = tag.textContent;
        nameInput.focus();
      });
    });
  }

  if (interactive) {
    const durationBtn  = container.querySelector('[data-setting="duration"]');
    const durationVal  = durationBtn.querySelector('.settings-row-value');
    const bellStartBtn = container.querySelector('[data-setting="bell-start"]');
    const bellStartVal = bellStartBtn.querySelector('.settings-row-value');
    const bellEndBtn   = container.querySelector('[data-setting="bell-end"]');
    const bellEndVal   = bellEndBtn.querySelector('.settings-row-value');
    const friendBtn    = container.querySelector('[data-setting="friend-chimes"]');
    const friendVal    = friendBtn.querySelector('.settings-row-value');

    durationBtn.addEventListener('click', () => {
      durationIndex = (durationIndex + 1) % DURATIONS.length;
      durationVal.textContent = fmtDuration(DURATIONS[durationIndex]);
      saveSettings({ durationMins: DURATIONS[durationIndex] });
    });

    function toggle(btn, valEl, key) {
      btn.addEventListener('click', () => {
        const next = valEl.textContent !== 'on';
        valEl.textContent = next ? 'on' : 'off';
        saveSettings({ [key]: next });
      });
    }

    toggle(bellStartBtn, bellStartVal, 'bellStart');
    toggle(bellEndBtn,   bellEndVal,   'bellEnd');
    toggle(friendBtn,    friendVal,    'friendChimes');

    log('debug', '[practice-setup] interactive settings wired');
  }

  return () => { container.innerHTML = ''; };
}
