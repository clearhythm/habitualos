// One-time generator for Tico Insights' demo dataset — NOT run as part of
// the build. Run manually (`node scripts/generate-insights-mock-data.cjs`)
// whenever the seed/shape needs to change; output is committed to the
// repo as the single source of truth both the build-time aggregation
// (src/_data/insightsAnalytics.js) and the chat Q&A endpoint
// (netlify/functions/insights-ask.cjs) read.
//
// Seeded (mulberry32) so re-running with the same seed reproduces the
// same dataset — deterministic, not regenerated per-build. Restaurant:
// Pete's Fish House, real menu items/prices (pulled live from Firestore
// during planning, see the plan file), August 2026, open 7 days/week.
//
// Skill differences are expressed as upsell RATE and item price-band
// bias, not a fake multiplier applied after the fact — every check total
// is the real sum of real item prices actually picked, so the resulting
// PPA numbers are grounded in the same records the chat Q&A sees.

const fs = require('fs');
const path = require('path');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260801);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const chance = (p) => rand() < p;
// "Order statistic" price-band skew: sampling twice and taking the max
// (or min) biases toward the high (or low) end of a price-sorted list
// without needing a weight/exponent formula — simple and legible.
function pickSkewed(sortedItems, skew) {
  const i1 = randInt(0, sortedItems.length - 1);
  if (skew === 'high') return sortedItems[Math.max(i1, randInt(0, sortedItems.length - 1))];
  if (skew === 'low') return sortedItems[Math.min(i1, randInt(0, sortedItems.length - 1))];
  return sortedItems[i1];
}
function pickOne(items) { return items[randInt(0, items.length - 1)]; }

// Real Pete's Fish House items (restaurant id "petes"), pulled live from
// Firestore restaurant-menus/petes during planning — trimmed to the
// categories relevant to a dinner-service check.
const STARTERS = [
  { name: 'Castelvetrano Olives', price: 8 },
  { name: 'House Smoked Salmon Dip', price: 14 },
  { name: 'Shishito Peppers', price: 15 },
  { name: 'Straciatella & Prosciutto', price: 21 },
  { name: 'Shrimp Cocktail', price: 22 },
  { name: 'Ahi Tuna Crudo', price: 24 },
  { name: 'Dungeness Crab Cocktail', price: 28 }
];
const MAINS = [
  { name: 'Wagyu Smashburger', price: 22 },
  { name: 'Maine Lobster Roll', price: 28 },
  { name: 'Shrimp & White Cheddar Grits', price: 32 },
  { name: 'Steamed Clams', price: 32 },
  { name: 'Grilled Branzino', price: 34 },
  { name: 'Local King Salmon', price: 38 },
  { name: 'Filet Mignon', price: 48 }
];
const DRINKS = [
  { name: 'Pomegranate Cosmo', price: 15 },
  { name: 'Lychee Martini', price: 15 },
  { name: 'Aperol Spritz', price: 15 },
  { name: 'Garden Gimlet', price: 15 },
  { name: 'Almost Famous', price: 16 },
  { name: 'Spiced Old Fashioned', price: 16 },
  { name: 'Espresso Martini', price: 16 },
  { name: "Storr's Chardonnay", price: 14 },
  { name: 'Rombauer Chardonnay', price: 19 },
  { name: 'Soquel Vineyards Pinot Noir', price: 14 },
  { name: "Ridge Three Valley's Zinfandel", price: 16 },
  { name: 'Roth Cabernet Sauvignon', price: 14 },
  { name: 'DAOU Cabernet Sauvignon', price: 16 }
];
const BOTTLES = [
  { name: 'La Marea "Kristy Vineyard"', price: 58 },
  { name: 'The Prisoner Cab. Sauvignon', price: 85 },
  { name: 'Round Pond Estate Cab. Sauvignon', price: 145 },
  { name: 'Paul Hobbs Pinot Noir', price: 155 }
];

