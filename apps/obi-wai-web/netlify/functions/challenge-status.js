/**
 * GET /api/challenge-status?userId=u-...
 *
 * Returns March 2026 challenge progress for the user.
 * Returns: {
 *   success: true,
 *   completedDays: ["2026-03-01", ...],   // Pacific date strings (YYYY-MM-DD)
 *   missedDays: [...],                     // past days that weren't complete
 *   todayJogging: bool,
 *   todayLasso: bool,
 *   todayComplete: bool,
 *   streak: N,
 *   dayNumber: N    // 1–31 (which day of March we're on)
 * }
 */
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');
const { getResponsesByUser } = require('@habitualos/survey-engine');

const SURVEY_ID = 'survey-obi-v1';

// Convert a timestamp to a Pacific date string "YYYY-MM-DD"
function toPacificDate(timestamp) {
  const date = new Date(timestamp);
  const str = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  // str format: "M/D/YYYY, H:MM:SS AM/PM"
  const [datePart] = str.split(',');
  const [month, day, year] = datePart.trim().split('/');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Get current Pacific date string
function todayPacific() {
  return toPacificDate(Date.now());
}

// Which day of March (1–31) is it in Pacific time?
function marchDayNumber(pacificDateStr) {
  if (!pacificDateStr.startsWith('2026-03-')) return null;
  return parseInt(pacificDateStr.slice(-2), 10);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const userId = event.queryStringParameters && event.queryStringParameters.userId;
  if (!userId || !userId.startsWith('u-')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid userId' }) };
  }

  const [allLogs, allResponses] = await Promise.all([
    getPracticeLogsByUserId(userId),
    getResponsesByUser(userId, SURVEY_ID).catch(() => [])
  ]);

  // Filter to March 2026 logs only
  const marchLogs = allLogs.filter(log => {
    if (!log.timestamp) return false;
    const dateStr = toPacificDate(log.timestamp);
    return dateStr.startsWith('2026-03-');
  });

  // Group logs by Pacific date
  const byDate = {};
  for (const log of marchLogs) {
    const dateStr = toPacificDate(log.timestamp);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(log);
  }

  // For a set of logs on a day, check completion
  function isDayComplete(logs) {
    const hasJogging = logs.some(l => /jog|run/i.test(l.practice_name || ''));
    const hasLasso = logs.some(l => /lasso|meditat/i.test(l.practice_name || ''));
    return hasJogging && hasLasso;
  }

  const today = todayPacific();
  const todayDay = marchDayNumber(today);

  // Build completedDays and missedDays
  const completedDays = [];
  const missedDays = [];

  for (let d = 1; d <= 31; d++) {
    const dateStr = `2026-03-${String(d).padStart(2, '0')}`;
    const isPast = dateStr < today;
    const isToday = dateStr === today;

    if (byDate[dateStr] && isDayComplete(byDate[dateStr])) {
      completedDays.push(dateStr);
    } else if (isPast && !isToday) {
      missedDays.push(dateStr);
    }
  }

  // Today's goal status
  const todayLogs = byDate[today] || [];
  const todayJogging = todayLogs.some(l => /jog|run/i.test(l.practice_name || ''));
  const todayLasso = todayLogs.some(l => /lasso|meditat/i.test(l.practice_name || ''));
  const todayComplete = todayJogging && todayLasso;

  // Streak: count consecutive complete days backwards from today (or last complete day)
  let streak = 0;
  let checkDay = todayComplete ? todayDay : (todayDay || 0) - 1;
  while (checkDay >= 1) {
    const dateStr = `2026-03-${String(checkDay).padStart(2, '0')}`;
    if (completedDays.includes(dateStr)) {
      streak++;
      checkDay--;
    } else {
      break;
    }
  }

  // dayNumber: which March day we're on (null if not in March 2026)
  const dayNumber = todayDay || null;

  // Today's check-in scores (all of them, sorted oldest first)
  const todayCheckIns = allResponses
    .filter(r => toPacificDate(r._createdAt) === today)
    .sort((a, b) => new Date(a._createdAt) - new Date(b._createdAt))
    .map(r => {
      const get = name => r.scores?.find(s => s.dimension === name);
      return {
        timing: r.timing || null,
        resistance: get('Resistance')?.average ?? null,
        selfEfficacy: get('Self-efficacy')?.average ?? null,
        innerAccess: get('Inner access')?.average ?? null,
        createdAt: r._createdAt
      };
    });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      completedDays,
      missedDays,
      todayJogging,
      todayLasso,
      todayComplete,
      streak,
      dayNumber,
      todayCheckIns
    })
  };
};
