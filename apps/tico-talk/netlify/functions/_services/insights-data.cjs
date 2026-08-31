// Shared aggregation over Tico Insights' seeded demo dataset — used by
// insights-tool-execute.cjs (each function here backs one tool the model
// can call). Deliberately NOT shared with src/_data/insightsAnalytics.js
// (ESM, 11ty build-time) — same reason restaurants.js/db-restaurants.cjs
// already duplicate their own shared logic in this codebase: different
// module systems. Keep the two in sync by eye if the aggregation rules
// ever change (server-performance math specifically — see that file's
// own comments for the "same-shift peer benchmark" reasoning).

const LOW_SAMPLE_THRESHOLD = 10;

// A plain relative require() of the JSON, not fs.readFileSync — esbuild
// statically resolves this and inlines the parsed data directly into the
// function bundle at build time, so there's no runtime file path to get
// wrong. That sidesteps __dirname (breaks once esbuild inlines this file
// into whichever function requires it — it no longer points at
// netlify/functions/_services) and LAMBDA_TASK_ROOT/included_files
// (works, but only after a Netlify Dev restart re-reads netlify.toml)
// entirely. Plain Node also natively require()s JSON with no bundler
// involved, so this behaves the same in direct `node -e` checks.
// require()'s own module cache replaces the manual memoization this used
// to need.
function loadChecks() {
  return require('../_data/insights-mock-checks.json');
}

function getServerPerformance() {
  const checks = loadChecks();
  const shiftServerTotals = new Map();
  for (const check of checks) {
    const shiftKey = `${check.date}::${check.period}`;
    if (!shiftServerTotals.has(shiftKey)) shiftServerTotals.set(shiftKey, new Map());
    const byServer = shiftServerTotals.get(shiftKey);
    const totals = byServer.get(check.server) || { totalRevenue: 0, totalGuests: 0 };
    totals.totalRevenue += check.total;
    totals.totalGuests += check.guestCount;
    byServer.set(check.server, totals);
  }

  const shiftGroups = new Map();
  for (const [shiftKey, byServer] of shiftServerTotals) {
    const rows = [...byServer.entries()].map(([server, { totalRevenue, totalGuests }]) => ({
      server,
      ppa: totalRevenue / totalGuests
    }));
    shiftGroups.set(shiftKey, rows);
  }

  const ppasByServer = new Map();
  const deltasByServer = new Map();
  for (const rows of shiftGroups.values()) {
    for (const row of rows) {
      const others = rows.filter((r) => r.server !== row.server);
      if (!others.length) continue;
      const peerAvg = others.reduce((sum, r) => sum + r.ppa, 0) / others.length;
      if (!ppasByServer.has(row.server)) ppasByServer.set(row.server, []);
      ppasByServer.get(row.server).push(row.ppa);
      if (!deltasByServer.has(row.server)) deltasByServer.set(row.server, []);
      deltasByServer.get(row.server).push(row.ppa - peerAvg);
    }
  }

  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return [...ppasByServer.keys()].map((server) => {
    const ppas = ppasByServer.get(server);
    const deltas = deltasByServer.get(server) || [];
    return {
      server,
      shifts: ppas.length,
      avgPPA: Number(mean(ppas).toFixed(2)),
      avgDelta: deltas.length ? Number(mean(deltas).toFixed(2)) : null,
      lowSample: ppas.length < LOW_SAMPLE_THRESHOLD
    };
  });
}

