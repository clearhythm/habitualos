import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Build-time aggregation over the seeded Tico Insights demo dataset (see
// scripts/generate-insights-mock-data.cjs — that script is the source of
// truth for netlify/functions/_data/insights-mock-checks.json; this file
// only aggregates it, never generates or mutates it). Computed fresh
// every build from the static JSON, same "global data" pattern as
// restaurants.js, so src/marketing/insights-demo.njk gets a plain
// `insightsAnalytics` variable with no client-side computation needed.
//
// PPA = revenue per guest (check $ / guest count, not per table). The
// benchmark is a SAME-SHIFT peer average: for each (date, period) shift,
// each server's shift-level PPA is compared only to the *other* servers
// who worked that exact shift, not a global average — this is what
// self-normalizes for daypart/day-of-week/events (see the reference
// doc). A server's rolled-up delta is the mean of their own per-shift
// deltas, not a single lump comparison.

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "..", "netlify", "functions", "_data", "insights-mock-checks.json");
const LOW_SAMPLE_THRESHOLD = 10;

export default function () {
  const checks = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

  // shiftKey -> server -> { totalRevenue, totalGuests }
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

  // One shift-level PPA per (shift, server) — the unit everything else
  // (peer average, delta) is computed from.
  const shiftServerPPA = []; // { shiftKey, server, ppa }
  for (const [shiftKey, byServer] of shiftServerTotals) {
    for (const [server, { totalRevenue, totalGuests }] of byServer) {
      shiftServerPPA.push({ shiftKey, server, ppa: totalRevenue / totalGuests });
    }
  }

  const deltasByServer = new Map(); // server -> [delta, delta, ...]
  const ppasByServer = new Map(); // server -> [ppa, ppa, ...]
  const shiftGroups = new Map(); // shiftKey -> [{server, ppa}, ...]
  for (const row of shiftServerPPA) {
    if (!shiftGroups.has(row.shiftKey)) shiftGroups.set(row.shiftKey, []);
    shiftGroups.get(row.shiftKey).push(row);
  }

  for (const rows of shiftGroups.values()) {
    for (const row of rows) {
      const others = rows.filter((r) => r.server !== row.server);
      if (!others.length) continue; // solo shift — no peer to benchmark against, excluded from delta
      const peerAvg = others.reduce((sum, r) => sum + r.ppa, 0) / others.length;

      if (!deltasByServer.has(row.server)) deltasByServer.set(row.server, []);
      deltasByServer.get(row.server).push(row.ppa - peerAvg);

      if (!ppasByServer.has(row.server)) ppasByServer.set(row.server, []);
      ppasByServer.get(row.server).push(row.ppa);
    }
  }

  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const servers = [...ppasByServer.keys()].map((server) => {
    const ppas = ppasByServer.get(server);
    const deltas = deltasByServer.get(server) || [];
    return {
      name: server,
      shifts: ppas.length,
      avgPPA: mean(ppas),
      avgDelta: deltas.length ? mean(deltas) : null,
      lowSample: ppas.length < LOW_SAMPLE_THRESHOLD
    };
  }).sort((a, b) => (b.avgDelta ?? -Infinity) - (a.avgDelta ?? -Infinity));

  // Raw Data tab: every check, grouped by server (same order as the
  // Analytics table above) so the two views read as the same underlying
  // numbers at different zoom levels, not two separate datasets — the
  // whole point Erik raised is trusting the rollup means being able to
  // see the checks it was built from.
  const checksByServer = servers.map(({ name }) => {
    const mine = checks
      .filter((c) => c.server === name)
      .sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));
    return {
      server: name,
      checkCount: mine.length,
      totalRevenue: mine.reduce((s, c) => s + c.total, 0),
      checks: mine.map((c) => ({
        checkId: c.checkId,
        date: c.date,
        period: c.period,
        guestCount: c.guestCount,
        items: c.items.map((i) => i.name).join(", "),
        total: c.total,
        ppa: c.total / c.guestCount
      }))
    };
  });

  const revenueTrends = computeRevenueTrends(checks);

  // Top Server highlight (Revenue Breakdown's overview row) — servers is
  // already sorted by avgDelta descending for the Staff Performance table,
  // so the top entry here is the same "vs. same-shift peers" delta that
  // table already shows, not a second/different definition of "best."
  revenueTrends.topServer = servers[0]
    ? { name: servers[0].name, avgPPA: servers[0].avgPPA, avgDelta: servers[0].avgDelta }
    : null;

  const menuMix = computeMenuMix(checks);

  return {
    servers,
    checksByServer,
    revenueTrends,
    menuMix,
    restaurantName: "Pete's Fish House",
    month: "August 2026",
    checkCount: checks.length
  };
}

// Menu Mix — dishes and drinks ranked by order count this month,
// organized by actual menu category with menu price shown per item, so
// it reads like the menu itself rather than a flat popularity list.
// Check items only carry a name/price, not a stored category, so the
// name -> category map below mirrors scripts/generate-insights-mock-
// data.cjs's STARTERS/MAINS/DRINKS/BOTTLES arrays exactly — DRINKS
// itself splits into Cocktails vs. Wine by the Glass here, a distinction
// the generator doesn't track either, just item order within that array.
// Kept in sync by eye, same duplication-across-module-systems reasoning
// as this file's other aggregations vs. insights-data.cjs. No gross
// profit (would need the restaurant's actual food/drink cost, which
// this dataset doesn't have) or specials/promotions dimension (flagged
// for later) — menu price and popularity only, for now.
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

const DISH_CATEGORIES = ["Starters", "Mains"];
const DRINK_CATEGORIES = ["Cocktails", "Wine by the Glass", "Wine by the Bottle"];