// checksPerShift: [min,max] tables worked that shift, against a room of
// ~20 tables split between whoever's on with them. activityWeight: this
// is the FULL staff (Erik: "the staff work all the shifts, the
// restaurant stays open... cover all available timeslots with this
// staff") — every one of the 62 possible (date, period) slots gets
// covered, so shift counts are computed from these relative weights
// below, not a fixed target each, except Jacob (see JACOB_SHIFTS).
// Doubles (lunch + dinner same day) and multiple days/week both happen
// naturally, since slots are scheduled independently.
//
// Sol is the 5th server, added mid-session — two independent axes, not
// one: quality between Colin and Larry (upsell rate/price-band skew,
// same as every other skill difference), but volume roughly half of
// Colin's (activityWeight) since Sol only works rarely — being good and
// being available are different things.
const SERVERS = {
  Larry:  { activityWeight: 5,   checksPerShift: [7, 9], drinkProb: 0.75, starterProb: 0.55, bottleProb: 0.12, skew: 'high' },
  Sol:    { activityWeight: 1.5, checksPerShift: [7, 8], drinkProb: 0.62, starterProb: 0.42, bottleProb: 0.07, skew: 'high' },
  Joanna: { activityWeight: 3,   checksPerShift: [6, 8], drinkProb: 0.55, starterProb: 0.35, bottleProb: 0.05, skew: 'mid' },
  Colin:  { activityWeight: 3,   checksPerShift: [6, 8], drinkProb: 0.50, starterProb: 0.30, bottleProb: 0.04, skew: 'mid' }
};
// Jacob is fixed at exactly 8 shifts (not weight-derived) — explicit and
// deliberate, the whole point of the low-sample-size flag downstream.
const JACOB_SHIFTS = 8;
SERVERS.Jacob = { checksPerShift: [3, 4], drinkProb: 0.35, starterProb: 0.15, bottleProb: 0.00, skew: 'low' };

const GUEST_WEIGHTS = [[2, 0.35], [3, 0.25], [4, 0.25], [6, 0.10], [7, 0.05]];
function pickGuestCount() {
  const r = rand();
  let cum = 0;
  for (const [n, w] of GUEST_WEIGHTS) { cum += w; if (r < cum) return n; }
  return 2;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// August 2026, open 7 days/week, two shift periods/day (lunch 12-5,
// dinner 5-10) — the peer benchmark groups by (date, period) together,
// not just date, since daypart is exactly the kind of condition the
// same-shift comparison is meant to normalize away (see plan/reference
// doc: comparing servers on different dayparts would reintroduce the
// bias this whole benchmark design exists to cancel out).
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PERIODS = ['lunch', 'dinner'];
const ALL_SLOTS = shuffle(DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))));

// Every one of the 62 slots gets a roster — full coverage, no gaps (see
// SERVERS comment above). Roster size per slot is decided first (2-3,
// "generally 2-3 servers per shift" per Erik), which fixes exactly how
// many server-shift tokens are needed in total; those tokens are then
// split among the 5 servers by activityWeight, with Jacob carved out
// first at his fixed 8. Same token-chunking approach as before, just
// sized to guarantee every slot gets filled instead of only the ones a
// fixed target happened to add up to.
const slotRosterSizes = ALL_SLOTS.map(() => randInt(2, 3));
const totalTokensNeeded = slotRosterSizes.reduce((sum, n) => sum + n, 0);

const weightedNames = Object.entries(SERVERS).filter(([name]) => name !== 'Jacob');
const weightSum = weightedNames.reduce((sum, [, cfg]) => sum + cfg.activityWeight, 0);
const remainingTokens = totalTokensNeeded - JACOB_SHIFTS;
const shiftCounts = { Jacob: JACOB_SHIFTS };
let allocated = 0;
weightedNames.forEach(([name, cfg], i) => {
  if (i === weightedNames.length - 1) {
    shiftCounts[name] = remainingTokens - allocated; // last server absorbs the rounding remainder
  } else {
    const n = Math.round(remainingTokens * (cfg.activityWeight / weightSum));
    shiftCounts[name] = n;
    allocated += n;
  }
});

