# Sunlight Replies — Phase 3: Weather System + Homepage Display

**Goal**: Weather display is dynamic. Sun points warm it. Cached in localStorage for instant load. Animated transitions.

## Data model

```
Collection: weather (singleton)
{
  id: "weather-current",
  temp: 58,
  previousTemp: null,
  lastChangedAt: null,
  lastChangeSource: null,
  history: [
    { temp: 59, source: "sun-points", delta: +1, at: "2026-02-15T..." }
  ]
}
```

## Weather labels (warm → cold)

| Temp | Label | Icon |
|------|-------|------|
| 92°+ | Tropical | palm tree |
| 85-91° | Sunny | sun |
| 78-84° | Partly Sunny | sun behind cloud |
| 70-77° | Lightly Cloudy | partly cloudy |
| 62-69° | Cloudy | cloud |
| 45-61° | Rainy | rain cloud |
| 33-44° | Stormy | thunder |
| <33° | Snowy | snowflake |

## Trend labels
- Points earned today → "Warming" (replaces weather word)
- Temperature dropped recently → "Cooling"
- No recent change → base weather word

## Sun points → temperature bonus (daily)

| Daily points | Bonus |
|-------------|-------|
| 5-15 | +1° |
| 16-30 | +2° |
| 31+ | +3° |

## Steps

### 1. Create `db-weather.cjs` service
- `getWeather()` → reads singleton doc
- `getWeatherDisplay()` → returns `{ emoji, label, temp }` with trend logic
- `applyDelta({ delta, source })` → adjusts temp, records history, returns new state
- Weather label mapping function (temp → icon + word)
- Trend detection (compare lastChangedAt to today, check source)
- Path: `apps/relationship-web/netlify/functions/_services/db-weather.cjs`

### 2. Create `weather-current.js` GET endpoint
- Returns: `{ emoji, label, temp }`
- Path: `apps/relationship-web/netlify/functions/weather-current.js`

### 3. Update `moment-reply-save.js` to update weather
- After awarding sun points: calculate daily total → determine temp bonus tier
- Call `weather.applyDelta({ delta, source: 'sun-points' })`
- Return weather in response

### 4. Seed weather singleton
- `{ id: "weather-current", temp: 58 }`

### 5. Create `text-animate.js` shared utility
- Extract from chat.njk thinking animation pattern
- `animateText(element, newText, { speed })` — letter-by-letter transition
- Refactor chat.njk thinking words to use it
- Path: `apps/relationship-web/src/assets/js/components/text-animate.js`

### 6. Dynamic weather on homepage
- Initial render: read `pidgerton_weather` from localStorage. If cached, display it. If not, show default "Rainy, 58°"
- Async fetch: call `/api/weather-current`
- If weather changed from displayed: animate label transition using text-animate, update temp
- Cache new value to localStorage
- Path: `apps/relationship-web/src/index.njk`

## Key files to modify
- `apps/relationship-web/netlify/functions/moment-reply-save.js` — weather delta
- `apps/relationship-web/src/index.njk` — dynamic weather with caching + animation
- `apps/relationship-web/src/chat.njk` — refactor thinking animation to use shared utility

## Verification
1. Homepage loads → shows cached weather (or default 58°)
2. Reply to a hard moment (+10 pts) → weather bumps +1°
3. Return to homepage → "Warming, 59°" with animated transition
4. Reload → shows "Rainy, 59°" from cache (trend gone since no new change)
5. Reply again in same day → daily total hits 20 → weather bumps another +2° (total +3° for the day)