function getRevenueTrends() {
  const checks = loadChecks();
  const byDate = new Map();
  for (const check of checks) {
    const row = byDate.get(check.date) || { date: check.date, revenue: 0, checkCount: 0, guestCount: 0 };
    row.revenue += check.total;
    row.checkCount += 1;
    row.guestCount += check.guestCount;
    byDate.set(check.date, row);
  }
  const daily = [...byDate.values()]
    .map((d) => ({ ...d, avgPPA: Number((d.revenue / d.guestCount).toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthlyRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const monthlyGuests = daily.reduce((s, d) => s + d.guestCount, 0);
  return {
    daily,
    monthly: {
      revenue: monthlyRevenue,
      checkCount: daily.reduce((s, d) => s + d.checkCount, 0),
      guestCount: monthlyGuests,
      avgPPA: Number((monthlyRevenue / monthlyGuests).toFixed(2))
    }
  };
}

// Optional date/server filters — this is the tool a question like "how
// did Larry do on Aug 5th" resolves to, so letting the model narrow the
// request keeps the tool_result small instead of returning all ~150 rows
// every time.
function getShiftBreakdown({ date, server } = {}) {
  const checks = loadChecks();
  const byKey = new Map();
  for (const check of checks) {
    if (date && check.date !== date) continue;
    if (server && check.server !== server) continue;
    const key = `${check.date}::${check.period}::${check.server}`;
    const row = byKey.get(key) || { date: check.date, period: check.period, server: check.server, checkCount: 0, revenue: 0, guestCount: 0 };
    row.checkCount += 1;
    row.revenue += check.total;
    row.guestCount += check.guestCount;
    byKey.set(key, row);
  }
  return [...byKey.values()]
    .map((r) => ({ ...r, ppa: Number((r.revenue / r.guestCount).toFixed(2)) }))
    .sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));
}

// Category mirrors src/_data/insightsAnalytics.js's CATEGORY_BY_NAME
// (same STARTERS/MAINS/DRINKS/BOTTLES split from scripts/generate-
// insights-mock-data.cjs) — kept in sync by eye, same duplication-
// across-module-systems reasoning as the rest of this file. Without it,
// a question like "which dishes make the most money" would have the
// model guessing food-vs-drink from item names alone instead of
// answering from real data.
const CATEGORY_BY_NAME = new Map([
  ["Castelvetrano Olives", "Starters"],
  ["House Smoked Salmon Dip", "Starters"],
  ["Shishito Peppers", "Starters"],
  ["Straciatella & Prosciutto", "Starters"],
  ["Shrimp Cocktail", "Starters"],
  ["Ahi Tuna Crudo", "Starters"],
  ["Dungeness Crab Cocktail", "Starters"],
  ["Wagyu Smashburger", "Mains"],
  ["Maine Lobster Roll", "Mains"],
  ["Shrimp & White Cheddar Grits", "Mains"],
  ["Steamed Clams", "Mains"],
  ["Grilled Branzino", "Mains"],
  ["Local King Salmon", "Mains"],
  ["Filet Mignon", "Mains"],
  ["Pomegranate Cosmo", "Cocktails"],
  ["Lychee Martini", "Cocktails"],
  ["Aperol Spritz", "Cocktails"],
  ["Garden Gimlet", "Cocktails"],
  ["Almost Famous", "Cocktails"],
  ["Spiced Old Fashioned", "Cocktails"],
  ["Espresso Martini", "Cocktails"],
  ["Storr's Chardonnay", "Wine by the Glass"],
  ["Rombauer Chardonnay", "Wine by the Glass"],
  ["Soquel Vineyards Pinot Noir", "Wine by the Glass"],
  ["Ridge Three Valley's Zinfandel", "Wine by the Glass"],
  ["Roth Cabernet Sauvignon", "Wine by the Glass"],
  ["DAOU Cabernet Sauvignon", "Wine by the Glass"],
  ['La Marea "Kristy Vineyard"', "Wine by the Bottle"],
  ["The Prisoner Cab. Sauvignon", "Wine by the Bottle"],
  ["Round Pond Estate Cab. Sauvignon", "Wine by the Bottle"],
  ["Paul Hobbs Pinot Noir", "Wine by the Bottle"]
]);

// Optional server/category filters — every check already carries both
// `server` and its own `items` array, so a per-server breakdown (e.g.
// "what does Larry sell more of than Sol") is just a groupby, not
// something this dataset lacks the granularity for. category is one of
// "Starters"/"Mains"/"Cocktails"/"Wine by the Glass"/"Wine by the
// Bottle" (matches Menu Mix's own categories exactly).
function getItemPopularity({ server, category } = {}) {
  const checks = loadChecks();
  const byItem = new Map();
  for (const check of checks) {
    if (server && check.server !== server) continue;
    for (const item of check.items) {
      const itemCategory = CATEGORY_BY_NAME.get(item.name) || "Other";
      if (category && itemCategory !== category) continue;
      const row = byItem.get(item.name) || { name: item.name, category: itemCategory, count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += item.price;
      byItem.set(item.name, row);
    }
  }
  return [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

module.exports = { getServerPerformance, getRevenueTrends, getShiftBreakdown, getItemPopularity };
