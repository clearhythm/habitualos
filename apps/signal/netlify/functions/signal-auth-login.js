require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { getOwnerBySignalId, getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { getUserById, getUserByEmail } = require('@habitualos/auth-server');
const { sendVerificationCode } = require('./_services/email.cjs');

const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * POST /api/signal-auth-login
 *
 * Sends a verification code to an existing owner's email.
 *
 * Two modes:
 * - Widget /signin: { email, signalId } — verifies email matches owner
 * - Dashboard signin: { email } only — looks up owner by email
 *
 * Returns: { success } or { success: false, error }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { email, signalId } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'email required' }) };
    }

    const normalizedEmail = email.toLowerCase().trim();
    let owner;

    if (signalId) {
      // Widget mode: look up owner by signalId, verify email matches
      owner = await getOwnerBySignalId(signalId);
      if (!owner || owner.status !== 'active') {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Signal not found' }) };
      }
      const user = await getUserById(owner._userId);
      if (!user || user._email !== normalizedEmail) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Email does not match this Signal' }) };
      }
    } else {
      // Dashboard mode: look up owner by email via users collection
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'No account found for this email' }) };
      }
      owner = await getOwnerByUserId(user.id);
      if (!owner || owner.status !== 'active') {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'No Signal found for this account' }) };
      }
    }

    // Issue a fresh verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    await db.collection('signal-auth-codes').doc(normalizedEmail).set({
      code,
      expiresAt,
      _userId: owner._userId,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendVerificationCode({ to: normalizedEmail, code });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('[signal-auth-login] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
