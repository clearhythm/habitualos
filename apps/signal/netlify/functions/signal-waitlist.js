require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const crypto = require('crypto');
const { sendWaitlistConfirm } = require('./_services/email.cjs');

/**
 * POST /api/signal-waitlist
 *
 * Body: { email, context? }
 *
 * Stores an email on the Signal waitlist.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { email, referrer = '' } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid email required' }) };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const confirmToken = crypto.randomBytes(24).toString('hex');
    const ref = db.collection('signal-waitlist').doc(normalizedEmail);
    await ref.set({
      _email: normalizedEmail,
      referrer: String(referrer).slice(0, 500),
      confirmed: false,
      confirmToken,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    sendWaitlistConfirm({ to: normalizedEmail, confirmToken }).catch(err =>
      console.error('[signal-waitlist] email error:', err.message)
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('[signal-waitlist] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
