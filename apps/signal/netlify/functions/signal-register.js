require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { ensureUserEmail } = require('@habitualos/auth-server');
const { createOwner, signalIdAvailable } = require('./_services/db-signal-owners.cjs');
const { sendVerificationCode } = require('./_services/email.cjs');

const SLUG_RE = /^[a-z0-9-]{3,32}$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST /api/signal-register
 *
 * Body: { userId, email, displayName, signalId }
 *
 * Creates a pending owner record and sends a verification code to email.
 * On re-submit (same email, same signalId), refreshes the code.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, email, displayName, signalId } = JSON.parse(event.body);

    // Validate
    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid email required' }) };
    }
    if (!displayName || displayName.trim().length < 2) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Display name required (min 2 chars)' }) };
    }
    if (!signalId || !SLUG_RE.test(signalId)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Signal ID must be 3–32 lowercase letters, numbers, or hyphens' }) };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check signalId availability
    const available = await signalIdAvailable(signalId);
    if (!available) {
      return { statusCode: 409, body: JSON.stringify({ success: false, error: `Signal ID '${signalId}' is already taken` }) };
    }

    // Upsert user record
    await ensureUserEmail(userId, normalizedEmail);

    // Create pending owner record
    await createOwner(signalId, {
      _userId: userId,
      displayName: displayName.trim(),
      status: 'pending',
      personas: [
        { key: 'recruiter', label: 'Recruiter', opener: "What role are you hiring for? I'll be direct about where I'd be a strong fit and where I wouldn't." },
        { key: 'colleague', label: 'Colleague', opener: "What are you working on? I'd love to find where our work might connect." },
        { key: 'curious', label: 'Just curious', opener: "Happy to give you a real picture of my work and what I'm focused on. What brings you here?" }
      ],
      contextText: ''
    });

    // Store verification code in Firestore (keyed by email)
    const code = generateCode();
    const codeRef = db.collection('signal-auth-codes').doc(normalizedEmail);
    await codeRef.set({
      code,
      userId,
      signalId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send code
    await sendVerificationCode({ to: normalizedEmail, code });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Verification code sent' })
    };

  } catch (error) {
    console.error('[signal-register] ERROR:', error);
    // Surface known errors (e.g. signalId taken)
    if (error.message && error.message.includes('already taken')) {
      return { statusCode: 409, body: JSON.stringify({ success: false, error: error.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
