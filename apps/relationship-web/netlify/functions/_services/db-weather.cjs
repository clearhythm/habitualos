/**
 * db-weather.cjs - Weather System Service
 *
 * Dynamic weather based on sun points activity.
 * Uses a singleton document for current state.
 * Auto-seeds on first write with default temp of 58°.
 *
 * Collection: weather
 * Singleton doc: "weather-current"
 */

const dbCore = require('@habitualos/db-core');

const COLLECTION = 'weather';
const SINGLETON_ID = 'weather-current';
const DEFAULT_TEMP = 58;

// Weather labels by temperature range (warm → cold)
const WEATHER_TIERS = [
  { min: 92, label: 'Tropical', emoji: '🌴' },
  { min: 85, label: 'Sunny', emoji: '☀️' },
  { min: 78, label: 'Partly Sunny', emoji: '🌤️' },
  { min: 70, label: 'Lightly Cloudy', emoji: '⛅' },
  { min: 62, label: 'Cloudy', emoji: '☁️' },
  { min: 45, label: 'Rainy', emoji: '🌧️' },
  { min: 33, label: 'Stormy', emoji: '⛈️' },
  { min: -Infinity, label: 'Snowy', emoji: '❄️' }
];

// Daily sun points → temperature bonus
const BONUS_TIERS = [
  { min: 31, bonus: 3 },
  { min: 16, bonus: 2 },
  { min: 5, bonus: 1 },
  { min: 0, bonus: 0 }
];

/**
 * Get weather tier for a temperature
 */
function getWeatherTier(temp) {
  for (const tier of WEATHER_TIERS) {
    if (temp >= tier.min) return tier;
  }
  return WEATHER_TIERS[WEATHER_TIERS.length - 1];
}

/**
 * Get bonus tier for daily points
 */
function getBonusTier(dailyPoints) {
  for (const tier of BONUS_TIERS) {
    if (dailyPoints >= tier.min) return tier.bonus;
  }
  return 0;
}

/**
 * Get current weather state.
 * Returns default state if singleton doesn't exist yet.
 */
async function getWeather() {
  const doc = await dbCore.get({ collection: COLLECTION, id: SINGLETON_ID });
  if (!doc) {
    return {
      id: SINGLETON_ID,
      temp: DEFAULT_TEMP,
      previousTemp: null,
      lastChangedAt: null,
      lastChangeSource: null,
      history: []
    };
  }
  return doc;
}

/**
 * Get display-ready weather object with trend detection.
 * Returns { emoji, label, temp }
 */
async function getWeatherDisplay() {
  const weather = await getWeather();
  const tier = getWeatherTier(weather.temp);

  // Detect trend: if points were earned today, show "Warming"
  const today = new Date().toISOString().slice(0, 10);
  const changedToday = weather.lastChangedAt && weather.lastChangedAt.startsWith(today);
  const isWarming = changedToday && weather.lastChangeSource === 'sun-points';

  return {
    emoji: tier.emoji,
    label: isWarming ? 'Warming' : tier.label,
    temp: weather.temp
  };
}

/**
 * Apply a temperature delta.
 * Auto-seeds the singleton if it doesn't exist yet.
 * Records change in history.
 */
async function applyDelta({ delta, source }) {
  const current = await getWeather();
  const now = new Date().toISOString();

  const newTemp = current.temp + delta;
  const history = (current.history || []).slice(0, 49); // Keep last 50 entries
  history.unshift({ temp: newTemp, source, delta, at: now });

  const data = {
    temp: newTemp,
    previousTemp: current.temp,
    lastChangedAt: now,
    lastChangeSource: source,
    history
  };

  await dbCore.create({
    collection: COLLECTION,
    id: SINGLETON_ID,
    data
  });

  const tier = getWeatherTier(newTemp);
  return {
    temp: newTemp,
    previousTemp: current.temp,
    emoji: tier.emoji,
    label: 'Warming'
  };
}

module.exports = {
  getWeather,
  getWeatherDisplay,
  applyDelta,
  getBonusTier,
  getWeatherTier,
  DEFAULT_TEMP
};
