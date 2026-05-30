import { log } from './utils/log.js';

const LS_KEY = 'dp-practice-settings';
const DEFAULTS = { durationMins: 5, bellStart: false, bellEnd: true, friendChimes: true };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...parsed };
  } catch {
    log('warn', '[practice-settings] failed to load, using defaults');
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const current = loadSettings();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...current, ...patch }));
}
