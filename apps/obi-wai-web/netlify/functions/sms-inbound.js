/**
 * POST /api/sms-inbound
 *
 * Twilio webhook for incoming SMS messages.
 * Handles: practice logging and Obi-Wai coaching conversations.
 */
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { getUserByPhone } = require('./_services/db-user-profiles.cjs');
const { getPracticeLogsByUserId, createPracticeLog } = require('./_services/db-practice-logs.cjs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Parse URL-encoded body (Twilio sends application/x-www-form-urlencoded)
function parseUrlEncoded(body) {
  const params = {};
  if (!body) return params;
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=').map(s => decodeURIComponent(s.replace(/\+/g, ' ')));
    params[key] = value;
  }
  return params;
}

// Detect practice from message text
function detectPractice(text) {
  if (/jog|run|jogging|running|ran/i.test(text)) return 'Jogging';
  if (/lasso|meditat|mindful/i.test(text)) return 'LASSO';
  return null;
}

// Parse duration in minutes from message text
function parseDuration(text) {
  const match = text.match(/(\d+)\s*(?:min|mins|minutes)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Convert timestamp to Pacific date string
function toPacificDate(timestamp) {
  const date = new Date(timestamp);
  const str = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const [datePart] = str.split(',');
  const [month, day, year] = datePart.trim().split('/');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Get challenge status inline for a user's logs
function getChallengeStatus(allLogs) {
  const today = toPacificDate(Date.now());
  const marchLogs = allLogs.filter(log => {
    if (!log.timestamp) return false;
    return toPacificDate(log.timestamp).startsWith('2026-03-');
  });

  const byDate = {};
  for (const log of marchLogs) {
    const dateStr = toPacificDate(log.timestamp);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(log);
  }

  const todayLogs = byDate[today] || [];
  const todayJogging = todayLogs.some(l => /jog|run/i.test(l.practice_name || ''));
  const todayLasso = todayLogs.some(l => /lasso|meditat/i.test(l.practice_name || ''));

  // dayNumber
  let dayNumber = null;
  if (today.startsWith('2026-03-')) {
    dayNumber = parseInt(today.slice(-2), 10);
  }

  return { todayJogging, todayLasso, todayComplete: todayJogging && todayLasso, dayNumber };
}

// Build TwiML response
function twiml(message) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
  };
}

const SMS_SYSTEM_PROMPT = `You are Obi-Wai, a calm, understated habit companion. The person is doing a 30-day challenge: daily jogging (5+ min) and LASSO mindfulness meditation (5+ min). They've texted you instead of checking in — there may be a block or they need encouragement.

Respond in 2–3 sentences. Your voice: direct, observational, no cheerleading, no exclamation marks. Key message: consistency matters more than duration. The smallest unit of practice is worth it. Help them dissolve any block by reframing perfectionism. Gently prompt them to reply with what they did to log it.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Parse Twilio POST body
  const params = parseUrlEncoded(event.body);
  const from = params.From;
  const body = params.Body || '';

  if (!from) {
    return { statusCode: 400, body: 'Missing From' };
  }

  // Validate Twilio signature (skip in local dev)
  if (process.env.APP_ENV !== 'local') {
    const signature = event.headers['x-twilio-signature'] || event.headers['X-Twilio-Signature'];
    const url = `https://${event.headers.host}${event.path}`;
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    );
    if (!valid) {
      return { statusCode: 403, body: 'Invalid Twilio signature' };
    }
  }

  // Look up user by phone
  const user = await getUserByPhone(from);
  if (!user) {
    const siteUrl = process.env.URL || 'https://obi-wai.netlify.app';
    return twiml(`I don't recognize this number. Register at: ${siteUrl}/profile/`);
  }

  const userId = user.id || user._userId;
  const practiceName = detectPractice(body);

  if (practiceName) {
    // Logging path
    const duration = parseDuration(body);
    const logId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    await createPracticeLog(logId, {
      _userId: userId,
      practice_name: practiceName,
      duration: duration || null,
      reflection: body,
      timestamp,
      source: 'sms'
    });

    // Re-fetch logs for status
    const allLogs = await getPracticeLogsByUserId(userId);
    const { todayJogging, todayLasso, todayComplete, dayNumber } = getChallengeStatus(allLogs);

    let reply;
    if (todayComplete) {
      reply = `Jogging + LASSO logged. Day ${dayNumber} complete.\nThat's the practice.`;
    } else {
      const durationStr = duration ? ` — ${duration} minutes` : '';
      const jogSymbol = todayJogging ? '✓' : '○';
      const lassoSymbol = todayLasso ? '✓' : '○';
      const dayStr = dayNumber ? ` (Day ${dayNumber}/31)` : '';
      reply = `${practiceName} logged${durationStr}.\nI'm watching what you're building here.\nToday: Jogging ${jogSymbol} · LASSO ${lassoSymbol}${dayStr}`;
    }

    return twiml(reply);
  }

  // Coaching path — call Claude
  let coachingReply = 'Keep going. The smallest unit of practice counts. Reply with what you did to log it.';
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      system: SMS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: body }]
    });
    coachingReply = response.content[0].text.trim();
  } catch (err) {
    console.error('Claude API error:', err);
  }

  return twiml(coachingReply);
};