function computeMenuMix(checks) {
  const byItem = new Map();
  for (const check of checks) {
    for (const item of check.items) {
      const row = byItem.get(item.name) || { name: item.name, price: item.price, count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += item.price;
      byItem.set(item.name, row);
    }
  }

  const byCategory = new Map();
  for (const row of byItem.values()) {
    const category = CATEGORY_BY_NAME.get(row.name) || "Other";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row);
  }

  const buildCategories = (names) =>
    names
      .filter((name) => byCategory.has(name))
      .map((name) => ({
        name,
        items: byCategory.get(name)
          .sort((a, b) => b.count - a.count)
          .map((item, i) => ({ ...item, rank: i + 1 }))
      }));

  return {
    dishes: buildCategories(DISH_CATEGORIES),
    drinks: buildCategories(DRINK_CATEGORIES)
  };
}

// Revenue Trends view — the restaurant-wide daily/weekly/monthly picture,
// a sibling view to Server Performance rather than a sub-tab of it (see
// the sidebar shell in insights-demo.njk). Aggregated by date only (both
// dayparts combined) since a GM looking at "how's the month going"
// thinks in days, not shifts — the same-shift peer-benchmark reasoning
// that requires splitting by period is specific to the server view.
function computeRevenueTrends(checks) {
  const byDate = new Map();
  for (const check of checks) {
    const row = byDate.get(check.date) || { date: check.date, revenue: 0, checkCount: 0, guestCount: 0 };
    row.revenue += check.total;
    row.checkCount += 1;
    row.guestCount += check.guestCount;
    byDate.set(check.date, row);
  }

  const daily = [...byDate.values()]
    .map((d) => ({ ...d, day: Number(d.date.slice(-2)), avgPPA: d.revenue / d.guestCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxDailyRevenue = Math.max(...daily.map((d) => d.revenue));

  // Simple 7-day buckets (Week 1 = Aug 1-7, ...), not calendar/ISO weeks
  // — a PoC doesn't need weekday-aligned bucketing, just a coarser zoom
  // level than daily.
  const weekly = [];
  for (let start = 1; start <= 31; start += 7) {
    const end = Math.min(start + 6, 31);
    const inRange = daily.filter((d) => {
      const day = Number(d.date.slice(-2));
      return day >= start && day <= end;
    });
    if (!inRange.length) continue;
    const revenue = inRange.reduce((s, d) => s + d.revenue, 0);
    const guestCount = inRange.reduce((s, d) => s + d.guestCount, 0);
    weekly.push({
      label: `Aug ${start}-${end}`,
      revenue,
      checkCount: inRange.reduce((s, d) => s + d.checkCount, 0),
      guestCount,
      avgPPA: revenue / guestCount
    });
  }

  const monthlyRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const monthlyGuests = daily.reduce((s, d) => s + d.guestCount, 0);
  const monthly = {
    label: "August 2026",
    revenue: monthlyRevenue,
    checkCount: daily.reduce((s, d) => s + d.checkCount, 0),
    guestCount: monthlyGuests,
    avgPPA: monthlyRevenue / monthlyGuests
  };

  const maxWeeklyRevenue = Math.max(...weekly.map((w) => w.revenue));

  // Top Day highlight — revenue vs. the average of every OTHER day, same
  // "vs. the rest" framing as the server peer-delta above, just applied
  // to days instead of servers.
  const avgDailyRevenue = daily.reduce((s, d) => s + d.revenue, 0) / daily.length;
  const topDayRow = daily.reduce((max, d) => (d.revenue > max.revenue ? d : max), daily[0]);
  const topDay = {
    date: topDayRow.date,
    day: topDayRow.day,
    revenue: topDayRow.revenue,
    deltaVsAvg: topDayRow.revenue - avgDailyRevenue,
    pctVsAvg: ((topDayRow.revenue - avgDailyRevenue) / avgDailyRevenue) * 100
  };

  // Top Shift highlight — the single strongest individual shift instance
  // (one date + period, e.g. "Dinner, Aug 7"), not lunch-vs-dinner
  // averaged across the month — that's a different question ("which
  // daypart type tends to do better") than "which single shift was the
  // best one," which needs every one of the ~62 shift instances compared
  // against each other individually, same "vs. the rest" framing as
  // Top Day above.
  const shiftTotals = new Map(); // "date::period" -> { date, day, period, revenue }
  for (const check of checks) {
    const key = `${check.date}::${check.period}`;
    const row = shiftTotals.get(key) || { date: check.date, day: Number(check.date.slice(-2)), period: check.period, revenue: 0 };
    row.revenue += check.total;
    shiftTotals.set(key, row);
  }
  const allShifts = [...shiftTotals.values()];
  const topShiftRow = allShifts.reduce((max, s) => (s.revenue > max.revenue ? s : max), allShifts[0]);
  const otherShifts = allShifts.filter((s) => s !== topShiftRow);
  const avgOtherShiftRevenue = otherShifts.reduce((sum, s) => sum + s.revenue, 0) / otherShifts.length;
  const topShift = {
    date: topShiftRow.date,
    day: topShiftRow.day,
    period: topShiftRow.period,
    revenue: topShiftRow.revenue,
    deltaVsAvg: topShiftRow.revenue - avgOtherShiftRevenue,
    pctVsAvg: ((topShiftRow.revenue - avgOtherShiftRevenue) / avgOtherShiftRevenue) * 100
  };

  return { daily, weekly, monthly, maxDailyRevenue, maxWeeklyRevenue, topDay, topShift };
}
