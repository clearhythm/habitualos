require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { updateOwner } = require('./_services/db-signal-owners.cjs');
const { sendWelcome } = require('./_services/email.cjs');
const { getUserById } = require('@habitualos/auth-server');

/**
 * POST /api/signal-auth-verify
 *
 * Body: { email, code }
 *
 * Verifies the 6-digit code sent to email.
 * On success: activates the owner record, sends welcome email.
 * Returns: { success, signalId, displayName }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { email, code } = JSON.parse(event.body);

    if (!email || !code) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'email and code required' }) };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const codeRef = db.collection('signal-auth-codes').doc(normalizedEmail);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'No verification code found for this email' }) };
    }

    const { code: storedCode, expiresAt, userId, signalId } = codeSnap.data();

    if (String(code).trim() !== String(storedCode)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Incorrect code' }) };
    }

    if (new Date() > new Date(expiresAt)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Code has expired — please register again' }) };
    }

    // Activate owner
    await updateOwner(signalId, { status: 'active' });

    // Clean up code doc
    await codeRef.delete();

    // Send welcome email (non-fatal)
    const user = await getUserById(userId).catch(() => null);
    const ownerSnap = await db.collection('signal-owners').doc(signalId).get();
    const { displayName } = ownerSnap.data();

    sendWelcome({ to: normalizedEmail, signalId, displayName }).catch(err => {
      console.warn('[signal-auth-verify] Welcome email failed (non-fatal):', err.message);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, signalId, displayName })
    };

  } catch (error) {
    console.error('[signal-auth-verify] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
