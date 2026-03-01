/**
 * POST /api/user-profile-set
 *
 * Save the user's phone number for SMS reminders.
 * Body: { userId, phoneNumber }
 * Returns: { success: true }
 */
const { setUserPhone } = require('./_services/db-user-profiles.cjs');

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

  const { userId, phoneNumber } = body;

  if (!userId || !userId.startsWith('u-')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid userId' }) };
  }

  if (!phoneNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: 'phoneNumber required' }) };
  }

  // Normalize to E.164: strip non-digits, prepend +1 if 10 digits
  const digits = String(phoneNumber).replace(/\D/g, '');
  let normalized;
  if (digits.length === 10) {
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    normalized = `+${digits}`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid phone number format' }) };
  }

  await setUserPhone(userId, normalized);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
};
