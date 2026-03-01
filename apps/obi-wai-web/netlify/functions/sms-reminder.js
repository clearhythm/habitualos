/**
 * Scheduled daily reminder at 7pm PT.
 * Cron: "0 2 * * *" UTC = 7pm PDT (Mar 8–31) / 6pm PST (Mar 1–7)
 *
 * Sends SMS to users who haven't completed both goals today.
 */
const twilio = require('twilio');
const { getAllUsersWithPhone } = require('./_services/db-user-profiles.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

// Convert timestamp to Pacific date string
function toPacificDate(timestamp) {
  const date = new Date(timestamp);
  const str = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const [datePart] = str.split(',');
  const [month, day, year] = datePart.trim().split('/');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

exports.handler = async () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Missing Twilio credentials');
    return { statusCode: 500, body: 'Missing Twilio credentials' };
  }

  const client = twilio(accountSid, authToken);
  const users = await getAllUsersWithPhone();

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const userId = user.id || user._userId;
    const phoneNumber = user.profile && user.profile.phoneNumber;
    if (!userId || !phoneNumber) continue;

    try {
      const allLogs = await getPracticeLogsByUserId(userId);
      const status = getChallengeStatus(allLogs);

      // Not in March 2026, or already complete
      if (!status || status.todayComplete) {
        skipped++;
        continue;
      }

      const { todayJogging, todayLasso, dayNumber } = status;

      let message;
      if (!todayJogging && !todayLasso) {
        message = `Day ${dayNumber} of 31. Still time today.\n5 min jogging + 5 min LASSO. That's the whole practice.`;
      } else if (todayJogging && !todayLasso) {
        message = `Jogging done. LASSO still waiting.\n5 minutes is all it takes.`;
      } else {
        message = `LASSO done. Still time for a jog.\nEven 5 minutes counts.`;
      }

      await client.messages.create({
        to: phoneNumber,
        from: fromNumber,
        body: message
      });

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder to user ${userId}:`, err.message);
    }
  }

  console.log(`SMS reminders: ${sent} sent, ${skipped} skipped`);
  return { statusCode: 200, body: JSON.stringify({ sent, skipped }) };
};
