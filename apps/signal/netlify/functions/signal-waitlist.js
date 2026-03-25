require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

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
    const { email, context = '' } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid email required' }) };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ref = db.collection('signal-waitlist').doc(normalizedEmail);
    await ref.set({
      _email: normalizedEmail,
      context: String(context).slice(0, 500),
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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
