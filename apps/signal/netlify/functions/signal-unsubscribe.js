require('dotenv').config();
const crypto = require('crypto');
const { db, admin } = require('@habitualos/db-core');

function makeUnsubscribeToken(contactId) {
  const secret = process.env.RESEND_API_KEY || 'fallback-secret';
  return crypto.createHmac('sha256', secret).update(contactId).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const { contactId, token } = event.queryStringParameters || {};

  const html = (msg, isError = false) => ({
    statusCode: isError ? 400 : 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signal</title>
      <style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f7ff;}
      .card{background:#fff;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06);}
      p{color:#475569;font-size:0.95rem;line-height:1.6;}</style></head>
      <body><div class="card"><p style="color:#7c3aed;font-weight:700;font-size:1.1rem;margin:0 0 0.75rem;">Signal</p><p>${msg}</p></div></body></html>`,
  });

  if (!contactId || !token) {
    return html('Invalid unsubscribe link.', true);
  }

  const expected = makeUnsubscribeToken(contactId);
  if (token !== expected) {
    return html('Invalid unsubscribe link.', true);
  }

  try {
    await db.collection('signal-contacts').doc(contactId).set(
      { outreachStatus: 'unsubscribed', _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return html("You've been unsubscribed. You won't receive any more messages from Signal.");
  } catch (error) {
    console.error('[signal-unsubscribe] ERROR:', error);
    return html('Something went wrong. Please try again.', true);
  }
};