// A token that would duplicate a server already in the current roster
// goes back to the end of the queue rather than being dropped, so every
// server still hits their exact computed shift count.
function buildRosters(sizes) {
  const queue = shuffle(Object.entries(shiftCounts).flatMap(([name, count]) => Array(count).fill(name)));
  return sizes.map((size) => {
    const roster = [];
    let attempts = 0;
    while (roster.length < size && queue.length && attempts < queue.length + 10) {
      const candidate = queue.shift();
      if (roster.includes(candidate)) queue.push(candidate);
      else roster.push(candidate);
      attempts++;
    }
    return roster;
  });
}

const rosters = buildRosters(slotRosterSizes);
const shifts = ALL_SLOTS.map((slot, i) => ({ ...slot, servers: rosters[i] }));

function withSeat(item) {
  // ~85% of line items carry a seat number — matches Toast's real export
  // shape (not every check has full seat assignment). Unused by this
  // pass's math; here so the schema doesn't need reworking once real
  // Toast data replaces this file.
  return { ...item, seat: chance(0.85) ? randInt(1, 7) : null };
}

function buildCheck(checkId, date, period, server, cfg) {
  const guestCount = pickGuestCount();
  const items = [];

  // ~20% of tables are drinks-only (bar/lounge seating) — no Mains at
  // all, just drinks per guest and an occasional shared starter. Erik's
  // correction: not every check is a full dining check.
  const drinksOnly = chance(0.20);

  if (!drinksOnly) {
    for (let g = 0; g < guestCount; g++) items.push(withSeat(pickSkewed(MAINS, cfg.skew)));
  }
  if (chance(cfg.starterProb)) items.push(withSeat(pickOne(STARTERS)));
  for (let g = 0; g < guestCount; g++) {
    if (chance(cfg.drinkProb)) items.push(withSeat(pickOne(DRINKS)));
  }
  if (guestCount >= 6 && chance(cfg.bottleProb)) items.push(withSeat(pickOne(BOTTLES)));

  // A drinks-only table that rolled no starter and no drinks (low
  // probability, but possible for Jacob) would be an empty check —
  // guarantee at least one drink so every check has a real total.
  if (!items.length) items.push(withSeat(pickOne(DRINKS)));

  const total = items.reduce((sum, i) => sum + i.price, 0);
  return {
    checkId,
    date,
    period,
    server,
    guestCount,
    items: items.map(({ name, price, seat }) => ({ name, price, seat })),
    total
  };
}

const checks = [];
let checkCounter = 1;
for (const shift of shifts) {
  const date = `2026-08-${String(shift.day).padStart(2, '0')}`;
  for (const name of shift.servers) {
    const cfg = SERVERS[name];
    const numChecks = randInt(cfg.checksPerShift[0], cfg.checksPerShift[1]);
    for (let c = 0; c < numChecks; c++) {
      checks.push(buildCheck(`C-${String(checkCounter++).padStart(4, '0')}`, date, shift.period, name, cfg));
    }
  }
}

const outPath = path.join(__dirname, '..', 'netlify', 'functions', '_data', 'insights-mock-checks.json');
fs.writeFileSync(outPath, JSON.stringify(checks, null, 2));
console.log(`Wrote ${checks.length} checks to ${outPath}`);
for (const name of Object.keys(SERVERS)) {
  const mine = checks.filter((c) => c.server === name);
  const shiftCount = shifts.filter((s) => s.servers.includes(name)).length;
  const avgPPA = mine.reduce((s, c) => s + c.total / c.guestCount, 0) / mine.length;
  console.log(`${name}: ${shiftCount} shifts, ${mine.length} checks, avg PPA $${avgPPA.toFixed(2)}`);
}
