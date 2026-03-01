/**
 * POST /api/sms-test
 *
 * Manual testing endpoint for SMS functionality.
 * Protected by SMS_TEST_SECRET env var.
 *
 * Body options:
 *
 * 1. Simulate inbound SMS (runs full inbound logic, optionally sends reply via Twilio):
 *    { secret, type: 'inbound', phone: '+15551234567', message: 'jogged 10 min' }
 *    Returns: { reply: '...', sent: bool }
 *
 * 2. Send test reminder to a specific phone:
 *    { secret, type: 'reminder', phone: '+15551234567' }
 *    Looks up user by phone, computes challenge status, sends reminder if not complete.
 *    Returns: { sent: bool, skipped: bool, message: '...' }
 *
 * 3. Send arbitrary outbound SMS:
 *    { secret, type: 'send', phone: '+15551234567', message: 'Hello from Obi-Wai' }
 *    Returns: { sent: bool }
 */
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { getUserByPhone } = require('./_services/db-user-profiles.cjs');
const { getPracticeLogsByUserId, createPracticeLog } = require('./_services/db-practice-logs.cjs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function toPacificDate(timestamp) {
  const date = new Date(timestamp);
  const str = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const [datePart] = str.split(',');
  const [month, day, year] = datePart.trim().split('/');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function detectPractice(text) {
  if (/jog|run|jogging|running|ran/i.test(text)) return 'Jogging';
  if (/lasso|meditat|mindful/i.test(text)) return 'LASSO';
  return null;
}

function parseDuration(text) {
  const match = text.match(/(\d+)\s*(?:min|mins|minutes)/i);
  return match ? parseInt(match[1], 10) : null;
}

function getChallengeStatus(allLogs) {
  const today = toPacificDate(Date.now());
  if (!today.startsWith('2026-03-')) return null;

  const dayNumber = parseInt(today.slice(-2), 10);
  const todayLogs = allLogs.filter(log => log.timestamp && toPacificDate(log.timestamp) === today);
  const todayJogging = todayLogs.some(l => /jog|run/i.test(l.practice_name || ''));
  const todayLasso = todayLogs.some(l => /lasso|meditat/i.test(l.practice_name || ''));

  return { todayJogging, todayLasso, todayComplete: todayJogging && todayLasso, dayNumber };
}

const SMS_SYSTEM_PROMPT = `You are Obi-Wai, a calm, understated habit companion. The person is doing a 30-day challenge: daily jogging (5+ min) and LASSO mindfulness meditation (5+ min). They've texted you instead of checking in — there may be a block or they need encouragement.

Respond in 2–3 sentences. Your voice: direct, observational, no cheerleading, no exclamation marks. Key message: consistency matters more than duration. The smallest unit of practice is worth it. Help them dissolve any block by reframing perfectionism. Gently prompt them to reply with what they did to log it.`;

async function handleInbound(phone, message) {
  const user = await getUserByPhone(phone);
  if (!user) {
    const siteUrl = process.env.URL || 'https://obi-wai.netlify.app';
    return `I don't recognize this number. Register at: ${siteUrl}/profile/`;
  }

  const userId = user.id || user._userId;
  const practiceName = detectPractice(message);

  if (practiceName) {
    const duration = parseDuration(message);
    const logId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await createPracticeLog(logId, {
      _userId: userId,
      practice_name: practiceName,
      duration: duration || null,
      reflection: message,
      timestamp: new Date().toISOString(),
      source: 'sms'
    });

    const allLogs = await getPracticeLogsByUserId(userId);
    const status = getChallengeStatus(allLogs);
    const { todayJogging, todayLasso, todayComplete, dayNumber } = status || {};

    if (todayComplete) {
      return `Jogging + LASSO logged. Day ${dayNumber} complete.\nThat's the practice.`;
    }

    const durationStr = duration ? ` — ${duration} minutes` : '';
    const jogSymbol = todayJogging ? '✓' : '○';
    const lassoSymbol = todayLasso ? '✓' : '○';
    const dayStr = dayNumber ? ` (Day ${dayNumber}/31)` : '';
    return `${practiceName} logged${durationStr}.\nI'm watching what you're building here.\nToday: Jogging ${jogSymbol} · LASSO ${lassoSymbol}${dayStr}`;
  }

  // Coaching path
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      system: SMS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }]
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('Claude API error:', err);
    return 'Keep going. The smallest unit of practice counts. Reply with what you did to log it.';
  }
}

async function handleReminder(phone) {
  const user = await getUserByPhone(phone);
  if (!user) return { skipped: true, reason: 'No user found for this phone number' };

  const userId = user.id || user._userId;
  const allLogs = await getPracticeLogsByUserId(userId);
  const status = getChallengeStatus(allLogs);

  if (!status) return { skipped: true, reason: 'Not in March 2026 challenge period' };
  if (status.todayComplete) return { skipped: true, reason: 'Already completed both goals today' };

  const { todayJogging, todayLasso, dayNumber } = status;
  let message;
  if (!todayJogging && !todayLasso) {
    message = `Day ${dayNumber} of 31. Still time today.\n5 min jogging + 5 min LASSO. That's the whole practice.`;
  } else if (todayJogging) {
    message = `Jogging done. LASSO still waiting.\n5 minutes is all it takes.`;
  } else {
    message = `LASSO done. Still time for a jog.\nEven 5 minutes counts.`;
  }

  return { message };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const testSecret = process.env.SMS_TEST_SECRET;
  if (testSecret && body.secret !== testSecret) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Invalid secret' }) };
  }

  const { type, phone, message } = body;

  if (!phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'phone required' }) };
  }

  const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER;

  try {
    if (type === 'inbound') {
      if (!message) return { statusCode: 400, body: JSON.stringify({ error: 'message required for inbound' }) };

      const reply = await handleInbound(phone, message);
      let sent = false;

      if (hasTwilio) {
        const client = getTwilioClient();
        await client.messages.create({ to: phone, from: process.env.TWILIO_PHONE_NUMBER, body: reply });
        sent = true;
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply, sent })
      };
    }

    if (type === 'reminder') {
      const result = await handleReminder(phone);

      if (result.skipped) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sent: false, skipped: true, reason: result.reason })
        };
      }

      let sent = false;
      if (hasTwilio) {
        const client = getTwilioClient();
        await client.messages.create({ to: phone, from: process.env.TWILIO_PHONE_NUMBER, body: result.message });
        sent = true;
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent, message: result.message })
      };
    }

    if (type === 'send') {
      if (!message) return { statusCode: 400, body: JSON.stringify({ error: 'message required for send' }) };

      if (!hasTwilio) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sent: false, reason: 'Twilio not configured' })
        };
      }

      const client = getTwilioClient();
      await client.messages.create({ to: phone, from: process.env.TWILIO_PHONE_NUMBER, body: message });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent: true })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'type must be inbound, reminder, or send' }) };
  } catch (err) {
    console.error('sms-test error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
