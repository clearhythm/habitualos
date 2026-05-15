/**
 * POST /api/user-profile-set
 *
 * Save profile fields. Accepts any combination of: phoneNumber, displayName.
 * Body: { userId, phoneNumber?, displayName? }
 * Returns: { success: true }
 */
const { setUserPhone, setDisplayName } = require('./_services/db-user-profiles.cjs');

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

  const { userId, phoneNumber, displayName } = body;

  if (!userId || !userId.startsWith('u-')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid userId' }) };
  }

  if (!phoneNumber && !displayName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'At least one field required: phoneNumber, displayName' }) };
  }

  if (phoneNumber) {
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
  }

  if (displayName) {
    const trimmed = String(displayName).trim().slice(0, 40);
    if (!trimmed) {
      return { statusCode: 400, body: JSON.stringify({ error: 'displayName cannot be empty' }) };
    }
    await setDisplayName(userId, trimmed);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
};
